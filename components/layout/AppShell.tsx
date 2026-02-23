"use client";

import { useState } from "react";
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
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="ml-0 md:ml-64 min-h-screen bg-gray-50">
        <header className="sticky top-0 z-20 flex h-16 items-center border-b border-gray-200 bg-white px-4 md:px-8">
          <button
            type="button"
            className="mr-3 rounded-lg p-2 text-gray-600 hover:bg-gray-100 md:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold text-navy">{getTitle(pathname)}</h1>
        </header>
        <div className="p-4 md:p-8">{children}</div>
      </main>
    </div>
  );
}
