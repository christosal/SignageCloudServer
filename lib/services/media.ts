import {
  addDoc,
  arrayRemove,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  type Timestamp,
} from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { getDb, getFirebaseStorage } from "@/lib/firebase/client";
import type { MediaDoc, MediaType, PlaylistDoc } from "@/lib/types";
import type { MediaCategory } from "@/lib/constants";

const COL = "media";

/** Update the duration field of a media document. */
export async function updateMediaDuration(id: string, durationSeconds: number): Promise<void> {
  const db = getDb();
  await updateDoc(doc(db, COL, id), { duration: durationSeconds });
}

function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export function detectMediaType(file: File): MediaType | null {
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("image/")) return "image";
  return null;
}

export async function listMedia(): Promise<MediaDoc[]> {
  const db = getDb();
  const q = query(collection(db, COL), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data() as Omit<MediaDoc, "id">;
    return { id: d.id, ...data };
  });
}

export async function uploadMedia(params: {
  file: File;
  title: string;
  category: MediaCategory;
  subcategory?: string;
  durationSeconds: number | null;
}): Promise<string> {
  const { file, title, category, subcategory, durationSeconds } = params;
  const mediaType = detectMediaType(file);
  if (!mediaType) {
    throw new Error("File must be a video or image");
  }

  const db = getDb();
  const storage = getFirebaseStorage();
  const safeName = sanitizeFilename(file.name);
  const subPath = subcategory ? `${category}/${subcategory.trim()}` : category;
  const storagePath = `media/${subPath}/${Date.now()}_${safeName}`;
  const storageRef = ref(storage, storagePath);
  await uploadBytes(storageRef, file, { contentType: file.type || undefined });
  const downloadUrl = await getDownloadURL(storageRef);

  const duration =
    mediaType === "image" ? durationSeconds ?? 6 : durationSeconds ?? null;

  const docData: Record<string, unknown> = {
    title: title.trim() || safeName,
    mediaType,
    category,
    storagePath,
    downloadUrl,
    filename: file.name,
    duration,
    createdAt: serverTimestamp(),
  };
  if (subcategory) docData['subcategory'] = subcategory.trim();

  const refDoc = await addDoc(collection(db, COL), docData);
  return refDoc.id;
}

export async function deleteMedia(item: MediaDoc): Promise<void> {
  const db = getDb();
  const storage = getFirebaseStorage();
  try {
    await deleteObject(ref(storage, item.storagePath));
  } catch {
    /* file may already be gone */
  }
  await deleteDoc(doc(db, COL, item.id));
}

/** Returns playlists that contain this media item. */
export async function findPlaylistsContainingMedia(mediaId: string): Promise<PlaylistDoc[]> {
  const db = getDb();
  const snap = await getDocs(query(collection(db, "playlists"), orderBy("updatedAt", "desc")));
  const affected: PlaylistDoc[] = [];
  for (const d of snap.docs) {
    const pl = { id: d.id, ...(d.data() as Omit<PlaylistDoc, "id">) };
    if ((pl.items ?? []).some((it) => it.mediaId === mediaId)) {
      affected.push(pl);
    }
  }
  return affected;
}

/**
 * Full cascade delete:
 * 1. Remove from Storage + Firestore media collection
 * 2. Remove item from all playlist items arrays
 * 3. Return IDs of trains whose active playlist was modified (for sync)
 */
export async function deleteMediaCascade(
  item: MediaDoc,
  affectedPlaylists: PlaylistDoc[],
): Promise<string[]> {
  const db = getDb();
  const storage = getFirebaseStorage();

  // Remove from Storage
  try { await deleteObject(ref(storage, item.storagePath)); } catch { /* already gone */ }

  // Remove item from all affected playlists
  const playlistItem = { mediaId: item.id };
  await Promise.all(
    affectedPlaylists.map((pl) =>
      updateDoc(doc(db, "playlists", pl.id), {
        items: (pl.items ?? []).filter((it) => it.mediaId !== item.id),
        updatedAt: serverTimestamp(),
      }),
    ),
  );

  // Delete the media doc
  await deleteDoc(doc(db, COL, item.id));

  // Find trains that use any of the affected playlists
  const affectedPlaylistIds = new Set(affectedPlaylists.map((p) => p.id));
  const trainSnap = await getDocs(collection(db, "trains"));
  const affectedTrainIds: string[] = [];
  for (const t of trainSnap.docs) {
    const pid = t.data()["activePlaylistId"] as string | null;
    if (pid && affectedPlaylistIds.has(pid)) {
      affectedTrainIds.push(t.id);
    }
  }

  // Tell each affected train to re-sync its playlist
  await Promise.all(
    affectedTrainIds.map((tid) =>
      updateDoc(doc(db, "trains", tid), { pendingCommand: "SYNC_PLAYLIST" }),
    ),
  );

  return affectedTrainIds;
}

export function formatCreatedAt(ts: Timestamp | undefined | null): string {
  if (!ts) return "—";
  try {
    return ts.toDate().toLocaleString();
  } catch {
    return "—";
  }
}
