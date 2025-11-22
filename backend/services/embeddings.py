from __future__ import annotations

from functools import lru_cache
from typing import Iterable, List

from groq import Groq

from config import get_settings

settings = get_settings()


@lru_cache
def get_groq_client() -> Groq:
    if not settings.groq_api_key:
        raise RuntimeError("GROQ_API_KEY is not set in environment")
    return Groq(api_key=settings.groq_api_key)


EMBEDDING_MODEL = "gpt-oss-20b"  # or another Groq embedding-capable model


def get_embedding(text: str) -> List[float]:
    """
    Return a single embedding vector for one piece of text using Groq.
    """
    text = text.strip()
    if not text:
        return []

    client = get_groq_client()

    # Groq Python client uses .embeddings.create(...)
    resp = client.embeddings.create(
        model=EMBEDDING_MODEL,
        input=text,
    )

    # shape: data[0].embedding -> List[float]
    return resp.data[0].embedding  # type: ignore[no-any-return]


def get_embeddings(texts: Iterable[str]) -> List[List[float]]:
    """
    Batch version – takes an iterable of strings and returns one embedding list per string.
    """
    cleaned = [t.strip() for t in texts]
    if not cleaned:
        return []

    client = get_groq_client()

    resp = client.embeddings.create(
        model=EMBEDDING_MODEL,
        input=cleaned,
    )

    return [item.embedding for item in resp.data]  # type: ignore[no-any-return]