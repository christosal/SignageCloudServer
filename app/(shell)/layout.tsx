import { AuthGuard } from "@/components/auth-guard";
import { Sidebar } from "@/components/sidebar";
import type { ReactNode } from "react";

export default function ShellLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-slate-50">
        <Sidebar />
        <main className="flex-1 overflow-auto p-6 md:p-10">{children}</main>
      </div>
    </AuthGuard>
  );
}
