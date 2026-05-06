import type { Timestamp } from "firebase/firestore";

export type MediaType = "video" | "image";

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
  pendingCommand?: "WAITING_SCREEN" | null;
  /** Written by Pi: what is currently shown on the TVs */
  currentState?: TrainCurrentState | null;
}
