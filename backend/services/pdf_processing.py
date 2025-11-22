from __future__ import annotations

from io import BytesIO
from typing import List

import pdfplumber


def extract_text_from_pdf(file_bytes: bytes) -> str:
    """Extract text from a PDF represented as bytes."""
    if not file_bytes:
        return ""

    text_parts: List[str] = []
    with pdfplumber.open(BytesIO(file_bytes)) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                text_parts.append(page_text)
    return "\n\n".join(text_parts).strip()


def chunk_text(text: str, chunk_size: int = 800, overlap: int = 150) -> List[str]:
    if not text or text.strip() == "":
        return []

    normalized = text.strip()
    step = max(1, chunk_size - overlap)
    chunks: List[str] = []

    for start in range(0, len(normalized), step):
        end = start + chunk_size
        chunk = normalized[start:end].strip()
        if chunk:
            chunks.append(chunk)
        if end >= len(normalized):
            break

    return chunks
