"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: "admin" | "editor" | "viewer";
  created_at: string;
}

function roleBadge(role: UserRow["role"]): string {
  if (role === "admin") return "rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700";
  if (role === "editor") return "rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700";
  return "rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600";
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("ja-JP");
}

export default function UsersPage() {
  const { data: session } = useSession();
  const role = session?.user?.role;

  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (role !== "admin") return;

    let mounted = true;
    const run = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/users");
        if (!res.ok) throw new Error("ユーザー一覧の取得に失敗しました");
        const data = (await res.json()) as UserRow[];
        if (!mounted) return;
        setRows(Array.isArray(data) ? data : []);
      } catch {
        if (!mounted) return;
        setError("/api/users が利用できません。APIルートの有効化後に再読み込みしてください。");
        setRows([]);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void run();
    return () => {
      mounted = false;
    };
  }, [role]);

  if (role !== "admin") {
    return <p className="rounded-xl bg-white p-6 text-sm text-gray-600 shadow-sm">権限がありません</p>;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl bg-white p-5 shadow-sm">
        <h2 className="text-2xl font-bold text-navy">ユーザー管理</h2>
        <p className="mt-1 text-sm text-gray-500">権限ロールと登録ユーザーを確認できます</p>
      </section>

      {error && <p className="rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-700">{error}</p>}

      <section className="overflow-hidden rounded-xl bg-white shadow-sm">
        {loading ? (
          <div className="px-4 py-8 text-sm text-gray-500">読み込み中...</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left font-medium">名前</th>
                <th className="px-4 py-3 text-left font-medium">メール</th>
                <th className="px-4 py-3 text-left font-medium">ロール</th>
                <th className="px-4 py-3 text-left font-medium">作成日</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-gray-100">
                  <td className="px-4 py-3">{row.name || "-"}</td>
                  <td className="px-4 py-3">{row.email}</td>
                  <td className="px-4 py-3">
                    <span className={roleBadge(row.role)}>{row.role}</span>
                  </td>
                  <td className="px-4 py-3">{formatDate(row.created_at)}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                    ユーザーデータがありません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
