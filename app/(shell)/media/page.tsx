"use client";

import { MEDIA_CATEGORIES, type MediaCategory } from "@/lib/constants";
import {
  deleteMedia,
  deleteMediaCascade,
  detectMediaType,
  findPlaylistsContainingMedia,
  formatCreatedAt,
  listMedia,
  updateMediaDuration,
  uploadMedia,
} from "@/lib/services/media";
import { sendSyncCommandToAllTrains } from "@/lib/services/trains";
import type { MediaDoc, PlaylistDoc } from "@/lib/types";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const TYPE_BADGE: Record<string, string> = {
  video: "bg-violet-100 text-violet-700",
  image: "bg-amber-100 text-amber-700",
};

/**
 * Read video duration (seconds, rounded) from a URL or local File.
 *
 * Some encodings (notably WebM and fragmented MP4) report `Infinity` for
 * `video.duration` until the browser is forced to seek. We handle that by
 * seeking to a huge value and reading the corrected duration on `timeupdate`.
 *
 * For Firebase Storage URLs we do NOT set `crossOrigin`, since their auth
 * token is in the query string — setting it triggers a CORS preflight that
 * Firebase Storage does not answer.
 */
function readVideoDurationFromSource(source: string | File): Promise<number | null> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;

    let settled = false;
    const objectUrl = source instanceof File ? URL.createObjectURL(source) : null;
    const cleanup = () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      video.removeAttribute("src");
      video.load();
    };
    const finish = (value: number | null) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };

    video.addEventListener("loadedmetadata", () => {
      if (isFinite(video.duration) && video.duration > 0) {
        finish(Math.round(video.duration));
      } else {
        // Force the browser to compute the real duration by seeking past the end.
        try { video.currentTime = 1e10; } catch { /* ignore */ }
      }
    });

    video.addEventListener("durationchange", () => {
      if (isFinite(video.duration) && video.duration > 0) {
        finish(Math.round(video.duration));
      }
    });

    video.addEventListener("error", () => finish(null));

    // Safety timeout — bail out if metadata never loads
    const timeout = setTimeout(() => finish(null), 20_000);
    void timeout;

    video.src = objectUrl ?? (source as string);
  });
}

/** Local File → duration (used at upload time). */
function readVideoDuration(file: File): Promise<number | null> {
  return readVideoDurationFromSource(file);
}

/** Remote URL → duration (used by the "Scan durations" rescue tool). */
function readRemoteVideoDuration(url: string): Promise<number | null> {
  return readVideoDurationFromSource(url);
}

