"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

interface UserItem {
  id: string;
  name: string | null;
  email: string;
  role: "admin" | "editor" | "viewer";
  created_at: string;
}

interface UserForm {
  name: string;
  email: string;
  password: string;
  role: "admin" | "editor" | "viewer";
}

const roleBadgeClass: Record<UserItem["role"], string> = {
  admin: "bg-purple-100 text-purple-700",
  editor: "bg-blue-100 text-blue-700",
  viewer: "bg-gray-100 text-gray-600",
};

export default function UsersPage() {
  const { data: session, status } = useSession();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<UserForm>({
    name: "",
    email: "",
    password: "",
    role: "viewer",
  });

  const role = (session?.user as Record<string, string> | undefined)?.role;

  const load = async () => {
    setLoading(true);
    const res = await fetch("/api/users");
    if (res.ok) {
      const data = (await res.json()) as UserItem[];
      setUsers(Array.isArray(data) ? data : []);
      setError("");
    } else {
      setError("ユーザー情報の取得に失敗しました");
    }
    setLoading(false);
  };

  useEffect(() => {
    if (status === "authenticated" && role === "admin") {
      void load();
    } else if (status !== "loading") {
      setLoading(false);
    }
  }, [status, role]);

  const onChangeField = (key: keyof UserForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleCreate = async () => {
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (res.ok) {
      setOpen(false);
      setForm({ name: "", email: "", password: "", role: "viewer" });
      await load();
    } else if (res.status === 409) {
      setError("同じメールアドレスのユーザーが既に存在します");
    } else {
      setError("ユーザーの作成に失敗しました");
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue border-t-transparent" />
      </div>
    );
  }

  if (role !== "admin") {
    return <p className="text-sm text-red-600">権限がありません</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-navy">ユーザー管理</h2>
          <p className="mt-1 text-sm text-gray-500">ユーザーの作成とロール設定を行います</p>
        </div>
        <button
          type="button"
          className="bg-blue text-white rounded-lg px-4 py-2.5 hover:bg-blue-light"
          onClick={() => setOpen(true)}
        >
          新規登録
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="px-4 py-3 text-left">名前</th>
              <th className="px-4 py-3 text-left">メール</th>
              <th className="px-4 py-3 text-left">ロール</th>
              <th className="px-4 py-3 text-left">登録日</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t border-gray-100">
                <td className="px-4 py-3">{user.name || "-"}</td>
                <td className="px-4 py-3">{user.email}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${roleBadgeClass[user.role]}`}>
                    {user.role}
                  </span>
                </td>
                <td className="px-4 py-3">{new Date(user.created_at).toLocaleDateString("ja-JP")}</td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                  ユーザーが存在しません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-navy">ユーザー新規登録</h3>
            <div className="mt-4 space-y-3">
              <label className="block text-sm text-gray-700">
                名前
                <input
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2"
                  value={form.name}
                  onChange={(e) => onChangeField("name", e.target.value)}
                />
              </label>
              <label className="block text-sm text-gray-700">
                メール
                <input
                  type="email"
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2"
                  value={form.email}
                  onChange={(e) => onChangeField("email", e.target.value)}
                />
              </label>
              <label className="block text-sm text-gray-700">
                パスワード
                <input
                  type="password"
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2"
                  value={form.password}
                  onChange={(e) => onChangeField("password", e.target.value)}
                />
              </label>
              <label className="block text-sm text-gray-700">
                ロール
                <select
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2"
                  value={form.role}
                  onChange={(e) => onChangeField("role", e.target.value)}
                >
                  <option value="admin">admin</option>
                  <option value="editor">editor</option>
                  <option value="viewer">viewer</option>
                </select>
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className="border border-gray-200 bg-white rounded-lg px-4 py-2.5 hover:bg-gray-50"
                onClick={() => setOpen(false)}
              >
                キャンセル
              </button>
              <button
                type="button"
                className="bg-blue text-white rounded-lg px-4 py-2.5 hover:bg-blue-light"
                onClick={handleCreate}
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
