"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { MetaInsights } from "@/types/meta";

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

function formatCurrency(value: number): string {
  return `¥${Math.round(value).toLocaleString("ja-JP")}`;
}

function formatNumber(value: number): string {
  return Math.round(value).toLocaleString("ja-JP");
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export default function DashboardPage() {
  const [datePreset, setDatePreset] = useState<DatePreset>("last_30d");
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [daily, setDaily] = useState<DailyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const [projectRes, dailyRes] = await Promise.all([
          fetch(`/api/meta/projects?date_preset=${datePreset}`),
          fetch(`/api/meta/daily?date_preset=${datePreset}`),
        ]);

        if (!projectRes.ok || !dailyRes.ok) {
          throw new Error("ダッシュボードデータの取得に失敗しました");
        }

        const [projectRows, dailyRows] = await Promise.all([
          projectRes.json() as Promise<ProjectRow[]>,
          dailyRes.json() as Promise<DailyRow[]>,
        ]);

        if (!mounted) return;

        setProjects(Array.isArray(projectRows) ? projectRows : []);
        setDaily(Array.isArray(dailyRows) ? dailyRows : []);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "データ取得エラー");
        setProjects([]);
        setDaily([]);
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

  const sortedProjects = useMemo(() => {
    return [...projects].sort((a, b) => b.spend - a.spend);
  }, [projects]);

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

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
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
              </tr>
            </thead>
            <tbody>
              {sortedProjects.map((project, index) => (
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
                  <td className="px-3 py-2 tabular-nums">{project.cv > 0 ? formatCurrency(project.cpa) : "-"}</td>
                </tr>
              ))}
              {sortedProjects.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-gray-500">
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
