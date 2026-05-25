"use client";

import { LEARN_GREEK_WORD_CATEGORY } from "@/lib/constants";
import { listMedia } from "@/lib/services/media";
import { getPlaylist, savePlaylist } from "@/lib/services/playlists";
import type { MediaDoc, PlaylistItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function EditPlaylistPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [loop, setLoop] = useState(true);
  const [items, setItems] = useState<PlaylistItem[]>([]);
  const [mediaLib, setMediaLib] = useState<MediaDoc[]>([]);
  const [pickId, setPickId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let c = false;
    Promise.all([getPlaylist(id), listMedia()])
      .then(([pl, media]) => {
        if (c) return;
        if (!pl) { setErr("Playlist not found"); setLoading(false); return; }
        setTitle(pl.title);
        setLoop(pl.loop);
        setItems(pl.items ?? []);
        setMediaLib(media);
        if (media[0]) setPickId(media[0].id);
      })
      .catch((e: unknown) => { if (!c) setErr(e instanceof Error ? e.message : "Load failed"); })
      .finally(() => { if (!c) setLoading(false); });
    return () => { c = true; };
  }, [id]);

  function addSelected() {
    const m = mediaLib.find((x) => x.id === pickId);
    if (!m) return;
    if (items.some((i) => i.mediaId === m.id)) return;
    setItems((prev) => [...prev, {
      mediaId: m.id, title: m.title, mediaType: m.mediaType, downloadUrl: m.downloadUrl, duration: m.duration,
    }]);
  }

  function addLearnGreekWordSlot() {
    setItems((prev) => [...prev, {
      mediaId: `template:${LEARN_GREEK_WORD_CATEGORY}`,
      title: "Learn a Greek Word",
      mediaType: "template",
      downloadUrl: "",
      duration: null,
      kind: "category_random",
      category: LEARN_GREEK_WORD_CATEGORY,
    }]);
  }

  function removeAt(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function move(index: number, dir: -1 | 1) {
    const j = index + dir;
    if (j < 0 || j >= items.length) return;
    setItems((prev) => {
      const next = [...prev];
      const t = next[index]; const u = next[j];
      if (!t || !u) return prev;
      next[index] = u; next[j] = t;
      return next;
    });
  }

  async function onSave() {
    setSaving(true); setErr(null);
    try { await savePlaylist(id, { title, loop, items }); router.push("/playlists"); }
    catch (e: unknown) { setErr(e instanceof Error ? e.message : "Save failed"); }
    finally { setSaving(false); }
  }

  if (loading) return (
    <div className="mx-auto max-w-3xl">
      <p className="text-slate-500">Loading…</p>
    </div>
  );

  const selectedMedia = mediaLib.find((m) => m.id === pickId);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/playlists" className="text-sm font-medium text-brand-700 hover:underline">
            ← Playlists
          </Link>
          <h1 className="mt-1.5 text-2xl font-bold text-slate-900">Edit playlist</h1>
        </div>
        <div className="flex gap-3">
          <Link
            href="/playlists"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </Link>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-900 disabled:bg-slate-400"
          >
            {saving ? "Saving…" : "Save playlist"}
          </button>
        </div>
      </div>

      {err && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</p>
      )}

      {/* Settings */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Settings</h2>
        <div className="mt-4 flex flex-wrap items-end gap-6">
          <div className="min-w-[200px] flex-1">
            <label className="block text-sm font-medium text-slate-700">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 pb-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={loop}
              onChange={(e) => setLoop(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            Loop playlist
          </label>
        </div>
      </div>

      {/* Add media */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Add media</h2>
        {mediaLib.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">
            No media yet.{" "}
            <Link href="/media" className="font-medium text-brand-700 hover:underline">Upload some →</Link>
          </p>
        ) : (
          <div className="mt-4 flex flex-wrap items-end gap-4">
            <div className="flex flex-1 flex-wrap items-end gap-3">
              {/* Thumbnail preview */}
              {selectedMedia && (
                <div className="h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                  {selectedMedia.mediaType === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={selectedMedia.downloadUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <video src={selectedMedia.downloadUrl} className="h-full w-full object-cover" muted playsInline preload="metadata" />
                  )}
                </div>
              )}
              <div className="min-w-[200px] flex-1">
                <label className="block text-sm font-medium text-slate-700">From library</label>
                <select
                  value={pickId}
                  onChange={(e) => setPickId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  {mediaLib.map((m) => (
                    <option key={m.id} value={m.id}>{m.title} ({m.mediaType})</option>
                  ))}
                </select>
              </div>
            </div>
            <button
              type="button"
              onClick={addSelected}
              disabled={!pickId || items.some((i) => i.mediaId === pickId)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {items.some((i) => i.mediaId === pickId) ? "Already added" : "Add to playlist"}
            </button>
            <button
              type="button"
              onClick={addLearnGreekWordSlot}
              className="rounded-lg border border-sky-300 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-700 hover:bg-sky-100"
            >
              + Learn a Greek Word slot
            </button>
          </div>
        )}
      </div>

      {/* Order */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            Order
            <span className="ml-2 font-normal normal-case text-slate-500">
              {items.length} item{items.length !== 1 ? "s" : ""}
            </span>
          </h2>
        </div>
        {items.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-slate-400">No items yet — add some above.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((it, index) => {
              const m = mediaLib.find((x) => x.id === it.mediaId);
              const isTemplate = it.kind === "category_random";
              return (
                <li key={`${it.mediaId}-${index}`} className="flex items-center gap-3 px-5 py-3">
                  <span className="w-6 shrink-0 text-center text-xs text-slate-400">{index + 1}</span>
                  {isTemplate ? (
                    <div className="flex h-10 w-14 shrink-0 items-center justify-center rounded-md bg-sky-100 text-xs font-bold text-sky-700">
                      LGW
                    </div>
                  ) : m && (
                    <div className="h-10 w-14 shrink-0 overflow-hidden rounded-md bg-slate-100">
                      {m.mediaType === "image" ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.downloadUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <video src={m.downloadUrl} className="h-full w-full object-cover" muted playsInline preload="metadata" />
                      )}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{it.title}</p>
                    <p className="text-xs text-slate-500">
                      {isTemplate
                        ? "Random video from Learn a Greek Word"
                        : `${it.mediaType}${it.mediaType === "image" && it.duration != null ? ` · ${it.duration}s` : ""}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => move(index, -1)}
                      disabled={index === 0}
                      className={cn("rounded px-2 py-1 text-sm", index === 0 ? "text-slate-300" : "text-slate-500 hover:bg-slate-100")}
                    >↑</button>
                    <button
                      type="button"
                      onClick={() => move(index, 1)}
                      disabled={index === items.length - 1}
                      className={cn("rounded px-2 py-1 text-sm", index === items.length - 1 ? "text-slate-300" : "text-slate-500 hover:bg-slate-100")}
                    >↓</button>
                    <button
                      type="button"
                      onClick={() => removeAt(index)}
                      className="ml-1 rounded px-2 py-1 text-xs font-medium text-slate-400 hover:text-red-600"
                    >Remove</button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Save footer */}
      <div className="flex justify-end gap-3 pb-4">
        <Link href="/playlists" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          Cancel
        </Link>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="rounded-lg bg-brand-700 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-900 disabled:bg-slate-400"
        >
          {saving ? "Saving…" : "Save playlist"}
        </button>
      </div>
    </div>
  );
}
