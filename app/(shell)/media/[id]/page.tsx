"use client";

import { doc, getDoc } from "firebase/firestore";
import Link from "next/link";
import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
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

/** Split a long text block into segments by chosen mode. */
function splitText(text: string, mode: "sentence" | "newline" | "paragraph"): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (mode === "newline") {
    return trimmed.split(/\r?\n+/).map((s) => s.trim()).filter(Boolean);
  }
  if (mode === "paragraph") {
    return trimmed.split(/\r?\n\s*\r?\n+/).map((s) => s.replace(/\s+/g, " ").trim()).filter(Boolean);
  }
  // Sentence: split on . ! ? ; followed by whitespace; also keep "..." together
  return trimmed
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?;])\s+(?=[A-ZΑ-ΩΆΈΉΊΌΎΏ"“(\[])/u)
    .map((s) => s.trim())
    .filter(Boolean);
}

// ── KaraokeDisplay (admin preview) ────────────────────────────────────────────

interface KaraokeDisplayProps {
  lines: ScriptLine[];
  currentTime: number;
  visibleUpcoming?: number;
}

function KaraokeDisplay({ lines, currentTime, visibleUpcoming = 4 }: KaraokeDisplayProps) {
  const sorted = useMemo(() => [...lines].sort((a, b) => a.start - b.start), [lines]);
  const activeIdx = sorted.findIndex((l) => l.start <= currentTime && currentTime < l.end);
  const firstUpcomingIdx = useMemo(
    () => (activeIdx >= 0 ? -1 : sorted.findIndex((l) => l.start > currentTime)),
    [sorted, currentTime, activeIdx],
  );
  const hasActive = activeIdx >= 0;
  const anchorIdx = hasActive ? activeIdx : firstUpcomingIdx;
  const atEnd = sorted.length > 0 && anchorIdx < 0;

  // Windowed render: 1 line before, up to `visibleUpcoming` after the anchor.
  // Stable React keys (one per ScriptLine.id) mean the same DOM nodes stay
  // mounted across state changes — CSS transitions then animate the
  // per-line `data-state` attribute smoothly with no flicker / duplicates.
  let firstIdx = -1;
  let lastIdx = -1;
  if (anchorIdx >= 0) {
    firstIdx = Math.max(0, anchorIdx - 1);
    lastIdx = Math.min(sorted.length - 1, anchorIdx + visibleUpcoming);
  }
  const visibleLines = firstIdx >= 0 ? sorted.slice(firstIdx, lastIdx + 1) : [];

  return (
    <div className="rounded-2xl bg-slate-900 px-6 py-5 min-h-36 flex flex-col gap-1.5 overflow-hidden">
      {!hasActive && !atEnd && sorted.length > 0 && (
        <p className="text-xs uppercase tracking-wider text-slate-500 italic">Coming next…</p>
      )}

      {visibleLines.map((line) => {
        const realIdx = sorted.indexOf(line);
        let state: 'past' | 'current' | 'next-up' | 'upcoming';
        if (hasActive) {
          if (realIdx < activeIdx) state = 'past';
          else if (realIdx === activeIdx) state = 'current';
          else state = 'upcoming';
        } else {
          state = realIdx === anchorIdx ? 'next-up' : 'upcoming';
        }
        const cls =
          state === 'current'
            ? 'text-2xl font-bold text-amber-400 leading-tight py-1'
            : state === 'past'
              ? 'text-xs text-slate-500 leading-snug opacity-50'
              : state === 'next-up'
                ? 'text-base font-semibold text-amber-200 italic leading-snug'
                : 'text-sm text-slate-200 leading-snug opacity-70';
        return (
          <p
            key={line.id}
            className={`${cls} transition-all duration-500 ease-out`}
          >
            {line.text}
          </p>
        );
      })}

      {atEnd && <p className="text-slate-500 italic text-sm">End of script</p>}
      {lines.length === 0 && (
        <p className="text-slate-600 italic text-sm">No lines yet — add lines above to see the preview.</p>
      )}
    </div>
  );
}

// ── Paste pool — bulk-import segments ─────────────────────────────────────────

interface PastePoolProps {
  videoTime: number;
  existingTexts: Set<string>;
  defaultDurationSec: number;
  onAddLine: (text: string, start: number, end: number) => void;
  onBulkAdd: (segments: string[], startAt: number, perLineDuration: number) => void;
}

function PastePool({ videoTime, existingTexts, defaultDurationSec, onAddLine, onBulkAdd }: PastePoolProps) {
  const [rawText, setRawText] = useState("");
  const [splitMode, setSplitMode] = useState<"sentence" | "newline" | "paragraph">("sentence");
  const [usedSegments, setUsedSegments] = useState<Set<string>>(new Set());

  const segments = useMemo(() => splitText(rawText, splitMode), [rawText, splitMode]);
  const visibleSegments = segments.filter((s) => !usedSegments.has(s));
  const allUsed = segments.length > 0 && visibleSegments.length === 0;

  function handleClickSegment(text: string) {
    const start = round2(videoTime);
    const end = round2(start + defaultDurationSec);
    onAddLine(text, start, end);
    setUsedSegments((prev) => new Set(prev).add(text));
  }

  function handleAddAll() {
    if (visibleSegments.length === 0) return;
    onBulkAdd(visibleSegments, round2(videoTime), defaultDurationSec);
    setUsedSegments((prev) => {
      const next = new Set(prev);
      for (const s of visibleSegments) next.add(s);
      return next;
    });
  }

  function handleReset() {
    setUsedSegments(new Set());
  }

  function handleClear() {
    setRawText("");
    setUsedSegments(new Set());
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-sm font-bold text-slate-900">Paste full script</h3>
        <span className="text-xs text-slate-500">
          Paste once, then click a sentence at the video moment to add it as a line.
        </span>
      </div>

      <textarea
        rows={4}
        value={rawText}
        onChange={(e) => setRawText(e.target.value)}
        placeholder="Paste your full guide script here. It will be split into clickable segments below."
        className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
      />

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs font-semibold text-slate-500">Split by</label>
        <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs">
          {([
            ["sentence", "Sentence"],
            ["newline", "Line"],
            ["paragraph", "Paragraph"],
          ] as const).map(([val, label]) => (
            <button
              key={val}
              type="button"
              onClick={() => setSplitMode(val)}
              className={cn(
                "px-3 py-1.5 font-semibold transition-colors",
                splitMode === val ? "bg-blue-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {segments.length > 0 && (
          <>
            <span className="text-xs text-slate-400">
              {visibleSegments.length} of {segments.length} segments
            </span>
            <div className="ml-auto flex gap-2">
              {usedSegments.size > 0 && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Reset used
                </button>
              )}
              <button
                type="button"
                onClick={handleClear}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Clear
              </button>
              {visibleSegments.length > 0 && (
                <button
                  type="button"
                  onClick={handleAddAll}
                  title={`Adds all ${visibleSegments.length} remaining segments as sequential lines starting at ${formatTime(videoTime)}`}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
                >
                  + Add all as sequential lines
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Segment chips */}
      {segments.length > 0 && (
        <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
          {segments.map((seg, i) => {
            const isUsed = usedSegments.has(seg);
            const isInLines = existingTexts.has(seg.trim());
            return (
              <button
                key={`${i}-${seg.slice(0, 30)}`}
                type="button"
                disabled={isUsed}
                onClick={() => handleClickSegment(seg)}
                title={
                  isUsed
                    ? "Already added — click Reset used to add again"
                    : `Add as line starting at ${formatTime(videoTime)}`
                }
                className={cn(
                  "w-full text-left rounded-lg border px-3 py-2 text-sm transition-all flex items-start gap-2",
                  isUsed
                    ? "border-slate-100 bg-slate-50 text-slate-400 cursor-not-allowed line-through"
                    : isInLines
                      ? "border-amber-200 bg-amber-50 text-amber-900 hover:border-amber-400"
                      : "border-slate-200 bg-white text-slate-800 hover:border-blue-400 hover:bg-blue-50 cursor-pointer",
                )}
              >
                <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-500 mt-0.5">
                  {i + 1}
                </span>
                <span className="flex-1 leading-snug">{seg}</span>
                {!isUsed && (
                  <span className="text-xs font-bold text-blue-500 flex-shrink-0">+ Add</span>
                )}
                {isInLines && !isUsed && (
                  <span className="text-[10px] font-semibold text-amber-700 flex-shrink-0 mt-0.5">in script</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {rawText.trim() && segments.length === 0 && (
        <p className="text-xs text-slate-400 italic">No segments detected — try a different split mode.</p>
      )}

      {allUsed && (
        <p className="text-xs text-emerald-700 font-medium">✓ All segments added to script. Click &ldquo;Reset used&rdquo; to add again, or clear to paste new text.</p>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function MediaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: mediaId } = use(params);

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
  const [defaultDurationSec, setDefaultDurationSec] = useState(4);

  // Script lines
  const [lines, setLines] = useState<ScriptLine[]>([]);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [showPastePool, setShowPastePool] = useState(false);

  // Save state
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Video player state
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null);
  const [videoTime, setVideoTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [videoErr, setVideoErr] = useState<string | null>(null);

  // ── Callback ref: attach listeners whenever the <video> element mounts ────

  const videoRef = useCallback((el: HTMLVideoElement | null) => {
    setVideoEl(el);
  }, []);

  useEffect(() => {
    const video = videoEl;
    if (!video) return;

    const onTime = () => setVideoTime(video.currentTime);
    const onMeta = () => {
      if (isFinite(video.duration) && video.duration > 0) {
        setVideoDuration(video.duration);
      }
    };
    const onPlay = () => setVideoPlaying(true);
    const onPause = () => setVideoPlaying(false);
    const onSeeked = () => setVideoTime(video.currentTime);
    const onError = () => {
      const err = video.error;
      setVideoErr(err ? `Video error (${err.code}): ${err.message || "could not load"}` : "Video error");
    };

    video.addEventListener("timeupdate", onTime);
    video.addEventListener("loadedmetadata", onMeta);
    video.addEventListener("durationchange", onMeta);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("error", onError);

    // Seed current state from element (covers tab-switch remount)
    setVideoTime(video.currentTime);
    if (isFinite(video.duration) && video.duration > 0) setVideoDuration(video.duration);
    setVideoPlaying(!video.paused);

    return () => {
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("loadedmetadata", onMeta);
      video.removeEventListener("durationchange", onMeta);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
    };
  }, [videoEl]);

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

  // ── Video controls ────────────────────────────────────────────────────────

  function togglePlay() {
    if (!videoEl) return;
    if (videoEl.paused) {
      void videoEl.play().catch((e) => setVideoErr(String(e)));
    } else {
      videoEl.pause();
    }
  }

  function seekBy(delta: number) {
    if (!videoEl) return;
    videoEl.currentTime = Math.max(0, Math.min(videoDuration || videoEl.duration || 0, videoEl.currentTime + delta));
  }

  function seekTo(t: number) {
    if (!videoEl) return;
    videoEl.currentTime = Math.max(0, t);
  }

  // ── Line operations ───────────────────────────────────────────────────────

  function addLine() {
    const t = round2(videoTime);
    const nl: ScriptLine = {
      id: newLineId(),
      start: t,
      end: round2(t + defaultDurationSec),
      text: "",
      order: lines.length,
    };
    setLines((prev) => [...prev, nl]);
    setSelectedLineId(nl.id);
  }

  function addLineFromPaste(text: string, start: number, end: number) {
    const nl: ScriptLine = {
      id: newLineId(),
      start,
      end,
      text,
      order: lines.length,
    };
    setLines((prev) => [...prev, nl].sort((a, b) => a.start - b.start).map((l, i) => ({ ...l, order: i })));
  }

  function bulkAddSequentialLines(segments: string[], startAt: number, perLineDuration: number) {
    const newLines: ScriptLine[] = segments.map((text, i) => ({
      id: newLineId(),
      start: round2(startAt + i * perLineDuration),
      end: round2(startAt + (i + 1) * perLineDuration),
      text,
      order: lines.length + i,
    }));
    setLines((prev) =>
      [...prev, ...newLines].sort((a, b) => a.start - b.start).map((l, i) => ({ ...l, order: i })),
    );
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
    if (!videoEl) return;
    videoEl.currentTime = line.start;
    void videoEl.play().catch((e) => setVideoErr(String(e)));
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

  // ── Derived ───────────────────────────────────────────────────────────────

  const existingTexts = useMemo(() => new Set(lines.map((l) => l.text.trim()).filter(Boolean)), [lines]);

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
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Default line duration
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  step="0.5"
                  min={0.5}
                  max={30}
                  value={defaultDurationSec}
                  onChange={(e) => setDefaultDurationSec(Math.max(0.5, Number(e.target.value) || 4))}
                  className="w-20 rounded-lg border border-slate-200 px-2 py-2 text-sm focus:border-blue-400 focus:outline-none"
                />
                <span className="text-xs text-slate-500">sec</span>
              </div>
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
                    key={media.downloadUrl}
                    src={media.downloadUrl}
                    className="w-full block"
                    playsInline
                    preload="auto"
                    controls
                  />
                </div>

                {videoErr && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                    {videoErr}
                  </div>
                )}

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
                    max={videoDuration || 0.1}
                    step={0.05}
                    value={Math.min(videoTime, videoDuration || videoTime)}
                    onChange={(e) => seekTo(Number(e.target.value))}
                    disabled={!videoEl || videoDuration <= 0}
                    className="w-full accent-blue-600 cursor-pointer disabled:opacity-50"
                  />

                  {/* Play + coarse seek */}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => seekBy(-5)}
                      disabled={!videoEl}
                      className="flex-1 rounded-lg border border-slate-200 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                    >
                      ◀◀ 5s
                    </button>
                    <button
                      type="button"
                      onClick={togglePlay}
                      disabled={!videoEl}
                      className="flex-[2] rounded-lg bg-blue-600 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-40"
                    >
                      {videoPlaying ? "⏸ Pause" : "▶ Play"}
                    </button>
                    <button
                      type="button"
                      onClick={() => seekBy(5)}
                      disabled={!videoEl}
                      className="flex-1 rounded-lg border border-slate-200 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
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
                        disabled={!videoEl}
                        className="rounded-lg border border-slate-200 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                      >
                        {d > 0 ? `+${d}` : d}s
                      </button>
                    ))}
                  </div>

                  <p className="text-xs text-slate-400 text-center">
                    Use Set ⏱ on each line to sync timings
                  </p>
                </div>
              </div>
            </div>

            {/* ─── Script lines editor ─── */}
            <div className="xl:col-span-3 space-y-4">
              {/* Paste pool toggle + open */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowPastePool((v) => !v)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition-colors",
                    showPastePool
                      ? "bg-slate-900 text-white hover:bg-slate-800"
                      : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
                  )}
                >
                  📋 {showPastePool ? "Hide paste pool" : "Paste full script…"}
                </button>
                {lines.length > 0 && (
                  <span className="ml-auto text-xs text-slate-500">{lines.length} line{lines.length !== 1 ? "s" : ""}</span>
                )}
              </div>

              {/* Paste pool */}
              {showPastePool && (
                <PastePool
                  videoTime={videoTime}
                  existingTexts={existingTexts}
                  defaultDurationSec={defaultDurationSec}
                  onAddLine={addLineFromPaste}
                  onBulkAdd={bulkAddSequentialLines}
                />
              )}

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
              {lines.length === 0 && !showPastePool && (
                <div className="rounded-xl border-2 border-dashed border-slate-200 p-10 text-center">
                  <p className="text-slate-400 font-medium">No lines yet</p>
                  <p className="text-sm text-slate-400 mt-1">
                    Click <strong>📋 Paste full script…</strong> to bulk-import, or play the video to a moment and click <strong>+ Add Line</strong>.
                  </p>
                </div>
              )}

              {/* Lines */}
              {lines.length > 0 && (
                <div className="space-y-3">
                  {lines.map((line, idx) => {
                    const isActiveInPreview =
                      line.start <= videoTime && videoTime < line.end;
                    return (
                      <div
                        key={line.id}
                        onClick={() => setSelectedLineId(line.id)}
                        className={cn(
                          "cursor-pointer rounded-xl border p-4 shadow-sm transition-all",
                          isActiveInPreview
                            ? "border-amber-400 bg-amber-50 ring-2 ring-amber-200"
                            : selectedLineId === line.id
                              ? "border-blue-400 bg-blue-50 ring-2 ring-blue-200"
                              : "border-slate-200 bg-white hover:border-slate-300",
                        )}
                      >
                        {/* Line header */}
                        <div className="mb-3 flex items-center gap-2">
                          <span
                            className={cn(
                              "flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold",
                              isActiveInPreview ? "bg-amber-500 text-white" : "bg-slate-100 text-slate-600",
                            )}
                          >
                            {idx + 1}
                          </span>
                          <span className="font-mono text-xs text-slate-500">
                            {formatTime(line.start)} → {formatTime(line.end)}
                            <span className="ml-2 text-slate-400">({(line.end - line.start).toFixed(1)}s)</span>
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
                    );
                  })}
                </div>
              )}

              {/* Action bar */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={addLine}
                  className="flex items-center gap-2 rounded-xl border-2 border-dashed border-blue-300 px-4 py-2.5 text-sm font-semibold text-blue-600 hover:border-blue-400 hover:bg-blue-50"
                >
                  + Add Line at {formatTime(videoTime)}
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
