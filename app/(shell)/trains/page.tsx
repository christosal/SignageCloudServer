"use client";

import {
  assignPlaylistToTrain,
  formatHeartbeat,
  isTrainOnline,
  renameTrain,
  sendWaitingScreen,
} from "@/lib/services/trains";
import { listPlaylists } from "@/lib/services/playlists";
import { useTrains } from "@/lib/hooks/useTrains";
import type { PlaylistDoc } from "@/lib/types";
import { TrainPiMetricsGrid } from "@/components/train-pi-metrics";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

export default function TrainsPage() {
  const { trains, loading, error: liveError } = useTrains();
  const [playlists, setPlaylists] = useState<PlaylistDoc[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<Record<string, string>>({});
  const [waitingBusy, setWaitingBusy] = useState<Record<string, boolean>>({});

  const onlineCount = trains.filter((t) => isTrainOnline(t.lastHeartbeat)).length;
  const totalTvs = trains.reduce((s, t) => s + (t.connectedTvs?.length ?? 0), 0);

  useEffect(() => {
    listPlaylists().then(setPlaylists).catch(() => null);
  }, []);

  const displayError = liveError ?? err;

  async function onAssign(trainId: string, playlistId: string) {
    setErr(null);
    const pl = playlistId === "" ? null : playlists.find((p) => p.id === playlistId) ?? null;
    try {
      await assignPlaylistToTrain(trainId, pl?.id ?? null, pl?.title ?? null);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Assign failed");
    }
  }

  async function onRename(trainId: string) {
    const name = renaming[trainId]?.trim();
    if (!name) return;
    setErr(null);
    try {
      await renameTrain(trainId, name);
      setRenaming((r) => { const n = { ...r }; delete n[trainId]; return n; });
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Rename failed");
    }
  }

  async function onWaitingScreen(trainId: string) {
    setWaitingBusy((b) => ({ ...b, [trainId]: true }));
    setErr(null);
    try {
      await sendWaitingScreen(trainId);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Command failed");
    } finally {
      setWaitingBusy((b) => ({ ...b, [trainId]: false }));
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Trains</h1>
          <p className="mt-1 text-slate-500">
            Live status · assign playlists · monitor hardware
          </p>
        </div>
        <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
          Live
        </span>
      </div>

      {/* Summary cards */}
      {!loading && (
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Total trains</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{trains.length}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Online</p>
            <p className="mt-1 text-3xl font-bold text-emerald-600">{onlineCount}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Connected TVs</p>
            <p className="mt-1 text-3xl font-bold text-blue-600">{totalTvs}</p>
          </div>
        </div>
      )}

      {displayError ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {displayError}
        </p>
      ) : null}

      <div className="space-y-4">
        {loading ? (
          <p className="text-sm text-slate-500">Connecting…</p>
        ) : trains.length === 0 ? (
          <p className="text-sm text-slate-500">No trains yet. Start the local server on a Pi to register one automatically.</p>
        ) : (
          trains.map((t) => {
            const online = isTrainOnline(t.lastHeartbeat);
            const tvs = t.connectedTvs ?? [];
            const isRenaming = renaming[t.id] !== undefined;
            const state = t.currentState ?? null;

            return (
              <div
                key={t.id}
                className={cn(
                  "rounded-xl border bg-white p-5 shadow-sm",
                  online ? "border-emerald-200" : "border-slate-200",
                )}
              >
                {/* Top row: name + badges + actions */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-3">
                    {/* Rename inline */}
                    {isRenaming ? (
                      <div className="flex items-center gap-2">
                        <input
                          autoFocus
                          value={renaming[t.id]}
                          onChange={(e) =>
                            setRenaming((r) => ({ ...r, [t.id]: e.target.value }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") void onRename(t.id);
                            if (e.key === "Escape")
                              setRenaming((r) => { const n = { ...r }; delete n[t.id]; return n; });
                          }}
                          className="rounded-lg border border-brand-400 px-2 py-1 text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-brand-500"
                        />
                        <button
                          type="button"
                          onClick={() => void onRename(t.id)}
                          className="rounded-md bg-brand-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-brand-900"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setRenaming((r) => { const n = { ...r }; delete n[t.id]; return n; })
                          }
                          className="text-xs text-slate-500 hover:text-slate-700"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        title="Click to rename"
                        onClick={() => setRenaming((r) => ({ ...r, [t.id]: t.name }))}
                        className="text-base font-semibold text-slate-900 hover:text-brand-700"
                      >
                        {t.name}
                        <span className="ml-1.5 text-xs font-normal text-slate-400">✎</span>
                      </button>
                    )}

                    {/* Online / Offline */}
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
                        online ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500",
                      )}
                    >
                      {online && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />}
                      {online ? "Online" : "Offline"}
                    </span>

                    {/* TV count */}
                    {tvs.length > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                        📺 {tvs.length} TV{tvs.length > 1 ? "s" : ""}
                      </span>
                    )}

                    {/* Now playing */}
                    {state && (
                      <span className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                        state.type === "waiting"
                          ? "bg-sky-100 text-sky-700"
                          : state.type === "announcement"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-violet-100 text-violet-700",
                      )}>
                        {state.type === "waiting" ? "⏳ Waiting Screen"
                          : state.type === "announcement" ? `📢 ${state.title ?? "Announcement"}`
                          : `▶ ${state.title ?? state.playlistTitle ?? "Playlist"}`}
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">{formatHeartbeat(t.lastHeartbeat)}</span>
                    {online && (
                      <button
                        type="button"
                        disabled={waitingBusy[t.id]}
                        onClick={() => void onWaitingScreen(t.id)}
                        className={cn(
                          "rounded-lg border px-3 py-1 text-xs font-semibold transition-colors",
                          waitingBusy[t.id]
                            ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                            : "border-sky-300 bg-sky-50 text-sky-700 hover:bg-sky-100",
                        )}
                      >
                        {waitingBusy[t.id] ? "Sending…" : "⏳ Waiting Screen"}
                      </button>
                    )}
                  </div>
                </div>

                {/* Hardware metrics */}
                <TrainPiMetricsGrid metrics={t.piMetrics} online={online} compact />

                {/* Management row */}
                <div className="mt-4 flex flex-wrap items-center gap-6 border-t border-slate-100 pt-4 text-sm">
                  <div>
                    <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      Active playlist
                    </span>
                    <div className="mt-0.5">
                      <select
                        value={t.activePlaylistId ?? ""}
                        onChange={(e) => void onAssign(t.id, e.target.value)}
                        className="rounded-lg border border-slate-300 px-2 py-1 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                      >
                        <option value="">— None —</option>
                        {playlists.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {tvs.length > 0 && (
                    <div>
                      <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
                        Connected TVs
                      </span>
                      <p className="mt-0.5 text-xs text-slate-600">
                        {tvs.map((c) => c.name).join(", ")}
                      </p>
                    </div>
                  )}

                  <div className="ml-auto">
                    <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      Device ID
                    </span>
                    <p className="mt-0.5 font-mono text-xs text-slate-400">{t.id}</p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
