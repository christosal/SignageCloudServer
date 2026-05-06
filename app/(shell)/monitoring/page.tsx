"use client";

import {
  formatHeartbeat,
  isTrainOnline,
  listTrains,
} from "@/lib/services/trains";
import type { TrainDoc } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

export default function MonitoringPage() {
  const [trains, setTrains] = useState<TrainDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let c = false;
    (async () => {
      try {
        const t = await listTrains();
        if (!c) setTrains(t);
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

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Monitoring</h1>
        <p className="mt-1 text-slate-600">
          Live view of train heartbeats (online if last heartbeat within 2 minutes)
        </p>
      </div>

      {err ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {err}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <p className="p-6 text-slate-500">Loading…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Train</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Last heartbeat</th>
                  <th className="px-4 py-3 font-medium">Active playlist</th>
                  <th className="px-4 py-3 font-medium">Connected TVs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {trains.map((t) => {
                  const online = isTrainOnline(t.lastHeartbeat);
                  return (
                    <tr key={t.id} className="bg-white">
                      <td className="px-4 py-3 font-medium text-slate-900">{t.name}</td>
                      <td className="px-4 py-3">
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
                      <td className="px-4 py-3 text-slate-600">
                        {formatHeartbeat(t.lastHeartbeat)}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {t.activePlaylistTitle ?? "—"}
                      </td>
                      <td className="max-w-xs px-4 py-3 text-xs text-slate-600">
                        {t.connectedTvs?.length
                          ? t.connectedTvs.map((c) => c.name).join(", ")
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {!loading && trains.length === 0 ? (
          <p className="p-6 text-slate-500">No trains configured.</p>
        ) : null}
      </div>
    </div>
  );
}
