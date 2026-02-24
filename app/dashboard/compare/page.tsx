"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MetaAccount } from "@/types/meta";

interface AccountMetrics {
  id: string;
  name: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
}

function formatCurrency(value: number): string {
  return `¥${Math.round(value).toLocaleString("ja-JP")}`;
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function formatNumber(value: number): string {
  return Math.round(value).toLocaleString("ja-JP");
}

export default function ComparePage() {
  const [accounts, setAccounts] = useState<MetaAccount[]>([]);
  const [datePreset, setDatePreset] = useState("last_30d");
  const [metrics, setMetrics] = useState<AccountMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      setError("");

      try {
        const accountsRes = await fetch("/api/meta/accounts");
        if (!accountsRes.ok) {
          throw new Error("アカウント情報の取得に失敗しました");
        }

        const accountList = (await accountsRes.json()) as MetaAccount[];
        if (!mounted) return;

        setAccounts(accountList);

        const insightResults = await Promise.all(
          accountList.map(async (account) => {
            const res = await fetch(
              `/api/meta/insights?account_id=${encodeURIComponent(account.id)}&date_preset=${datePreset}`,
            );

            if (!res.ok) {
              return {
                id: account.id,
                name: account.name,
                spend: 0,
                impressions: 0,
                clicks: 0,
                ctr: 0,
                cpc: 0,
              };
            }

            const data = (await res.json()) as {
              spend?: string;
              impressions?: string;
              clicks?: string;
              ctr?: string;
              cpc?: string;
            } | null;

            return {
              id: account.id,
              name: account.name,
              spend: Number.parseFloat(data?.spend || "0") || 0,
              impressions: Number.parseFloat(data?.impressions || "0") || 0,
              clicks: Number.parseFloat(data?.clicks || "0") || 0,
              ctr: Number.parseFloat(data?.ctr || "0") || 0,
              cpc: Number.parseFloat(data?.cpc || "0") || 0,
            };
          }),
        );

        if (!mounted) return;

        setMetrics(insightResults);
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "比較データの取得に失敗しました");
          setMetrics([]);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [datePreset]);

  const total = useMemo(() => {
    return metrics.reduce(
      (acc, item) => {
        acc.spend += item.spend;
        acc.impressions += item.impressions;
        acc.clicks += item.clicks;
        return acc;
      },
      { spend: 0, impressions: 0, clicks: 0 },
    );
  }, [metrics]);

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#2C5282] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#1B2A4A]">アカウント比較</h2>
          <p className="mt-1 text-sm text-gray-500">Meta Ads 全アカウントの横比較</p>
        </div>
        <label className="text-sm text-gray-700">
          期間
          <select
            className="mt-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            value={datePreset}
            onChange={(event) => setDatePreset(event.target.value)}
          >
            <option value="today">今日</option>
            <option value="yesterday">昨日</option>
            <option value="last_7d">過去7日</option>
            <option value="last_30d">過去30日</option>
            <option value="this_month">今月</option>
          </select>
        </label>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">合計消化額</p>
          <p className="mt-2 text-2xl font-bold text-[#1B2A4A] tabular-nums">{formatCurrency(total.spend)}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">合計IMP</p>
          <p className="mt-2 text-2xl font-bold text-[#1B2A4A] tabular-nums">{formatNumber(total.impressions)}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">合計クリック</p>
          <p className="mt-2 text-2xl font-bold text-[#1B2A4A] tabular-nums">{formatNumber(total.clicks)}</p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-base font-semibold text-[#1B2A4A]">消化額比較</h3>
        <ResponsiveContainer width="100%" height={360}>
          <BarChart data={metrics}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis dataKey="name" tick={{ fill: "#64748B", fontSize: 12 }} />
            <YAxis tickFormatter={(value: number | undefined) => `¥${Math.round(value ?? 0).toLocaleString("ja-JP")}`} />
            <Tooltip formatter={(value: number | undefined) => formatCurrency(value ?? 0)} />
            <Bar dataKey="spend" fill="#2C5282" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500">
            <tr>
              <th className="px-4 py-3 text-left font-medium">アカウント</th>
              <th className="px-4 py-3 text-left font-medium">消化額</th>
              <th className="px-4 py-3 text-left font-medium">IMP</th>
              <th className="px-4 py-3 text-left font-medium">クリック</th>
              <th className="px-4 py-3 text-left font-medium">CTR</th>
              <th className="px-4 py-3 text-left font-medium">CPC</th>
            </tr>
          </thead>
          <tbody>
            {metrics.map((item, index) => (
              <tr key={item.id} className={`${index % 2 === 0 ? "bg-white" : "bg-gray-50/60"} hover:bg-blue-50`}>
                <td className="px-4 py-3 font-medium text-[#1B2A4A]">{item.name}</td>
                <td className="px-4 py-3 tabular-nums">{formatCurrency(item.spend)}</td>
                <td className="px-4 py-3 tabular-nums">{formatNumber(item.impressions)}</td>
                <td className="px-4 py-3 tabular-nums">{formatNumber(item.clicks)}</td>
                <td className="px-4 py-3 tabular-nums">{formatPercent(item.ctr)}</td>
                <td className="px-4 py-3 tabular-nums">{formatCurrency(item.cpc)}</td>
              </tr>
            ))}
            {metrics.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  比較対象のアカウントがありません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-500">取得アカウント数: {accounts.length}</p>
    </div>
  );
}
