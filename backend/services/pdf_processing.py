from __future__ import annotations

from io import BytesIO
from typing import List, TypedDict

import pdfplumber


class Chunk(TypedDict):
    text: str
    page: int


def extract_pages(file_bytes: bytes) -> List[str]:
    """Return the text of each page (empty string for pages with no text layer)."""
    if not file_bytes:
        return []

    with pdfplumber.open(BytesIO(file_bytes)) as pdf:
        return [(page.extract_text() or "").strip() for page in pdf.pages]


def chunk_pages(
    pages: List[str], chunk_size: int = 800, overlap: int = 150
) -> List[Chunk]:
    """Sliding-window chunking per page, so every chunk keeps its page number."""
    step = max(1, chunk_size - overlap)
    chunks: List[Chunk] = []

    for page_no, text in enumerate(pages, start=1):
        if not text:
            continue
        for start in range(0, len(text), step):
            end = start + chunk_size
            piece = text[start:end].strip()
            if piece:
                chunks.append({"text": piece, "page": page_no})
            if end >= len(text):
                break

    return chunks
