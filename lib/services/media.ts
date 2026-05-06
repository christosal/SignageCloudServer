import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  type Timestamp,
} from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { getDb, getFirebaseStorage } from "@/lib/firebase/client";
import type { MediaDoc, MediaType } from "@/lib/types";
import type { MediaCategory } from "@/lib/constants";

const COL = "media";

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
  durationSeconds: number | null;
}): Promise<string> {
  const { file, title, category, durationSeconds } = params;
  const mediaType = detectMediaType(file);
  if (!mediaType) {
    throw new Error("File must be a video or image");
  }

  const db = getDb();
  const storage = getFirebaseStorage();
  const safeName = sanitizeFilename(file.name);
  const storagePath = `media/${category}/${Date.now()}_${safeName}`;
  const storageRef = ref(storage, storagePath);
  await uploadBytes(storageRef, file, { contentType: file.type || undefined });
  const downloadUrl = await getDownloadURL(storageRef);

  const duration =
    mediaType === "image" ? durationSeconds ?? 6 : null;

  const refDoc = await addDoc(collection(db, COL), {
    title: title.trim() || safeName,
    mediaType,
    category,
    storagePath,
    downloadUrl,
    filename: file.name,
    duration,
    createdAt: serverTimestamp(),
  });

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

export function formatCreatedAt(ts: Timestamp | undefined | null): string {
  if (!ts) return "—";
  try {
    return ts.toDate().toLocaleString();
  } catch {
    return "—";
  }
}
