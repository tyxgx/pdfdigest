from __future__ import annotations

import math
import re
from collections import OrderedDict
from dataclasses import dataclass
from typing import Dict, List

from services.pdf_processing import Chunk

# Keyword retrieval (TF-IDF style) over in-memory chunks. There are no embeddings.
_STOPWORDS = frozenset(
    """a an and are as at be but by can did do does for from had has have he her his
    how i if in into is it its me my of on or our she so than that the their them then
    there these they this to was we were what when where which who whom why will with
    would you your about tell please""".split()
)
_TOKEN_RE = re.compile(r"[a-z0-9]+")


@dataclass
class StoredDocument:
    filename: str
    num_pages: int
    chunks: List[Chunk]


# doc_id -> document; ordered so the oldest can be evicted.
_DOC_STORE: "OrderedDict[str, StoredDocument]" = OrderedDict()


def _tokens(text: str) -> List[str]:
    return [t for t in _TOKEN_RE.findall(text.lower()) if len(t) > 2 and t not in _STOPWORDS]


async def add_document(
    doc_id: str, doc: StoredDocument, max_documents: int = 50
) -> None:
    _DOC_STORE[doc_id] = doc
    _DOC_STORE.move_to_end(doc_id)
    while len(_DOC_STORE) > max_documents:
        _DOC_STORE.popitem(last=False)


def get_document(doc_id: str) -> StoredDocument | None:
    return _DOC_STORE.get(doc_id)


def first_chunks(doc_id: str, n: int = 6) -> List[dict]:
    doc = _DOC_STORE.get(doc_id)
    if not doc:
        return []
    return [
        {"chunk": c["text"], "page": c["page"], "score": 0.0} for c in doc.chunks[:n]
    ]


async def query_document(doc_id: str, query: str, top_k: int = 5) -> List[dict]:
    """Rank chunks by IDF-weighted keyword overlap with the query."""
    doc = _DOC_STORE.get(doc_id)
    if not doc:
        return []

    query_terms = set(_tokens(query))
    if not query_terms:
        return []

    chunk_tokens = [_tokens(c["text"]) for c in doc.chunks]
    n = len(chunk_tokens)
    doc_freq = {t: sum(1 for toks in chunk_tokens if t in toks) for t in query_terms}

    scored: List[dict] = []
    for chunk, toks in zip(doc.chunks, chunk_tokens):
        score = 0.0
        for term in query_terms:
            tf = toks.count(term)
            if tf:
                idf = math.log(1 + n / doc_freq[term])
                score += (1 + math.log(tf)) * idf
        if score > 0:
            scored.append(
                {"chunk": chunk["text"], "page": chunk["page"], "score": round(score, 3)}
            )

    scored.sort(key=lambda x: x["score"], reverse=True)
    return scored[:top_k]
