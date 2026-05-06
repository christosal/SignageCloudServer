"use client";

import { MEDIA_CATEGORIES, type MediaCategory } from "@/lib/constants";
import {
  deleteMedia,
  detectMediaType,
  formatCreatedAt,
  listMedia,
  uploadMedia,
} from "@/lib/services/media";
import type { MediaDoc } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

export default function MediaPage() {
  const [items, setItems] = useState<MediaDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<MediaCategory>("videos");
  const [imageDuration, setImageDuration] = useState(6);
  const [uploadBusy, setUploadBusy] = useState(false);

  const [preview, setPreview] = useState<MediaDoc | null>(null);

  async function refresh() {
    setErr(null);
    const list = await listMedia();
    setItems(list);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await refresh();
      } catch (e: unknown) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Load failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const detected = file ? detectMediaType(file) : null;

  async function onUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setErr("Choose a file");
      return;
    }
    setUploadBusy(true);
    setErr(null);
    try {
      await uploadMedia({
        file,
        title: title || file.name,
        category,
        durationSeconds: detected === "image" ? imageDuration : null,
      });
      setFile(null);
      setTitle("");
      await refresh();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploadBusy(false);
    }
  }

  async function onDelete(m: MediaDoc) {
    if (!confirm(`Delete “${m.title}”?`)) return;
    setErr(null);
    try {
      await deleteMedia(m);
      await refresh();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Delete failed");
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Media library</h1>
        <p className="mt-1 text-slate-600">Upload and manage videos and images</p>
      </div>

      {err ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {err}
        </p>
      ) : null}

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Upload</h2>
        <form onSubmit={onUpload} className="mt-4 flex flex-col gap-4 md:flex-row md:flex-wrap md:items-end">
          <div className="min-w-[200px] flex-1">
            <label className="block text-sm font-medium text-slate-700">File</label>
            <input
              type="file"
              accept="video/*,image/*"
              onChange={(e) => {
                const f = e.target.files?.[0];
                setFile(f ?? null);
                if (f && !title) setTitle(f.name.replace(/\.[^.]+$/, ""));
              }}
              className="mt-1 block w-full text-sm text-slate-600"
            />
            {file ? (
              <p className="mt-1 text-xs text-slate-500">
                Detected:{" "}
                {detected ? (
                  <span className="font-medium text-slate-700">{detected}</span>
                ) : (
                  <span className="text-amber-700">unknown — use video or image</span>
                )}
              </p>
            ) : null}
          </div>
          <div className="min-w-[160px]">
            <label className="block text-sm font-medium text-slate-700">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="min-w-[160px]">
            <label className="block text-sm font-medium text-slate-700">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as MediaCategory)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {MEDIA_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          {detected === "image" ? (
            <div className="min-w-[100px]">
              <label className="block text-sm font-medium text-slate-700">Duration (s)</label>
              <input
                type="number"
                min={1}
                value={imageDuration}
                onChange={(e) => setImageDuration(Number(e.target.value) || 6)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          ) : null}
          <button
            type="submit"
            disabled={uploadBusy || !file || !detected}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-semibold text-white",
              uploadBusy || !file || !detected
                ? "bg-slate-400"
                : "bg-brand-700 hover:bg-brand-900",
            )}
          >
            {uploadBusy ? "Uploading…" : "Upload"}
          </button>
        </form>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">All media</h2>
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <p className="p-6 text-slate-500">Loading…</p>
          ) : (
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Preview</th>
                  <th className="px-4 py-3 font-medium">Title</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((m) => (
                  <tr key={m.id} className="bg-white">
                    <td className="px-4 py-2">
                      <button
                        type="button"
                        onClick={() => setPreview(m)}
                        className="relative block h-16 w-28 overflow-hidden rounded-md bg-slate-100 ring-offset-2 hover:ring-2 hover:ring-brand-600"
                      >
                        {m.mediaType === "image" ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={m.downloadUrl}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <video
                            src={m.downloadUrl}
                            className="h-full w-full object-cover"
                            muted
                            playsInline
                            preload="metadata"
                          />
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-2 font-medium text-slate-900">{m.title}</td>
                    <td className="px-4 py-2 text-slate-600">{m.mediaType}</td>
                    <td className="px-4 py-2 text-slate-600">{m.category}</td>
                    <td className="px-4 py-2 text-slate-500">{formatCreatedAt(m.createdAt)}</td>
                    <td className="px-4 py-2">
                      <button
                        type="button"
                        onClick={() => onDelete(m)}
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
            <p className="p-6 text-slate-500">No media yet.</p>
          ) : null}
        </div>
      </div>

      {preview ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal
          onClick={() => setPreview(null)}
        >
          <div
            className="max-h-[90vh] max-w-4xl overflow-auto rounded-xl bg-white p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between gap-4">
              <h3 className="font-semibold text-slate-900">{preview.title}</h3>
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="rounded-lg px-3 py-1 text-sm text-slate-600 hover:bg-slate-100"
              >
                Close
              </button>
            </div>
            {preview.mediaType === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview.downloadUrl} alt="" className="max-h-[70vh] w-auto rounded-lg" />
            ) : (
              <video
                src={preview.downloadUrl}
                controls
                autoPlay
                className="max-h-[70vh] w-full rounded-lg"
              />
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
