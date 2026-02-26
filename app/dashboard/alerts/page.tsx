"use client";

import { useEffect, useMemo, useState } from "react";
import { generateAlerts, type Alert } from "@/lib/alerts";
import { DEFAULT_SETTINGS, loadSettings } from "@/lib/settings";
import type { MetaInsights, MetaCreativeSummary } from "@/types/meta";

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

interface DailyRow extends MetaInsights {
  cv?: number;
}

interface CreativeRow extends MetaCreativeSummary {}

type AlertTypeFilter = "all" | "critical" | "warning" | "info";
type CategoryFilter = "all" | "budget" | "performance" | "creative";

function toNumber(value: string | number | null | undefined): number {
  return Number.parseFloat(String(value ?? "0")) || 0;
}

function categoryLabel(category: Alert["category"]): string {
  if (category === "budget") return "予算";
  if (category === "performance") return "パフォーマンス";
  return "クリエイティブ";
}

export default function AlertsPage() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [daily, setDaily] = useState<DailyRow[]>([]);
  const [creatives, setCreatives] = useState<CreativeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [typeFilter, setTypeFilter] = useState<AlertTypeFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
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
          fetch("/api/meta/projects?date_preset=last_30d"),
          fetch("/api/meta/daily?date_preset=last_30d"),
          fetch("/api/meta/creatives?date_preset=last_30d"),
        ]);

        if (!projectRes.ok || !dailyRes.ok || !creativeRes.ok) {
          throw new Error("アラートデータの取得に失敗しました");
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
        if (mounted) setLoading(false);
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, []);

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
      settings.budgets.map((budget) => ({
        projectName: budget.projectName,
        monthlyBudget: budget.monthlyBudget,
      })),
      settings.alertThresholds,
    );
  }, [projects, daily, creatives, settings]);

  const filteredAlerts = useMemo(() => {
    return alertRows.filter((alert) => {
      if (typeFilter !== "all" && alert.type !== typeFilter) return false;
      if (categoryFilter !== "all" && alert.category !== categoryFilter) return false;
      return true;
    });
  }, [alertRows, typeFilter, categoryFilter]);

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold text-navy">アラート一覧</h2>
        <p className="mt-1 text-sm text-gray-500">重要度やカテゴリでアラートを確認できます</p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1 text-sm">
            {([
              { id: "all", label: "全て" },
              { id: "critical", label: "critical" },
              { id: "warning", label: "warning" },
              { id: "info", label: "info" },
            ] as const).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setTypeFilter(tab.id)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                  typeFilter === tab.id ? "bg-blue text-white" : "text-gray-600"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <label className="text-sm text-gray-700">
            カテゴリ
            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value as CategoryFilter)}
              className="ml-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            >
              <option value="all">全て</option>
              <option value="budget">予算</option>
              <option value="performance">パフォーマンス</option>
              <option value="creative">クリエイティブ</option>
            </select>
          </label>
        </div>
      </section>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        {filteredAlerts.length === 0 && !error ? (
          <div className="text-sm text-gray-500">現在アラートはありません。全ての指標は正常範囲内です。</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500">
                <tr>
                  <th className="w-24 px-3 py-2 text-left font-medium">重要度</th>
                  <th className="w-28 px-3 py-2 text-left font-medium">カテゴリ</th>
                  <th className="px-3 py-2 text-left font-medium">案件</th>
                  <th className="px-3 py-2 text-left font-medium">内容</th>
                </tr>
              </thead>
              <tbody>
                {filteredAlerts.map((alert, index) => {
                  const textColor =
                    alert.type === "critical"
                      ? "text-red-700"
                      : alert.type === "warning"
                        ? "text-amber-700"
                        : "text-blue-700";
                  const dotColor =
                    alert.type === "critical" ? "bg-red-500" : alert.type === "warning" ? "bg-amber-500" : "bg-blue-500";
                  return (
                    <tr key={`${alert.title}-${index}`} className="border-b border-gray-100 hover:bg-gray-50/50">
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${textColor}`}>
                          <span className={`h-2 w-2 rounded-full ${dotColor}`} />
                          {alert.type}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                          {categoryLabel(alert.category)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-600">{alert.projectName || "-"}</td>
                      <td className="px-3 py-2.5">
                        <p className="text-sm font-medium text-navy">{alert.title}</p>
                        <p className="mt-0.5 text-xs text-gray-500">{alert.message}</p>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
