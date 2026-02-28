"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { loadApiKeys, loadClients, saveClients, type StoredApiKey, type StoredClient } from "@/lib/storage";
import { isValidMetaAccountId } from "@/lib/validation";

function formatCurrency(value: number): string {
  return `¥${Math.round(value).toLocaleString("ja-JP")}`;
}

function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `local-${Date.now()}`;
}

export default function ClientManagementPage() {
  const { data: session } = useSession();
  const role = session?.user?.role;
  const canEdit = role === "admin" || role === "editor";

  const [rows, setRows] = useState<StoredClient[]>([]);
  const [apiKeys, setApiKeys] = useState<StoredApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [warning, setWarning] = useState("");
  const [form, setForm] = useState({
    name: "",
    googleAdsAccountId: "",
    metaAdsAccountId: "",
    monthlyBudgetGoogle: 0,
    monthlyBudgetMeta: 0,
    googleApiKeyId: "",
    metaApiKeyId: "",
  });

  useEffect(() => {
    if (canEdit) {
      setRows(loadClients());
      setApiKeys(loadApiKeys());
      setLoading(false);
    }
  }, [canEdit]);

  const metaKeys = useMemo(() => apiKeys.filter((key) => key.platform === "meta"), [apiKeys]);
  const googleKeys = useMemo(() => apiKeys.filter((key) => key.platform === "google"), [apiKeys]);

  if (!canEdit) {
    return <p className="rounded-xl bg-white p-6 text-sm text-gray-600 shadow-sm">権限がありません</p>;
  }

  const onSave = () => {
    if (!form.name.trim()) return;

    if (form.metaAdsAccountId.trim() && !isValidMetaAccountId(form.metaAdsAccountId.trim())) {
      setWarning("Meta Ads IDは act_1234567890 の形式で入力してください");
      return;
    }

    setWarning("");
    const nextClient: StoredClient = {
      id: createId(),
      name: form.name.trim(),
      googleAdsAccountId: form.googleAdsAccountId.trim(),
      metaAdsAccountId: form.metaAdsAccountId.trim(),
      monthlyBudgetGoogle: form.monthlyBudgetGoogle,
      monthlyBudgetMeta: form.monthlyBudgetMeta,
      status: "active",
      googleApiKeyId: form.googleApiKeyId || undefined,
      metaApiKeyId: form.metaApiKeyId || undefined,
      createdAt: new Date().toISOString(),
    };
    const next = [nextClient, ...rows];
    setRows(next);
    saveClients(next);
    setOpen(false);
    setForm({
      name: "",
      googleAdsAccountId: "",
      metaAdsAccountId: "",
      monthlyBudgetGoogle: 0,
      monthlyBudgetMeta: 0,
      googleApiKeyId: "",
      metaApiKeyId: "",
    });
  };

  return (
    <div className="space-y-6">
      <section className="rounded-xl bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-navy">クライアント管理</h2>
            <p className="mt-1 text-sm text-gray-500">クライアント情報と月間予算を管理します</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setWarning("");
              setOpen(true);
            }}
            className="rounded-lg bg-blue px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-light"
          >
            新規登録
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl bg-white shadow-sm">
        {loading ? (
          <div className="px-4 py-8 text-sm text-gray-500">読み込み中...</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left font-medium">クライアント名</th>
                <th className="px-4 py-3 text-left font-medium">Google Ads ID</th>
                <th className="px-4 py-3 text-left font-medium">Meta Ads ID</th>
                <th className="px-4 py-3 text-left font-medium">月予算(Google)</th>
                <th className="px-4 py-3 text-left font-medium">月予算(Meta)</th>
                <th className="px-4 py-3 text-left font-medium">ステータス</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-gray-100">
                  <td className="px-4 py-3">{row.name}</td>
                  <td className="px-4 py-3">{row.googleAdsAccountId || "-"}</td>
                  <td className="px-4 py-3">{row.metaAdsAccountId || "-"}</td>
                  <td className="px-4 py-3 tabular-nums">{formatCurrency(row.monthlyBudgetGoogle)}</td>
                  <td className="px-4 py-3 tabular-nums">{formatCurrency(row.monthlyBudgetMeta)}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    クライアントが未登録です
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </section>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-xl rounded-xl bg-white p-5 shadow-lg">
            <h3 className="text-lg font-semibold text-navy">クライアント新規登録</h3>
            {warning && (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">{warning}</p>
            )}
            <div className="mt-4 grid grid-cols-1 gap-3">
              <input
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="クライアント名"
                className="rounded-lg border border-gray-200 px-3 py-2"
              />
              <input
                value={form.googleAdsAccountId}
                onChange={(event) => setForm((prev) => ({ ...prev, googleAdsAccountId: event.target.value }))}
                placeholder="Google Ads ID"
                className="rounded-lg border border-gray-200 px-3 py-2"
              />
              <input
                value={form.metaAdsAccountId}
                onChange={(event) => {
                  setWarning("");
                  setForm((prev) => ({ ...prev, metaAdsAccountId: event.target.value }));
                }}
                placeholder="Meta Ads ID"
                className="rounded-lg border border-gray-200 px-3 py-2"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="number"
                  value={form.monthlyBudgetGoogle}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      monthlyBudgetGoogle: Number.parseFloat(event.target.value) || 0,
                    }))
                  }
                  placeholder="月予算(Google)"
                  className="rounded-lg border border-gray-200 px-3 py-2"
                />
                <input
                  type="number"
                  value={form.monthlyBudgetMeta}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      monthlyBudgetMeta: Number.parseFloat(event.target.value) || 0,
                    }))
                  }
                  placeholder="月予算(Meta)"
                  className="rounded-lg border border-gray-200 px-3 py-2"
                />
              </div>
              <label className="text-sm text-gray-700">
                Google APIキー
                <select
                  value={form.googleApiKeyId}
                  onChange={(event) => setForm((prev) => ({ ...prev, googleApiKeyId: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2"
                >
                  <option value="">未選択</option>
                  {googleKeys.map((key) => (
                    <option key={key.id} value={key.id}>
                      {key.keyName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-gray-700">
                Meta APIキー
                <select
                  value={form.metaApiKeyId}
                  onChange={(event) => setForm((prev) => ({ ...prev, metaApiKeyId: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2"
                >
                  <option value="">未選択</option>
                  {metaKeys.map((key) => (
                    <option key={key.id} value={key.id}>
                      {key.keyName}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={onSave}
                className="rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white hover:bg-blue-light"
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
