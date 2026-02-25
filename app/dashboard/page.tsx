"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { MetaInsights, MetaCreativeSummary } from "@/types/meta";
import { calculateBudgetProgress, DEFAULT_BUDGETS } from "@/lib/budget";
import { generateAlerts } from "@/lib/alerts";

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

export default function DashboardPage() {
  const [datePreset, setDatePreset] = useState<DatePreset>("last_30d");
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [daily, setDaily] = useState<DailyRow[]>([]);
  const [creatives, setCreatives] = useState<CreativeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showDailyTable, setShowDailyTable] = useState(false);

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
  const averageCpa = cpa;

  const sortedProjects = useMemo(() => {
    return [...projects].sort((a, b) => b.spend - a.spend);
  }, [projects]);

  const budgetRows = useMemo(() => {
    return sortedProjects.map((project) => ({
      ...project,
      progress: calculateBudgetProgress(project.name, project.spend),
    }));
  }, [sortedProjects]);

  const alertRows = useMemo(() => {
    const normalizedDaily = daily.map((row) => ({
      date_start: row.date_start,
      spend: toNumber(row.spend),
      cv: row.cv ?? 0,
      impressions: toNumber(row.impressions),
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
      DEFAULT_BUDGETS,
    );
  }, [projects, daily, creatives]);

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
        <section className="space-y-3">
          {alertRows.map((alert, index) => {
            const colorClass =
              alert.type === "critical"
                ? "border-red-500 bg-red-50 text-red-800"
                : alert.type === "warning"
                  ? "border-amber-500 bg-amber-50 text-amber-800"
                  : "border-blue-500 bg-blue-50 text-blue-800";
            return (
              <div key={`${alert.title}-${index}`} className={`rounded-lg border-l-4 px-4 py-3 ${colorClass}`}>
                <p className="text-sm font-semibold">{alert.title}</p>
                <p className="text-sm">
                  {alert.projectName ? `${alert.projectName} / ` : ""}
                  {alert.message}
                </p>
              </div>
            );
          })}
        </section>
      )}

      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
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

      <section className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <article className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">総消化額</p>
          <p className="mt-2 text-2xl font-bold text-navy tabular-nums">{formatCurrency(summary.spend)}</p>
        </article>
        <article className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">総CV</p>
          <p className="mt-2 text-2xl font-bold text-navy tabular-nums">{formatNumber(summary.cv)}</p>
        </article>
        <article className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">平均CPA</p>
          <p className="mt-2 text-2xl font-bold text-navy tabular-nums">{summary.cv > 0 ? formatCurrency(cpa) : "-"}</p>
        </article>
        <article className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">CTR</p>
          <p className="mt-2 text-2xl font-bold text-navy tabular-nums">{formatPercent(ctr)}</p>
        </article>
        <article className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">総クリック数</p>
          <p className="mt-2 text-2xl font-bold text-navy tabular-nums">{formatNumber(summary.clicks)}</p>
        </article>
        <article className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">総IMP</p>
          <p className="mt-2 text-2xl font-bold text-navy tabular-nums">{formatNumber(summary.impressions)}</p>
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
                  <p className="mt-2 text-sm text-gray-500">予算が未設定のため、進捗を算出できません。</p>
                ) : (
                  <>
                    <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-100">
                      <div className={`h-full ${barColor}`} style={{ width: `${Math.min(rate, 130)}%` }} />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-600">
                      <span className="tabular-nums">理想: {formatPercent(progress.idealRate)}</span>
                      <span className="tabular-nums">実績: {formatPercent(rate)}</span>
                      <span className="tabular-nums">
                        着地予想: {progress.projectedSpend ? formatCurrency(progress.projectedSpend) : "-"}
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
        <h3 className="mb-4 text-base font-semibold text-navy">日次推移（消化額）</h3>
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart data={daily}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis dataKey="date_start" tick={{ fill: "#64748B", fontSize: 12 }} />
            <YAxis
              tick={{ fill: "#64748B", fontSize: 12 }}
              tickFormatter={(value: number) => `¥${Math.round(value).toLocaleString("ja-JP")}`}
            />
            <Tooltip
              formatter={(value: number | string | undefined) => {
                const num = Number.parseFloat(String(value ?? 0)) || 0;
                return [formatCurrency(num), "消化額"];
              }}
            />
            <Area type="monotone" dataKey="spend" stroke="#2C5282" fill="#93C5FD" fillOpacity={0.35} />
          </AreaChart>
        </ResponsiveContainer>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-navy">日次データ</h3>
          <button
            type="button"
            onClick={() => setShowDailyTable((prev) => !prev)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-600 hover:bg-gray-50"
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
                    <td className="px-3 py-2 tabular-nums">{formatNumber(row.cv)}</td>
                    <td className="px-3 py-2 tabular-nums">{row.cv > 0 ? formatCurrency(row.cpa) : "-"}</td>
                  </tr>
                ))}
                {dailyRows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-gray-500">
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
                  <td className="px-3 py-2 tabular-nums">{formatCurrency(project.spend)}</td>
                  <td className="px-3 py-2 tabular-nums">{formatNumber(project.impressions)}</td>
                  <td className="px-3 py-2 tabular-nums">{formatNumber(project.clicks)}</td>
                  <td className="px-3 py-2 tabular-nums">{formatPercent(project.ctr)}</td>
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
                  <td colSpan={8} className="px-3 py-8 text-center text-gray-500">
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
