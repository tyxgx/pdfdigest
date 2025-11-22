"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

const backendUrl =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://127.0.0.1:8000";

interface UploadResponse {
  doc_id: string;
  num_chunks: number;
  sample_chunk?: string;
  chunks?: string[];
}

interface QueryResponsePayload {
  answer: string;
  chunks: { text: string; score: number }[];
  full_text?: string;
} 

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function Page() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [docId, setDocId] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [model, setModel] = useState<
    "llama-3.1-8b-instant" | "llama-3.3-70b-versatile"
  >("llama-3.1-8b-instant");
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [typingMessageIndex, setTypingMessageIndex] = useState<number | null>(
    null,
  );
  const [typingText, setTypingText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (typingMessageIndex === null) {
      setTypingText("");
      return;
    }

    const message = messages[typingMessageIndex];
    if (!message || message.role !== "assistant") {
      setTypingMessageIndex(null);
      setTypingText("");
      return;
    }

    setTypingText("");
    let currentIndex = 0;
    const interval = setInterval(() => {
      currentIndex += 1;
      setTypingText(message.content.slice(0, currentIndex));
      if (currentIndex >= message.content.length) {
        clearInterval(interval);
        setTypingMessageIndex(null);
      }
    }, 25);

    return () => clearInterval(interval);
  }, [typingMessageIndex, messages]);

  const generateSummary = async (id: string) => {
    setSummaryLoading(true);
    try {
      const response = await fetch(`${backendUrl}/api/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doc_id: id,
          question:
            "In 1–2 concise sentences, summarize what this PDF is about.",
          model, // 👈 use current model for summary too
        }),
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Failed to summarize document");
      }

      const data: QueryResponsePayload = await response.json();
      const assistantMessage: Message = { role: "assistant", content: data.answer };
      setMessages((prev) => {
        const next = [...prev, assistantMessage];
        setTypingMessageIndex(next.length - 1);
        return next;
      });
    } catch (error) {
      console.error("Unable to summarize document", error);
    } finally {
      setSummaryLoading(false);
    }
  };

  const handleUpload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedFile) {
      setUploadError("Choose a PDF before uploading.");
      return;
    }

    const formData = new FormData();
    formData.append("file", selectedFile);

    setUploading(true);
    setUploadError(null);
    setChatError(null);

    try {
      const response = await fetch(`${backendUrl}/api/upload-pdf`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Upload failed");
      }

      const data: UploadResponse = await response.json();
      setDocId(data.doc_id);
      setSelectedFile(null);
      setMessages([]);
      setQuestion("");
      setTypingMessageIndex(null);
      setTypingText("");
      void generateSummary(data.doc_id);
    } catch (error) {
      setUploadError(
        error instanceof Error ? error.message : "Failed to upload PDF",
      );
      setDocId(null);
    } finally {
      setUploading(false);
    }
  };

  const askQuestion = async (prompt: string) => {
    if (!docId) {
      setChatError("Upload a PDF first.");
      return;
    }

    const trimmed = prompt.trim();
    if (!trimmed) {
      setChatError("Enter a question to continue.");
      return;
    }

    setAsking(true);
    setChatError(null);

    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);

    try {
      const response = await fetch(`${backendUrl}/api/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doc_id: docId,
          question: trimmed,
          model, // 👈 send selected model
        }),
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Failed to fetch answer");
      }

      const data: QueryResponsePayload = await response.json();
      const assistantMessage: Message = { role: "assistant", content: data.answer };
      setMessages((prev) => {
        const next = [...prev, assistantMessage];
        setTypingMessageIndex(next.length - 1);
        return next;
      });
      setQuestion("");
    } catch (error) {
      setChatError(
        error instanceof Error ? error.message : "Unable to fetch an answer",
      );
    } finally {
      setAsking(false);
    }
  };

  const handleAsk = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await askQuestion(question);
  };

  const handleBackToUpload = () => {
    setDocId(null);
    setMessages([]);
    setQuestion("");
    setChatError(null);
    setSummaryLoading(false);
    setTypingMessageIndex(null);
    setTypingText("");
  };

  const heroContainerClasses =
    "mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center justify-center px-4";

  return (
    <div className="min-h-screen bg-neutral-100">
      <div className={heroContainerClasses}>
        {!docId ? (
          <section className="w-full max-w-xl rounded-3xl bg-white/80 p-8 text-center shadow-2xl">
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.4em] text-neutral-400">
                PDF Companion
              </p>
              <h1 className="text-3xl font-semibold text-neutral-900">
                Ask anything about your document
              </h1>
              <p className="text-sm text-neutral-500">
                Upload a PDF and start a gentle conversation with it.
              </p>
            </div>
            <form
              onSubmit={handleUpload}
              className="mt-8 flex flex-col items-center gap-4"
            >
              <label
                htmlFor="pdf-upload"
                className="flex w-full cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-6 py-10 text-sm text-neutral-600 transition hover:border-neutral-400 hover:bg-white"
              >
                <span className="text-lg font-medium text-neutral-800">
                  Upload PDF
                </span>
                <span className="mt-2 text-xs text-neutral-400">
                  Drag & drop or click to browse
                </span>
              </label>
              <input
                id="pdf-upload"
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(event) => {
                  setSelectedFile(event.target.files?.[0] ?? null);
                  setUploadError(null);
                }}
              />
              {selectedFile && (
                <p className="text-xs text-neutral-500">
                  Ready to upload: {selectedFile.name}
                </p>
              )}
              <button
                type="submit"
                disabled={uploading}
                className="w-full rounded-full bg-neutral-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-400"
              >
                {uploading ? "Uploading…" : "Start"}
              </button>
              {uploading && (
                <div className="mt-3 flex w-full flex-col items-center gap-2">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-200">
                    <div className="h-full w-1/3 animate-loading-bar rounded-full bg-neutral-900" />
                  </div>
                  <span className="text-xs uppercase tracking-[0.3em] text-neutral-400">
                    Sending your PDF…
                  </span>
                </div>
              )}
              {uploadError && (
                <div className="w-full rounded-xl bg-red-50 px-4 py-3 text-xs text-red-600">
                  {uploadError}
                </div>
              )}
            </form>
          </section>
        ) : (
          <section className="flex w-full max-w-2xl flex-col rounded-3xl bg-white/90 p-6 text-sm text-neutral-800 shadow-2xl">
            <div className="mb-4 flex items-center gap-3">
              <button
                type="button"
                onClick={handleBackToUpload}
                className="inline-flex items-center rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-medium text-neutral-600 transition hover:border-neutral-400 hover:text-neutral-900"
              >
                <span className="mr-1 text-sm">←</span>
                <span>Back</span>
              </button>
              <div className="flex-1 text-center">
                <h2 className="text-2xl font-semibold text-neutral-900">
                  Chat with your PDF
                </h2>
                <p className="text-xs text-neutral-500">
                  Ask anything—your document is listening.
                </p>
              </div>
            </div>

            {/* Model toggle */}
            <div className="mb-4 flex items-center justify-center gap-2 text-xs text-neutral-500">
              <span className="mr-1">Model:</span>
              <button
                type="button"
                onClick={() => setModel("llama-3.1-8b-instant")}
                className={`rounded-full px-3 py-1 border transition ${
                  model === "llama-3.1-8b-instant"
                    ? "bg-neutral-900 text-white border-neutral-900"
                    : "bg-white text-neutral-700 border-neutral-300 hover:border-neutral-400"
                }`}
              >
                Fast (8B)
              </button>
              <button
                type="button"
                onClick={() => setModel("llama-3.3-70b-versatile")}
                className={`rounded-full px-3 py-1 border transition ${
                  model === "llama-3.3-70b-versatile"
                    ? "bg-neutral-900 text-white border-neutral-900"
                    : "bg-white text-neutral-700 border-neutral-300 hover:border-neutral-400"
                }`}
              >
                Smart (70B)
              </button>
            </div>

            <div className="flex-1">
              <div className="h-[55vh] space-y-4 overflow-y-auto pr-2">
                {summaryLoading && (
                  <div className="flex justify-center text-xs text-neutral-400">
                    Summarizing your document…
                  </div>
                )}
                {messages.length === 0 && !summaryLoading && (
                  <div className="flex h-full items-center justify-center text-neutral-400">
                    Start the conversation when you're ready.
                  </div>
                )}
                {messages.map((message, index) => (
                  <div
                    key={`${message.role}-${index}`}
                    className={`flex w-full ${
                      message.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-3 shadow ${
                        message.role === "user"
                          ? "bg-neutral-900 text-white"
                          : "bg-neutral-100 text-neutral-800"
                      }`}
                    >
                      {message.role === "assistant" &&
                      typingMessageIndex === index
                        ? typingText
                        : message.content}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </div>

            <form onSubmit={handleAsk} className="mt-4 flex items-end gap-3">
              <textarea
                rows={1}
                value={question}
                onChange={(event) => {
                  setQuestion(event.target.value);
                  setChatError(null);
                }}
                placeholder="Ask something sweet about your PDF…"
                className="flex-1 resize-none rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-800 shadow-inner focus:border-neutral-300 focus:outline-none"
                onKeyDown={async (event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    await askQuestion(question);
                  }
                }}
                disabled={asking}
              />
              <button
                type="submit"
                disabled={asking}
                className="self-end rounded-full bg-neutral-900 px-6 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-400"
              >
                {asking ? "Thinking…" : "Ask"}
              </button>
            </form>

            {chatError && (
              <div className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-xs text-red-600">
                {chatError}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
