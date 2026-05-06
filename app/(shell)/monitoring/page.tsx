"use client";

import { formatHeartbeat, isTrainOnline } from "@/lib/services/trains";
import { useTrains } from "@/lib/hooks/useTrains";
import { cn } from "@/lib/utils";

export default function MonitoringPage() {
  const { trains, loading, error } = useTrains();
  const onlineCount = trains.filter((t) => isTrainOnline(t.lastHeartbeat)).length;

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Monitoring</h1>
          <p className="mt-1 text-slate-500">
            Live — online if heartbeat within 2 minutes
          </p>
        </div>
        <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
          Live
        </span>
      </div>

      {/* Summary cards */}
      {!loading && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Total trains</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{trains.length}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Online</p>
            <p className="mt-1 text-3xl font-bold text-emerald-600">{onlineCount}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Total TVs</p>
            <p className="mt-1 text-3xl font-bold text-blue-600">
              {trains.reduce((s, t) => s + (t.connectedTvs?.length ?? 0), 0)}
            </p>
          </div>
        </div>
      )}

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <div className="space-y-4">
        {loading ? (
          <p className="text-sm text-slate-500">Connecting…</p>
        ) : trains.length === 0 ? (
          <p className="text-sm text-slate-500">No trains configured.</p>
        ) : (
          trains.map((t) => {
            const online = isTrainOnline(t.lastHeartbeat);
            const tvs = t.connectedTvs ?? [];
            return (
              <div
                key={t.id}
                className={cn(
                  "rounded-xl border bg-white p-5 shadow-sm",
                  online ? "border-emerald-200" : "border-slate-200",
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="text-base font-semibold text-slate-900">{t.name}</span>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
                        online
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-slate-100 text-slate-500",
                      )}
                    >
                      {online && (
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                      )}
                      {online ? "Online" : "Offline"}
                    </span>
                    {tvs.length > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                        📺 {tvs.length} TV{tvs.length > 1 ? "s" : ""}
                      </span>
                    )}
                    {t.currentState && (
                      <span className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                        t.currentState.type === "waiting"
                          ? "bg-sky-100 text-sky-700"
                          : t.currentState.type === "announcement"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-violet-100 text-violet-700",
                      )}>
                        {t.currentState.type === "waiting" ? "⏳ Waiting Screen"
                          : t.currentState.type === "announcement" ? `📢 ${t.currentState.title ?? "Announcement"}`
                          : `▶ ${t.currentState.title ?? t.currentState.playlistTitle ?? "Playlist"}`}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-400">
                    {formatHeartbeat(t.lastHeartbeat)}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Playlist</p>
                    <p className="mt-0.5 text-slate-700">{t.activePlaylistTitle ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">TVs</p>
                    <p className="mt-0.5 text-slate-700">
                      {tvs.length > 0 ? tvs.map((c) => c.name).join(", ") : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Device ID</p>
                    <p className="mt-0.5 font-mono text-xs text-slate-500">{t.id}</p>
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