export default function MediaPage() {
  const [items, setItems] = useState<MediaDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<MediaCategory>("videos");
  const [subcategory, setSubcategory] = useState("");
  const [imageDuration, setImageDuration] = useState(6);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [preview, setPreview] = useState<MediaDoc | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    item: MediaDoc;
    playlists: PlaylistDoc[];
  } | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [scanBusy, setScanBusy] = useState(false);
  const [scanStatus, setScanStatus] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function scanDurations() {
    const targets = items.filter((m) => m.mediaType === "video" && (m.duration == null || m.duration === 0));
    if (targets.length === 0) return;
    setScanBusy(true);
    setScanStatus(`0 / ${targets.length} — διαβάζω metadata…`);
    let updated = 0;
    let skipped = 0;
    for (const m of targets) {
      try {
        const dur = await readRemoteVideoDuration(m.downloadUrl);
        if (dur) {
          await updateMediaDuration(m.id, dur);
          updated++;
          setScanStatus(`${updated + skipped} / ${targets.length} — "${m.title}" → ${dur}s ✓`);
          // Update local state so banner hides immediately
          setItems((prev) => prev.map((it) => it.id === m.id ? { ...it, duration: dur } : it));
        } else {
          skipped++;
          setScanStatus(`${updated + skipped} / ${targets.length} — "${m.title}" δεν βρέθηκε διάρκεια`);
        }
      } catch {
        skipped++;
        setScanStatus(`${updated + skipped} / ${targets.length} — "${m.title}" σφάλμα`);
      }
    }
    if (updated > 0) {
      setScanStatus(`✓ ${updated} videos ενημερώθηκαν${skipped > 0 ? `, ${skipped} παρελείφθησαν` : ""} — στέλνω SYNC στα Pis…`);
      try {
        await sendSyncCommandToAllTrains("SYNC_PLAYLIST");
        setScanStatus(`✓ ${updated} videos ενημερώθηκαν — τα Pis ξαναφορτώνουν το playlist`);
      } catch {
        setScanStatus(`✓ ${updated} videos ενημερώθηκαν (αποτυχία αποστολής sync)`);
      }
    } else {
      setScanStatus(`⚠️ Δεν διαβάστηκε καμία διάρκεια. Βεβαιωθείτε ότι τα αρχεία είναι προσβάσιμα.`);
    }
    setScanBusy(false);
    await refresh();
  }

  async function refresh() {
    setErr(null);
    setItems(await listMedia());
  }

  useEffect(() => {
    let c = false;
    refresh()
      .catch((e: unknown) => { if (!c) setErr(e instanceof Error ? e.message : "Load failed"); })
      .finally(() => { if (!c) setLoading(false); });
    return () => { c = true; };
  }, []);

  const primaryFile = files[0] ?? null;
  const detected = primaryFile ? detectMediaType(primaryFile) : null;
  const unsupportedCount = files.filter((f) => !detectMediaType(f)).length;

  function handleFiles(nextFiles: FileList | File[]) {
    const picked = Array.from(nextFiles);
    setFiles(picked);
    if (picked.length === 1 && !title && picked[0]) {
      setTitle(picked[0].name.replace(/\.[^.]+$/, ""));
    }
  }

  async function onUpload(e: React.FormEvent) {
    e.preventDefault();
    if (files.length === 0) { setErr("Choose at least one file"); return; }
    if (unsupportedCount > 0) { setErr("All files must be videos or images"); return; }
    if (category === "learn_greek_word" && files.some((f) => detectMediaType(f) !== "video")) {
      setErr("Learn a Greek Word accepts video files only");
      return;
    }
    setUploadBusy(true);
    setUploadProgress(0);
    setErr(null);
    try {
      let completed = 0;
      for (const currentFile of files) {
        const currentType = detectMediaType(currentFile);
        if (!currentType) throw new Error(`Unsupported file: ${currentFile.name}`);

        // For video files, read the actual duration from the browser before uploading.
        // This is used server-side for playlist sync timing.
        let durationSeconds: number | null = currentType === "image" ? imageDuration : null;
        if (currentType === "video") {
          durationSeconds = await readVideoDuration(currentFile);
        }

        const displayTitle = files.length === 1
          ? title || currentFile.name
          : currentFile.name.replace(/\.[^.]+$/, "");
        await uploadMedia({
          file: currentFile,
          title: displayTitle,
          category,
          subcategory: category === "announcements" ? subcategory.trim() || undefined : undefined,
          durationSeconds,
        });
        completed++;
        setUploadProgress(Math.round((completed / files.length) * 100));
      }
      if (category === "learn_greek_word") {
        await sendSyncCommandToAllTrains("SYNC_PLAYLIST").catch(() => null);
      }
      setTimeout(() => setUploadProgress(null), 600);
      setFiles([]);
      setTitle("");
      setSubcategory("");
      if (fileRef.current) fileRef.current.value = "";
      await refresh();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Upload failed");
      setUploadProgress(null);
    } finally {
      setUploadBusy(false);
    }
  }

  async function onDelete(m: MediaDoc) {
    setErr(null);
    try {
      const playlists = await findPlaylistsContainingMedia(m.id);
      setDeleteTarget({ item: m, playlists });
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Check failed");
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    setErr(null);
    try {
      const { item, playlists } = deleteTarget;
      if (playlists.length > 0) {
        await deleteMediaCascade(item, playlists);
      } else {
        await deleteMedia(item);
        // Announce deletion to Pis (for announcements)
        if (item.category === "announcements") {
          await sendSyncCommandToAllTrains("SYNC_ANNOUNCEMENTS").catch(() => null);
        }
      }
      setDeleteTarget(null);
      await refresh();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleteBusy(false);
    }
  }

  // Group items by category / subcategory for display
  const announcements = items.filter((m) => m.category === "announcements");
  const annFolders = [...new Set(announcements.map((m) => m.subcategory?.trim() || "general"))].sort();
  const otherMedia = items.filter((m) => m.category !== "announcements");
  const otherByCategory: Record<string, MediaDoc[]> = {};
  for (const m of otherMedia) {
    const key = m.category || "other";
    if (!otherByCategory[key]) otherByCategory[key] = [];
    otherByCategory[key].push(m);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Media library</h1>
        <p className="mt-1 text-slate-500">Upload and manage videos and images</p>
      </div>

      {err && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</p>
      )}

      {/* Upload */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Upload new file</h2>
        <form onSubmit={onUpload} className="mt-4 space-y-4">
          <div
            className={cn(
              "relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 transition-colors",
              dragOver ? "border-brand-500 bg-brand-50" : "border-slate-300 bg-slate-50 hover:border-slate-400",
            )}
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const dropped = e.dataTransfer.files;
              if (dropped?.length) handleFiles(dropped);
            }}
          >
            <input ref={fileRef} type="file" accept="video/*,image/*" multiple className="sr-only"
              onChange={(e) => { const picked = e.target.files; if (picked?.length) handleFiles(picked); }} />
            {files.length > 0 ? (
              <div className="text-center">
                <p className="text-sm font-medium text-slate-900">
                  {files.length === 1 ? primaryFile?.name : `${files.length} files selected`}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {(files.reduce((sum, f) => sum + f.size, 0) / 1024 / 1024).toFixed(1)} MB total
                  {detected && <span className={cn("ml-2 rounded-full px-2 py-0.5 font-semibold", TYPE_BADGE[detected] ?? "bg-slate-100 text-slate-600")}>{detected}</span>}
                  {unsupportedCount > 0 && <span className="ml-2 text-amber-600">{unsupportedCount} unsupported</span>}
                </p>
                <button type="button" className="mt-2 text-xs text-brand-700 hover:underline"
                  onClick={(e) => { e.stopPropagation(); setFiles([]); setTitle(""); }}>Remove</button>
              </div>
            ) : (
              <>
                <p className="text-2xl">📁</p>
                <p className="mt-2 text-sm font-medium text-slate-700">Drop files or click to browse</p>
                <p className="text-xs text-slate-400">Bulk video/image upload supported</p>
              </>
            )}
          </div>

          {uploadProgress !== null && (
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full bg-brand-600 transition-all duration-200" style={{ width: `${uploadProgress}%` }} />
            </div>
          )}

          <div className="flex flex-wrap items-end gap-4">
            <div className="min-w-[180px] flex-1">
              <label className="block text-sm font-medium text-slate-700">Title</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={files.length > 1 ? "Bulk upload uses filenames" : "Display name"}
                disabled={files.length > 1}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
            </div>
            <div className="min-w-[140px]">
              <label className="block text-sm font-medium text-slate-700">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value as MediaCategory)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500">
                {MEDIA_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            {category === "announcements" && (
              <div className="min-w-[140px]">
                <label className="block text-sm font-medium text-slate-700">
                  Folder <span className="font-normal text-slate-400">(e.g. castle, stops)</span>
                </label>
                <input value={subcategory} onChange={(e) => setSubcategory(e.target.value)} placeholder="castle"
                  list="existing-folders"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
                <datalist id="existing-folders">
                  {annFolders.filter((f) => f !== "general").map((f) => <option key={f} value={f} />)}
                </datalist>
              </div>
            )}
            {files.length <= 1 && detected === "image" && (
              <div className="w-28">
                <label className="block text-sm font-medium text-slate-700">Duration (s)</label>
                <input type="number" min={1} value={imageDuration} onChange={(e) => setImageDuration(Number(e.target.value) || 6)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
              </div>
            )}
            <button type="submit" disabled={uploadBusy || files.length === 0 || unsupportedCount > 0}
              className={cn("rounded-lg px-5 py-2 text-sm font-semibold text-white transition-colors",
                uploadBusy || files.length === 0 || unsupportedCount > 0 ? "bg-slate-400 cursor-not-allowed" : "bg-brand-700 hover:bg-brand-900")}>
              {uploadBusy ? "Uploading…" : files.length > 1 ? `Upload ${files.length} files` : "Upload"}
            </button>
          </div>
        </form>
      </div>

      {/* ── Scan missing durations ── */}
      {items.some((m) => m.mediaType === "video" && (m.duration == null || m.duration === 0)) && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 flex items-center gap-4">
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-800">
              {items.filter((m) => m.mediaType === "video" && (m.duration == null || m.duration === 0)).length} video{items.filter((m) => m.mediaType === "video" && (m.duration == null || m.duration === 0)).length !== 1 ? "s" : ""} χωρίς διάρκεια
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              Χωρίς διάρκεια το σύστημα sync δεν μπορεί να συγχρονίσει τα TVs. Κάντε κλικ για αυτόματη ανίχνευση.
            </p>
            {scanStatus && <p className="text-xs text-amber-900 mt-1 font-mono">{scanStatus}</p>}
          </div>
          <button
            onClick={scanDurations}
            disabled={scanBusy}
            className="shrink-0 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {scanBusy ? "Σκανάρισμα…" : "🔍 Scan διάρκειες"}
          </button>
        </div>
      )}

      {/* ── Announcements (grouped by folder) ── */}
      {!loading && announcements.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-slate-900">📢 Announcements</h2>
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
              {announcements.length} file{announcements.length !== 1 ? "s" : ""}
            </span>
          </div>
          {annFolders.map((folder) => {
            const folderItems = announcements.filter(
              (m) => (m.subcategory?.trim() || "general") === folder,
            );
            const label = folder === "general" ? "General" : folder.charAt(0).toUpperCase() + folder.slice(1);
            return (
              <div key={folder} className="rounded-xl border border-amber-100 bg-white shadow-sm overflow-hidden">
                <div className="flex items-center gap-2 border-b border-amber-50 bg-amber-50/60 px-5 py-3">
                  <span className="text-base">📂</span>
                  <span className="font-semibold text-slate-900">{label}</span>
                  <span className="ml-auto text-xs text-slate-400">{folderItems.length} video{folderItems.length !== 1 ? "s" : ""}</span>
                </div>
                <div className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                  {folderItems.map((m) => <MediaCard key={m.id} m={m} onPreview={setPreview} onDelete={onDelete} />)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Other media (videos / images) ── */}
      {!loading && Object.keys(otherByCategory).length > 0 && (
        <div className="space-y-4">
          {Object.entries(otherByCategory).map(([cat, catItems]) => (
            <div key={cat} className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3">
                <span className="font-semibold capitalize text-slate-900">{cat}</span>
                <span className="ml-auto text-xs text-slate-400">{catItems.length} file{catItems.length !== 1 ? "s" : ""}</span>
              </div>
              <div className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {catItems.map((m) => <MediaCard key={m.id} m={m} onPreview={setPreview} onDelete={onDelete} />)}
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && items.length === 0 && (
        <p className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          No media yet. Upload a file above.
        </p>
      )}
      {loading && <p className="text-sm text-slate-500">Loading…</p>}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal
          onClick={() => !deleteBusy && setDeleteTarget(null)}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-slate-100 px-6 py-4">
              <p className="text-base font-bold text-slate-900">
                {deleteTarget.playlists.length > 0 ? "⚠️ File is in active playlists" : "Delete file"}
              </p>
            </div>
            <div className="space-y-3 px-6 py-4 text-sm text-slate-700">
              <p>
                Delete <span className="font-semibold text-slate-900">&ldquo;{deleteTarget.item.title}&rdquo;</span>?
              </p>
              {deleteTarget.playlists.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800">
                  <p className="font-semibold">Used in {deleteTarget.playlists.length} playlist{deleteTarget.playlists.length > 1 ? "s" : ""}:</p>
                  <ul className="mt-1 list-inside list-disc text-sm">
                    {deleteTarget.playlists.map((pl) => (
                      <li key={pl.id}>{pl.title}</li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs">
                    The file will be <strong>removed from these playlists</strong> and all connected trains will be notified to resync.
                  </p>
                </div>
              )}
              <p className="text-xs text-slate-400">This action cannot be undone.</p>
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
              <button
                type="button"
                disabled={deleteBusy}
                onClick={() => setDeleteTarget(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteBusy}
                onClick={confirmDelete}
                className={cn(
                  "rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors",
                  deleteBusy ? "cursor-not-allowed bg-red-300" : "bg-red-600 hover:bg-red-700",
                )}
              >
                {deleteBusy ? "Deleting…" : deleteTarget.playlists.length > 0 ? "Delete & remove from playlists" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview modal */}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog" aria-modal onClick={() => setPreview(null)}>
          <div className="w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
              <div>
                <p className="font-semibold text-slate-900">{preview.title}</p>
                <p className="text-xs text-slate-500">
                  {preview.category}{preview.subcategory ? `/${preview.subcategory}` : ""} · {preview.mediaType}
                </p>
              </div>
              <button type="button" onClick={() => setPreview(null)}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100">✕</button>
            </div>
            <div className="bg-black">
              {preview.mediaType === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview.downloadUrl} alt="" className="mx-auto max-h-[72vh] w-auto" />
              ) : (
                <video src={preview.downloadUrl} controls autoPlay className="max-h-[72vh] w-full" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MediaCard({ m, onPreview, onDelete }: { m: MediaDoc; onPreview: (m: MediaDoc) => void; onDelete: (m: MediaDoc) => void }) {
  const TYPE_BADGE: Record<string, string> = {
    video: "bg-violet-100 text-violet-700",
    image: "bg-amber-100 text-amber-700",
  };
  return (
    <div className="group relative flex flex-col overflow-hidden rounded-xl border border-slate-200">
      <button type="button" onClick={() => onPreview(m)}
        className="relative block aspect-video w-full overflow-hidden bg-slate-100">
        {m.mediaType === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={m.downloadUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <video src={m.downloadUrl} className="h-full w-full object-cover" muted playsInline preload="metadata" />
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-2xl opacity-0 transition-all group-hover:bg-black/30 group-hover:opacity-100">▶</span>
      </button>
      <div className="flex flex-1 flex-col gap-1 p-2.5">
        <p className="truncate text-xs font-medium text-slate-900">{m.title}</p>
        <div className="flex items-center justify-between">
          <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-semibold", TYPE_BADGE[m.mediaType] ?? "bg-slate-100 text-slate-600")}>
            {m.mediaType}
          </span>
          <div className="flex items-center gap-2">
            {m.mediaType === "video" && (
              <Link
                href={`/media/${m.id}`}
                className="text-[10px] font-medium text-blue-500 hover:text-blue-700"
                title="Edit guide script"
              >
                Script
              </Link>
            )}
            <button type="button" onClick={() => onDelete(m)} className="text-[10px] font-medium text-slate-400 hover:text-red-600">
              Delete
            </button>
          </div>
        </div>
        <p className="text-[10px] text-slate-400">{formatCreatedAt(m.createdAt)}</p>
      </div>
    </div>
  );
}
