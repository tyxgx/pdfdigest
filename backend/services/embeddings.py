from __future__ import annotations

from functools import lru_cache
from typing import List

from sentence_transformers import SentenceTransformer

# Light, popular, CPU-friendly embedding model
MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"


@lru_cache(maxsize=1)
def get_model() -> SentenceTransformer:
    """
    Load the sentence-transformers model once and cache it.

    This runs locally – no external API, no cost.
    """
    return SentenceTransformer(MODEL_NAME)


async def get_embedding(text: str) -> List[float]:
    """
    Return a single embedding vector for given text.
    Kept async so existing code (await ...) still works.
    """
    if not text.strip():
        raise ValueError("Text must be non-empty to compute embeddings")

    model = get_model()
    vector = model.encode(text, normalize_embeddings=True)
    return vector.tolist()


async def get_embeddings(texts: List[str]) -> List[List[float]]:
    """
    Batch embeddings for a list of texts.
    """
    if not texts:
        return []

    model = get_model()
    vectors = model.encode(texts, normalize_embeddings=True)
    # sentence-transformers returns a numpy array
    return [v.tolist() for v in vectors]