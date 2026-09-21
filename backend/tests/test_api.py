import io
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from reportlab.pdfgen import canvas

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import main  # noqa: E402
from services import llm  # noqa: E402


def make_pdf(pages: list[str]) -> bytes:
    buf = io.BytesIO()
    c = canvas.Canvas(buf)
    for text in pages:
        c.drawString(72, 720, text)
        c.showPage()
    c.save()
    return buf.getvalue()


@pytest.fixture
def client(monkeypatch):
    async def fake_answer(chunks, question, model_name=None, history=None):
        return f"ANSWER({len(chunks)} chunks, {len(history or [])} history)"

    monkeypatch.setattr(main, "generate_answer", fake_answer)
    return TestClient(main.app)


def upload(client, pages, name="doc.pdf"):
    return client.post(
        "/api/upload-pdf", files={"file": (name, make_pdf(pages), "application/pdf")}
    )


def test_upload_query_roundtrip(client):
    res = upload(client, ["Python developer skilled in FastAPI", "Hobbies: chess and cycling"])
    assert res.status_code == 200
    body = res.json()
    assert body["num_pages"] == 2 and body["filename"] == "doc.pdf"

    q = client.post(
        "/api/query",
        json={
            "doc_id": body["doc_id"],
            "question": "What are the hobbies?",
            "history": [{"role": "user", "content": "hi"}],
        },
    )
    assert q.status_code == 200
    data = q.json()
    assert data["answer"] == "ANSWER(1 chunks, 1 history)"
    assert data["sources"][0]["page"] == 2


def test_summary_uses_first_chunks(client):
    doc_id = upload(client, ["Quarterly report"]).json()["doc_id"]
    res = client.post("/api/summary", json={"doc_id": doc_id})
    assert res.status_code == 200 and res.json()["sources"][0]["page"] == 1


def test_rejects_non_pdf_and_fake_pdf(client):
    r = client.post("/api/upload-pdf", files={"file": ("a.txt", b"hello", "text/plain")})
    assert r.status_code == 400
    r = client.post("/api/upload-pdf", files={"file": ("a.pdf", b"hello", "application/pdf")})
    assert r.status_code == 400


def test_empty_text_pdf_is_422(client):
    assert upload(client, [""]).status_code == 422


def test_unknown_doc_and_bad_model(client):
    r = client.post("/api/query", json={"doc_id": "nope", "question": "x"})
    assert r.status_code == 404
    doc_id = upload(client, ["hello world"]).json()["doc_id"]
    r = client.post("/api/query", json={"doc_id": doc_id, "question": "hello", "model": "evil/model"})
    assert r.status_code == 400


def test_llm_failure_is_502(client, monkeypatch):
    async def boom(*a, **k):
        raise llm.LLMError("no key")

    monkeypatch.setattr(main, "generate_answer", boom)
    doc_id = upload(client, ["hello world"]).json()["doc_id"]
    r = client.post("/api/query", json={"doc_id": doc_id, "question": "hello"})
    assert r.status_code == 502


def test_too_large(client, monkeypatch):
    monkeypatch.setattr(main.settings, "max_upload_mb", 0)
    assert upload(client, ["hello"]).status_code == 413
