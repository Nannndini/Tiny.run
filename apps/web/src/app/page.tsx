import Link from "next/link";
"use client";

import { useState } from "react";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type CreatedLink = {
  originalUrl: string;
  shortCode: string;
  shortUrl: string;
};

export default function HomePage() {
  const [url, setUrl] = useState("");
  const [alias, setAlias] = useState("");
  const [createdLink, setCreatedLink] = useState<CreatedLink | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleShorten(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setCreatedLink(null);
    setCopied(false);
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url.trim(),
          ...(alias.trim() ? { alias: alias.trim() } : {}),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ?? "Unable to shorten this URL. Please try again.",
        );
      }

      setCreatedLink(data as CreatedLink);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!createdLink) return;

    try {
      await navigator.clipboard.writeText(createdLink.shortUrl);
      setCopied(true);
    } catch {
      setError("Unable to copy automatically. Please copy the link manually.");
    }
  }

  return (
    <main className="min-h-screen bg-[#faf9f6] px-5 py-8 text-[#22211f] sm:px-8">
      <div className="mx-auto flex max-w-5xl flex-col">
        <header className="flex items-center justify-between border-b border-black/10 pb-6">
          <Link href="/" className="text-xl font-bold tracking-tight">
  Tiny<span className="text-[#b85e42]">.run</span>
</Link>
          <span className="text-sm text-black/55">Simple links. Clear insights.</span>
        </header>

        <section className="mx-auto mt-20 w-full max-w-2xl sm:mt-28">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#b85e42]">
            Your links, made tiny
          </p>

          <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">
            Long URLs.
            <br />
            <span className="text-[#b85e42]">Tiny links.</span>
          </h1>

          <p className="mt-5 max-w-lg leading-7 text-black/65">
            Turn any long URL into a short, shareable link. Add your own
            custom alias and share it anywhere.
          </p>

          <form
            onSubmit={handleShorten}
            className="mt-10 space-y-4 rounded-2xl border border-black/10 bg-white p-5 shadow-sm sm:p-7"
          >
            <div>
              <label htmlFor="url" className="mb-2 block text-sm font-medium">
                Destination URL
              </label>
              <input
                id="url"
                type="url"
                required
                maxLength={2048}
                placeholder="https://example.com/your-long-link"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                className="w-full rounded-xl border border-black/15 bg-[#faf9f6] px-4 py-3 outline-none transition focus:border-[#b85e42] focus:ring-2 focus:ring-[#b85e42]/15"
              />
            </div>

            <div>
              <label htmlFor="alias" className="mb-2 block text-sm font-medium">
                Custom alias <span className="font-normal text-black/45">(optional)</span>
              </label>
              <div className="flex items-center rounded-xl border border-black/15 bg-[#faf9f6] focus-within:border-[#b85e42]">
                <span className="whitespace-nowrap pl-3 text-sm text-black/45 sm:pl-4">
                  localhost:4000/
                </span>
                <input
                  id="alias"
                  type="text"
                  minLength={3}
                  maxLength={32}
                  pattern="[a-zA-Z0-9_-]+"
                  title="Use 3–32 letters, numbers, hyphens, or underscores."
                  placeholder="my-link"
                  value={alias}
                  onChange={(event) => setAlias(event.target.value)}
                  className="min-w-0 flex-1 rounded-r-xl bg-transparent px-2 py-3 outline-none"
                />
              </div>
              <p className="mt-2 text-xs text-black/45">
                Use 3–32 letters, numbers, hyphens, or underscores.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-[#b85e42] px-5 py-3.5 font-semibold text-white transition hover:bg-[#9f4d35] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Creating your link..." : "Shorten URL →"}
            </button>

            {error && (
              <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                {error}
              </p>
            )}

            {createdLink && (
              <div className="rounded-xl border border-green-700/20 bg-green-50 p-4">
                <p className="text-sm font-semibold text-green-800">
                  Your short link is ready!
                </p>
                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <a
                    href={createdLink.shortUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="min-w-0 flex-1 break-all font-medium text-[#9f4d35] underline underline-offset-4"
                  >
                    {createdLink.shortUrl}
                  </a>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="shrink-0 rounded-lg border border-green-800/20 bg-white px-4 py-2 text-sm font-semibold hover:bg-green-100"
                  >
                    {copied ? "Copied!" : "Copy link"}
                  </button>
                </div>
                <p className="mt-3 break-all text-xs text-black/50">
                  Destination: {createdLink.originalUrl}
                </p>
              </div>
            )}
          </form>

          <div className="mt-8 grid grid-cols-3 gap-3 text-center">
            {[
              ["01", "Paste a URL"],
              ["02", "Make it tiny"],
              ["03", "Share it"],
            ].map(([number, label]) => (
              <div key={number} className="rounded-xl border border-black/10 p-4">
                <p className="text-xs font-semibold text-[#b85e42]">{number}</p>
                <p className="mt-1 text-sm text-black/65">{label}</p>
              </div>
            ))}
          </div>
        </section>

        <footer className="mt-20 border-t border-black/10 py-6 text-center text-xs text-black/45">
          Tiny.run · Built for links that go places.
        </footer>
      </div>
    </main>
  );
}
