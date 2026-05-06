import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  type Timestamp,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase/client";
import type { PlaylistDoc, PlaylistItem } from "@/lib/types";

const COL = "playlists";

export async function listPlaylists(): Promise<PlaylistDoc[]> {
  const db = getDb();
  const q = query(collection(db, COL), orderBy("updatedAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data() as Omit<PlaylistDoc, "id">;
    return { id: d.id, ...data };
  });
}

export async function getPlaylist(id: string): Promise<PlaylistDoc | null> {
  const db = getDb();
  const r = doc(db, COL, id);
  const s = await getDoc(r);
  if (!s.exists()) return null;
  return { id: s.id, ...(s.data() as Omit<PlaylistDoc, "id">) };
}

export async function createPlaylist(title: string, loop: boolean): Promise<string> {
  const db = getDb();
  const now = serverTimestamp();
  const refDoc = await addDoc(collection(db, COL), {
    title: title.trim() || "Untitled",
    loop,
    items: [] as PlaylistItem[],
    createdAt: now,
    updatedAt: now,
  });
  return refDoc.id;
}

export async function savePlaylist(
  id: string,
  payload: { title: string; loop: boolean; items: PlaylistItem[] },
): Promise<void> {
  const db = getDb();
  await updateDoc(doc(db, COL, id), {
    title: payload.title.trim(),
    loop: payload.loop,
    items: payload.items,
    updatedAt: serverTimestamp(),
  });
}

export async function deletePlaylist(id: string): Promise<void> {
  const db = getDb();
  await deleteDoc(doc(db, COL, id));
}

export function formatUpdatedAt(ts: Timestamp | undefined | null): string {
  if (!ts) return "—";
  try {
    return ts.toDate().toLocaleString();
  } catch {
    return "—";
  }
}
