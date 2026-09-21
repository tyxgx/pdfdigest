import asyncio
import logging
import uuid
from contextlib import asynccontextmanager
from typing import Literal

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from config import get_settings
from ratelimit import RateLimitMiddleware
from services.llm import ALLOWED_MODELS, LLMError, generate_answer
from services.pdf_processing import chunk_pages, extract_pages
from services.vector_store import (
    StoredDocument,
    add_document,
    first_chunks,
    get_document,
    query_document,
)


@asynccontextmanager
async def lifespan(_: FastAPI):
    get_settings()
    yield


logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("pdfdigest")

app = FastAPI(title="PDF Knowledge Base API", lifespan=lifespan)

settings = get_settings()
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://pdfdigest.vercel.app",
    *[o.strip() for o in settings.extra_cors_origins.split(",") if o.strip()],
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.add_middleware(
    RateLimitMiddleware,
    upload_per_min=settings.upload_rate_per_min,
    ask_per_min=settings.ask_rate_per_min,
)


@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok"}


class HistoryTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=4000)


class QueryRequest(BaseModel):
    doc_id: str
    question: str = Field(max_length=2000)
    model: str | None = None
    history: list[HistoryTurn] = Field(default_factory=list, max_length=10)


class SummaryRequest(BaseModel):
    doc_id: str
    model: str | None = None


class Source(BaseModel):
    text: str
    page: int
    score: float


class QueryResponse(BaseModel):
    answer: str
    sources: list[Source]


def _check_model(model: str | None) -> str | None:
    if model and model not in ALLOWED_MODELS:
        raise HTTPException(status_code=400, detail=f"Unsupported model: {model}")
    return model


def _sources(results: list[dict]) -> list[Source]:
    out = []
    for item in results:
        text = item["chunk"]
        out.append(
            Source(
                text=text[:300] + ("..." if len(text) > 300 else ""),
                page=item["page"],
                score=float(item["score"]),
            )
        )
    return out


@app.post("/api/upload-pdf")
async def upload_pdf(file: UploadFile = File(...)) -> dict[str, str | int]:
    name = file.filename or "document.pdf"
    if file.content_type != "application/pdf" and not name.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    limit = settings.max_upload_mb * 1024 * 1024
    content = await file.read(limit + 1)
    if len(content) > limit:
        raise HTTPException(
            status_code=413, detail=f"PDF is larger than {settings.max_upload_mb} MB"
        )
    if not content.startswith(b"%PDF"):
        raise HTTPException(status_code=400, detail="File is not a valid PDF")

    try:
        pages = await asyncio.to_thread(extract_pages, content)
    except Exception as exc:
        raise HTTPException(
            status_code=422, detail=f"Could not read this PDF ({type(exc).__name__})"
        ) from exc

    if len(pages) > settings.max_pages:
        raise HTTPException(
            status_code=413, detail=f"PDF has more than {settings.max_pages} pages"
        )
    chunks = chunk_pages(pages)
    if not chunks:
        raise HTTPException(
            status_code=422,
            detail="No text found in this PDF. Scanned/image-only PDFs are not supported.",
        )

    doc_id = str(uuid.uuid4())
    await add_document(
        doc_id,
        StoredDocument(filename=name, num_pages=len(pages), chunks=chunks),
        max_documents=settings.max_documents,
    )
    return {
        "doc_id": doc_id,
        "filename": name,
        "num_pages": len(pages),
        "num_chunks": len(chunks),
    }


@app.post("/api/summary", response_model=QueryResponse)
async def summarize_document(payload: SummaryRequest) -> QueryResponse:
    _check_model(payload.model)
    results = first_chunks(payload.doc_id)
    if not results:
        raise HTTPException(status_code=404, detail="Document not found. Upload it again.")

    try:
        answer = await generate_answer(
            [r["chunk"] for r in results],
            "In 2-3 concise sentences, summarize what this document is about.",
            model_name=payload.model,
        )
    except LLMError as exc:
        logger.warning("LLM error: %s", exc)
        raise HTTPException(status_code=502, detail=f"LLM error: {exc}") from exc
    return QueryResponse(answer=answer, sources=_sources(results))


@app.post("/api/query", response_model=QueryResponse)
async def query_document_endpoint(payload: QueryRequest) -> QueryResponse:
    if not payload.question.strip():
        raise HTTPException(status_code=400, detail="question is required")
    _check_model(payload.model)
    if get_document(payload.doc_id) is None:
        raise HTTPException(status_code=404, detail="Document not found. Upload it again.")

    # Follow-ups like "give an example of that" carry no keywords of their own,
    # so retrieval also sees the previous user question.
    prior = [t.content for t in payload.history if t.role == "user"]
    retrieval_query = f"{prior[-1]} {payload.question}" if prior else payload.question
    results = await query_document(payload.doc_id, retrieval_query, top_k=5)
    try:
        answer = await generate_answer(
            [r["chunk"] for r in results],
            payload.question,
            model_name=payload.model,
            history=[t.model_dump() for t in payload.history],
        )
    except LLMError as exc:
        logger.warning("LLM error: %s", exc)
        raise HTTPException(status_code=502, detail=f"LLM error: {exc}") from exc
    return QueryResponse(answer=answer, sources=_sources(results))
