"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { generateAlerts, type Alert } from "@/lib/alerts";
import { apiFetch } from "@/lib/api-client";
import { DEFAULT_SETTINGS, loadSettings } from "@/lib/settings";
import type { MetaCreativeSummary, MetaInsights } from "@/types/meta";

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

interface AlertRow {
  id: string;
  timestamp: string;
  clientName: string;
  platform: string;
  metric: string;
  severity: "warning" | "critical";
  currentValue: number;
  movingAverage: number;
  deviation: number;
  message: string;
  title: string;
  resolved: boolean;
}

function toNumber(value: string | number | null | undefined): number {
  return Number.parseFloat(String(value ?? "0")) || 0;
}

function categoryLabel(category: Alert["category"]): string {
  if (category === "budget") return "予算";
  if (category === "performance") return "成果";
  return "クリエイティブ";
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function severityClass(level: AlertRow["severity"]): string {
  return level === "critical"
    ? "rounded-full bg-red-50 text-red-700 text-xs px-2 py-0.5"
    : "rounded-full bg-amber-50 text-amber-700 text-xs px-2 py-0.5";
}

function metricLabel(metric: string): string {
  const map: Record<string, string> = {
    cpa: "CPA",
    cv: "CV",
    ctr: "CTR",
    cpc: "CPC",
    spend: "消化額",
    budget: "予算",
  };
  return map[metric] ?? metric;
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("ja-JP");
}

export default function AlertsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [daily, setDaily] = useState<DailyRow[]>([]);
  const [creatives, setCreatives] = useState<MetaCreativeSummary[]>([]);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [severityFilter, setSeverityFilter] = useState<"all" | "warning" | "critical">("all");
  const [clientFilter, setClientFilter] = useState("all");

  useEffect(() => {
    setSettings(loadSettings());
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadFromAlertsApi = async (): Promise<AlertRow[] | null> => {
      try {
        const res = await fetch("/api/alerts?limit=100");
        if (!res.ok) return null;
        const data = (await res.json()) as Array<Record<string, unknown>>;
        if (!Array.isArray(data)) return null;
        return data.map((row, idx) => ({
          id: String(row.id ?? idx),
          timestamp: String(row.created_at ?? row.timestamp ?? new Date().toISOString()),
          clientName: String(row.client_name ?? row.client ?? row.projectName ?? "-"),
          platform: String(row.platform ?? "Meta Ads"),
          metric: String(row.metric ?? row.category ?? "spend"),
          severity: String(row.severity ?? "warning") === "critical" ? "critical" : "warning",
          currentValue: Number(row.current_value ?? row.current ?? 0),
          movingAverage: Number(row.moving_average ?? row.average ?? 0),
          deviation: Number(row.deviation_rate ?? row.deviation ?? 0),
          message: String(row.message ?? ""),
          title: String(row.title ?? "アラート"),
          resolved: Boolean(row.resolved),
        }));
      } catch {
        return null;
      }
    };

    const run = async () => {
      setLoading(true);
      setError("");

      try {
        const alertsFromApi = await loadFromAlertsApi();
        if (alertsFromApi && mounted) {
          setAlerts(alertsFromApi);
          setLoading(false);
          return;
        }

        const [projectRes, dailyRes, creativeRes] = await Promise.all([
          apiFetch("/api/meta/projects?date_preset=last_30d"),
          apiFetch("/api/meta/daily?date_preset=last_30d"),
          apiFetch("/api/meta/creatives?date_preset=last_30d"),
        ]);

        if (!projectRes.ok || !dailyRes.ok || !creativeRes.ok) {
          throw new Error("アラートデータの取得に失敗しました");
        }

        const [projectData, dailyData, creativeData] = await Promise.all([
          projectRes.json() as Promise<ProjectRow[]>,
          dailyRes.json() as Promise<DailyRow[]>,
          creativeRes.json() as Promise<MetaCreativeSummary[]>,
        ]);

        if (!mounted) return;

        setProjects(Array.isArray(projectData) ? projectData : []);
        setDaily(Array.isArray(dailyData) ? dailyData : []);
        setCreatives(Array.isArray(creativeData) ? creativeData : []);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "データ取得エラー");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void run();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (alerts.length > 0) return;
    const generated = generateAlerts(
      projects.map((project) => ({
        name: project.name,
        spend: project.spend,
        cv: project.cv,
        cpa: project.cpa,
        ctr: project.ctr,
      })),
      daily.map((row) => ({
        date_start: row.date_start,
        spend: toNumber(row.spend),
        cv: row.cv ?? 0,
        impressions: toNumber(row.impressions),
        clicks: toNumber(row.clicks),
      })),
      creatives.map((creative) => ({
        creative_name: creative.creative_name,
        spend: creative.spend,
        cv: creative.cv,
        ctr: creative.ctr,
      })),
      settings.budgets.map((budget) => ({ projectName: budget.projectName, monthlyBudget: budget.monthlyBudget })),
      settings.alertThresholds,
    );

    const rows: AlertRow[] = generated
      .filter((row) => row.type === "warning" || row.type === "critical")
      .map((row, index) => ({
        id: `generated-${index}`,
        timestamp: new Date(Date.now() - index * 3600_000).toISOString(),
        clientName: row.projectName || "-",
        platform: "Meta Ads",
        metric: categoryLabel(row.category),
        severity: row.type === "critical" ? "critical" : "warning",
        currentValue: 0,
        movingAverage: 0,
        deviation: 0,
        message: row.message,
        title: row.title,
        resolved: false,
      }));

    setAlerts(rows);
  }, [projects, daily, creatives, settings, alerts.length]);

  const filtered = useMemo(() => {
    return alerts.filter((row) => {
      if (severityFilter !== "all" && row.severity !== severityFilter) return false;
      if (clientFilter !== "all" && row.clientName !== clientFilter) return false;
      return true;
    });
  }, [alerts, severityFilter, clientFilter]);

  const clients = useMemo(() => {
    return ["all", ...Array.from(new Set(alerts.map((row) => row.clientName).filter((name) => name && name !== "-")))];
  }, [alerts]);

  const resolveAlert = async (id: string) => {
    setAlerts((prev) => prev.map((row) => (row.id === id ? { ...row, resolved: true } : row)));
    try {
      await fetch("/api/alerts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
    } catch {
      // API未実装環境ではローカル状態のみ更新
    }
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
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-navy">アラート</h2>
          <div className="flex items-center gap-3">
            {settings.slack.enabled && settings.slack.channelName && (
              <span className="flex items-center gap-1.5 text-xs text-gray-500">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Slack通知: {settings.slack.channelName}
              </span>
            )}
            <Link href="/settings" className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50">
              通知設定
            </Link>
          </div>
        </div>
        <p className="mt-1 text-sm text-gray-500">重大度とクライアントで絞り込みできます</p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="text-sm text-gray-700">
            重大度
            <select
              value={severityFilter}
              onChange={(event) => setSeverityFilter(event.target.value as "all" | "warning" | "critical")}
              className="ml-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            >
              <option value="all">全て</option>
              <option value="warning">warning</option>
              <option value="critical">critical</option>
            </select>
          </label>
          <label className="text-sm text-gray-700">
            クライアント
            <select
              value={clientFilter}
              onChange={(event) => setClientFilter(event.target.value)}
              className="ml-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            >
              {clients.map((name) => (
                <option key={name} value={name}>
                  {name === "all" ? "全て" : name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <section className="overflow-hidden rounded-xl bg-white shadow-sm">
        {filtered.length === 0 ? (
          <div className="px-4 py-8 text-sm text-gray-500">現在アラートはありません。</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1260px] text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">日時</th>
                  <th className="px-3 py-2 text-left font-medium">クライアント</th>
                  <th className="px-3 py-2 text-left font-medium">媒体</th>
                  <th className="px-3 py-2 text-left font-medium">指標</th>
                  <th className="px-3 py-2 text-left font-medium">レベル</th>
                  <th className="px-3 py-2 text-left font-medium">現在値</th>
                  <th className="px-3 py-2 text-left font-medium">移動平均</th>
                  <th className="px-3 py-2 text-left font-medium">乖離率</th>
                  <th className="px-3 py-2 text-left font-medium">メッセージ</th>
                  <th className="px-3 py-2 text-left font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((alert) => (
                  <tr key={alert.id} className={`border-t border-gray-100 ${alert.resolved ? "text-gray-400" : ""}`}>
                    <td className={`px-3 py-2 ${alert.resolved ? "line-through" : ""}`}>{formatDate(alert.timestamp)}</td>
                    <td className={`px-3 py-2 ${alert.resolved ? "line-through" : ""}`}>{alert.clientName}</td>
                    <td className={`px-3 py-2 ${alert.resolved ? "line-through" : ""}`}>{alert.platform}</td>
                    <td className={`px-3 py-2 ${alert.resolved ? "line-through" : ""}`}>{metricLabel(alert.metric)}</td>
                    <td className="px-3 py-2">
                      <span className={severityClass(alert.severity)}>{alert.severity}</span>
                    </td>
                    <td className="px-3 py-2 tabular-nums">{alert.currentValue.toLocaleString("ja-JP")}</td>
                    <td className="px-3 py-2 tabular-nums">{alert.movingAverage.toLocaleString("ja-JP")}</td>
                    <td className="px-3 py-2 tabular-nums">{formatPercent(alert.deviation)}</td>
                    <td className={`px-3 py-2 ${alert.resolved ? "line-through" : ""}`}>
                      <p className="font-medium text-navy">{alert.title}</p>
                      <p className="text-xs text-gray-500">{alert.message}</p>
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => resolveAlert(alert.id)}
                        disabled={alert.resolved}
                        className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        解決済み
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
