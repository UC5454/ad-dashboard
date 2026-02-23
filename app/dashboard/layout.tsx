"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { redirect } from "next/navigation";

const navItems = [
  { href: "/dashboard", label: "ダッシュボード", icon: "📊" },
  { href: "/dashboard/compare", label: "媒体比較", icon: "⚖️" },
  { href: "/dashboard/alerts", label: "アラート", icon: "🔔" },
  { href: "/dashboard/reports", label: "レポート", icon: "📄" },
];

const settingsItems = [
  { href: "/settings/api-keys", label: "APIキー管理", icon: "🔑" },
  { href: "/settings/clients", label: "クライアント管理", icon: "🏢" },
  { href: "/settings/users", label: "ユーザー管理", icon: "👤" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue border-t-transparent" />
      </div>
    );
  }

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 z-30 flex h-screen w-60 flex-col bg-navy text-white">
        {/* Logo */}
        <div className="flex h-16 items-center gap-2 px-5">
          <span className="text-xl font-bold tracking-tight">Ad Dashboard</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            メイン
          </p>
          {navItems.map((item) => {
            const isActive =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-blue text-white"
                    : "text-gray-300 hover:bg-navy-light hover:text-white"
                }`}
              >
                <span className="text-base">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}

          <p className="mb-2 mt-6 px-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            設定
          </p>
          {settingsItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-blue text-white"
                    : "text-gray-300 hover:bg-navy-light hover:text-white"
                }`}
              >
                <span className="text-base">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="border-t border-navy-light p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue text-sm font-bold">
              {session.user?.name?.[0] || "U"}
            </div>
            <div className="flex-1 truncate">
              <p className="truncate text-sm font-medium">{session.user?.name}</p>
              <p className="truncate text-xs text-gray-400">{session.user?.email}</p>
            </div>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="mt-3 w-full rounded-lg bg-navy-light px-3 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:bg-navy-dark hover:text-white"
          >
            ログアウト
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="ml-60 flex-1">
        <header className="sticky top-0 z-20 flex h-16 items-center border-b border-gray-200 bg-white px-8">
          <h1 className="text-lg font-semibold text-navy">
            {navItems.find((i) => pathname === i.href || (i.href !== "/dashboard" && pathname.startsWith(i.href)))?.label ||
              settingsItems.find((i) => pathname.startsWith(i.href))?.label ||
              (pathname.startsWith("/dashboard/clients") ? "クライアント詳細" : "ダッシュボード")}
          </h1>
        </header>
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
