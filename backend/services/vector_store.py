from __future__ import annotations

from typing import Dict, List

# Super simple in-memory "vector store"
# doc_id -> list of text chunks
_DOC_STORE: Dict[str, List[str]] = {}


async def add_document_chunks(doc_id: str, chunks: List[str]) -> None:
    """
    Store the PDF chunks in memory.
    For your use-case (small resume PDFs), this is enough.
    """
    _DOC_STORE[doc_id] = chunks


async def query_document(doc_id: str, query: str, top_k: int = 5) -> List[dict]:
    """
    Naive "semantic-ish" search:
    - Get chunks for this doc_id.
    - Score them by simple keyword overlap with the query.
    - Return top_k chunks with scores + metadata.
    """
    chunks = _DOC_STORE.get(doc_id, [])
    if not chunks:
        return []

    tokens = [w.lower() for w in query.split() if len(w) > 2]

    scored: List[dict] = []
    for idx, chunk in enumerate(chunks):
        text_low = chunk.lower()
        score = 0.0
        for t in tokens:
            score += text_low.count(t)
        scored.append(
            {
                "chunk": chunk,
                "score": float(score),
                "meta": {"doc_id": doc_id, "index": idx},
            }
        )

    scored.sort(key=lambda x: x["score"], reverse=True)
    return scored[:top_k]