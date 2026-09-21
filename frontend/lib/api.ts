export const backendUrl =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://127.0.0.1:8000";

export interface UploadResponse {
  doc_id: string;
  filename: string;
  num_pages: number;
  num_chunks: number;
}

export interface Source {
  text: string;
  page: number;
  score: number;
}

export interface AnswerResponse {
  answer: string;
  sources: Source[];
}

export interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
}

export type Model = "openai/gpt-oss-20b" | "openai/gpt-oss-120b";

/** Turn a failed response into a readable message (FastAPI sends {detail}). */
export async function errorMessage(response: Response): Promise<string> {
  try {
    const body = await response.json();
    if (typeof body?.detail === "string") return body.detail;
  } catch {
    // fall through
  }
  return `Request failed (${response.status})`;
}

async function post<T>(path: string, init: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${backendUrl}${path}`, { method: "POST", ...init });
  } catch {
    throw new Error(
      "Can't reach the server. It may be waking up (free tier), try again in a few seconds.",
    );
  }
  if (!response.ok) throw new Error(await errorMessage(response));
  return response.json();
}

export function uploadPdf(file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append("file", file);
  return post("/api/upload-pdf", { body: formData });
}

const json = (body: unknown): RequestInit => ({
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export function summarize(docId: string, model: Model): Promise<AnswerResponse> {
  return post("/api/summary", json({ doc_id: docId, model }));
}

export function ask(
  docId: string,
  question: string,
  model: Model,
  history: Message[],
): Promise<AnswerResponse> {
  return post(
    "/api/query",
    json({
      doc_id: docId,
      question,
      model,
      history: history.map(({ role, content }) => ({ role, content })),
    }),
  );
}
