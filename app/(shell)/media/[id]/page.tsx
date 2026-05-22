"use client";

import { doc, getDoc } from "firebase/firestore";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { getDb } from "@/lib/firebase/client";
import { getScriptByMediaId, saveScript } from "@/lib/services/scripts";
import type { MediaDoc, ScriptLine } from "@/lib/types";
import { cn } from "@/lib/utils";

// ── helpers ───────────────────────────────────────────────────────────────────

function formatTime(sec: number): string {
  if (!isFinite(sec) || sec < 0) return "0:00.0";
  const m = Math.floor(sec / 60);
  const s = (sec % 60).toFixed(1).padStart(4, "0");
  return `${m}:${s}`;
}

function newLineId(): string {
  return `line-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ── KaraokePreview (reusable in both admin and tablet) ────────────────────────

interface KaraokeDisplayProps {
  lines: ScriptLine[];
  currentTime: number;
  visibleUpcoming?: number;
}

function KaraokeDisplay({ lines, currentTime, visibleUpcoming = 3 }: KaraokeDisplayProps) {
  const sorted = [...lines].sort((a, b) => a.start - b.start);
  const activeIdx = sorted.findIndex((l) => l.start <= currentTime && currentTime < l.end);
  const prevLine = activeIdx > 0 ? sorted[activeIdx - 1] ?? null : null;
  const currLine = activeIdx >= 0 ? sorted[activeIdx] ?? null : null;
  const upcomingLines =
    activeIdx >= 0
      ? sorted.slice(activeIdx + 1, activeIdx + 1 + visibleUpcoming)
      : sorted.filter((l) => l.start > currentTime).slice(0, visibleUpcoming);
  const nextLine = sorted.find((l) => l.start > currentTime) ?? null;

  const showPrev = prevLine;
  const showCurr = currLine;
  const showUpcoming = currLine ? upcomingLines : nextLine ? [nextLine, ...upcomingLines.slice(0, visibleUpcoming - 1)] : [];
  const atEnd = sorted.length > 0 && !prevLine && !currLine && !nextLine;

  return (
    <div className="rounded-2xl bg-slate-900 px-6 py-5 space-y-1.5 min-h-36">
      {/* Previous */}
      {showPrev && (
        <p className="text-sm text-slate-500 leading-snug">{showPrev.text}</p>
      )}

      {/* Current */}
      {showCurr ? (
        <p className="text-2xl font-bold text-amber-400 leading-tight py-1">{showCurr.text}</p>
      ) : nextLine ? (
        <p className="text-slate-500 italic text-sm">Coming next…</p>
      ) : lines.length > 0 && !atEnd ? (
        <p className="text-slate-600 italic text-sm">—</p>
      ) : null}

      {/* Upcoming */}
      {showUpcoming.map((l, i) => (
        <p
          key={l.id}
          className="text-white leading-snug"
          style={{ fontSize: i === 0 ? "1rem" : "0.88rem", opacity: i === 0 ? 0.9 : 0.65 }}
        >
          {l.text}
        </p>
      ))}

      {atEnd && <p className="text-slate-500 italic text-sm">End of script</p>}
      {lines.length === 0 && (
        <p className="text-slate-600 italic text-sm">No lines yet — add lines above to see the preview.</p>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function MediaDetailPage({ params }: { params: { id: string } }) {
  const mediaId = params.id;

  // Media
  const [media, setMedia] = useState<MediaDoc | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Tabs
  const [activeTab, setActiveTab] = useState<"info" | "script">("info");

  // Script metadata
  const [scriptId, setScriptId] = useState<string | null>(null);
  const [scriptTitle, setScriptTitle] = useState("");
  const [scriptLanguage, setScriptLanguage] = useState("en");

  // Script lines
  const [lines, setLines] = useState<ScriptLine[]>([]);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);

  // Save state
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Video player
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoTime, setVideoTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoPlaying, setVideoPlaying] = useState(false);

  // ── Load media + existing script ─────────────────────────────────────────

  useEffect(() => {
    setLoading(true);
    setLoadErr(null);
    void (async () => {
      try {
        const db = getDb();
        const snap = await getDoc(doc(db, "media", mediaId));
        if (!snap.exists()) {
          setLoadErr("Media not found");
          return;
        }
        const m = { id: snap.id, ...(snap.data() as Omit<MediaDoc, "id">) };
        setMedia(m);
        setScriptTitle(`${m.title} Guide Script`);

        const script = await getScriptByMediaId(mediaId);
        if (script) {
          setScriptId(script.id);
          setScriptTitle(script.title);
          setScriptLanguage(script.language);
          setLines(script.lines);
        }
      } catch (e) {
        setLoadErr(String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [mediaId]);

  // ── Video listeners ───────────────────────────────────────────────────────

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onTime = () => setVideoTime(video.currentTime);
    const onMeta = () => {
      if (isFinite(video.duration)) setVideoDuration(video.duration);
    };
    const onPlay = () => setVideoPlaying(true);
    const onPause = () => setVideoPlaying(false);

    video.addEventListener("timeupdate", onTime);
    video.addEventListener("loadedmetadata", onMeta);
    video.addEventListener("durationchange", onMeta);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    return () => {
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("loadedmetadata", onMeta);
      video.removeEventListener("durationchange", onMeta);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
    };
  }, [media]);

  // ── Video controls ────────────────────────────────────────────────────────

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) void v.play();
    else v.pause();
  }

  function seekBy(delta: number) {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(videoDuration || 0, v.currentTime + delta));
  }

  function seekTo(t: number) {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, t);
  }

  // ── Line operations ───────────────────────────────────────────────────────

  function addLine() {
    const t = round2(videoTime);
    const nl: ScriptLine = {
      id: newLineId(),
      start: t,
      end: round2(t + 4),
      text: "",
      order: lines.length,
    };
    setLines((prev) => [...prev, nl]);
    setSelectedLineId(nl.id);
  }

  function updateLine(id: string, changes: Partial<ScriptLine>) {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...changes } : l)));
    setValidationErrors([]);
  }

  function deleteLine(id: string) {
    setLines((prev) => prev.filter((l) => l.id !== id));
    if (selectedLineId === id) setSelectedLineId(null);
  }

  function moveLine(id: string, dir: "up" | "down") {
    setLines((prev) => {
      const idx = prev.findIndex((l) => l.id === id);
      const swapIdx = dir === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[swapIdx]] = [next[swapIdx]!, next[idx]!];
      return next.map((l, i) => ({ ...l, order: i }));
    });
  }

  function setStartNow(id: string) {
    updateLine(id, { start: round2(videoTime) });
  }

  function setEndNow(id: string) {
    updateLine(id, { end: round2(videoTime) });
  }

  function playLine(line: ScriptLine) {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = line.start;
    void v.play();
  }

  // ── Validation ────────────────────────────────────────────────────────────

  function validate(): string[] {
    const errors: string[] = [];
    const sorted = [...lines].sort((a, b) => a.start - b.start);
    sorted.forEach((l, i) => {
      const n = i + 1;
      if (!l.text.trim()) errors.push(`Line ${n}: text is empty`);
      if (l.start < 0) errors.push(`Line ${n}: start must be ≥ 0`);
      if (l.end <= l.start) errors.push(`Line ${n}: end must be greater than start`);
      if (i > 0 && sorted[i - 1]!.end > l.start) {
        errors.push(`Warning: line ${i} and ${n} have overlapping timings`);
      }
    });
    return errors;
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  async function handleSave() {
    const errs = validate();
    setValidationErrors(errs);
    if (errs.filter((e) => !e.startsWith("Warning")).length > 0) return;

    setSaving(true);
    setSaveErr(null);
    setSaveSuccess(false);
    try {
      const id = await saveScript(
        {
          mediaId,
          title: scriptTitle.trim() || `${media?.title ?? ""} Guide Script`,
          language: scriptLanguage,
          mode: "line",
          lines,
        },
        scriptId ?? undefined,
      );
      setScriptId(id);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch (e) {
      setSaveErr(String(e));
    } finally {
      setSaving(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return <div className="p-10 text-slate-500">Loading…</div>;
  }

  if (loadErr || !media) {
    return (
      <div className="p-10 space-y-3">
        <p className="text-red-600 font-medium">{loadErr ?? "Media not found"}</p>
        <Link href="/media" className="text-sm text-slate-500 hover:underline">← Back to Media</Link>
      </div>
    );
  }

  const isVideo = media.mediaType === "video";

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/media"
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-colors"
        >
          ← Media
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">{media.title}</h1>
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 text-xs font-semibold",
            media.mediaType === "video" ? "bg-violet-100 text-violet-700" : "bg-amber-100 text-amber-700",
          )}
        >
          {media.mediaType}
        </span>
        {media.category && (
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
            {media.category}{media.subcategory ? `/${media.subcategory}` : ""}
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-slate-200">
        {(["info", ...(isVideo ? (["script"] as const) : [])] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-5 py-2.5 text-sm font-semibold border-b-2 transition-colors",
              activeTab === tab
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800",
            )}
          >
            {tab === "script" ? "Guide Script" : "Info"}
          </button>
        ))}
      </div>

      {/* ── INFO TAB ── */}
      {activeTab === "info" && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-sm">
            {[
              ["Title", media.title],
              ["Type", media.mediaType],
              ["Category", `${media.category}${media.subcategory ? `/${media.subcategory}` : ""}`],
              ["Filename", media.filename],
              ...(media.duration != null ? [["Duration", `${media.duration}s`]] : []),
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
                <dd className="mt-0.5 font-medium text-slate-900 break-all">{value}</dd>
              </div>
            ))}
          </dl>
          {isVideo && (
            <video src={media.downloadUrl} controls className="w-full max-h-64 rounded-xl bg-black" />
          )}
          {media.mediaType === "image" && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={media.downloadUrl} alt="" className="max-h-64 rounded-xl" />
          )}
          {isVideo && (
            <p className="text-sm text-slate-500">
              Switch to the <strong>Guide Script</strong> tab to create synchronized karaoke captions for this video.
            </p>
          )}
        </div>
      )}

      {/* ── GUIDE SCRIPT TAB ── */}
      {activeTab === "script" && isVideo && (
        <div className="space-y-6">
          {/* Script metadata */}
          <div className="flex flex-wrap gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-1 min-w-52 flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Script Title
              </label>
              <input
                type="text"
                value={scriptTitle}
                onChange={(e) => setScriptTitle(e.target.value)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Language
              </label>
              <select
                value={scriptLanguage}
                onChange={(e) => setScriptLanguage(e.target.value)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
              >
                <option value="en">English</option>
                <option value="el">Ελληνικά (Greek)</option>
                <option value="de">Deutsch (German)</option>
                <option value="fr">Français (French)</option>
                <option value="es">Español (Spanish)</option>
                <option value="it">Italiano (Italian)</option>
              </select>
            </div>
          </div>

          {/* Main editor — video + lines side by side */}
          <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 items-start">
            {/* ─── Video preview panel ─── */}
            <div className="xl:col-span-2">
              <div className="sticky top-4 space-y-3">
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-black shadow-sm">
                  <video
                    ref={videoRef}
                    src={media.downloadUrl}
                    className="w-full"
                    playsInline
                    preload="metadata"
                  />
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
                  {/* Time + duration */}
                  <div className="flex items-end justify-between">
                    <span className="font-mono text-2xl font-bold tabular-nums text-slate-900">
                      {formatTime(videoTime)}
                    </span>
                    <span className="font-mono text-sm text-slate-400">{formatTime(videoDuration)}</span>
                  </div>

                  {/* Seek bar */}
                  <input
                    type="range"
                    min={0}
                    max={videoDuration || 100}
                    step={0.05}
                    value={videoTime}
                    onChange={(e) => seekTo(Number(e.target.value))}
                    className="w-full accent-blue-600 cursor-pointer"
                  />

                  {/* Play + coarse seek */}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => seekBy(-5)}
                      className="flex-1 rounded-lg border border-slate-200 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      ◀◀ 5s
                    </button>
                    <button
                      type="button"
                      onClick={togglePlay}
                      className="flex-[2] rounded-lg bg-blue-600 py-2 text-sm font-bold text-white hover:bg-blue-700"
                    >
                      {videoPlaying ? "⏸ Pause" : "▶ Play"}
                    </button>
                    <button
                      type="button"
                      onClick={() => seekBy(5)}
                      className="flex-1 rounded-lg border border-slate-200 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      5s ▶▶
                    </button>
                  </div>

                  {/* Fine seek */}
                  <div className="grid grid-cols-4 gap-1.5">
                    {[-0.5, -0.1, 0.1, 0.5].map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => seekBy(d)}
                        className="rounded-lg border border-slate-200 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                      >
                        {d > 0 ? `+${d}` : d}s
                      </button>
                    ))}
                  </div>

                  <p className="text-xs text-slate-400 text-center">
                    Use Set ⏱ buttons on each line to sync timings
                  </p>
                </div>
              </div>
            </div>

            {/* ─── Script lines editor ─── */}
            <div className="xl:col-span-3 space-y-4">
              {/* Validation errors */}
              {validationErrors.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm font-semibold text-amber-800 mb-2">Issues to fix:</p>
                  <ul className="space-y-1">
                    {validationErrors.map((e, i) => (
                      <li
                        key={i}
                        className={cn("text-xs", e.startsWith("Warning") ? "text-amber-700" : "text-red-700 font-medium")}
                      >
                        {e.startsWith("Warning") ? "⚠ " : "✕ "}{e}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Empty state */}
              {lines.length === 0 && (
                <div className="rounded-xl border-2 border-dashed border-slate-200 p-10 text-center">
                  <p className="text-slate-400 font-medium">No lines yet</p>
                  <p className="text-sm text-slate-400 mt-1">
                    Play the video to a timestamp, then click &ldquo;+ Add Line&rdquo; below.
                  </p>
                </div>
              )}

              {/* Lines */}
              {lines.length > 0 && (
                <div className="space-y-3">
                  {lines.map((line, idx) => (
                    <div
                      key={line.id}
                      onClick={() => setSelectedLineId(line.id)}
                      className={cn(
                        "cursor-pointer rounded-xl border p-4 shadow-sm transition-all",
                        selectedLineId === line.id
                          ? "border-blue-400 bg-blue-50 ring-2 ring-blue-200"
                          : "border-slate-200 bg-white hover:border-slate-300",
                      )}
                    >
                      {/* Line header */}
                      <div className="mb-3 flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                          {idx + 1}
                        </span>
                        <span className="font-mono text-xs text-slate-400">
                          {formatTime(line.start)} → {formatTime(line.end)}
                        </span>
                        <div className="ml-auto flex gap-1">
                          <button
                            type="button"
                            title="Move up"
                            disabled={idx === 0}
                            onClick={(e) => { e.stopPropagation(); moveLine(line.id, "up"); }}
                            className="rounded px-1.5 py-1 text-xs text-slate-400 hover:bg-slate-100 disabled:opacity-30"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            title="Move down"
                            disabled={idx === lines.length - 1}
                            onClick={(e) => { e.stopPropagation(); moveLine(line.id, "down"); }}
                            className="rounded px-1.5 py-1 text-xs text-slate-400 hover:bg-slate-100 disabled:opacity-30"
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            title="Delete line"
                            onClick={(e) => { e.stopPropagation(); deleteLine(line.id); }}
                            className="rounded px-1.5 py-1 text-xs text-slate-400 hover:bg-red-50 hover:text-red-600"
                          >
                            ✕
                          </button>
                        </div>
                      </div>

                      {/* Text */}
                      <textarea
                        rows={2}
                        value={line.text}
                        onChange={(e) => updateLine(line.id, { text: e.target.value })}
                        onClick={(e) => e.stopPropagation()}
                        placeholder="Enter the guide text for this line…"
                        className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                      />

                      {/* Timing row */}
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-slate-500">Start</span>
                          <input
                            type="number"
                            step="0.01"
                            min={0}
                            value={line.start}
                            onChange={(e) => updateLine(line.id, { start: round2(Number(e.target.value)) })}
                            onClick={(e) => e.stopPropagation()}
                            className="w-20 rounded-lg border border-slate-200 px-2 py-1 font-mono text-xs focus:border-blue-400 focus:outline-none"
                          />
                          <button
                            type="button"
                            title="Set start to current video time"
                            onClick={(e) => { e.stopPropagation(); setStartNow(line.id); }}
                            className="rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                          >
                            Set ⏱
                          </button>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-slate-500">End</span>
                          <input
                            type="number"
                            step="0.01"
                            min={0}
                            value={line.end}
                            onChange={(e) => updateLine(line.id, { end: round2(Number(e.target.value)) })}
                            onClick={(e) => e.stopPropagation()}
                            className="w-20 rounded-lg border border-slate-200 px-2 py-1 font-mono text-xs focus:border-blue-400 focus:outline-none"
                          />
                          <button
                            type="button"
                            title="Set end to current video time"
                            onClick={(e) => { e.stopPropagation(); setEndNow(line.id); }}
                            className="rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                          >
                            Set ⏱
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); playLine(line); }}
                          className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                        >
                          ▶ Play
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Action bar */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={addLine}
                  className="flex items-center gap-2 rounded-xl border-2 border-dashed border-blue-300 px-4 py-2.5 text-sm font-semibold text-blue-600 hover:border-blue-400 hover:bg-blue-50"
                >
                  + Add Line
                </button>
                <div className="ml-auto flex gap-3">
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className={cn(
                      "rounded-xl px-6 py-2.5 text-sm font-bold text-white transition-colors",
                      saving ? "cursor-not-allowed bg-blue-300" : "bg-blue-600 hover:bg-blue-700",
                    )}
                  >
                    {saving ? "Saving…" : scriptId ? "Save Changes" : "Save Script"}
                  </button>
                </div>
              </div>

              {saveSuccess && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">
                  ✓ Script saved successfully
                </div>
              )}
              {saveErr && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  Error saving: {saveErr}
                </div>
              )}
            </div>
          </div>

          {/* ── Karaoke Preview ── */}
          <div>
            <div className="mb-3 flex items-center gap-3">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">
                Karaoke Preview
              </h3>
              <span className="font-mono text-xs text-slate-400">@ {formatTime(videoTime)}</span>
              {lines.length > 0 && (
                <span className="ml-auto text-xs text-slate-400">{lines.length} line{lines.length !== 1 ? "s" : ""}</span>
              )}
            </div>
            <KaraokeDisplay lines={lines} currentTime={videoTime} />
          </div>
        </div>
      )}
    </div>
  );
}
