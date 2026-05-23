"use client";

import {
  assignPlaylistToTrain,
  formatHeartbeat,
  isTrainOnline,
  renameTrain,
  sendWaitingScreen,
  sendWifiConnect,
  sendWifiScan,
} from "@/lib/services/trains";
import { listPlaylists } from "@/lib/services/playlists";
import { useTrains } from "@/lib/hooks/useTrains";
import type { PlaylistDoc, TrainDoc } from "@/lib/types";
import { TrainPiMetricsGrid } from "@/components/train-pi-metrics";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

export default function TrainsPage() {
  const { trains, loading, error: liveError } = useTrains();
  const [playlists, setPlaylists] = useState<PlaylistDoc[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<Record<string, string>>({});
  const [waitingBusy, setWaitingBusy] = useState<Record<string, boolean>>({});
  const [wifiBusy, setWifiBusy] = useState<Record<string, boolean>>({});
  const [wifiForm, setWifiForm] = useState<Record<string, { ssid: string; password: string }>>({});
  const [confirmClear, setConfirmClear] = useState<{ trainId: string; trainName: string } | null>(null);

  const onlineCount = trains.filter((t) => isTrainOnline(t.lastHeartbeat)).length;
  const totalTvs = trains.reduce((s, t) => s + (t.connectedTvs?.length ?? 0), 0);

  useEffect(() => {
    listPlaylists().then(setPlaylists).catch(() => null);
  }, []);

  const displayError = liveError ?? err;

  async function onAssign(trainId: string, playlistId: string) {
    setErr(null);
    // Picking "None" clears the active playlist and switches the train to the
    // waiting screen — confirm first because it visibly stops playback on every TV.
    if (playlistId === "") {
      const train = trains.find((t) => t.id === trainId);
      if (train?.activePlaylistId) {
        setConfirmClear({ trainId, trainName: train.name });
        return;
      }
    }
    const pl = playlistId === "" ? null : playlists.find((p) => p.id === playlistId) ?? null;
    try {
      await assignPlaylistToTrain(trainId, pl?.id ?? null, pl?.title ?? null);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Assign failed");
    }
  }

  async function confirmClearActive() {
    if (!confirmClear) return;
    const { trainId } = confirmClear;
    setConfirmClear(null);
    setErr(null);
    try {
      await assignPlaylistToTrain(trainId, null, null);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Clear failed");
    }
  }

  async function onRename(trainId: string) {
    const name = renaming[trainId]?.trim();
    if (!name) return;
    setErr(null);
    try {
      await renameTrain(trainId, name);
      setRenaming((r) => { const n = { ...r }; delete n[trainId]; return n; });
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Rename failed");
    }
  }

  async function onWaitingScreen(trainId: string) {
    setWaitingBusy((b) => ({ ...b, [trainId]: true }));
    setErr(null);
    try {
      await sendWaitingScreen(trainId);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Command failed");
    } finally {
      setWaitingBusy((b) => ({ ...b, [trainId]: false }));
    }
  }

  async function onWifiScan(trainId: string) {
    setWifiBusy((b) => ({ ...b, [trainId]: true }));
    setErr(null);
    try {
      await sendWifiScan(trainId);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "WiFi scan command failed");
    } finally {
      setWifiBusy((b) => ({ ...b, [trainId]: false }));
    }
  }

  async function onWifiConnect(trainId: string) {
    const form = wifiForm[trainId];
    const ssid = form?.ssid?.trim();
    if (!ssid) {
      setErr("Select or enter a WiFi network name first.");
      return;
    }
    const ok = window.confirm(
      `Connect this Pi to "${ssid}"?\n\nIf the password/network is wrong, the Pi may temporarily lose cloud access until it reconnects to a known WiFi.`,
    );
    if (!ok) return;
    setWifiBusy((b) => ({ ...b, [trainId]: true }));
    setErr(null);
    try {
      await sendWifiConnect(trainId, ssid, form?.password ?? "");
      setWifiForm((prev) => ({ ...prev, [trainId]: { ssid, password: "" } }));
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "WiFi connect command failed");
    } finally {
      setWifiBusy((b) => ({ ...b, [trainId]: false }));
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Trains</h1>
          <p className="mt-1 text-slate-500">
            Live status · assign playlists · monitor hardware
          </p>
        </div>
        <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
          Live
        </span>
      </div>

      {/* Summary cards */}
      {!loading && (
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Total trains</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{trains.length}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Online</p>
            <p className="mt-1 text-3xl font-bold text-emerald-600">{onlineCount}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Connected TVs</p>
            <p className="mt-1 text-3xl font-bold text-blue-600">{totalTvs}</p>
          </div>
        </div>
      )}

      {displayError ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {displayError}
        </p>
      ) : null}

      <div className="space-y-4">
        {loading ? (
          <p className="text-sm text-slate-500">Connecting…</p>
        ) : trains.length === 0 ? (
          <p className="text-sm text-slate-500">No trains yet. Start the local server on a Pi to register one automatically.</p>
        ) : (
          trains.map((t) => {
            const online = isTrainOnline(t.lastHeartbeat);
            const tvs = t.connectedTvs ?? [];
            const isRenaming = renaming[t.id] !== undefined;
            const state = t.currentState ?? null;

            return (
              <div
                key={t.id}
                className={cn(
                  "rounded-xl border bg-white p-5 shadow-sm",
                  online ? "border-emerald-200" : "border-slate-200",
                )}
              >
                {/* Top row: name + badges + actions */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-3">
                    {/* Rename inline */}
                    {isRenaming ? (
                      <div className="flex items-center gap-2">
                        <input
                          autoFocus
                          value={renaming[t.id]}
                          onChange={(e) =>
                            setRenaming((r) => ({ ...r, [t.id]: e.target.value }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") void onRename(t.id);
                            if (e.key === "Escape")
                              setRenaming((r) => { const n = { ...r }; delete n[t.id]; return n; });
                          }}
                          className="rounded-lg border border-brand-400 px-2 py-1 text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-brand-500"
                        />
                        <button
                          type="button"
                          onClick={() => void onRename(t.id)}
                          className="rounded-md bg-brand-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-brand-900"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setRenaming((r) => { const n = { ...r }; delete n[t.id]; return n; })
                          }
                          className="text-xs text-slate-500 hover:text-slate-700"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        title="Click to rename"
                        onClick={() => setRenaming((r) => ({ ...r, [t.id]: t.name }))}
                        className="text-base font-semibold text-slate-900 hover:text-brand-700"
                      >
                        {t.name}
                        <span className="ml-1.5 text-xs font-normal text-slate-400">✎</span>
                      </button>
                    )}

                    {/* Online / Offline */}
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
                        online ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500",
                      )}
                    >
                      {online && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />}
                      {online ? "Online" : "Offline"}
                    </span>

                    {/* TV count */}
                    {tvs.length > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                        📺 {tvs.length} TV{tvs.length > 1 ? "s" : ""}
                      </span>
                    )}

                    {/* Now playing */}
                    {state && (
                      <span className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                        state.type === "waiting"
                          ? "bg-sky-100 text-sky-700"
                          : state.type === "announcement"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-violet-100 text-violet-700",
                      )}>
                        {state.type === "waiting" ? "⏳ Waiting Screen"
                          : state.type === "announcement" ? `📢 ${state.title ?? "Announcement"}`
                          : `▶ ${state.title ?? state.playlistTitle ?? "Playlist"}`}
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">{formatHeartbeat(t.lastHeartbeat)}</span>
                    {online && (
                      <button
                        type="button"
                        disabled={waitingBusy[t.id]}
                        onClick={() => void onWaitingScreen(t.id)}
                        className={cn(
                          "rounded-lg border px-3 py-1 text-xs font-semibold transition-colors",
                          waitingBusy[t.id]
                            ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                            : "border-sky-300 bg-sky-50 text-sky-700 hover:bg-sky-100",
                        )}
                      >
                        {waitingBusy[t.id] ? "Sending…" : "⏳ Waiting Screen"}
                      </button>
                    )}
                  </div>
                </div>

                {/* Hardware metrics */}
                <TrainPiMetricsGrid metrics={t.piMetrics} online={online} compact />

                <WifiSettings
                  train={t}
                  busy={Boolean(wifiBusy[t.id])}
                  form={wifiForm[t.id] ?? { ssid: "", password: "" }}
                  onFormChange={(next) => setWifiForm((prev) => ({ ...prev, [t.id]: next }))}
                  onScan={() => void onWifiScan(t.id)}
                  onConnect={() => void onWifiConnect(t.id)}
                />

                {/* Management row */}
                <div className="mt-4 flex flex-wrap items-center gap-6 border-t border-slate-100 pt-4 text-sm">
                  <div>
                    <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      Active playlist
                    </span>
                    <div className="mt-0.5">
                      <select
                        value={t.activePlaylistId ?? ""}
                        onChange={(e) => void onAssign(t.id, e.target.value)}
                        className="rounded-lg border border-slate-300 px-2 py-1 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                      >
                        <option value="">— None —</option>
                        {playlists.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {tvs.length > 0 && (
                    <div>
                      <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
                        Connected TVs
                      </span>
                      <p className="mt-0.5 text-xs text-slate-600">
                        {tvs.map((c) => c.name).join(", ")}
                      </p>
                    </div>
                  )}

                  <div className="ml-auto">
                    <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      Device ID
                    </span>
                    <p className="mt-0.5 font-mono text-xs text-slate-400">{t.id}</p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Confirmation modal: clearing active playlist */}
      {confirmClear && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => setConfirmClear(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-slate-900">Σταμάτημα playlist;</h3>
            <p className="mt-2 text-sm text-slate-600">
              Όλα τα TVs του τραίνου <span className="font-semibold">{confirmClear.trainName}</span>{" "}
              θα μεταβούν στο Waiting Screen και η αναπαραγωγή θα σταματήσει.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setConfirmClear(null)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Ακύρωση
              </button>
              <button
                onClick={confirmClearActive}
                className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
              >
                Ναι, σταμάτα
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function WifiSettings({
  train,
  busy,
  form,
  onFormChange,
  onScan,
  onConnect,
}: {
  train: TrainDoc;
  busy: boolean;
  form: { ssid: string; password: string };
  onFormChange: (next: { ssid: string; password: string }) => void;
  onScan: () => void;
  onConnect: () => void;
}) {
  const wifi = train.wifiStatus ?? null;
  const networks = train.wifiScan?.networks ?? [];
  const result = train.wifiCommandResult ?? null;
  const running = result?.status === "running" || busy;
  const scannedAt = train.wifiScan?.scannedAt
    ? formatHeartbeat(train.wifiScan.scannedAt)
    : null;

  return (
    <div className="mt-4 rounded-xl border border-sky-100 bg-sky-50/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">
            WiFi Settings
          </p>
          <p className="mt-1 text-sm text-slate-700">
            {wifi?.supported === false ? (
              <span className="font-medium text-amber-700">
                WiFi tools unavailable{wifi.error ? `: ${wifi.error}` : ""}
              </span>
            ) : wifi?.connected ? (
              <>
                Connected to <span className="font-semibold text-slate-900">{wifi.ssid}</span>
                {wifi.signal !== null && wifi.signal !== undefined ? (
                  <span className="text-slate-500"> · {wifi.signal}% signal</span>
                ) : null}
                {wifi.ip4 ? <span className="text-slate-500"> · {wifi.ip4}</span> : null}
              </>
            ) : (
              <span className="font-medium text-slate-600">Not connected / unknown</span>
            )}
          </p>
          {wifi?.device ? (
            <p className="mt-0.5 text-xs text-slate-500">
              Device: <code>{wifi.device}</code>
              {wifi.security ? <> · Security: {wifi.security}</> : null}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          disabled={running}
          onClick={onScan}
          className={cn(
            "rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
            running
              ? "cursor-not-allowed border-slate-200 bg-white text-slate-400"
              : "border-sky-300 bg-white text-sky-700 hover:bg-sky-100",
          )}
        >
          {running && result?.type === "scan" ? "Scanning…" : "Scan WiFi"}
        </button>
      </div>

      {result ? (
        <p
          className={cn(
            "mt-3 rounded-lg px-3 py-2 text-xs",
            result.status === "success"
              ? "bg-emerald-50 text-emerald-700"
              : result.status === "error"
              ? "bg-red-50 text-red-700"
              : result.status === "warning"
              ? "bg-amber-50 text-amber-700"
              : "bg-white text-slate-600",
          )}
        >
          {result.message}
        </p>
      ) : null}

      <div className="mt-3 grid gap-3 md:grid-cols-[1.2fr_1fr_auto]">
        <div>
          <label className="text-xs font-medium text-slate-500">Network name</label>
          <input
            list={`wifi-networks-${train.id}`}
            value={form.ssid}
            onChange={(e) => onFormChange({ ...form, ssid: e.target.value })}
            placeholder="Select or type SSID"
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
          <datalist id={`wifi-networks-${train.id}`}>
            {networks.map((n) => (
              <option key={n.ssid} value={n.ssid}>
                {n.signal ?? "?"}% {n.security ?? "open"}
              </option>
            ))}
          </datalist>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500">Password</label>
          <input
            type="password"
            value={form.password}
            onChange={(e) => onFormChange({ ...form, password: e.target.value })}
            placeholder="Leave empty for open WiFi"
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
        </div>
        <div className="flex items-end">
          <button
            type="button"
            disabled={running || !form.ssid.trim()}
            onClick={onConnect}
            className={cn(
              "w-full rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors md:w-auto",
              running || !form.ssid.trim()
                ? "cursor-not-allowed bg-slate-300"
                : "bg-sky-700 hover:bg-sky-800",
            )}
          >
            {running && result?.type === "connect" ? "Connecting…" : "Connect"}
          </button>
        </div>
      </div>

      {networks.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {networks.slice(0, 8).map((n) => (
            <button
              type="button"
              key={n.ssid}
              onClick={() => onFormChange({ ...form, ssid: n.ssid })}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs font-medium",
                n.inUse
                  ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
              )}
            >
              {n.inUse ? "✓ " : ""}
              {n.ssid}
              {n.signal !== null && n.signal !== undefined ? ` · ${n.signal}%` : ""}
            </button>
          ))}
          {scannedAt ? <span className="self-center text-xs text-slate-400">Scanned {scannedAt}</span> : null}
        </div>
      ) : null}

      <p className="mt-3 text-xs text-slate-500">
        Password is sent only as a temporary command. The Pi clears it from Firestore after pickup.
      </p>
    </div>
  );
}
