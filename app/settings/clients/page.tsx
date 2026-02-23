"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

interface Client {
  id: string;
  name: string;
  google_ads_account_id: string | null;
  meta_ads_account_id: string | null;
  monthly_budget_google: number;
  monthly_budget_meta: number;
  status: string;
}

interface ClientForm {
  name: string;
  google_ads_account_id: string;
  meta_ads_account_id: string;
  monthly_budget_google: string;
  monthly_budget_meta: string;
}

function fmtCurrency(value: number): string {
  return `¥${Math.round(value).toLocaleString("ja-JP")}`;
}

export default function SettingsClientsPage() {
  const { data: session, status } = useSession();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ClientForm>({
    name: "",
    google_ads_account_id: "",
    meta_ads_account_id: "",
    monthly_budget_google: "0",
    monthly_budget_meta: "0",
  });

  const role = (session?.user as Record<string, string> | undefined)?.role;

  const load = async () => {
    setLoading(true);
    const res = await fetch("/api/clients");
    if (res.ok) {
      const data = (await res.json()) as Client[];
      setClients(Array.isArray(data) ? data : []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (status === "authenticated" && (role === "admin" || role === "editor")) {
      void load();
    } else if (status !== "loading") {
      setLoading(false);
    }
  }, [status, role]);

  const onChangeField = (key: keyof ClientForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleCreate = async () => {
    const payload = {
      name: form.name,
      google_ads_account_id: form.google_ads_account_id || null,
      meta_ads_account_id: form.meta_ads_account_id || null,
      monthly_budget_google: Number(form.monthly_budget_google || 0),
      monthly_budget_meta: Number(form.monthly_budget_meta || 0),
    };

    const res = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      setOpen(false);
      setForm({
        name: "",
        google_ads_account_id: "",
        meta_ads_account_id: "",
        monthly_budget_google: "0",
        monthly_budget_meta: "0",
      });
      await load();
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue border-t-transparent" />
      </div>
    );
  }

  if (role !== "admin" && role !== "editor") {
    return <p className="text-sm text-red-600">権限がありません</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-navy">クライアント管理</h2>
          <p className="mt-1 text-sm text-gray-500">クライアント情報を登録・確認します</p>
        </div>
        <button
          type="button"
          className="bg-blue text-white rounded-lg px-4 py-2.5 hover:bg-blue-light"
          onClick={() => setOpen(true)}
        >
          新規登録
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="px-4 py-3 text-left">名前</th>
              <th className="px-4 py-3 text-left">Google Ads ID</th>
              <th className="px-4 py-3 text-left">Meta Ads ID</th>
              <th className="px-4 py-3 text-right">Google月次予算</th>
              <th className="px-4 py-3 text-right">Meta月次予算</th>
              <th className="px-4 py-3 text-left">ステータス</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((client) => (
              <tr key={client.id} className="border-t border-gray-100">
                <td className="px-4 py-3">{client.name}</td>
                <td className="px-4 py-3">{client.google_ads_account_id || "-"}</td>
                <td className="px-4 py-3">{client.meta_ads_account_id || "-"}</td>
                <td className="px-4 py-3 text-right">{fmtCurrency(client.monthly_budget_google || 0)}</td>
                <td className="px-4 py-3 text-right">{fmtCurrency(client.monthly_budget_meta || 0)}</td>
                <td className="px-4 py-3">{client.status}</td>
              </tr>
            ))}
            {clients.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  クライアントが登録されていません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-navy">クライアント新規登録</h3>
            <div className="mt-4 space-y-3">
              <label className="block text-sm text-gray-700">
                名前（必須）
                <input
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2"
                  value={form.name}
                  onChange={(e) => onChangeField("name", e.target.value)}
                />
              </label>
              <label className="block text-sm text-gray-700">
                Google Ads ID
                <input
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2"
                  value={form.google_ads_account_id}
                  onChange={(e) => onChangeField("google_ads_account_id", e.target.value)}
                />
              </label>
              <label className="block text-sm text-gray-700">
                Meta Ads ID
                <input
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2"
                  value={form.meta_ads_account_id}
                  onChange={(e) => onChangeField("meta_ads_account_id", e.target.value)}
                />
              </label>
              <label className="block text-sm text-gray-700">
                Google月次予算
                <input
                  type="number"
                  min="0"
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2"
                  value={form.monthly_budget_google}
                  onChange={(e) => onChangeField("monthly_budget_google", e.target.value)}
                />
              </label>
              <label className="block text-sm text-gray-700">
                Meta月次予算
                <input
                  type="number"
                  min="0"
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2"
                  value={form.monthly_budget_meta}
                  onChange={(e) => onChangeField("monthly_budget_meta", e.target.value)}
                />
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
