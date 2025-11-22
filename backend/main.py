import uuid
from typing import Optional
from fastapi.middleware.cors import CORSMiddleware

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from config import get_settings
from services.llm import generate_answer
from services.pdf_processing import chunk_text, extract_text_from_pdf
from services.vector_store import add_document_chunks, query_document

app = FastAPI(title="PDF Knowledge Base API")
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,          # in dev, you can use ["*"] to allow all
    allow_credentials=True,
    allow_methods=["*"],            # allow all HTTP methods
    allow_headers=["*"],            # allow all headers
)


@app.on_event("startup")
async def load_settings() -> None:
    get_settings()


@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok"}


class QueryRequest(BaseModel):
    doc_id: str
    question: str
    model: str | None = None  # optional


class QueryResponse(BaseModel):
    answer: str
    chunks: list[dict[str, str | float]]
    full_text: str


@app.post("/api/upload-pdf")
async def upload_pdf(
    file: UploadFile = File(...),
    doc_id: Optional[str] = Form(None),
) -> dict[str, str | int]:
    if file.content_type not in {"application/pdf"}:
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    content = await file.read()
    final_doc_id = doc_id.strip() if doc_id and doc_id.strip() else str(uuid.uuid4())

    try:
        text = extract_text_from_pdf(content)
        if not text.strip():
            return {"doc_id": final_doc_id, "num_chunks": 0, "sample_chunk": ""}

        chunks = chunk_text(text)
        await add_document_chunks(final_doc_id, chunks)
        sample_chunk = chunks[0] if chunks else ""

        return {
            "doc_id": final_doc_id,
            "num_chunks": len(chunks),
            "sample_chunk": sample_chunk,
        }

    except Exception as exc:  # pragma: no cover - defensive
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to process PDF: {type(exc).__name__}: {exc}",
        )


@app.post("/api/query", response_model=QueryResponse)
async def query_document_endpoint(payload: QueryRequest) -> QueryResponse:
    if not payload.doc_id.strip() or not payload.question.strip():
        raise HTTPException(status_code=400, detail="doc_id and question are required")

    try:
        results = await query_document(payload.doc_id, payload.question, top_k=5)
        context_chunks = [item.get("chunk", "") for item in results]
        answer = await generate_answer(context_chunks, payload.question,model_name=payload.model)

        response_chunks: list[dict[str, str | float]] = []
        for item in results:
            full_text = item.get("chunk", "") or ""
            snippet = full_text[:200]
            if len(full_text) > 200:
                snippet += "..."
            response_chunks.append(
                {
                    "text": snippet,
                    "score": float(item.get("score", 0.0)),
                }
            )

        combined_text = "\n\n".join(context_chunks).strip()
        return QueryResponse(
            answer=answer,
            chunks=response_chunks,
            full_text=combined_text,
        )

    except HTTPException:
        raise
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail="Failed to answer question") from exc
