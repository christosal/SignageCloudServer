"use client";

import {
  assignPlaylistToTrain,
  createTrain,
  deleteTrain,
  formatHeartbeat,
  isTrainOnline,
  listTrains,
} from "@/lib/services/trains";
import { listPlaylists } from "@/lib/services/playlists";
import type { PlaylistDoc, TrainDoc } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

export default function TrainsPage() {
  const [trains, setTrains] = useState<TrainDoc[]>([]);
  const [playlists, setPlaylists] = useState<PlaylistDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    setErr(null);
    const [t, p] = await Promise.all([listTrains(), listPlaylists()]);
    setTrains(t);
    setPlaylists(p);
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
      await createTrain(newName || "New train");
      setNewName("");
      await refresh();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  async function onAssign(trainId: string, playlistId: string) {
    setErr(null);
    const pl =
      playlistId === ""
        ? null
        : playlists.find((p) => p.id === playlistId) ?? null;
    try {
      await assignPlaylistToTrain(trainId, pl?.id ?? null, pl?.title ?? null);
      await refresh();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Assign failed");
    }
  }

  async function onDelete(id: string, name: string) {
    if (!confirm(`Delete train “${name}”?`)) return;
    setErr(null);
    try {
      await deleteTrain(id);
      await refresh();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Delete failed");
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Trains</h1>
        <p className="mt-1 text-slate-600">Assign active playlists and monitor connectivity</p>
      </div>

      {err ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {err}
        </p>
      ) : null}

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Add train</h2>
        <form onSubmit={onCreate} className="mt-4 flex flex-wrap items-end gap-4">
          <div className="min-w-[200px] flex-1">
            <label className="block text-sm font-medium text-slate-700">Name</label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Train A"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-900 disabled:bg-slate-400"
          >
            {busy ? "Adding…" : "Add train"}
          </button>
        </form>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">All trains</h2>
        </div>
        {loading ? (
          <p className="p-6 text-slate-500">Loading…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Last heartbeat</th>
                  <th className="px-4 py-3 font-medium">Active playlist</th>
                  <th className="px-4 py-3 font-medium">TVs</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {trains.map((t) => {
                  const online = isTrainOnline(t.lastHeartbeat);
                  return (
                    <tr key={t.id} className="bg-white">
                      <td className="px-4 py-2 font-medium text-slate-900">{t.name}</td>
                      <td className="px-4 py-2">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2 py-0.5 text-xs font-semibold",
                            online
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-slate-100 text-slate-600",
                          )}
                        >
                          {online ? "Online" : "Offline"}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-slate-600">
                        {formatHeartbeat(t.lastHeartbeat)}
                      </td>
                      <td className="px-4 py-2">
                        <select
                          value={t.activePlaylistId ?? ""}
                          onChange={(e) => onAssign(t.id, e.target.value)}
                          className="max-w-[220px] rounded-lg border border-slate-300 px-2 py-1 text-sm"
                        >
                          <option value="">— None —</option>
                          {playlists.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.title}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="max-w-[200px] px-4 py-2 text-xs text-slate-600">
                        {t.connectedTvs?.length
                          ? t.connectedTvs.map((c) => c.name).join(", ")
                          : "—"}
                      </td>
                      <td className="px-4 py-2">
                        <button
                          type="button"
                          onClick={() => onDelete(t.id, t.name)}
                          className="text-sm font-medium text-red-600 hover:text-red-800"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {!loading && trains.length === 0 ? (
          <p className="p-6 text-slate-500">No trains yet.</p>
        ) : null}
      </div>
    </div>
  );
}
