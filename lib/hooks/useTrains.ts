"use client";

import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { useEffect, useState } from "react";
import { getDb } from "@/lib/firebase/client";
import type { TrainDoc } from "@/lib/types";

/**
 * Real-time Firestore listener for all trains.
 * Updates instantly when the Pi writes a heartbeat or an admin changes a field.
 */
export function useTrains() {
  const [trains, setTrains] = useState<TrainDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const db = getDb();
    const q = query(collection(db, "trains"), orderBy("createdAt", "desc"));

    const unsub = onSnapshot(
      q,
      (snap) => {
        setTrains(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<TrainDoc, "id">) })),
        );
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );

    return unsub;
  }, []);

  return { trains, loading, error };
}
