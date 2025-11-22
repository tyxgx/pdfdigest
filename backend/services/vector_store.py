from __future__ import annotations

from typing import Any, Dict, List
import math

from services.embeddings import get_embedding, get_embeddings

# Simple in-memory vector store:
# {
#   doc_id: [
#       {"chunk": str, "embedding": list[float]}
#   ]
# }
_STORE: dict[str, list[dict[str, Any]]] = {}


def _cosine_similarity(a: List[float], b: List[float]) -> float:
    """Compute cosine similarity between two embedding vectors."""
    if not a or not b or len(a) != len(b):
        return 0.0

    dot = 0.0
    norm_a = 0.0
    norm_b = 0.0
    for x, y in zip(a, b):
        dot += x * y
        norm_a += x * x
        norm_b += y * y

    denom = math.sqrt(norm_a) * math.sqrt(norm_b)
    if denom == 0:
        return 0.0
    return dot / denom


async def add_document_chunks(doc_id: str, chunks: List[str]) -> None:
    """Store chunks and their embeddings in memory for the given doc_id."""
    if not chunks:
        return

    embeddings = await get_embeddings(chunks)
    items: list[dict[str, Any]] = []
    for chunk, emb in zip(chunks, embeddings):
        items.append(
            {
                "chunk": chunk,
                "embedding": emb,
            }
        )
    _STORE[doc_id] = items


async def query_document(doc_id: str, query: str, top_k: int = 5) -> List[Dict[str, Any]]:
    """Return top_k chunks for a given doc_id most similar to the query."""
    if not query.strip():
        return []

    items = _STORE.get(doc_id)
    if not items:
        return []

    query_emb = await get_embedding(query)

    scored: list[dict[str, Any]] = []
    for item in items:
        emb = item.get("embedding") or []
        score = _cosine_similarity(query_emb, emb)
        scored.append(
            {
                "chunk": item.get("chunk", ""),
                "score": score,
            }
        )

    # Highest score first
    scored.sort(key=lambda x: x["score"], reverse=True)
    return scored[:top_k]