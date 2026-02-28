"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";

function Icon({ path }: { path: string }) {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d={path} />
    </svg>
  );
}

interface NavItem {
  href: string;
  label: string;
  iconPath: string;
}

const menuItems: NavItem[] = [
  { href: "/dashboard", label: "ダッシュボード", iconPath: "M4 12h6V4H4v8Zm10 8h6v-6h-6v6Zm0-10h6V4h-6v6ZM4 20h6v-6H4v6Z" },
  { href: "/dashboard/compare", label: "媒体比較", iconPath: "M4 19V9m8 10V5m8 14v-7" },
  { href: "/dashboard/alerts", label: "アラート", iconPath: "M12 8v4m0 4h.01M5.2 18h13.6L12 4 5.2 18Z" },
  { href: "/dashboard/reports", label: "レポート", iconPath: "M8 4h8l4 4v12H8V4Zm8 0v4h4M10 12h8M10 16h8" },
];

const settingItems: NavItem[] = [
  { href: "/settings", label: "手数料・Slack設定", iconPath: "M12 3l1.7 3.2 3.5.5-2.5 2.5.6 3.5L12 11l-3.3 1.7.6-3.5-2.5-2.5 3.5-.5L12 3Zm0 8.5a4 4 0 1 0 .001 8.001A4 4 0 0 0 12 11.5Z" },
  { href: "/settings/api-keys", label: "APIキー管理", iconPath: "M12 15a3 3 0 1 0-2.8-4h-4l-2 2 2 2h2l1 1 1-1h1.2A3 3 0 0 0 12 15Z" },
  { href: "/settings/clients", label: "クライアント管理", iconPath: "M4 19h16M5 17V7l7-3 7 3v10M9 11h.01M15 11h.01" },
  { href: "/settings/users", label: "ユーザー管理", iconPath: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m16 0v-2a4 4 0 0 0-3-3.87M14 4.13a4 4 0 0 1 0 7.75M10 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" },
  { href: "/settings/security", label: "セキュリティ", iconPath: "M12 3l7 4v5c0 5-3.4 8.8-7 10-3.6-1.2-7-5-7-10V7l7-4Zm0 7.5v4m0 3h.01" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") {
    return (
      pathname === "/dashboard" ||
      pathname.startsWith("/dashboard/clients/") ||
      pathname.startsWith("/dashboard/projects/")
    );
  }
  if (href === "/settings") {
    return pathname === "/settings";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavSection({ title, items, pathname }: { title: string; items: NavItem[]; pathname: string }) {
  return (
    <section className="mt-6 first:mt-0">
      <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</p>
      <div className="space-y-1">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                active ? "bg-blue text-white" : "text-slate-300 hover:bg-navy-light hover:text-white"
              }`}
            >
              <Icon path={item.iconPath} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col bg-navy text-white">
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
        <NavSection title="メニュー" items={menuItems} pathname={pathname} />
        <NavSection title="設定" items={settingItems} pathname={pathname} />
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
