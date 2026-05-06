"use client";

import {
  formatCreatedAt,
  listMedia,
} from "@/lib/services/media";
import { listPlaylists } from "@/lib/services/playlists";
import { isTrainOnline, listTrains } from "@/lib/services/trains";
import { useEffect, useState } from "react";

export default function DashboardPage() {
  const [counts, setCounts] = useState({
    media: 0,
    playlists: 0,
    trains: 0,
    onlineTrains: 0,
  });
  const [recent, setRecent] = useState<Awaited<ReturnType<typeof listMedia>>>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [media, pl, tr] = await Promise.all([
          listMedia(),
          listPlaylists(),
          listTrains(),
        ]);
        if (cancelled) return;
        const onlineTrains = tr.filter((t) => isTrainOnline(t.lastHeartbeat)).length;
        setCounts({
          media: media.length,
          playlists: pl.length,
          trains: tr.length,
          onlineTrains,
        });
        setRecent(media.slice(0, 5));
      } catch (e: unknown) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Failed to load");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
        <p className="mt-1 text-slate-600">Overview of your signage setup</p>
      </div>

      {err ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {err}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Media items", value: counts.media },
          { label: "Playlists", value: counts.playlists },
          { label: "Trains", value: counts.trains },
          { label: "Trains online", value: counts.onlineTrains },
        ].map((c) => (
          <div
            key={c.label}
            className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <p className="text-sm font-medium text-slate-500">{c.label}</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Recent media</h2>
        <p className="text-sm text-slate-500">Latest uploads by creation time</p>
        <ul className="mt-4 divide-y divide-slate-100">
          {recent.length === 0 ? (
            <li className="py-4 text-slate-500">No media yet. Upload from the Media page.</li>
          ) : (
            recent.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <span className="font-medium text-slate-800">{m.title}</span>
                <span className="text-sm text-slate-500">
                  {m.mediaType} · {formatCreatedAt(m.createdAt)}
                </span>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
