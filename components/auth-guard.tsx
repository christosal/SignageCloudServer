"use client";

import { useAuth } from "@/lib/firebase/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

export function AuthGuard({ children }: { children: ReactNode }) {
  const { user, loading, authReady } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading || !authReady) return;
    if (!user) router.replace("/login");
  }, [user, loading, authReady, router]);

  if (!authReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">
        Firebase is not configured. Add <code className="rounded bg-slate-200 px-1">.env.local</code>{" "}
        from <code className="rounded bg-slate-200 px-1">.env.local.example</code>.
      </div>
    );
  }

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">
        Loading…
      </div>
    );
  }

  return <>{children}</>;
}
