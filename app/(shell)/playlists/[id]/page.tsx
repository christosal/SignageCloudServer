"use client";

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
    (async () => {
      try {
        const [pl, media] = await Promise.all([getPlaylist(id), listMedia()]);
        if (c) return;
        if (!pl) {
          setErr("Playlist not found");
          setLoading(false);
          return;
        }
        setTitle(pl.title);
        setLoop(pl.loop);
        setItems(pl.items ?? []);
        setMediaLib(media);
        if (media[0]) setPickId(media[0].id);
      } catch (e: unknown) {
        if (!c) setErr(e instanceof Error ? e.message : "Load failed");
      } finally {
        if (!c) setLoading(false);
      }
    })();
    return () => {
      c = true;
    };
  }, [id]);

  function addSelected() {
    const m = mediaLib.find((x) => x.id === pickId);
    if (!m) return;
    if (items.some((i) => i.mediaId === m.id)) return;
    setItems((prev) => [
      ...prev,
      {
        mediaId: m.id,
        title: m.title,
        mediaType: m.mediaType,
        downloadUrl: m.downloadUrl,
        duration: m.duration,
      },
    ]);
  }

  function removeAt(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function move(index: number, dir: -1 | 1) {
    const j = index + dir;
    if (j < 0 || j >= items.length) return;
    setItems((prev) => {
      const next = [...prev];
      const t = next[index];
      const u = next[j];
      if (t === undefined || u === undefined) return prev;
      next[index] = u;
      next[j] = t;
      return next;
    });
  }

  async function onSave() {
    setSaving(true);
    setErr(null);
    try {
      await savePlaylist(id, { title, loop, items });
      router.push("/playlists");
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl">
        <p className="text-slate-600">Loading…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/playlists" className="text-sm font-medium text-brand-700 hover:underline">
            ← Playlists
          </Link>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Edit playlist</h1>
        </div>
      </div>

      {err ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {err}
        </p>
      ) : null}

      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <label className="block text-sm font-medium text-slate-700">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} />
          Loop playlist
        </label>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Add media</h2>
        <div className="mt-4 flex flex-wrap items-end gap-4">
          <div className="min-w-[220px] flex-1">
            <label className="block text-sm font-medium text-slate-700">From library</label>
            <select
              value={pickId}
              onChange={(e) => setPickId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {mediaLib.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title} ({m.mediaType})
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={addSelected}
            className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-200"
          >
            Add to playlist
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Order</h2>
          <p className="text-sm text-slate-500">Use ↑ ↓ to reorder (saved when you click Save)</p>
        </div>
        <ul className="divide-y divide-slate-100">
          {items.length === 0 ? (
            <li className="px-6 py-8 text-slate-500">No items yet.</li>
          ) : (
            items.map((it, index) => (
              <li
                key={`${it.mediaId}-${index}`}
                className="flex flex-wrap items-center gap-3 px-6 py-4"
              >
                <span className="w-8 text-slate-400">{index + 1}.</span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-900">{it.title}</p>
                  <p className="text-xs text-slate-500">
                    {it.mediaType}
                    {it.mediaType === "image" && it.duration != null
                      ? ` · ${it.duration}s`
                      : ""}
                  </p>
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    className={cn(
                      "rounded border px-2 py-1 text-sm",
                      index === 0
                        ? "border-slate-100 text-slate-300"
                        : "border-slate-200 hover:bg-slate-50",
                    )}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={index === items.length - 1}
                    className={cn(
                      "rounded border px-2 py-1 text-sm",
                      index === items.length - 1
                        ? "border-slate-100 text-slate-300"
                        : "border-slate-200 hover:bg-slate-50",
                    )}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => removeAt(index)}
                    className="ml-2 text-sm font-medium text-red-600 hover:text-red-800"
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))
          )}
        </ul>
      </div>

      <div className="flex justify-end gap-4">
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
  );
}
