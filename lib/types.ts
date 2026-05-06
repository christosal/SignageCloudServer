import type { Timestamp } from "firebase/firestore";

export type MediaType = "video" | "image";

export interface MediaDoc {
  id: string;
  title: string;
  mediaType: MediaType;
  category: string;
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
}
