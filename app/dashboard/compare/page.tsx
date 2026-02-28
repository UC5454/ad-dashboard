"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";
import { apiFetch } from "@/lib/api-client";
import { loadCompanies, type StoredCompany } from "@/lib/storage";
import type { ProjectSummary } from "@/lib/projects";

type Period = "current_month" | "last_30";

interface ProjectWithConfig extends ProjectSummary {
  monthlyBudget: number;
  feeRate: number;
  spendRate: number;
  cpc: number;
}

interface RadarRow {
  metric: string;
  [key: string]: string | number;
}

const radarColors = ["#2C5282", "#38A169", "#D69E2E", "#E53E3E", "#805AD5"];

function formatCurrency(value: number): string {
  return `¥${Math.round(value).toLocaleString("ja-JP")}`;
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function formatNumber(value: number): string {
  return Math.round(value).toLocaleString("ja-JP");
}

function paceBadgeClass(kind: "順調" | "遅れ" | "超過ペース"): string {
  if (kind === "順調") return "bg-emerald-50 text-emerald-700";
  if (kind === "遅れ") return "bg-amber-50 text-amber-700";
  return "bg-red-50 text-red-700";
}

function suggestBadgeClass(kind: "予算増額推奨" | "改善優先" | "現状維持"): string {
  if (kind === "予算増額推奨") return "bg-emerald-50 text-emerald-700";
  if (kind === "改善優先") return "bg-red-50 text-red-700";
  return "bg-gray-100 text-gray-600";
}

function cardTopColor(cpa: number, avgCpa: number): string {
  if (avgCpa <= 0 || cpa <= 0) return "bg-amber-500";
  if (cpa <= avgCpa * 0.8) return "bg-emerald-500";
  if (cpa >= avgCpa * 1.2) return "bg-red-500";
  return "bg-amber-500";
}

function elapsedRate(period: Period): number {
  if (period === "last_30") return 100;
  const today = new Date();
  const day = today.getDate();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  return daysInMonth > 0 ? (day / daysInMonth) * 100 : 100;
}

function paceLabel(spendRate: number, elapsed: number): "順調" | "遅れ" | "超過ペース" {
  if (spendRate < elapsed - 20) return "遅れ";
  if (spendRate > elapsed + 10) return "超過ペース";
  return "順調";
}

function findCompanyConfig(project: ProjectSummary, companies: StoredCompany[]): StoredCompany | null {
  const byName = companies.find((company) => company.companyName === project.name);
  if (byName) return byName;

  const byKeyword = companies.find((company) =>
    company.campaignKeywords.some((keyword) => keyword && project.name.includes(keyword)),
  );
  return byKeyword || null;
}

function parseErrorMessage(payload: unknown): string {
  if (payload && typeof payload === "object" && "error" in payload) {
    const value = (payload as { error?: unknown }).error;
    if (typeof value === "string" && value) return value;
  }
  return "案件データの取得に失敗しました";
}

export default function ComparePage() {
  const [period, setPeriod] = useState<Period>("last_30");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [projects, setProjects] = useState<ProjectSummary[]>([]);

  useEffect(() => {
    let mounted = true;
    const datePreset = period === "current_month" ? "this_month" : "last_30d";

    const run = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await apiFetch(`/api/meta/projects?date_preset=${datePreset}`);
        if (!res.ok) {
          let payload: unknown = null;
          try {
            payload = await res.json();
          } catch {
            payload = null;
          }
          throw new Error(parseErrorMessage(payload));
        }
        const data = (await res.json()) as ProjectSummary[];
        if (!mounted) return;
        setProjects(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "データ取得エラー");
        setProjects([]);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void run();
    return () => {
      mounted = false;
    };
  }, [period]);

  const rows = useMemo<ProjectWithConfig[]>(() => {
    const companies = loadCompanies();
    return projects.map((project) => {
      const config = findCompanyConfig(project, companies);
      const monthlyBudget = config?.monthlyBudget ?? 0;
      const feeRate = config?.feeRate ?? 0.2;
      const spendRate = monthlyBudget > 0 ? (project.spend / monthlyBudget) * 100 : 0;
      const cpc = project.clicks > 0 ? project.spend / project.clicks : 0;
      return {
        ...project,
        monthlyBudget,
        feeRate,
        spendRate,
        cpc,
      };
    });
  }, [projects]);

  const averageCpa = useMemo(() => {
    const valid = rows.filter((row) => row.cpa > 0);
    if (valid.length === 0) return 0;
    return valid.reduce((sum, row) => sum + row.cpa, 0) / valid.length;
  }, [rows]);

  const radarData = useMemo<RadarRow[]>(() => {
    if (rows.length === 0) return [];

    const maxSpendRate = Math.max(...rows.map((row) => row.spendRate), 1);
    const maxCv = Math.max(...rows.map((row) => row.cv), 1);
    const maxCtr = Math.max(...rows.map((row) => row.ctr), 1);
    const maxClicks = Math.max(...rows.map((row) => row.clicks), 1);
    const maxCpa = Math.max(...rows.map((row) => row.cpa), 1);

    const metrics = ["消化率", "CV数", "CPA効率", "CTR", "クリック数"];
    return metrics.map((metric) => {
      const row: RadarRow = { metric };
      rows.forEach((project) => {
        if (metric === "消化率") row[project.name] = (project.spendRate / maxSpendRate) * 100;
        if (metric === "CV数") row[project.name] = (project.cv / maxCv) * 100;
        if (metric === "CPA効率") {
          row[project.name] = project.cpa > 0 ? (maxCpa / project.cpa) * 100 : 0;
        }
        if (metric === "CTR") row[project.name] = (project.ctr / maxCtr) * 100;
        if (metric === "クリック数") row[project.name] = (project.clicks / maxClicks) * 100;
      });
      return row;
    });
  }, [rows]);

  const elapsed = useMemo(() => elapsedRate(period), [period]);

  const summaryRows = useMemo(() => {
    return rows.map((row) => {
      const ratio = averageCpa > 0 && row.cpa > 0 ? (row.cpa / averageCpa) * 100 : 100;
      let badge: "予算増額推奨" | "改善優先" | "現状維持" = "現状維持";
      let comment = `CPAは平均水準。現行の運用を継続しつつ改善余地を探索`;

      if (averageCpa > 0 && row.cpa > 0 && row.cpa < averageCpa * 0.8) {
        badge = "予算増額推奨";
        comment = `CPAが全案件平均の${ratio.toFixed(0)}%で効率的。予算増額でCV獲得をスケール可能`;
      } else if (averageCpa > 0 && row.cpa > averageCpa * 1.5) {
        badge = "改善優先";
        comment = `CPAが全案件平均の${ratio.toFixed(0)}%。クリエイティブ改善またはターゲティングの見直しを検討`;
      }

      return {
        ...row,
        badge,
        comment,
      };
    });
  }, [rows, averageCpa]);

  const ranking = useMemo(() => {
    if (rows.length <= 1) {
      return {
        best: new Set<string>(),
        worst: new Set<string>(),
      };
    }

    const best = new Set<string>();
    const worst = new Set<string>();

    const mark = (
      metric: string,
      getter: (row: ProjectWithConfig) => number,
      higherIsBetter: boolean,
      epsilon = 0.000001,
    ) => {
      const values = rows.map(getter);
      const bestValue = higherIsBetter ? Math.max(...values) : Math.min(...values);
      const worstValue = higherIsBetter ? Math.min(...values) : Math.max(...values);

      rows.forEach((row) => {
        const value = getter(row);
        const key = `${row.id}:${metric}`;
        if (Math.abs(value - bestValue) <= epsilon) best.add(key);
        if (Math.abs(value - worstValue) <= epsilon) worst.add(key);
      });
    };

    mark("impressions", (row) => row.impressions, true);
    mark("clicks", (row) => row.clicks, true);
    mark("ctr", (row) => row.ctr, true);
    mark("cpc", (row) => row.cpc, false);
    mark("cv", (row) => row.cv, true);
    mark("cpa", (row) => row.cpa, false);

    return { best, worst };
  }, [rows]);

  const cellClass = (id: string, metric: string): string => {
    const key = `${id}:${metric}`;
    if (ranking.best.has(key)) return "bg-emerald-50";
    if (ranking.worst.has(key)) return "bg-red-50";
    return "";
  };

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl bg-white p-5 shadow-sm">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-navy">案件クロス分析</h2>
            <p className="mt-1 text-sm text-gray-500">案件間のパフォーマンスを比較し、予算配分を最適化</p>
          </div>
          <label className="text-sm text-gray-700">
            期間
            <select
              className="ml-2 rounded-lg border border-gray-200 bg-white px-3 py-2"
              value={period}
              onChange={(event) => setPeriod(event.target.value as Period)}
            >
              <option value="current_month">今月</option>
              <option value="last_30">過去30日</option>
            </select>
          </label>
        </div>
      </section>

      {error && <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {rows.map((row) => {
          const barRate = Math.max(0, Math.min(100, row.spendRate));
          const pace = paceLabel(row.spendRate, elapsed);
          return (
            <article key={row.id} className="overflow-hidden rounded-xl bg-white shadow-sm">
              <div className={`h-0.5 ${cardTopColor(row.cpa, averageCpa)}`} />
              <div className="p-5">
                <h3 className="text-base font-semibold text-navy">{row.name}</h3>
                <div className="mt-3 space-y-2">
                  <p className="text-xs text-gray-500">
                    消化額 / 月間予算: <span className="tabular-nums text-gray-700">{formatCurrency(row.spend)} / {row.monthlyBudget > 0 ? formatCurrency(row.monthlyBudget) : "未設定"}</span>
                  </p>
                  <div className="h-2 rounded-full bg-gray-200">
                    <div className="h-2 rounded-full bg-blue" style={{ width: `${barRate}%` }} />
                  </div>
                  <p className="text-xs text-gray-500">消化率: <span className="tabular-nums text-gray-700">{formatPercent(row.spendRate)}</span></p>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-gray-500">CV数</p>
                    <p className="text-xl font-semibold tabular-nums text-navy">{formatNumber(row.cv)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">CPA</p>
                    <p className="tabular-nums text-navy">{row.cv > 0 ? formatCurrency(row.cpa) : "-"}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">CTR</p>
                    <p className="tabular-nums text-navy">{formatPercent(row.ctr)}</p>
                  </div>
                </div>

                <div className="mt-4">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${paceBadgeClass(pace)}`}>{pace}</span>
                </div>
              </div>
            </article>
          );
        })}
        {rows.length === 0 && (
          <article className="rounded-xl bg-white p-5 text-sm text-gray-500 shadow-sm">表示できる案件データがありません</article>
        )}
      </section>

      <section className="rounded-xl bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-base font-semibold text-navy">案件レーダー比較</h3>
        <ResponsiveContainer width="100%" height={360}>
          <RadarChart data={radarData}>
            <PolarGrid stroke="#E2E8F0" />
            <PolarAngleAxis dataKey="metric" tick={{ fill: "#334155", fontSize: 12 }} />
            <PolarRadiusAxis angle={30} domain={[0, 100]} tickCount={5} />
            <Legend />
            {rows.map((row, index) => (
              <Radar
                key={row.id}
                name={row.name}
                dataKey={row.name}
                stroke={radarColors[index % radarColors.length]}
                fill={radarColors[index % radarColors.length]}
                fillOpacity={0.18}
                strokeWidth={2}
              />
            ))}
          </RadarChart>
        </ResponsiveContainer>
      </section>

      <section className="rounded-xl bg-white p-5 shadow-sm">
        <h3 className="text-base font-semibold text-navy">予算配分サジェスト</h3>
        <div className="mt-3 space-y-3">
          {summaryRows.map((row) => (
            <div key={row.id} className="grid grid-cols-1 gap-2 rounded-lg border border-gray-100 p-3 md:grid-cols-[1.2fr_0.8fr_0.6fr_0.9fr_2fr] md:items-center">
              <p className="font-medium text-navy">{row.name}</p>
              <p className="tabular-nums text-sm text-gray-700">CPA: {row.cv > 0 ? formatCurrency(row.cpa) : "-"}</p>
              <p className="tabular-nums text-sm text-gray-700">CV: {formatNumber(row.cv)}</p>
              <span className={`inline-flex w-fit rounded-full px-2 py-0.5 text-xs ${suggestBadgeClass(row.badge)}`}>{row.badge}</span>
              <p className="text-sm text-gray-600">{row.comment}</p>
            </div>
          ))}
          {summaryRows.length === 0 && <p className="text-sm text-gray-500">サジェスト対象の案件がありません</p>}
        </div>
      </section>

      <section className="overflow-hidden rounded-xl bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500">
            <tr>
              <th className="px-4 py-3 text-left font-medium">案件名</th>
              <th className="px-4 py-3 text-left font-medium">消化額</th>
              <th className="px-4 py-3 text-left font-medium">IMP</th>
              <th className="px-4 py-3 text-left font-medium">クリック</th>
              <th className="px-4 py-3 text-left font-medium">CTR</th>
              <th className="px-4 py-3 text-left font-medium">CPC</th>
              <th className="px-4 py-3 text-left font-medium">CV</th>
              <th className="px-4 py-3 text-left font-medium">CPA</th>
              <th className="px-4 py-3 text-left font-medium">月間予算</th>
              <th className="px-4 py-3 text-left font-medium">消化率</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-gray-100">
                <td className="px-4 py-3 text-navy">{row.name}</td>
                <td className="px-4 py-3 tabular-nums">{formatCurrency(row.spend)}</td>
                <td className={`px-4 py-3 tabular-nums ${cellClass(row.id, "impressions")}`}>{formatNumber(row.impressions)}</td>
                <td className={`px-4 py-3 tabular-nums ${cellClass(row.id, "clicks")}`}>{formatNumber(row.clicks)}</td>
                <td className={`px-4 py-3 tabular-nums ${cellClass(row.id, "ctr")}`}>{formatPercent(row.ctr)}</td>
                <td className={`px-4 py-3 tabular-nums ${cellClass(row.id, "cpc")}`}>{row.clicks > 0 ? formatCurrency(row.cpc) : "-"}</td>
                <td className={`px-4 py-3 tabular-nums ${cellClass(row.id, "cv")}`}>{formatNumber(row.cv)}</td>
                <td className={`px-4 py-3 tabular-nums ${cellClass(row.id, "cpa")}`}>{row.cv > 0 ? formatCurrency(row.cpa) : "-"}</td>
                <td className="px-4 py-3 tabular-nums">{row.monthlyBudget > 0 ? formatCurrency(row.monthlyBudget) : "未設定"}</td>
                <td className="px-4 py-3 tabular-nums">{formatPercent(row.spendRate)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-gray-500">
                  比較できる案件データがありません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
