import Link from "next/link";

const FEATURES = [
  {
    title: "Cited answers",
    body: "Every answer comes with the exact passages and page numbers it was drawn from, so you can check it.",
  },
  {
    title: "Follow-up questions",
    body: "The conversation is remembered, so you can ask “and what about the second one?” naturally.",
  },
  {
    title: "Instant summary",
    body: "Upload a PDF and get a short summary before you type a single question.",
  },
  {
    title: "Choose your model",
    body: "Switch between a fast 20B model and a smarter 120B model on the fly.",
  },
  {
    title: "Export the chat",
    body: "Download the whole conversation as a text file when you're done.",
  },
  {
    title: "Drag & drop",
    body: "Drop a PDF straight onto the page. Files up to 10 MB are supported.",
  },
];

const STEPS = [
  ["Upload", "Drop in a text-based PDF. It's split into passages, page by page."],
  ["Ask", "Type a question. The most relevant passages are found by keyword matching."],
  ["Verify", "Read the answer, then open its sources to see where it came from."],
];

export default function Home() {
  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-900">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <span className="text-lg font-semibold">PDFdigest</span>
        <Link
          href="/chat"
          className="rounded-full bg-neutral-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800"
        >
          Open app
        </Link>
      </header>

      <main className="mx-auto max-w-5xl px-6">
        <section className="py-20 text-center sm:py-28">
          <h1 className="mx-auto max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">
            Ask your PDF anything.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base text-neutral-500 sm:text-lg">
            Upload a document, ask questions in plain language, and get answers
            grounded in the text, with sources you can check.
          </p>
          <Link
            href="/chat"
            className="mt-10 inline-block rounded-full bg-neutral-900 px-8 py-3 text-sm font-semibold text-white transition hover:bg-neutral-800"
          >
            Upload a PDF
          </Link>
        </section>

        <section aria-labelledby="how" className="pb-20">
          <h2 id="how" className="text-center text-sm uppercase tracking-[0.3em] text-neutral-400">
            How it works
          </h2>
          <ol className="mt-8 grid gap-4 sm:grid-cols-3">
            {STEPS.map(([title, body], i) => (
              <li key={title} className="rounded-2xl bg-white p-6 shadow">
                <span className="text-xs text-neutral-400">Step {i + 1}</span>
                <h3 className="mt-1 text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-sm text-neutral-500">{body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="features" className="pb-20">
          <h2 id="features" className="text-center text-sm uppercase tracking-[0.3em] text-neutral-400">
            Features
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="rounded-2xl bg-white p-6 shadow">
                <h3 className="font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm text-neutral-500">{feature.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="limits" className="pb-24">
          <div className="rounded-2xl border border-neutral-200 bg-white/60 p-6 text-sm text-neutral-600">
            <h2 id="limits" className="font-semibold text-neutral-900">
              Good to know
            </h2>
            <ul className="mt-3 list-disc space-y-1 pl-5">
              <li>Works with text-based PDFs. Scanned or image-only PDFs aren&apos;t supported.</li>
              <li>Passages are found by keyword matching, not semantic search, so use words that appear in the document.</li>
              <li>Documents are kept in server memory only and disappear when the server restarts.</li>
              <li>The server runs on a free tier, so the first request can take up to a minute.</li>
            </ul>
          </div>
        </section>
      </main>

      <footer className="border-t border-neutral-200 py-6 text-center text-xs text-neutral-400">
        PDFdigest
      </footer>
    </div>
  );
}
