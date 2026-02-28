"use client";

import { useEffect, useMemo, useState } from "react";
import { loadCompanies, saveCompanies, type StoredCompany } from "@/lib/storage";

interface CompanyForm {
  companyName: string;
  campaignKeywordsText: string;
  monthlyBudget: number;
  feeRatePercent: number;
  status: "active" | "paused";
}

function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `company-${Date.now()}`;
}

function formatCurrency(value: number): string {
  return `¥${Math.round(value).toLocaleString("ja-JP")}`;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function statusLabel(status: StoredCompany["status"]): string {
  if (status === "active") return "稼働中";
  if (status === "paused") return "停止中";
  return "アーカイブ";
}

function statusBadge(status: StoredCompany["status"]): string {
  if (status === "active") return "bg-emerald-50 text-emerald-700";
  if (status === "paused") return "bg-amber-50 text-amber-700";
  return "bg-gray-100 text-gray-600";
}

const emptyForm: CompanyForm = {
  companyName: "",
  campaignKeywordsText: "",
  monthlyBudget: 0,
  feeRatePercent: 20,
  status: "active",
};

export default function CompanyManagementPage() {
  const [rows, setRows] = useState<StoredCompany[]>([]);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState<CompanyForm>(emptyForm);

  useEffect(() => {
    setRows(loadCompanies());
  }, []);

  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [rows],
  );

  const openCreate = () => {
    setEditingId(null);
    setError("");
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (company: StoredCompany) => {
    setEditingId(company.id);
    setError("");
    setForm({
      companyName: company.companyName,
      campaignKeywordsText: company.campaignKeywords.join(", "),
      monthlyBudget: company.monthlyBudget,
      feeRatePercent: company.feeRate * 100,
      status: company.status === "archived" ? "paused" : company.status,
    });
    setOpen(true);
  };

  const onSave = () => {
    const companyName = form.companyName.trim();
    const campaignKeywords = form.campaignKeywordsText
      .split(",")
      .map((keyword) => keyword.trim())
      .filter(Boolean);

    if (!companyName) {
      setError("会社名を入力してください");
      return;
    }

    const nextCompany: StoredCompany = {
      id: editingId || createId(),
      companyName,
      campaignKeywords,
      monthlyBudget: Number.isFinite(form.monthlyBudget) ? form.monthlyBudget : 0,
      feeRate: Math.max(0, form.feeRatePercent) / 100,
      status: form.status,
      createdAt: editingId ? rows.find((row) => row.id === editingId)?.createdAt || new Date().toISOString() : new Date().toISOString(),
    };

    const nextRows = editingId
      ? rows.map((row) => (row.id === editingId ? nextCompany : row))
      : [nextCompany, ...rows];

    setRows(nextRows);
    saveCompanies(nextRows);
    setOpen(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const onDelete = (id: string) => {
    const target = rows.find((row) => row.id === id);
    if (!target) return;
    if (!window.confirm(`「${target.companyName}」を削除しますか？`)) return;
    const nextRows = rows.filter((row) => row.id !== id);
    setRows(nextRows);
    saveCompanies(nextRows);
  };

  return (
    <div className="space-y-6">
      <section className="rounded-xl bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-navy">案件管理</h2>
            <p className="mt-1 text-sm text-gray-500">広告キャンペーンを会社（案件）単位でグルーピングします</p>
          </div>
          <button
            type="button"
            className="rounded-lg bg-blue px-4 py-2 text-sm text-white"
            onClick={openCreate}
          >
            新規登録
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500">
            <tr>
              <th className="px-4 py-3 text-left font-medium">会社名</th>
              <th className="px-4 py-3 text-left font-medium">マッチキーワード</th>
              <th className="px-4 py-3 text-left font-medium">月間予算</th>
              <th className="px-4 py-3 text-left font-medium">手数料率</th>
              <th className="px-4 py-3 text-left font-medium">ステータス</th>
              <th className="px-4 py-3 text-left font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row) => (
              <tr key={row.id} className="border-t border-gray-100">
                <td className="px-4 py-3 text-navy">{row.companyName}</td>
                <td className="px-4 py-3 text-gray-700">{row.campaignKeywords.join(", ") || "-"}</td>
                <td className="px-4 py-3 tabular-nums">{formatCurrency(row.monthlyBudget)}</td>
                <td className="px-4 py-3 tabular-nums">{formatPercent(row.feeRate)}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${statusBadge(row.status)}`}>{statusLabel(row.status)}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openEdit(row)}
                      className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
                    >
                      編集
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(row.id)}
                      className="rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
                    >
                      削除
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {sortedRows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  案件が未登録です
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-2xl rounded-xl bg-white p-5 shadow-lg">
            <h3 className="text-lg font-semibold text-navy">{editingId ? "案件を編集" : "案件を新規登録"}</h3>
            {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

            <div className="mt-4 grid grid-cols-1 gap-4">
              <label className="text-sm text-gray-700">
                会社名
                <input
                  value={form.companyName}
                  onChange={(event) => setForm((prev) => ({ ...prev, companyName: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2"
                  placeholder="会社名を入力"
                />
              </label>

              <label className="text-sm text-gray-700">
                マッチキーワード
                <input
                  value={form.campaignKeywordsText}
                  onChange={(event) => setForm((prev) => ({ ...prev, campaignKeywordsText: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2"
                  placeholder="例: CREET, 美容外科"
                />
                <p className="mt-1 text-xs text-gray-500">
                  キャンペーン名に含まれるキーワードをカンマ区切りで入力。いずれかが含まれるキャンペーンがこの案件にグルーピングされます
                </p>
              </label>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="text-sm text-gray-700">
                  月間予算（円）
                  <input
                    type="number"
                    min={0}
                    value={form.monthlyBudget}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        monthlyBudget: Number.parseFloat(event.target.value) || 0,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2"
                  />
                </label>

                <label className="text-sm text-gray-700">
                  手数料率（%）
                  <input
                    type="number"
                    min={0}
                    step={0.1}
                    value={form.feeRatePercent}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        feeRatePercent: Number.parseFloat(event.target.value) || 0,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2"
                  />
                </label>
              </div>

              <label className="text-sm text-gray-700">
                ステータス
                <select
                  value={form.status}
                  onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value as "active" | "paused" }))}
                  className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2"
                >
                  <option value="active">active</option>
                  <option value="paused">paused</option>
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
              <button type="button" onClick={onSave} className="rounded-lg bg-blue px-4 py-2 text-sm text-white">
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
