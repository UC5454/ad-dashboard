"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { MetaInsights, MetaCreativeSummary } from "@/types/meta";
import { calculateBudgetProgress } from "@/lib/budget";
import { generateAlerts } from "@/lib/alerts";
import { DEFAULT_SETTINGS, loadSettings, type FeeCalcMethod } from "@/lib/settings";

type DatePreset = "today" | "yesterday" | "last_7d" | "last_30d" | "this_month";

interface DailyRow extends MetaInsights {
  cv?: number;
}

interface ProjectRow {
  id: string;
  name: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cv: number;
  cpa: number;
}

interface CreativeRow extends MetaCreativeSummary {}

function formatCurrency(value: number): string {
  return `¥${Math.round(value).toLocaleString("ja-JP")}`;
}

function formatNumber(value: number): string {
  return Math.round(value).toLocaleString("ja-JP");
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function toNumber(value: string | number | null | undefined): number {
  return Number.parseFloat(String(value ?? "0")) || 0;
}

function feeLabel(method: FeeCalcMethod): string {
  return method === "margin" ? "Fee込(内掛)" : "Fee込(外掛)";
}

export default function DashboardPage() {
  const [datePreset, setDatePreset] = useState<DatePreset>("last_30d");
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [daily, setDaily] = useState<DailyRow[]>([]);
  const [creatives, setCreatives] = useState<CreativeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showDailyTable, setShowDailyTable] = useState(false);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  useEffect(() => {
    setSettings(loadSettings());
  }, []);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const [projectRes, dailyRes, creativeRes] = await Promise.all([
          fetch(`/api/meta/projects?date_preset=${datePreset}`),
          fetch(`/api/meta/daily?date_preset=${datePreset}`),
          fetch(`/api/meta/creatives?date_preset=${datePreset}`),
        ]);

        if (!projectRes.ok || !dailyRes.ok || !creativeRes.ok) {
          throw new Error("ダッシュボードデータの取得に失敗しました");
        }

        const [projectRows, dailyRows, creativeRows] = await Promise.all([
          projectRes.json() as Promise<ProjectRow[]>,
          dailyRes.json() as Promise<DailyRow[]>,
          creativeRes.json() as Promise<CreativeRow[]>,
        ]);

        if (!mounted) return;

        setProjects(Array.isArray(projectRows) ? projectRows : []);
        setDaily(Array.isArray(dailyRows) ? dailyRows : []);
        setCreatives(Array.isArray(creativeRows) ? creativeRows : []);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "データ取得エラー");
        setProjects([]);
        setDaily([]);
        setCreatives([]);
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

  const summary = useMemo(() => {
    return projects.reduce(
      (acc, row) => {
        acc.spend += row.spend;
        acc.impressions += row.impressions;
        acc.clicks += row.clicks;
        acc.cv += row.cv;
        return acc;
      },
      { spend: 0, impressions: 0, clicks: 0, cv: 0 },
    );
  }, [projects]);

  const cpa = summary.cv > 0 ? summary.spend / summary.cv : 0;
  const ctr = summary.impressions > 0 ? (summary.clicks / summary.impressions) * 100 : 0;
  const cpc = summary.clicks > 0 ? summary.spend / summary.clicks : 0;
  const averageCpa = cpa;

  const sortedProjects = useMemo(() => {
    return [...projects].sort((a, b) => b.spend - a.spend);
  }, [projects]);

  const budgetRows = useMemo(() => {
    return sortedProjects.map((project) => ({
      ...project,
      progress: calculateBudgetProgress(
        project.name,
        project.spend,
        settings.budgets,
        settings.defaultFeeRate,
        settings.feeCalcMethod,
      ),
    }));
  }, [sortedProjects, settings]);

  const totalSpendWithFee = useMemo(() => {
    return budgetRows.reduce((sum, row) => sum + row.progress.spendWithFee, 0);
  }, [budgetRows]);

  const feeLabelText = feeLabel(settings.feeCalcMethod);

  const alertRows = useMemo(() => {
    const normalizedDaily = daily.map((row) => ({
      date_start: row.date_start,
      spend: toNumber(row.spend),
      cv: row.cv ?? 0,
      impressions: toNumber(row.impressions),
      clicks: toNumber(row.clicks),
    }));

    return generateAlerts(
      projects.map((project) => ({
        name: project.name,
        spend: project.spend,
        cv: project.cv,
        cpa: project.cpa,
        ctr: project.ctr,
      })),
      normalizedDaily,
      creatives.map((creative) => ({
        creative_name: creative.creative_name,
        spend: creative.spend,
        cv: creative.cv,
        ctr: creative.ctr,
      })),
      settings.budgets.map((budget) => ({ projectName: budget.projectName, monthlyBudget: budget.monthlyBudget })),
      settings.alertThresholds,
    );
  }, [projects, daily, creatives, settings]);

  const dailyRows = useMemo(() => {
    return [...daily]
      .map((row) => {
        const spend = toNumber(row.spend);
        const impressions = toNumber(row.impressions);
        const clicks = toNumber(row.clicks);
        const cv = row.cv ?? 0;
        return {
          date_start: row.date_start,
          spend,
          impressions,
          clicks,
          ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
          cv,
          cpa: cv > 0 ? spend / cv : 0,
          cpc: clicks > 0 ? spend / clicks : 0,
        };
      })
      .sort((a, b) => a.date_start.localeCompare(b.date_start));
  }, [daily]);

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {alertRows.length > 0 && (
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-navy">アラート</h3>
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                {alertRows.length}
              </span>
            </div>
            <Link href="/dashboard/alerts" className="text-xs text-blue hover:text-blue-light hover:underline">
              全て見る →
            </Link>
          </div>
          <div className="space-y-2">
            {alertRows.slice(0, 3).map((alert, index) => {
              const dotColor =
                alert.type === "critical" ? "bg-red-500" : alert.type === "warning" ? "bg-amber-500" : "bg-blue-500";
              return (
                <div key={`${alert.title}-${index}`} className="flex items-start gap-2 text-sm">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dotColor}`} />
                  <div className="min-w-0">
                    <span className="font-medium text-navy">{alert.title}</span>
                    {alert.projectName && <span className="text-gray-500"> / {alert.projectName}</span>}
                  </div>
                </div>
              );
            })}
          </div>
          {alertRows.length > 3 && (
            <Link href="/dashboard/alerts" className="mt-2 block text-xs text-gray-500 hover:text-blue">
              他 {alertRows.length - 3} 件のアラート →
            </Link>
          )}
        </section>
      )}

      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-navy">デジタルゴリラ ダッシュボード</h2>
            <p className="mt-1 text-sm text-gray-500">案件別パフォーマンスの集約ビュー</p>
          </div>
          <label className="text-sm text-gray-700">
            期間
            <select
              className="mt-1 rounded-lg border border-gray-200 bg-white px-3 py-2"
              value={datePreset}
              onChange={(event) => setDatePreset(event.target.value as DatePreset)}
            >
              <option value="today">今日</option>
              <option value="yesterday">昨日</option>
              <option value="last_7d">過去7日</option>
              <option value="last_30d">過去30日</option>
              <option value="this_month">今月</option>
            </select>
          </label>
        </div>
      </section>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
        <article className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>総消化額</span>
            <span className="rounded-full bg-blue/10 p-1 text-blue">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18m-7-7h14" />
              </svg>
            </span>
          </div>
          <p className={`mt-2 text-2xl font-bold tabular-nums ${summary.spend === 0 ? "text-gray-400" : "text-navy"}`}>
            {formatCurrency(summary.spend)}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            {feeLabelText}: {formatCurrency(totalSpendWithFee)}
          </p>
        </article>
        <article className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>総CV</span>
            <span className="rounded-full bg-blue/10 p-1 text-blue">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 12h5l2-3 3 6 2-3h4" />
              </svg>
            </span>
          </div>
          <p className={`mt-2 text-2xl font-bold tabular-nums ${summary.cv === 0 ? "text-gray-400" : "text-navy"}`}>
            {formatNumber(summary.cv)}
          </p>
        </article>
        <article className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>平均CPA</span>
            <span className="rounded-full bg-blue/10 p-1 text-blue">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                <circle cx="12" cy="12" r="8" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 2" />
              </svg>
            </span>
          </div>
          <p className={`mt-2 text-2xl font-bold tabular-nums ${summary.cv === 0 ? "text-gray-400" : "text-navy"}`}>
            {summary.cv > 0 ? formatCurrency(cpa) : "-"}
          </p>
        </article>
        <article className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>CTR</span>
            <span className="rounded-full bg-blue/10 p-1 text-blue">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 17l6-6 4 4 6-7" />
              </svg>
            </span>
          </div>
          <p className={`mt-2 text-2xl font-bold tabular-nums ${ctr === 0 ? "text-gray-400" : "text-navy"}`}>
            {formatPercent(ctr)}
          </p>
        </article>
        <article className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>平均CPC</span>
            <span className="rounded-full bg-blue/10 p-1 text-blue">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h10v10H7z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 9h6v6H9z" />
              </svg>
            </span>
          </div>
          <p className={`mt-2 text-2xl font-bold tabular-nums ${summary.clicks === 0 ? "text-gray-400" : "text-navy"}`}>
            {summary.clicks > 0 ? formatCurrency(cpc) : "-"}
          </p>
        </article>
        <article className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>総クリック数</span>
            <span className="rounded-full bg-blue/10 p-1 text-blue">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h10l-5 10-5-10Z" />
              </svg>
            </span>
          </div>
          <p className={`mt-2 text-2xl font-bold tabular-nums ${summary.clicks === 0 ? "text-gray-400" : "text-navy"}`}>
            {formatNumber(summary.clicks)}
          </p>
        </article>
        <article className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>総IMP</span>
            <span className="rounded-full bg-blue/10 p-1 text-blue">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12s4-6 9-6 9 6 9 6-4 6-9 6-9-6-9-6Z" />
                <circle cx="12" cy="12" r="2.5" />
              </svg>
            </span>
          </div>
          <p className={`mt-2 text-2xl font-bold tabular-nums ${summary.impressions === 0 ? "text-gray-400" : "text-navy"}`}>
            {formatNumber(summary.impressions)}
          </p>
        </article>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-navy">予算進捗</h3>
          <span className="text-xs text-gray-500">案件数: {formatNumber(budgetRows.length)}</span>
        </div>
        <div className="space-y-4">
          {budgetRows.map((project) => {
            const progress = project.progress;
            const rate = progress.consumptionRate ?? 0;
            const barColor =
              progress.paceStatus === "under"
                ? "bg-blue"
                : progress.paceStatus === "over"
                  ? "bg-red-500"
                  : "bg-emerald-500";
            const paceLabel =
              progress.paceStatus === "under" ? "ペース遅れ" : progress.paceStatus === "over" ? "超過ペース" : "順調";
            return (
              <div key={`budget-${project.id}`} className="rounded-lg border border-gray-200 p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <p className="text-sm font-semibold text-navy">{project.name}</p>
                  {progress.monthlyBudget === null ? (
                    <span className="text-xs text-gray-500">予算未設定</span>
                  ) : (
                    <span className="text-xs text-gray-500 tabular-nums">
                      {formatCurrency(project.spend)} / {formatCurrency(progress.monthlyBudget)}
                    </span>
                  )}
                </div>

                {progress.monthlyBudget === null ? (
                  <p className="mt-2 text-sm text-gray-500">
                    予算が未設定のため、進捗を算出できません。{" "}
                    <Link href="/dashboard/settings" className="text-blue hover:text-blue-light hover:underline">
                      設定画面
                    </Link>
                    で予算を設定できます。
                  </p>
                ) : (
                  <>
                    <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-100">
                      <div className={`h-full ${barColor}`} style={{ width: `${Math.min(rate, 130)}%` }} />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-600">
                      <span className="tabular-nums">
                        {feeLabelText}: {formatCurrency(progress.spendWithFee)}
                      </span>
                      <span className="tabular-nums">理想: {formatPercent(progress.idealRate)}</span>
                      <span className="tabular-nums">実績: {formatPercent(rate)}</span>
                      <span className="tabular-nums">
                        着地予想: {progress.projectedSpend ? formatCurrency(progress.projectedSpend) : "-"}
                      </span>
                      <span className="tabular-nums">
                        {feeLabelText}着地: {progress.projectedSpendWithFee ? formatCurrency(progress.projectedSpendWithFee) : "-"}
                      </span>
                      <span className="tabular-nums">
                        残予算: {progress.remainingBudget !== null ? formatCurrency(progress.remainingBudget) : "-"}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] ${
                          progress.paceStatus === "under"
                            ? "bg-blue-50 text-blue-700"
                            : progress.paceStatus === "over"
                              ? "bg-red-50 text-red-700"
                              : "bg-emerald-50 text-emerald-700"
                        }`}
                      >
                        {paceLabel}
                      </span>
                    </div>
                  </>
                )}
              </div>
            );
          })}
          {budgetRows.length === 0 && <p className="text-sm text-gray-500">案件データがありません</p>}
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-base font-semibold text-navy">日次推移（消化額 / CPC）</h3>
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart data={dailyRows}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis dataKey="date_start" tick={{ fill: "#64748B", fontSize: 12 }} />
            <YAxis
              yAxisId="left"
              tick={{ fill: "#64748B", fontSize: 12 }}
              tickFormatter={(value: number) => `¥${Math.round(value).toLocaleString("ja-JP")}`}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fill: "#64748B", fontSize: 12 }}
              tickFormatter={(value: number) => `¥${Math.round(value).toLocaleString("ja-JP")}`}
            />
            <Tooltip
              formatter={(value: number | string | undefined, name?: string) => {
                const num = Number.parseFloat(String(value ?? 0)) || 0;
                if (name === "cpc") return [`¥${Math.round(num).toLocaleString("ja-JP")}`, "CPC"];
                return [formatCurrency(num), "消化額"];
              }}
            />
            <Area yAxisId="left" type="monotone" dataKey="spend" stroke="#2C5282" fill="#93C5FD" fillOpacity={0.35} />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="cpc"
              stroke="#F59E0B"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-navy">日次データ</h3>
          <button
            type="button"
            onClick={() => setShowDailyTable((prev) => !prev)}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {showDailyTable ? "日次データを閉じる" : "日次データを表示"}
          </button>
        </div>
        {showDailyTable && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">日付</th>
                  <th className="px-3 py-2 text-left font-medium">消化額</th>
                  <th className="px-3 py-2 text-left font-medium">IMP</th>
                  <th className="px-3 py-2 text-left font-medium">クリック</th>
                  <th className="px-3 py-2 text-left font-medium">CTR</th>
                  <th className="px-3 py-2 text-left font-medium">CPC</th>
                  <th className="px-3 py-2 text-left font-medium">CV</th>
                  <th className="px-3 py-2 text-left font-medium">CPA</th>
                </tr>
              </thead>
              <tbody>
                {dailyRows.map((row, index) => (
                  <tr key={`${row.date_start}-${index}`} className={index % 2 === 0 ? "bg-white" : "bg-gray-50/60"}>
                    <td className="px-3 py-2">{row.date_start}</td>
                    <td className="px-3 py-2 tabular-nums">{formatCurrency(row.spend)}</td>
                    <td className="px-3 py-2 tabular-nums">{formatNumber(row.impressions)}</td>
                    <td className="px-3 py-2 tabular-nums">{formatNumber(row.clicks)}</td>
                    <td className="px-3 py-2 tabular-nums">{formatPercent(row.ctr)}</td>
                    <td className="px-3 py-2 tabular-nums">{row.clicks > 0 ? formatCurrency(row.cpc) : "-"}</td>
                    <td className="px-3 py-2 tabular-nums">{formatNumber(row.cv)}</td>
                    <td className="px-3 py-2 tabular-nums">{row.cv > 0 ? formatCurrency(row.cpa) : "-"}</td>
                  </tr>
                ))}
                {dailyRows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-gray-500">
                      日次データがありません
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-navy">案件一覧</h3>
          <span className="text-xs text-gray-500">案件数: {formatNumber(sortedProjects.length)}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left font-medium">案件名</th>
                <th className="px-3 py-2 text-left font-medium">消化額</th>
                <th className="px-3 py-2 text-left font-medium">IMP</th>
                <th className="px-3 py-2 text-left font-medium">クリック</th>
                <th className="px-3 py-2 text-left font-medium">CTR</th>
                <th className="px-3 py-2 text-left font-medium">CPC</th>
                <th className="px-3 py-2 text-left font-medium">CV</th>
                <th className="px-3 py-2 text-left font-medium">CPA</th>
                <th className="px-3 py-2 text-left font-medium">ステータス</th>
              </tr>
            </thead>
            <tbody>
              {budgetRows.map((project, index) => (
                <tr key={project.id} className={index % 2 === 0 ? "bg-white" : "bg-gray-50/60"}>
                  <td className="px-3 py-2 font-medium text-navy">
                    <Link
                      href={`/dashboard/projects/${project.id}`}
                      className="text-blue hover:text-blue-light hover:underline"
                    >
                      {project.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    <p>{formatCurrency(project.spend)}</p>
                    <p className="text-xs text-gray-500">
                      {feeLabelText}: {formatCurrency(project.progress.spendWithFee)}
                    </p>
                  </td>
                  <td className="px-3 py-2 tabular-nums">{formatNumber(project.impressions)}</td>
                  <td className="px-3 py-2 tabular-nums">{formatNumber(project.clicks)}</td>
                  <td className="px-3 py-2 tabular-nums">{formatPercent(project.ctr)}</td>
                  <td className="px-3 py-2 tabular-nums">{project.clicks > 0 ? formatCurrency(project.spend / project.clicks) : "-"}</td>
                  <td className="px-3 py-2 tabular-nums">{formatNumber(project.cv)}</td>
                  <td
                    className={`px-3 py-2 tabular-nums ${
                      project.cv > 0 && averageCpa > 0
                        ? project.cpa >= averageCpa * 1.2
                          ? "text-red-600"
                          : project.cpa <= averageCpa * 0.8
                            ? "text-emerald-600"
                            : ""
                        : ""
                    }`}
                  >
                    {project.cv > 0 ? formatCurrency(project.cpa) : "-"}
                  </td>
                  <td className="px-3 py-2">
                    {project.progress.monthlyBudget === null ? (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">予算未設定</span>
                    ) : project.progress.paceStatus === "under" ? (
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">ペース遅れ</span>
                    ) : project.progress.paceStatus === "over" ? (
                      <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700">超過ペース</span>
                    ) : (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">順調</span>
                    )}
                  </td>
                </tr>
              ))}
              {sortedProjects.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-gray-500">
                    案件データがありません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

    </div>
  );
}
