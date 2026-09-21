"use client";

import Link from "next/link";
import { DragEvent, FormEvent, useEffect, useRef, useState } from "react";
import {
  ask,
  Message,
  Model,
  summarize,
  UploadResponse,
  uploadPdf,
} from "../../lib/api";

const SUGGESTIONS = [
  "What are the key points?",
  "List any dates or deadlines mentioned",
  "What are the main conclusions?",
];

export default function ChatPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [doc, setDoc] = useState<UploadResponse | null>(null);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [model, setModel] = useState<Model>("openai/gpt-oss-20b");
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [typing, setTyping] = useState<{ index: number; shown: number } | null>(
    null,
  );
  const [openSources, setOpenSources] = useState<number | null>(null);
  const [copied, setCopied] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  // Reveal only the newest assistant message, a few characters at a time.
  const typingIndex = typing?.index ?? null;
  useEffect(() => {
    if (typingIndex === null) return;
    const interval = setInterval(() => {
      setTyping((current) => {
        if (!current) return null;
        const length = messages[current.index]?.content.length ?? 0;
        return current.shown + 4 >= length
          ? null
          : { ...current, shown: current.shown + 4 };
      });
    }, 15);
    return () => clearInterval(interval);
  }, [typingIndex, messages]);

  const addAssistantMessage = (message: Message) => {
    setMessages((prev) => {
      setTyping({ index: prev.length, shown: 0 });
      return [...prev, message];
    });
  };

  const pickFile = (file: File | null | undefined) => {
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setUploadError("Only PDF files are supported.");
      return;
    }
    setSelectedFile(file);
    setUploadError(null);
  };

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragging(false);
    pickFile(event.dataTransfer.files?.[0]);
  };

  const handleUpload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedFile) {
      setUploadError("Choose a PDF before uploading.");
      return;
    }

    setUploading(true);
    setUploadError(null);
    setChatError(null);

    try {
      const uploaded = await uploadPdf(selectedFile);
      setDoc(uploaded);
      setSelectedFile(null);
      setMessages([]);
      setQuestion("");
      setTyping(null);
      setOpenSources(null);
      void generateSummary(uploaded.doc_id);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Failed to upload PDF");
      setDoc(null);
    } finally {
      setUploading(false);
    }
  };

  const generateSummary = async (docId: string) => {
    setSummaryLoading(true);
    try {
      const data = await summarize(docId, model);
      addAssistantMessage({
        role: "assistant",
        content: data.answer,
        sources: data.sources,
      });
    } catch (error) {
      setChatError(
        error instanceof Error ? error.message : "Couldn't summarize the document",
      );
    } finally {
      setSummaryLoading(false);
    }
  };

  const askQuestion = async (prompt: string) => {
    if (!doc) return;
    const trimmed = prompt.trim();
    if (!trimmed) {
      setChatError("Enter a question to continue.");
      return;
    }

    const history = messages;
    setAsking(true);
    setChatError(null);
    setQuestion("");
    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);

    try {
      const data = await ask(doc.doc_id, trimmed, model, history);
      addAssistantMessage({
        role: "assistant",
        content: data.answer,
        sources: data.sources,
      });
    } catch (error) {
      setChatError(error instanceof Error ? error.message : "Unable to fetch an answer");
      setQuestion(trimmed);
    } finally {
      setAsking(false);
    }
  };

  const copyMessage = async (index: number) => {
    try {
      await navigator.clipboard.writeText(messages[index].content);
      setCopied(index);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      setChatError("Couldn't copy to the clipboard.");
    }
  };

  const exportChat = () => {
    if (!doc) return;
    const text =
      `PDFdigest chat: ${doc.filename}\n\n` +
      messages
        .map((m) => `${m.role === "user" ? "You" : "PDFdigest"}: ${m.content}`)
        .join("\n\n");
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${doc.filename.replace(/\.pdf$/i, "")}-chat.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleNewDocument = () => {
    setDoc(null);
    setMessages([]);
    setQuestion("");
    setChatError(null);
    setSummaryLoading(false);
    setTyping(null);
    setOpenSources(null);
  };

  const modelButton = (value: Model, label: string) => (
    <button
      type="button"
      onClick={() => setModel(value)}
      className={`rounded-full border px-3 py-1 transition ${
        model === value
          ? "border-neutral-900 bg-neutral-900 text-white"
          : "border-neutral-300 bg-white text-neutral-700 hover:border-neutral-400"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-neutral-100">
      <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center justify-center px-4 py-8">
        {!doc ? (
          <section className="w-full max-w-xl rounded-3xl bg-white/80 p-8 text-center shadow-2xl">
            <Link href="/" className="text-xs text-neutral-400 hover:text-neutral-700">
              ← Home
            </Link>
            <div className="mt-3 space-y-3">
              <h1 className="text-3xl font-semibold text-neutral-900">
                Ask anything about your document
              </h1>
              <p className="text-sm text-neutral-500">
                Upload a PDF (up to 10 MB) and start a conversation with it.
              </p>
            </div>
            <form onSubmit={handleUpload} className="mt-8 flex flex-col items-center gap-4">
              <label
                htmlFor="pdf-upload"
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                className={`flex w-full cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-10 text-sm text-neutral-600 transition ${
                  dragging
                    ? "border-neutral-900 bg-white"
                    : "border-neutral-300 bg-neutral-50 hover:border-neutral-400 hover:bg-white"
                }`}
              >
                <span className="text-lg font-medium text-neutral-800">Upload PDF</span>
                <span className="mt-2 text-xs text-neutral-400">
                  Drag & drop or click to browse
                </span>
              </label>
              <input
                id="pdf-upload"
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(event) => pickFile(event.target.files?.[0])}
              />
              {selectedFile && (
                <p className="text-xs text-neutral-500">
                  Ready to upload: {selectedFile.name} (
                  {(selectedFile.size / 1024 / 1024).toFixed(1)} MB)
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
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-200">
                  <div className="h-full w-1/3 animate-loading-bar rounded-full bg-neutral-900" />
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
                onClick={handleNewDocument}
                className="inline-flex items-center rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-medium text-neutral-600 transition hover:border-neutral-400 hover:text-neutral-900"
              >
                ← New PDF
              </button>
              <div className="min-w-0 flex-1 text-center">
                <h2 className="truncate text-lg font-semibold text-neutral-900">
                  {doc.filename}
                </h2>
                <p className="text-xs text-neutral-500">
                  {doc.num_pages} pages · {doc.num_chunks} passages indexed
                </p>
              </div>
              <button
                type="button"
                onClick={exportChat}
                disabled={messages.length === 0}
                className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-medium text-neutral-600 transition hover:border-neutral-400 hover:text-neutral-900 disabled:opacity-40"
              >
                Export
              </button>
            </div>

            <div className="mb-4 flex items-center justify-center gap-2 text-xs text-neutral-500">
              <span className="mr-1">Model:</span>
              {modelButton("openai/gpt-oss-20b", "Fast (20B)")}
              {modelButton("openai/gpt-oss-120b", "Smart (120B)")}
            </div>

            <div className="h-[50vh] space-y-4 overflow-y-auto pr-2">
              {summaryLoading && (
                <div className="flex justify-center text-xs text-neutral-400">
                  Summarizing your document…
                </div>
              )}
              {messages.length === 0 && !summaryLoading && (
                <div className="flex h-full items-center justify-center text-neutral-400">
                  Ask a question below to get started.
                </div>
              )}
              {messages.map((message, index) => {
                const isUser = message.role === "user";
                const isTyping = typing?.index === index;
                return (
                  <div
                    key={`${message.role}-${index}`}
                    className={`flex w-full flex-col ${isUser ? "items-end" : "items-start"}`}
                  >
                    <div
                      className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 shadow ${
                        isUser ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-800"
                      }`}
                    >
                      {isTyping ? message.content.slice(0, typing.shown) : message.content}
                    </div>
                    {!isUser && !isTyping && (
                      <div className="mt-1 flex items-center gap-3 text-xs text-neutral-400">
                        <button
                          type="button"
                          onClick={() => copyMessage(index)}
                          className="hover:text-neutral-700"
                        >
                          {copied === index ? "Copied" : "Copy"}
                        </button>
                        {message.sources && message.sources.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setOpenSources(openSources === index ? null : index)}
                            className="hover:text-neutral-700"
                          >
                            {openSources === index ? "Hide" : "Show"} sources (
                            {message.sources.length})
                          </button>
                        )}
                      </div>
                    )}
                    {openSources === index && message.sources && (
                      <ul className="mt-2 max-w-[85%] space-y-2 text-xs text-neutral-600">
                        {message.sources.map((source, i) => (
                          <li key={i} className="rounded-xl border border-neutral-200 bg-white p-3">
                            <span className="font-medium text-neutral-800">
                              Page {source.page}
                            </span>
                            <p className="mt-1 whitespace-pre-wrap">{source.text}</p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
              {asking && (
                <div className="text-xs text-neutral-400">Thinking…</div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {messages.length <= 1 && !asking && (
              <div className="mt-3 flex flex-wrap gap-2">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => askQuestion(suggestion)}
                    className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs text-neutral-600 transition hover:border-neutral-400"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}

            <form
              onSubmit={(event) => {
                event.preventDefault();
                void askQuestion(question);
              }}
              className="mt-4 flex items-end gap-3"
            >
              <textarea
                rows={1}
                value={question}
                onChange={(event) => {
                  setQuestion(event.target.value);
                  setChatError(null);
                }}
                placeholder="Ask something about your PDF…"
                className="flex-1 resize-none rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-800 shadow-inner focus:border-neutral-300 focus:outline-none"
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    if (!asking) void askQuestion(question);
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
