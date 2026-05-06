import {
  addDoc,
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
import { getDb } from "@/lib/firebase/client";
import { ONLINE_THRESHOLD_MS } from "@/lib/constants";
import type { TrainDoc } from "@/lib/types";

const COL = "trains";

export async function listTrains(): Promise<TrainDoc[]> {
  const db = getDb();
  const q = query(collection(db, COL), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data() as Omit<TrainDoc, "id">;
    return { id: d.id, ...data };
  });
}

export function isTrainOnline(lastHeartbeat: Timestamp | null | undefined): boolean {
  if (!lastHeartbeat) return false;
  try {
    const t = lastHeartbeat.toMillis();
    return Date.now() - t < ONLINE_THRESHOLD_MS;
  } catch {
    return false;
  }
}

export async function createTrain(name: string): Promise<string> {
  const db = getDb();
  const refDoc = await addDoc(collection(db, COL), {
    name: name.trim() || "Train",
    activePlaylistId: null,
    activePlaylistTitle: null,
    status: "offline",
    lastHeartbeat: null,
    connectedTvs: [],
    createdAt: serverTimestamp(),
  });
  return refDoc.id;
}

export async function assignPlaylistToTrain(
  trainId: string,
  playlistId: string | null,
  playlistTitle: string | null,
): Promise<void> {
  const db = getDb();
  await updateDoc(doc(db, COL, trainId), {
    activePlaylistId: playlistId,
    activePlaylistTitle: playlistTitle,
  });
}

export async function renameTrain(id: string, name: string): Promise<void> {
  const db = getDb();
  await updateDoc(doc(db, COL, id), { name: name.trim() || "Train" });
}

export async function deleteTrain(id: string): Promise<void> {
  const db = getDb();
  await deleteDoc(doc(db, COL, id));
}

/** Set pendingCommand = "WAITING_SCREEN" — the Pi picks this up via onSnapshot */
export async function sendWaitingScreen(trainId: string): Promise<void> {
  const db = getDb();
  await updateDoc(doc(db, COL, trainId), { pendingCommand: "WAITING_SCREEN" });
}

/** Broadcast a sync command to all online trains (used after media/playlist changes). */
export async function sendSyncCommandToAllTrains(
  command: "SYNC_PLAYLIST" | "SYNC_ANNOUNCEMENTS",
): Promise<void> {
  const db = getDb();
  const snap = await getDocs(collection(db, COL));
  await Promise.all(
    snap.docs.map((d) => updateDoc(doc(db, COL, d.id), { pendingCommand: command })),
  );
}

export function formatHeartbeat(ts: Timestamp | null | undefined): string {
  if (!ts) return "Never";
  try {
    return ts.toDate().toLocaleString();
  } catch {
    return "—";
  }
}
