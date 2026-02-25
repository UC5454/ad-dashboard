"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";

const navItems = [
  { href: "/dashboard", label: "ダッシュボード", icon: "📊" },
  { href: "/dashboard/reports", label: "レポート", icon: "📄" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") {
    return pathname === "/dashboard" || pathname.startsWith("/dashboard/projects/");
  }
  return pathname.startsWith(href);
}

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();

  return (
    <aside
      className={`fixed left-0 top-0 z-40 flex h-screen w-64 flex-col bg-navy text-white transition-transform md:translate-x-0 ${
        open ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <div className="border-b border-navy-light px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue text-sm font-bold">AD</div>
          <div>
            <p className="text-sm font-semibold">広告ダッシュボード</p>
            <p className="text-xs text-slate-300">Digital Gorilla</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <p className="mb-2 px-2 text-xs font-semibold text-slate-400">メニュー</p>
        <div className="space-y-1">
          {navItems.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  active ? "bg-blue text-white" : "text-slate-300 hover:bg-navy-light hover:text-white"
                }`}
              >
                <span aria-hidden>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="border-t border-navy-light p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue text-sm font-semibold">
            {session?.user?.name?.charAt(0) || "U"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{session?.user?.name || "ユーザー"}</p>
            <p className="truncate text-xs text-slate-400">{session?.user?.email || ""}</p>
          </div>
        </div>
        <button
          type="button"
          className="mt-3 w-full rounded-lg bg-navy-light px-3 py-2 text-xs text-slate-200 hover:bg-navy-dark"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          ログアウト
        </button>
      </div>
    </aside>
  );
}
