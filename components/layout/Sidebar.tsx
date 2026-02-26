"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";

function DashboardIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 12h6V4H4v8Zm10 8h6v-6h-6v6Zm0-10h6V4h-6v6ZM4 20h6v-6H4v6Z" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M5.2 18h13.6L12 4 5.2 18Z" />
    </svg>
  );
}

function ReportIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 4h8l4 4v12H8V4Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 4v4h4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 12h8M10 16h8" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m12 3 1.6 2.8 3.2.5-2.3 2.2.6 3.1L12 10.8 8.9 11.6l.6-3.1-2.3-2.2 3.2-.5L12 3Z"
      />
      <circle cx="12" cy="15.5" r="3.5" />
    </svg>
  );
}

interface NavSection {
  title: string;
  items: { href: string; label: string; icon: React.ReactNode }[];
}

const navSections: NavSection[] = [
  {
    title: "分析",
    items: [
      { href: "/dashboard", label: "ダッシュボード", icon: <DashboardIcon /> },
      { href: "/dashboard/alerts", label: "アラート", icon: <AlertIcon /> },
    ],
  },
  {
    title: "レポート",
    items: [{ href: "/dashboard/reports", label: "レポート生成", icon: <ReportIcon /> }],
  },
  {
    title: "管理",
    items: [{ href: "/dashboard/settings", label: "設定", icon: <SettingsIcon /> }],
  },
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
        {navSections.map((section, sectionIndex) => (
          <div key={section.title} className={sectionIndex === 0 ? "" : "mt-6"}>
            <p className="mb-2 px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">{section.title}</p>
            <div className="space-y-1">
              {section.items.map((item) => {
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
          </div>
        ))}
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
