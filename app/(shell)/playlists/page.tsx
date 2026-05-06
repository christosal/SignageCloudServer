"use client";

import { createPlaylist, deletePlaylist, formatUpdatedAt, listPlaylists } from "@/lib/services/playlists";
import type { PlaylistDoc } from "@/lib/types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function PlaylistsPage() {
  const [items, setItems] = useState<PlaylistDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function refresh() {
    setErr(null);
    setItems(await listPlaylists());
  }

  useEffect(() => {
    let c = false;
    refresh()
      .catch((e: unknown) => { if (!c) setErr(e instanceof Error ? e.message : "Failed"); })
      .finally(() => { if (!c) setLoading(false); });
    return () => { c = true; };
  }, []);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const id = await createPlaylist(title.trim() || "New playlist", true);
      setTitle("");
      router.push(`/playlists/${id}`);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: string, label: string) {
    if (!confirm(`Delete playlist "${label}"?`)) return;
    setErr(null);
    try { await deletePlaylist(id); await refresh(); }
    catch (e: unknown) { setErr(e instanceof Error ? e.message : "Delete failed"); }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Playlists</h1>
          <p className="mt-1 text-slate-500">Build media loops for your trains</p>
        </div>
      </div>

      {err && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</p>
      )}

      {/* Create */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">New playlist</h2>
        <form onSubmit={onCreate} className="mt-4 flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <label className="block text-sm font-medium text-slate-700">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Main loop summer"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-900 disabled:bg-slate-400"
          >
            {busy ? "Creating…" : "Create & edit"}
          </button>
        </form>
      </div>

      {/* List */}
      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">
          No playlists yet. Create one above.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm"
            >
              <div className="min-w-0">
                <Link
                  href={`/playlists/${p.id}`}
                  className="text-sm font-semibold text-slate-900 hover:text-brand-700"
                >
                  {p.title}
                </Link>
                <p className="mt-0.5 text-xs text-slate-500">
                  {p.items?.length ?? 0} item{(p.items?.length ?? 0) !== 1 ? "s" : ""}
                  {" · "}
                  {p.loop ? "Loops" : "No loop"}
                  {" · "}
                  Updated {formatUpdatedAt(p.updatedAt)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <Link
                  href={`/playlists/${p.id}`}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Edit
                </Link>
                <button
                  type="button"
                  onClick={() => void onDelete(p.id, p.title)}
                  className="text-xs font-medium text-slate-400 hover:text-red-600"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
