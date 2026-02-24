/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  buildKpiCards,
  calcBudgetPacing,
  generateAccountAnalysis,
  parseMetricSnapshot,
  summarizeAdsetRisks,
  topCreativeByCv,
} from "@/lib/analysis";
import { actionValue } from "@/lib/meta-utils";
import type {
  MetaAccount,
  MetaAdInsights,
  MetaAdsetInsights,
  MetaBreakdownInsights,
  MetaCampaignInsights,
  MetaCreativeSummary,
  MetaInsights,
} from "@/types/meta";

type TrendMetric = "spend" | "cv" | "cpa";

interface DailyRow extends MetaInsights {
  cv?: number;
  lp_views?: number;
}

interface EnrichedAdset extends MetaAdsetInsights {
  cv?: number;
  lp_views?: number;
  cpa?: number;
}

const PRESETS = [
  { value: "today", label: "今日", days: 1 },
  { value: "yesterday", label: "昨日", days: 1 },
  { value: "last_7d", label: "過去7日", days: 7 },
  { value: "last_30d", label: "過去30日", days: 30 },
  { value: "this_month", label: "今月", days: 0 },
] as const;

function formatCurrency(value: number): string {
  return `¥${Math.round(value).toLocaleString("ja-JP")}`;
}

function formatNumber(value: number): string {
  return Math.round(value).toLocaleString("ja-JP");
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function resolveDateRange(datePreset: string): { since: string; until: string; days: number } {
  const today = new Date();
  const midnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  if (datePreset === "today") {
    return { since: toDateString(midnight), until: toDateString(midnight), days: 1 };
  }

  if (datePreset === "yesterday") {
    const yesterday = addDays(midnight, -1);
    return { since: toDateString(yesterday), until: toDateString(yesterday), days: 1 };
  }

  if (datePreset === "last_7d") {
    const since = addDays(midnight, -6);
    return { since: toDateString(since), until: toDateString(midnight), days: 7 };
  }

  if (datePreset === "last_30d") {
    const since = addDays(midnight, -29);
    return { since: toDateString(since), until: toDateString(midnight), days: 30 };
  }

  const monthStart = new Date(midnight.getFullYear(), midnight.getMonth(), 1);
  const days = Math.floor((midnight.getTime() - monthStart.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  return { since: toDateString(monthStart), until: toDateString(midnight), days };
}

function getPreviousRange(datePreset: string): { since: string; until: string } {
  const current = resolveDateRange(datePreset);
  const currentSince = new Date(current.since);
  const previousUntil = addDays(currentSince, -1);
  const previousSince = addDays(previousUntil, -(current.days - 1));
  return { since: toDateString(previousSince), until: toDateString(previousUntil) };
}

function aggregateDaily(rows: DailyRow[]): MetaInsights {
  let spend = 0;
  let impressions = 0;
  let clicks = 0;
  let cv = 0;
  let lpv = 0;

  rows.forEach((row) => {
    spend += Number.parseFloat(row.spend || "0") || 0;
    impressions += Number.parseFloat(row.impressions || "0") || 0;
    clicks += Number.parseFloat(row.clicks || "0") || 0;
    cv += row.cv ?? actionValue(row.actions, "offsite_conversion.fb_pixel_custom");
    lpv += row.lp_views ?? actionValue(row.actions, "landing_page_view");
  });

  const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
  const cpc = clicks > 0 ? spend / clicks : 0;

  return {
    impressions: String(impressions),
    clicks: String(clicks),
    spend: String(spend),
    ctr: String(ctr),
    cpc: String(cpc),
    actions: [
      { action_type: "offsite_conversion.fb_pixel_custom", value: String(cv) },
      { action_type: "landing_page_view", value: String(lpv) },
    ],
    date_start: rows[0]?.date_start || "",
    date_stop: rows[rows.length - 1]?.date_stop || "",
  };
}

function metricLabel(metric: TrendMetric): string {
  if (metric === "cv") return "CV";
  if (metric === "cpa") return "CPA";
  return "消化額";
}

export default function DashboardPage() {
  const [accounts, setAccounts] = useState<MetaAccount[]>([]);
  const [accountId, setAccountId] = useState("");
  const [datePreset, setDatePreset] = useState("last_30d");
  const [trendMetric, setTrendMetric] = useState<TrendMetric>("spend");
  const [monthlyBudget, setMonthlyBudget] = useState(1000000);

  const [insights, setInsights] = useState<MetaInsights | null>(null);
  const [campaigns, setCampaigns] = useState<MetaCampaignInsights[]>([]);
  const [adsets, setAdsets] = useState<EnrichedAdset[]>([]);
  const [ads, setAds] = useState<MetaAdInsights[]>([]);
  const [dailyCurrent, setDailyCurrent] = useState<DailyRow[]>([]);
  const [dailyPrevious, setDailyPrevious] = useState<DailyRow[]>([]);
  const [breakdownAge, setBreakdownAge] = useState<MetaBreakdownInsights[]>([]);
  const [breakdownGender, setBreakdownGender] = useState<MetaBreakdownInsights[]>([]);
  const [breakdownPlacement, setBreakdownPlacement] = useState<MetaBreakdownInsights[]>([]);
  const [creatives, setCreatives] = useState<MetaCreativeSummary[]>([]);

  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    const loadAccounts = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/meta/accounts");
        if (!res.ok) {
          throw new Error("アカウントの取得に失敗しました");
        }

        const rows = (await res.json()) as MetaAccount[];
        if (!mounted) return;

        setAccounts(rows);
        if (rows.length > 0) {
          setAccountId(rows[0].id);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "データ取得エラー");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void loadAccounts();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!accountId) return;

    let mounted = true;
    const currentRange = resolveDateRange(datePreset);
    const previousRange = getPreviousRange(datePreset);

    const loadDetails = async () => {
      setDetailsLoading(true);
      setError("");
      try {
        const [
          insightsRes,
          campaignsRes,
          adsetsRes,
          adsRes,
          dailyCurrentRes,
          dailyPrevRes,
          breakAgeRes,
          breakGenderRes,
          breakPlacementRes,
          creativesRes,
        ] = await Promise.all([
          fetch(`/api/meta/insights?account_id=${encodeURIComponent(accountId)}&date_preset=${datePreset}`),
          fetch(`/api/meta/campaigns?account_id=${encodeURIComponent(accountId)}&date_preset=${datePreset}`),
          fetch(`/api/meta/adsets?account_id=${encodeURIComponent(accountId)}&date_preset=${datePreset}`),
          fetch(`/api/meta/ads?account_id=${encodeURIComponent(accountId)}&date_preset=${datePreset}&limit=100`),
          fetch(
            `/api/meta/daily?account_id=${encodeURIComponent(accountId)}&since=${currentRange.since}&until=${currentRange.until}`,
          ),
          fetch(
            `/api/meta/daily?account_id=${encodeURIComponent(accountId)}&since=${previousRange.since}&until=${previousRange.until}`,
          ),
          fetch(
            `/api/meta/breakdowns?account_id=${encodeURIComponent(accountId)}&date_preset=${datePreset}&dimension=age`,
          ),
          fetch(
            `/api/meta/breakdowns?account_id=${encodeURIComponent(accountId)}&date_preset=${datePreset}&dimension=gender`,
          ),
          fetch(
            `/api/meta/breakdowns?account_id=${encodeURIComponent(accountId)}&date_preset=${datePreset}&dimension=publisher_platform`,
          ),
          fetch(`/api/meta/creatives?account_id=${encodeURIComponent(accountId)}&date_preset=${datePreset}`),
        ]);

        const responses = [
          insightsRes,
          campaignsRes,
          adsetsRes,
          adsRes,
          dailyCurrentRes,
          dailyPrevRes,
          breakAgeRes,
          breakGenderRes,
          breakPlacementRes,
          creativesRes,
        ];

        if (responses.some((res) => !res.ok)) {
          throw new Error("分析データの取得に失敗しました");
        }

        const [
          insightsData,
          campaignsData,
          adsetsData,
          adsData,
          dailyCurrentData,
          dailyPrevData,
          breakAgeData,
          breakGenderData,
          breakPlacementData,
          creativesData,
        ] = await Promise.all([
          insightsRes.json() as Promise<MetaInsights | null>,
          campaignsRes.json() as Promise<MetaCampaignInsights[]>,
          adsetsRes.json() as Promise<EnrichedAdset[]>,
          adsRes.json() as Promise<MetaAdInsights[]>,
          dailyCurrentRes.json() as Promise<DailyRow[]>,
          dailyPrevRes.json() as Promise<DailyRow[]>,
          breakAgeRes.json() as Promise<MetaBreakdownInsights[]>,
          breakGenderRes.json() as Promise<MetaBreakdownInsights[]>,
          breakPlacementRes.json() as Promise<MetaBreakdownInsights[]>,
          creativesRes.json() as Promise<MetaCreativeSummary[]>,
        ]);

        if (!mounted) return;

        setInsights(insightsData);
        setCampaigns(campaignsData || []);
        setAdsets(adsetsData || []);
        setAds(adsData || []);
        setDailyCurrent(Array.isArray(dailyCurrentData) ? dailyCurrentData : []);
        setDailyPrevious(Array.isArray(dailyPrevData) ? dailyPrevData : []);
        setBreakdownAge(Array.isArray(breakAgeData) ? breakAgeData : []);
        setBreakdownGender(Array.isArray(breakGenderData) ? breakGenderData : []);
        setBreakdownPlacement(Array.isArray(breakPlacementData) ? breakPlacementData : []);
        setCreatives(Array.isArray(creativesData) ? creativesData : []);
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "データ取得エラー");
          setInsights(null);
          setCampaigns([]);
          setAdsets([]);
          setAds([]);
          setDailyCurrent([]);
          setDailyPrevious([]);
          setBreakdownAge([]);
          setBreakdownGender([]);
          setBreakdownPlacement([]);
          setCreatives([]);
        }
      } finally {
        if (mounted) {
          setDetailsLoading(false);
        }
      }
    };

    void loadDetails();

    return () => {
      mounted = false;
    };
  }, [accountId, datePreset]);

  const currentSnapshot = useMemo(() => {
    if (dailyCurrent.length > 0) {
      return parseMetricSnapshot(aggregateDaily(dailyCurrent));
    }
    return parseMetricSnapshot(insights);
  }, [dailyCurrent, insights]);

  const previousSnapshot = useMemo(() => parseMetricSnapshot(aggregateDaily(dailyPrevious)), [dailyPrevious]);

  const kpiCards = useMemo(() => buildKpiCards(currentSnapshot, previousSnapshot), [currentSnapshot, previousSnapshot]);

  const trendData = useMemo(() => {
    return dailyCurrent.map((row) => {
      const spend = Number.parseFloat(row.spend || "0") || 0;
      const cv = row.cv ?? actionValue(row.actions, "offsite_conversion.fb_pixel_custom");
      return {
        date: row.date_start,
        spend,
        cv,
        cpa: cv > 0 ? spend / cv : 0,
      };
    });
  }, [dailyCurrent]);

  const pacing = useMemo(() => calcBudgetPacing(currentSnapshot.spend, monthlyBudget), [currentSnapshot.spend, monthlyBudget]);

  const analysisComments = useMemo(() => {
    if (!insights) return [];
    return [...generateAccountAnalysis(insights, campaigns), ...summarizeAdsetRisks(adsets)];
  }, [adsets, campaigns, insights]);

  const topCreative = useMemo(() => topCreativeByCv(ads), [ads]);

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === accountId) || null,
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
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-navy">広告分析ダッシュボード</h2>
            <p className="mt-1 text-sm text-gray-500">ATOM同等分析: KPI / 推移 / 内訳 / クリエイティブ / ペーシング</p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="text-sm text-gray-700">
              アカウント
              <select
                className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2"
                value={accountId}
                onChange={(event) => setAccountId(event.target.value)}
              >
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}（{account.account_id}）
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-gray-700">
              期間
              <select
                className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2"
                value={datePreset}
                onChange={(event) => setDatePreset(event.target.value)}
              >
                {PRESETS.map((preset) => (
                  <option key={preset.value} value={preset.value}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-gray-700">
              月間予算
              <input
                type="number"
                min={0}
                value={monthlyBudget}
                onChange={(event) => setMonthlyBudget(Number(event.target.value) || 0)}
                className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 tabular-nums"
              />
            </label>
          </div>
        </div>
        {selectedAccount && (
          <p className="mt-3 text-xs text-gray-500">
            通貨: {selectedAccount.currency} / タイムゾーン: {selectedAccount.timezone_name}
          </p>
        )}
      </section>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {detailsLoading ? (
        <div className="flex h-60 items-center justify-center rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue border-t-transparent" />
        </div>
      ) : (
        <>
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {kpiCards.map((card) => {
              const isCostMetric = card.key === "spend" || card.key === "cpc" || card.key === "cpa";
              const delta = card.deltaPct;
              const isUp = (delta ?? 0) >= 0;
              const positiveColor = isCostMetric ? "text-red-600" : "text-emerald-600";
              const negativeColor = isCostMetric ? "text-emerald-600" : "text-red-600";

              let valueText = formatNumber(card.value);
              if (card.format === "currency") valueText = formatCurrency(card.value);
              if (card.format === "percent") valueText = formatPercent(card.value);

              return (
                <article key={card.key} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                  <p className="text-sm text-gray-500">{card.label}</p>
                  <p className="mt-2 text-2xl font-bold text-navy tabular-nums">{valueText}</p>
                  <p className={`mt-2 text-xs tabular-nums ${isUp ? positiveColor : negativeColor}`}>
                    {delta === null ? "前期間データなし" : `${isUp ? "↑" : "↓"} ${Math.abs(delta).toFixed(1)}%`}
                  </p>
                </article>
              );
            })}
          </section>

          <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <article className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm xl:col-span-2">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-base font-semibold text-navy">日別推移</h3>
                <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-1 text-xs">
                  {(["spend", "cv", "cpa"] as TrendMetric[]).map((metric) => (
                    <button
                      key={metric}
                      type="button"
                      onClick={() => setTrendMetric(metric)}
                      className={`rounded-md px-2.5 py-1 ${trendMetric === metric ? "bg-blue text-white" : "text-gray-600"}`}
                    >
                      {metricLabel(metric)}
                    </button>
                  ))}
                </div>
              </div>
              <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="date" tick={{ fill: "#64748B", fontSize: 12 }} />
                  <YAxis
                    tick={{ fill: "#64748B", fontSize: 12 }}
                    tickFormatter={(value: number) => {
                      if (trendMetric === "spend" || trendMetric === "cpa") return `¥${Math.round(value).toLocaleString("ja-JP")}`;
                      return Math.round(value).toLocaleString("ja-JP");
                    }}
                  />
                  <Tooltip
                    formatter={(value: number | string | undefined) => {
                      const num = Number.parseFloat(String(value ?? 0)) || 0;
                      if (trendMetric === "spend" || trendMetric === "cpa") return [formatCurrency(num), metricLabel(trendMetric)];
                      return [formatNumber(num), metricLabel(trendMetric)];
                    }}
                  />
                  <Area type="monotone" dataKey={trendMetric} stroke="#2C5282" fill="#93C5FD" fillOpacity={0.35} />
                  <Line type="monotone" dataKey={trendMetric} stroke="#2C5282" dot={false} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </article>

            <article className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="text-base font-semibold text-navy">予算ペーシング</h3>
              <div className="mt-4 space-y-3 text-sm text-gray-700">
                <p className="tabular-nums">現在消化: {formatCurrency(pacing.spendToDate)}</p>
                <p className="tabular-nums">月末予測: {formatCurrency(pacing.projectedSpend)}</p>
                <p className="tabular-nums">予算: {formatCurrency(pacing.budget)}</p>
                <div>
                  <p className="mb-1 text-xs text-gray-500">消化率 {formatPercent(pacing.utilizationPct)}</p>
                  <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full bg-blue"
                      style={{ width: `${Math.min(100, pacing.utilizationPct)}%` }}
                    />
                  </div>
                </div>
                <div>
                  <p className="mb-1 text-xs text-gray-500">予測達成率 {formatPercent(pacing.projectionPct)}</p>
                  <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className={`h-full ${pacing.projectionPct > 100 ? "bg-red-500" : "bg-emerald-600"}`}
                      style={{ width: `${Math.min(100, pacing.projectionPct)}%` }}
                    />
                  </div>
                </div>
              </div>
            </article>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="text-base font-semibold text-navy">期間比較（前期間比）</h3>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-xs text-gray-500">消化額</p>
                <p className="mt-1 text-lg font-semibold text-navy tabular-nums">{formatCurrency(currentSnapshot.spend)}</p>
                <p className="text-xs text-gray-500 tabular-nums">前期間: {formatCurrency(previousSnapshot.spend)}</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-xs text-gray-500">CV</p>
                <p className="mt-1 text-lg font-semibold text-navy tabular-nums">{formatNumber(currentSnapshot.cv)}</p>
                <p className="text-xs text-gray-500 tabular-nums">前期間: {formatNumber(previousSnapshot.cv)}</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-xs text-gray-500">CPA</p>
                <p className="mt-1 text-lg font-semibold text-navy tabular-nums">{formatCurrency(currentSnapshot.cpa)}</p>
                <p className="text-xs text-gray-500 tabular-nums">前期間: {formatCurrency(previousSnapshot.cpa)}</p>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-base font-semibold text-navy">広告セット詳細</h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">広告セット名</th>
                    <th className="px-3 py-2 text-left font-medium">消化額</th>
                    <th className="px-3 py-2 text-left font-medium">IMP</th>
                    <th className="px-3 py-2 text-left font-medium">クリック</th>
                    <th className="px-3 py-2 text-left font-medium">CTR</th>
                    <th className="px-3 py-2 text-left font-medium">CV</th>
                    <th className="px-3 py-2 text-left font-medium">CPA</th>
                  </tr>
                </thead>
                <tbody>
                  {[...adsets]
                    .sort((a, b) => (Number.parseFloat(b.spend || "0") || 0) - (Number.parseFloat(a.spend || "0") || 0))
                    .slice(0, 20)
                    .map((adset, index) => {
                      const spend = Number.parseFloat(adset.spend || "0") || 0;
                      const impressions = Number.parseFloat(adset.impressions || "0") || 0;
                      const clicks = Number.parseFloat(adset.clicks || "0") || 0;
                      const ctr = Number.parseFloat(adset.ctr || "0") || 0;
                      const cv = adset.cv ?? actionValue(adset.actions, "offsite_conversion.fb_pixel_custom");
                      const cpa = adset.cpa ?? (cv > 0 ? spend / cv : 0);

                      return (
                        <tr key={adset.adset_id} className={index % 2 === 0 ? "bg-white" : "bg-gray-50/60"}>
                          <td className="px-3 py-2 font-medium text-navy">{adset.adset_name}</td>
                          <td className="px-3 py-2 tabular-nums">{formatCurrency(spend)}</td>
                          <td className="px-3 py-2 tabular-nums">{formatNumber(impressions)}</td>
                          <td className="px-3 py-2 tabular-nums">{formatNumber(clicks)}</td>
                          <td className="px-3 py-2 tabular-nums">{formatPercent(ctr)}</td>
                          <td className="px-3 py-2 tabular-nums">{formatNumber(cv)}</td>
                          <td className="px-3 py-2 tabular-nums">{cv > 0 ? formatCurrency(cpa) : "-"}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {[
              { title: "年齢別", rows: breakdownAge, keyName: "age" as const },
              { title: "性別", rows: breakdownGender, keyName: "gender" as const },
              { title: "配置別", rows: breakdownPlacement, keyName: "publisher_platform" as const },
            ].map((panel) => (
              <article key={panel.title} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <h3 className="text-base font-semibold text-navy">ブレイクダウン分析: {panel.title}</h3>
                <div className="mt-3 space-y-2 text-sm">
                  {panel.rows.slice(0, 6).map((row, idx) => {
                    const spend = Number.parseFloat(row.spend || "0") || 0;
                    const value = row[panel.keyName] || "unknown";
                    return (
                      <div key={`${value}-${idx}`} className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2">
                        <span className="text-gray-700">{value}</span>
                        <span className="tabular-nums text-navy">{formatCurrency(spend)}</span>
                      </div>
                    );
                  })}
                  {panel.rows.length === 0 && <p className="text-gray-500">データがありません</p>}
                </div>
              </article>
            ))}
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-base font-semibold text-navy">クリエイティブ分析</h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">サムネイル</th>
                    <th className="px-3 py-2 text-left font-medium">クリエイティブ名</th>
                    <th className="px-3 py-2 text-left font-medium">消化額</th>
                    <th className="px-3 py-2 text-left font-medium">CTR</th>
                    <th className="px-3 py-2 text-left font-medium">CV</th>
                    <th className="px-3 py-2 text-left font-medium">CPA</th>
                  </tr>
                </thead>
                <tbody>
                  {creatives.slice(0, 15).map((creative, index) => (
                    <tr key={creative.ad_id} className={index % 2 === 0 ? "bg-white" : "bg-gray-50/60"}>
                      <td className="px-3 py-2">
                        {creative.thumbnail_url ? (
                          <img
                            src={creative.thumbnail_url}
                            alt={creative.creative_name}
                            className="h-10 w-16 rounded object-cover"
                          />
                        ) : (
                          <div className="flex h-10 w-16 items-center justify-center rounded bg-gray-100 text-xs text-gray-500">
                            画像なし
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 font-medium text-navy">{creative.creative_name}</td>
                      <td className="px-3 py-2 tabular-nums">{formatCurrency(creative.spend)}</td>
                      <td className="px-3 py-2 tabular-nums">{formatPercent(creative.ctr)}</td>
                      <td className="px-3 py-2 tabular-nums">{formatNumber(creative.cv)}</td>
                      <td className="px-3 py-2 tabular-nums">{creative.cv > 0 ? formatCurrency(creative.cpa) : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {topCreative && (
              <p className="mt-3 text-xs text-gray-500">
                CV最多クリエイティブ: {topCreative.ad.ad_name}（CV {formatNumber(topCreative.cv)} / CPA {formatCurrency(topCreative.cpa)}）
              </p>
            )}
          </section>

          <section className="rounded-xl border-l-4 border-blue bg-blue-50 p-4">
            <h3 className="text-base font-semibold text-navy">分析コメント</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-700">
              {analysisComments.map((comment) => (
                <li key={comment}>{comment}</li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
