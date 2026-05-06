"use client";

import { useAuth } from "@/lib/firebase/auth-context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function HomePage() {
  const { user, loading, authReady } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authReady || loading) return;
    router.replace(user ? "/dashboard" : "/login");
  }, [user, loading, authReady, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">
      Redirecting…
    </div>
  );
}
