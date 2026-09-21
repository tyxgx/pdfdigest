# PDFdigest

Upload a text-based PDF, ask questions, and get answers grounded in the document, with page-cited sources.

- **Backend** (`backend/`, FastAPI + pdfplumber + Groq): page-aware chunking, TF-IDF keyword retrieval over an in-memory store, summary and Q&A endpoints with conversation history.
- **Frontend** (`frontend/`, Next.js + Tailwind): landing page at `/`, app at `/chat`.

Retrieval is keyword-based (no embeddings). Documents live in server memory and are lost on restart. Scanned PDFs are not supported.

## Run locally
```bash
cp .env.example backend/.env   # add GROQ_API_KEY
cd backend && pip install -r requirements.txt && uvicorn main:app --reload
cd frontend && npm install && npm run dev
```

## Tests
```bash
cd backend && pip install pytest reportlab && python -m pytest tests
```
