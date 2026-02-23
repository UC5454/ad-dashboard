"use client";

import { usePathname } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";

const titles: { prefix: string; title: string }[] = [
  { prefix: "/dashboard/compare", title: "媒体比較" },
  { prefix: "/dashboard/alerts", title: "アラート" },
  { prefix: "/dashboard/reports", title: "レポート" },
  { prefix: "/dashboard/clients/", title: "クライアント詳細" },
  { prefix: "/dashboard", title: "ダッシュボード" },
  { prefix: "/settings/api-keys", title: "APIキー管理" },
  { prefix: "/settings/clients", title: "クライアント管理" },
  { prefix: "/settings/users", title: "ユーザー管理" },
  { prefix: "/settings", title: "設定" },
];

function getTitle(pathname: string): string {
  const matched = titles.find((item) => pathname.startsWith(item.prefix));
  return matched?.title || "広告ダッシュボード";
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <main className="ml-64 min-h-screen bg-gray-50">
        <header className="sticky top-0 z-20 flex h-16 items-center border-b border-gray-200 bg-white px-8">
          <h1 className="text-lg font-semibold text-navy">{getTitle(pathname)}</h1>
        </header>
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
