"use client";

import { useEffect, useMemo, useState } from "react";
import type { MetaAccount } from "@/types/meta";

interface AlertItem {
  id: string;
  severity: "warning" | "critical";
  title: string;
  message: string;
  value: string;
}

function formatCurrency(value: number): string {
  return `¥${Math.round(value).toLocaleString("ja-JP")}`;
}

export default function AlertsPage() {
  const [accounts, setAccounts] = useState<MetaAccount[]>([]);
  const [accountId, setAccountId] = useState("");
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const accountsRes = await fetch("/api/meta/accounts");
        if (!accountsRes.ok) throw new Error("アカウント取得に失敗しました");
        const accountRows = (await accountsRes.json()) as MetaAccount[];
        if (!mounted) return;

        setAccounts(accountRows);
        const first = accountRows[0]?.id || "";
        setAccountId(first);

        if (!first) {
          setAlerts([]);
          return;
        }

        const [insightsRes, adsetsRes] = await Promise.all([
          fetch(`/api/meta/insights?account_id=${encodeURIComponent(first)}&date_preset=last_30d`),
          fetch(`/api/meta/adsets?account_id=${encodeURIComponent(first)}&date_preset=last_30d`),
        ]);

        if (!insightsRes.ok || !adsetsRes.ok) {
          throw new Error("アラートデータの取得に失敗しました");
        }

        const insights = (await insightsRes.json()) as {
          ctr?: string;
          frequency?: string;
        } | null;

        const adsets = (await adsetsRes.json()) as Array<{
          adset_id: string;
          adset_name: string;
          spend: string;
          cpa?: number;
          cv?: number;
        }>;

        const built: AlertItem[] = [];

        const ctr = Number.parseFloat(insights?.ctr || "0") || 0;
        if (ctr < 0.5) {
          built.push({
            id: "ctr-low",
            severity: "critical",
            title: "CTR低下",
            message: "アカウント全体のCTRが低い状態です。配信面・訴求の見直しを推奨します。",
            value: `${ctr.toFixed(2)}%`,
          });
        }

        const frequency = Number.parseFloat(insights?.frequency || "0") || 0;
        if (frequency >= 3) {
          built.push({
            id: "freq-high",
            severity: "warning",
            title: "フリークエンシー上昇",
            message: "広告接触頻度が高く、クリエイティブ疲弊の可能性があります。",
            value: `${frequency.toFixed(2)}`,
          });
        }

        adsets
          .filter((adset) => (adset.cpa || 0) >= 500)
          .slice(0, 5)
          .forEach((adset) => {
            built.push({
              id: `adset-${adset.adset_id}`,
              severity: "warning",
              title: "高CPA広告セット",
              message: `${adset.adset_name} のCPAが高騰しています。入札・訴求の調整を検討してください。`,
              value: formatCurrency(adset.cpa || 0),
            });
          });

        if (built.length === 0) {
          built.push({
            id: "healthy",
            severity: "warning",
            title: "異常検知なし",
            message: "現在の分析範囲では重大な異常は検知されていません。",
            value: "-",
          });
        }

        if (mounted) {
          setAlerts(built);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "取得エラー");
          setAlerts([]);
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
  }, []);

  const selectedName = useMemo(
    () => accounts.find((account) => account.id === accountId)?.name || "未選択",
    [accountId, accounts],
  );

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-bold text-navy">アラート</h2>
        <p className="mt-1 text-sm text-gray-500">対象アカウント: {selectedName}</p>
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <section className="space-y-3">
        {alerts.map((alert) => (
          <article
            key={alert.id}
            className={`rounded-xl border-l-4 p-4 shadow-sm ${
              alert.severity === "critical" ? "border-red-400 bg-red-50" : "border-amber-400 bg-amber-50"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-semibold text-navy">{alert.title}</h3>
              <span className="text-xs font-medium text-gray-600 tabular-nums">{alert.value}</span>
            </div>
            <p className="mt-1 text-sm text-gray-700">{alert.message}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
