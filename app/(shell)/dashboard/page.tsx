"use client";

import { formatCreatedAt, listMedia } from "@/lib/services/media";
import { listPlaylists } from "@/lib/services/playlists";
import { isTrainOnline } from "@/lib/services/trains";
import { useTrains } from "@/lib/hooks/useTrains";
import Link from "next/link";
import { useEffect, useState } from "react";

type RecentMedia = Awaited<ReturnType<typeof listMedia>>;

const STAT_ICONS: Record<string, string> = {
  "Media items": "🎬",
  Playlists: "≡",
  Trains: "🚂",
  Online: "📡",
};

export default function DashboardPage() {
  const { trains } = useTrains();
  const [mediaCount, setMediaCount] = useState(0);
  const [playlistCount, setPlaylistCount] = useState(0);
  const [recent, setRecent] = useState<RecentMedia>([]);
  const [err, setErr] = useState<string | null>(null);

  const onlineCount = trains.filter((t) => isTrainOnline(t.lastHeartbeat)).length;

  useEffect(() => {
    let cancelled = false;
    Promise.all([listMedia(), listPlaylists()])
      .then(([media, pl]) => {
        if (cancelled) return;
        setMediaCount(media.length);
        setPlaylistCount(pl.length);
        setRecent(media.slice(0, 6));
      })
      .catch((e: unknown) => {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Failed to load");
      });
    return () => { cancelled = true; };
  }, []);

  const stats = [
    { label: "Media items", value: mediaCount, href: "/media", color: "text-violet-600 bg-violet-50" },
    { label: "Playlists",   value: playlistCount, href: "/playlists", color: "text-amber-600 bg-amber-50" },
    { label: "Trains",      value: trains.length, href: "/trains", color: "text-slate-700 bg-slate-100" },
    { label: "Online",      value: onlineCount, href: "/monitoring", color: "text-emerald-600 bg-emerald-50" },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
        <p className="mt-1 text-slate-500">Overview of your signage system</p>
      </div>

      {err && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</p>
      )}

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-500">{s.label}</p>
              <span className={`rounded-lg p-2 text-lg ${s.color}`}>{STAT_ICONS[s.label]}</span>
            </div>
            <p className="mt-3 text-3xl font-bold text-slate-900">{s.value}</p>
          </Link>
        ))}
      </div>

      {/* Quick actions */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Quick actions</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/media" className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-900">
            Upload media
          </Link>
          <Link href="/playlists" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            New playlist
          </Link>
          <Link href="/trains" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Assign playlists
          </Link>
          <Link href="/monitoring" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Monitor trains
          </Link>
        </div>
      </div>

      {/* Recent media */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">Recent uploads</h2>
          <Link href="/media" className="text-sm font-medium text-brand-700 hover:underline">
            View all
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">
            No media yet.{" "}
            <Link href="/media" className="font-medium text-brand-700 hover:underline">
              Upload your first file →
            </Link>
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {recent.map((m) => (
              <li key={m.id} className="flex items-center gap-4 px-6 py-3">
                <div className="h-10 w-16 shrink-0 overflow-hidden rounded-md bg-slate-100">
                  {m.mediaType === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.downloadUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <video src={m.downloadUrl} className="h-full w-full object-cover" muted playsInline preload="metadata" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{m.title}</p>
                  <p className="text-xs text-slate-500">{m.category} · {m.mediaType}</p>
                </div>
                <span className="shrink-0 text-xs text-slate-400">{formatCreatedAt(m.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
