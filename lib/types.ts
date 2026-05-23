import type { Timestamp } from "firebase/firestore";

export type MediaType = "video" | "image";

// ── Guide Script ──────────────────────────────────────────────────────────────

export interface ScriptLine {
  id: string;
  /** Start time in seconds (inclusive). */
  start: number;
  /** End time in seconds (exclusive). */
  end: number;
  text: string;
  order: number;
}

export interface ScriptDoc {
  id: string;
  mediaId: string;
  title: string;
  language: string;
  mode: "line";
  lines: ScriptLine[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface MediaDoc {
  id: string;
  title: string;
  mediaType: MediaType;
  category: string;
  /** For announcements: subfolder grouping, e.g. "castle", "stops" */
  subcategory?: string;
  storagePath: string;
  downloadUrl: string;
  filename: string;
  duration: number | null;
  createdAt: Timestamp;
}

export interface PlaylistItem {
  mediaId: string;
  title: string;
  mediaType: MediaType;
  downloadUrl: string;
  duration: number | null;
}

export interface PlaylistDoc {
  id: string;
  title: string;
  loop: boolean;
  items: PlaylistItem[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ConnectedTv {
  name: string;
  /** optional — filled when players report */
  lastSeen?: Timestamp;
}

export interface TrainCurrentState {
  type: "playlist" | "announcement" | "waiting";
  title: string | null;
  playlistTitle?: string | null;
}

/** Latest hardware snapshot from the Pi (heartbeat); optional fields when unavailable */
export interface TrainPiMetrics {
  cpuPercent: number | null;
  cpuTempC: number | null;
  ramUsedPercent: number | null;
  storageFreeBytes: number | null;
  storageTotalBytes: number | null;
  networkIface: string | null;
  netRxBytes: number | null;
  netTxBytes: number | null;
}

export interface TrainWifiStatus {
  supported: boolean;
  connected: boolean;
  ssid: string | null;
  signal: number | null;
  security: string | null;
  device: string | null;
  ip4: string | null;
  updatedAt: string;
  error?: string;
}

export interface TrainWifiNetwork {
  ssid: string;
  bssid?: string | null;
  signal: number | null;
  security: string | null;
  inUse: boolean;
}

export interface TrainWifiScan {
  networks: TrainWifiNetwork[];
  scannedAt?: Timestamp;
}

export interface TrainWifiCommandResult {
  type: "scan" | "connect";
  status: "running" | "success" | "warning" | "error";
  ssid?: string | null;
  message: string;
  startedAt?: Timestamp;
  finishedAt?: Timestamp;
}

export interface TrainDoc {
  id: string;
  name: string;
  activePlaylistId: string | null;
  activePlaylistTitle: string | null;
  /** Convenience denormalized field; UI also derives from lastHeartbeat */
  status: "online" | "offline" | "unknown";
  lastHeartbeat: Timestamp | null;
  connectedTvs: ConnectedTv[];
  createdAt: Timestamp;
  /** Set by cloud admin; Pi watches and executes then clears */
  pendingCommand?: "WAITING_SCREEN" | "SYNC_PLAYLIST" | "SYNC_ANNOUNCEMENTS" | "WIFI_SCAN" | "WIFI_CONNECT" | null;
  /** Written by Pi: what is currently shown on the TVs */
  currentState?: TrainCurrentState | null;
  /** Written by Pi heartbeat: CPU, temp, RAM, disk, network */
  piMetrics?: TrainPiMetrics | null;
  /** Written by Pi heartbeat: current WiFi connection status */
  wifiStatus?: TrainWifiStatus | null;
  /** Written by Pi after a WiFi scan command */
  wifiScan?: TrainWifiScan | null;
  /** Written by Pi after/while executing WiFi commands */
  wifiCommandResult?: TrainWifiCommandResult | null;
}
