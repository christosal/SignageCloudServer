"use client";

import { getFirebaseAuth } from "@/lib/firebase/client";
import { cn } from "@/lib/utils";
import { signOut } from "firebase/auth";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: "▦" },
  { href: "/media",     label: "Media",     icon: "🎬" },
  { href: "/playlists", label: "Playlists", icon: "≡" },
  { href: "/trains",    label: "Trains",    icon: "🚂" },
] as const;

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-slate-200 bg-white">
      {/* Logo */}
      <div className="border-b border-slate-100 px-5 py-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
          VillageTrain
        </p>
        <p className="mt-0.5 text-lg font-bold leading-tight text-slate-900">
          Signage Admin
        </p>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-0.5 p-3">
        {NAV.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-brand-50 text-brand-900"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
              )}
            >
              <span className="w-4 text-center text-base leading-none">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Sign out */}
      <div className="border-t border-slate-100 p-3">
        <button
          type="button"
          onClick={() => signOut(getFirebaseAuth())}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-900"
        >
          <span className="w-4 text-center">↩</span>
          Sign out
        </button>
      </div>
    </aside>
  );
}
