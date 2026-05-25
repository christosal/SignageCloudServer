/** Consider a train "online" if heartbeat is newer than this (ms). */
export const ONLINE_THRESHOLD_MS = 2 * 60 * 1000;

export const LEARN_GREEK_WORD_CATEGORY = "learn_greek_word" as const;

export const MEDIA_CATEGORIES = ["videos", "images", "announcements", LEARN_GREEK_WORD_CATEGORY] as const;
export type MediaCategory = (typeof MEDIA_CATEGORIES)[number];
