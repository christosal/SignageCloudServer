import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase/client";
import type { ScriptDoc, ScriptLine } from "@/lib/types";

const COL = "scripts";

export async function getScriptByMediaId(mediaId: string): Promise<ScriptDoc | null> {
  const db = getDb();
  const q = query(collection(db, COL), where("mediaId", "==", mediaId));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0]!;
  return { id: d.id, ...(d.data() as Omit<ScriptDoc, "id">) };
}

export async function saveScript(
  data: {
    mediaId: string;
    title: string;
    language: string;
    mode: "line";
    lines: ScriptLine[];
  },
  existingId?: string,
): Promise<string> {
  const db = getDb();
  const sorted = [...data.lines]
    .sort((a, b) => a.start - b.start)
    .map((l, i) => ({ ...l, order: i }));

  if (existingId) {
    await updateDoc(doc(db, COL, existingId), {
      ...data,
      lines: sorted,
      updatedAt: serverTimestamp(),
    });
    return existingId;
  }

  const ref = await addDoc(collection(db, COL), {
    ...data,
    lines: sorted,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}
