/** Consider a train "online" if heartbeat is newer than this (ms). */
export const ONLINE_THRESHOLD_MS = 2 * 60 * 1000;

export const MEDIA_CATEGORIES = ["videos", "images", "announcements"] as const;
export type MediaCategory = (typeof MEDIA_CATEGORIES)[number];
