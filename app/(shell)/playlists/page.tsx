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
    (async () => {
      try {
        await refresh();
      } catch (e: unknown) {
        if (!c) setErr(e instanceof Error ? e.message : "Failed");
      } finally {
        if (!c) setLoading(false);
      }
    })();
    return () => {
      c = true;
    };
  }, []);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const id = await createPlaylist(title || "New playlist", true);
      setTitle("");
      await refresh();
      router.push(`/playlists/${id}`);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: string, label: string) {
    if (!confirm(`Delete playlist “${label}”?`)) return;
    setErr(null);
    try {
      await deletePlaylist(id);
      await refresh();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Delete failed");
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Playlists</h1>
        <p className="mt-1 text-slate-600">Build loops for your trains</p>
      </div>

      {err ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {err}
        </p>
      ) : null}

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">New playlist</h2>
        <form onSubmit={onCreate} className="mt-4 flex flex-wrap items-end gap-4">
          <div className="min-w-[200px] flex-1">
            <label className="block text-sm font-medium text-slate-700">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Main loop"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
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

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">All playlists</h2>
        </div>
        {loading ? (
          <p className="p-6 text-slate-500">Loading…</p>
        ) : (
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Items</th>
                <th className="px-4 py-3 font-medium">Loop</th>
                <th className="px-4 py-3 font-medium">Updated</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((p) => (
                <tr key={p.id} className="bg-white">
                  <td className="px-4 py-2">
                    <Link
                      href={`/playlists/${p.id}`}
                      className="font-medium text-brand-700 hover:underline"
                    >
                      {p.title}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-slate-600">{p.items?.length ?? 0}</td>
                  <td className="px-4 py-2 text-slate-600">{p.loop ? "Yes" : "No"}</td>
                  <td className="px-4 py-2 text-slate-500">{formatUpdatedAt(p.updatedAt)}</td>
                  <td className="px-4 py-2">
                    <button
                      type="button"
                      onClick={() => onDelete(p.id, p.title)}
                      className="text-sm font-medium text-red-600 hover:text-red-800"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && items.length === 0 ? (
          <p className="p-6 text-slate-500">No playlists yet.</p>
        ) : null}
      </div>
    </div>
  );
}
