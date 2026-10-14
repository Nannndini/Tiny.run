"use client";

import { useCallback, useEffect, useState } from "react";

const API_URL = "http://localhost:4000";

type LinkItem = {
  id: string;
  originalUrl: string;
  shortCode: string;
  shortUrl: string;
  createdAt: string;
  expiresAt: string | null;
  totalClicks: number;
};

type ClickItem = {
  clickedAt: string;
  referrer: string | null;
  userAgent: string | null;
};

type Analytics = {
  shortCode: string;
  originalUrl: string;
  totalClicks: number;
  recentClicks: ClickItem[];
};

type LinkResponse = {
  links: LinkItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export default function LinkDashboard() {
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<LinkItem | null>(null);
  const [editUrl, setEditUrl] = useState("");
  const [editExpiry, setEditExpiry] = useState("");
  const [saving, setSaving] = useState(false);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const loadLinks = useCallback(async (requestedPage: number) => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `${API_URL}/links?page=${requestedPage}&limit=10`,
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to load links.");
      }

      const result = data as LinkResponse;
      setLinks(result.links);
      setPage(result.pagination.page);
      setTotal(result.pagination.total);
      setTotalPages(result.pagination.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load links.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLinks(1);
  }, [loadLinks]);

  async function copyLink(shortUrl: string) {
    try {
      await navigator.clipboard.writeText(shortUrl);
      setNotice("Short link copied!");
    } catch {
      setNotice("Copy failed. Please copy the link manually.");
    }
  }

  function openEditor(link: LinkItem) {
    setEditing(link);
    setEditUrl(link.originalUrl);
    setEditExpiry(
      link.expiresAt
        ? new Date(link.expiresAt).toISOString().slice(0, 10)
        : "",
    );
    setError("");
    setNotice("");
  }

  async function saveEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch(
        `${API_URL}/links/${encodeURIComponent(editing.shortCode)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: editUrl.trim(),
            expiresAt: editExpiry
              ? new Date(`${editExpiry}T23:59:59.000Z`).toISOString()
              : null,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to update link.");
      }

      setEditing(null);
      setNotice("Link updated successfully.");
      await loadLinks(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update link.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteLink(link: LinkItem) {
    const confirmed = window.confirm(
      `Delete "${link.shortCode}"? Its click history will also be deleted.`,
    );

    if (!confirmed) return;

    setError("");
    setNotice("");

    try {
      const response = await fetch(
        `${API_URL}/links/${encodeURIComponent(link.shortCode)}`,
        { method: "DELETE" },
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to delete link.");
      }

      setNotice("Link deleted successfully.");
      setAnalytics((current) =>
        current?.shortCode === link.shortCode ? null : current,
      );

      const nextPage = links.length === 1 && page > 1 ? page - 1 : page;
      await loadLinks(nextPage);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete link.");
    }
  }

  async function showAnalytics(link: LinkItem) {
    setAnalytics(null);
    setAnalyticsLoading(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch(
        `${API_URL}/links/${encodeURIComponent(link.shortCode)}/analytics`,
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to load analytics.");
      }

      setAnalytics(data as Analytics);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load analytics.");
    } finally {
      setAnalyticsLoading(false);
    }
  }

  return (
    <section id="dashboard" className="mt-20 border-t border-black/10 pt-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rust">
            Link management
          </p>
          <h2 className="mt-2 font-display text-3xl sm:text-4xl">
            Your links, at a glance.
          </h2>
          <p className="mt-2 text-sm text-black/55">
            Manage destinations, expiry dates, and click activity.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadLinks(page)}
          disabled={loading}
          className="rounded-xl border border-black/15 px-4 py-2 text-sm hover:bg-white disabled:opacity-50"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className="mt-7 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-black/10 bg-white p-5">
          <p className="text-sm text-black/55">Total links</p>
          <p className="mt-2 text-3xl font-semibold">{total}</p>
        </div>
        <div className="rounded-2xl border border-black/10 bg-white p-5">
          <p className="text-sm text-black/55">Clicks on this page</p>
          <p className="mt-2 text-3xl font-semibold">
            {links.reduce((sum, link) => sum + link.totalClicks, 0)}
          </p>
          <p className="mt-1 text-xs text-black/45">
            Total clicks for the currently loaded links.
          </p>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">
          {error}
        </p>
      )}

      {notice && (
        <p role="status" className="mt-5 rounded-xl bg-green-50 p-4 text-sm text-green-800">
          {notice}
        </p>
      )}

      {editing && (
        <form
          onSubmit={saveEdit}
          className="mt-6 space-y-4 rounded-2xl border border-rust/30 bg-white p-5"
        >
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold">Edit link: {editing.shortCode}</h3>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="text-sm text-black/55 hover:text-black"
            >
              Cancel
            </button>
          </div>

          <div>
            <label htmlFor="edit-url" className="mb-2 block text-sm font-medium">
              Destination URL
            </label>
            <input
              id="edit-url"
              type="url"
              required
              maxLength={2048}
              value={editUrl}
              onChange={(event) => setEditUrl(event.target.value)}
              className="w-full rounded-xl border border-black/15 bg-paper px-4 py-3 outline-none focus:border-rust"
            />
          </div>

          <div>
            <label htmlFor="edit-expiry" className="mb-2 block text-sm font-medium">
              Expiration date (optional)
            </label>
            <input
              id="edit-expiry"
              type="date"
              value={editExpiry}
              onChange={(event) => setEditExpiry(event.target.value)}
              className="w-full rounded-xl border border-black/15 bg-paper px-4 py-3 outline-none focus:border-rust"
            />
            <p className="mt-1 text-xs text-black/50">
              Leave blank to remove the expiration date.
            </p>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-rust px-5 py-3 font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
        </form>
      )}

      <div className="mt-6 overflow-hidden rounded-2xl border border-black/10 bg-white">
        {loading ? (
          <p className="p-8 text-center text-sm text-black/55">
            Loading your links...
          </p>
        ) : links.length === 0 ? (
          <p className="p-8 text-center text-sm text-black/55">
            No links yet. Create your first short link above.
          </p>
        ) : (
          <div className="divide-y divide-black/10">
            {links.map((link) => (
              <article key={link.id} className="p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <a
                      href={link.shortUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="break-all font-semibold text-rust underline-offset-4 hover:underline"
                    >
                      {link.shortUrl}
                    </a>
                    <p className="mt-2 break-all text-sm text-black/65">
                      {link.originalUrl}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-black/45">
                      <span>
                        Created {new Date(link.createdAt).toLocaleDateString()}
                      </span>
                      <span>
                        {link.expiresAt
                          ? `Expires ${new Date(link.expiresAt).toLocaleDateString()}`
                          : "No expiry"}
                      </span>
                    </div>
                  </div>

                  <div className="shrink-0 rounded-xl bg-paper px-4 py-3 text-center">
                    <p className="text-2xl font-semibold">{link.totalClicks}</p>
                    <p className="text-xs text-black/55">clicks</p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void copyLink(link.shortUrl)}
                    className="rounded-lg border border-black/15 px-3 py-2 text-sm hover:bg-paper"
                  >
                    Copy link
                  </button>
                  <button
                    type="button"
                    onClick={() => openEditor(link)}
                    className="rounded-lg border border-black/15 px-3 py-2 text-sm hover:bg-paper"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => void showAnalytics(link)}
                    className="rounded-lg border border-black/15 px-3 py-2 text-sm hover:bg-paper"
                  >
                    Analytics
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteLink(link)}
                    className="rounded-lg border border-red-700/20 px-3 py-2 text-sm text-red-700 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-black/55">
          Page {page} of {Math.max(totalPages, 1)} - {total} links
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => void loadLinks(page - 1)}
            className="rounded-lg border border-black/15 px-4 py-2 text-sm hover:bg-white disabled:opacity-40"
          >
            Previous
          </button>
          <button
            type="button"
            disabled={page >= totalPages || loading}
            onClick={() => void loadLinks(page + 1)}
            className="rounded-lg border border-black/15 px-4 py-2 text-sm hover:bg-white disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>

      {analyticsLoading && (
        <p className="mt-6 rounded-xl border border-black/10 bg-white p-5 text-sm text-black/55">
          Loading analytics...
        </p>
      )}

      {analytics && (
        <div className="mt-6 rounded-2xl border border-black/10 bg-white p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-rust">
                Recent activity
              </p>
              <h3 className="mt-2 text-xl font-semibold">
                Analytics - {analytics.shortCode}
              </h3>
              <p className="mt-1 text-sm text-black/55">
                {analytics.totalClicks} total clicks
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAnalytics(null)}
              className="text-sm text-black/55 hover:text-black"
            >
              Close
            </button>
          </div>

          {analytics.recentClicks.length === 0 ? (
            <p className="mt-5 text-sm text-black/55">
              No clicks recorded yet.
            </p>
          ) : (
            <div className="mt-5 divide-y divide-black/10">
              {analytics.recentClicks.map((click, index) => (
                <div key={`${click.clickedAt}-${index}`} className="py-4">
                  <p className="text-sm font-medium">
                    {new Date(click.clickedAt).toLocaleString()}
                  </p>
                  <p className="mt-1 break-all text-xs text-black/55">
                    Referrer: {click.referrer || "Direct / unknown"}
                  </p>
                  <p className="mt-1 break-all text-xs text-black/45">
                    Device: {click.userAgent || "Unknown"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
