"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface KpiData {
  total_cost: number;
  total_conversions: number;
  avg_cpa: number;
  avg_roas: number;
}

interface ClientData {
  id: string;
  name: string;
  status: string;
  monthly_budget_google: number;
  monthly_budget_meta: number;
  total_cost: number;
  total_conversions: number;
  avg_cpa: number;
  avg_roas: number;
  avg_ctr: number;
}

interface DailyData {
  date: string;
  total_cost: number;
  total_conversions: number;
  avg_cpa: number;
}

interface DashboardResponse {
  kpi: { current: KpiData; previous: KpiData };
  clients: ClientData[];
  dailyTrend: DailyData[];
  period: { startDate: string; endDate: string };
}

type ChartMetric = "cost" | "cv" | "cpa";
type SortKey =
  | "name"
  | "budget"
  | "total_cost"
  | "budget_pct"
  | "total_conversions"
  | "avg_cpa"
  | "avg_roas"
  | "avg_ctr"
  | "status";

function formatCurrency(value: number): string {
  return `¥${Math.round(value).toLocaleString()}`;
}

function formatNumber(value: number, decimals = 0): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function calcChange(current: number, previous: number): number {
  if (previous === 0) return 0;
  return ((current - previous) / previous) * 100;
}

function ChangeIndicator({ value, inverted = false }: { value: number; inverted?: boolean }) {
  if (value === 0) return <span className="text-xs text-gray-400">--</span>;
  const isPositive = inverted ? value < 0 : value > 0;
  return (
    <span className={`inline-flex items-center text-xs font-medium ${isPositive ? "text-emerald-600" : "text-red-500"}`}>
      {value > 0 ? "↑" : "↓"} {Math.abs(value).toFixed(1)}%
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "bg-emerald-100 text-emerald-700",
    paused: "bg-yellow-100 text-yellow-700",
    archived: "bg-gray-100 text-gray-500",
  };
  const labels: Record<string, string> = {
    active: "アクティブ",
    paused: "一時停止",
    archived: "アーカイブ",
  };
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] || styles.archived}`}>
      {labels[status] || status}
    </span>
  );
}

function BudgetBar({ spent, budget }: { spent: number; budget: number }) {
  if (budget === 0) return <span className="text-xs text-gray-400">--</span>;
  const pct = Math.min((spent / budget) * 100, 100);
  const color =
    pct > 100 ? "bg-red-500" : pct > 80 ? "bg-yellow-500" : "bg-emerald-500";
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-20 overflow-hidden rounded-full bg-gray-200">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className="text-xs text-gray-600">{pct.toFixed(0)}%</span>
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [chartMetric, setChartMetric] = useState<ChartMetric>("cost");
  const [sortKey, setSortKey] = useState<SortKey>("total_cost");
  const [sortAsc, setSortAsc] = useState(false);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue border-t-transparent" />
      </div>
    );
  }

  if (!data) {
    return <p className="text-center text-gray-500">データの取得に失敗しました</p>;
  }

  const { kpi, clients, dailyTrend } = data;

  const getSortValue = (client: ClientData, key: SortKey): string | number => {
    switch (key) {
      case "name":
        return client.name;
      case "budget":
        return client.monthly_budget_google + client.monthly_budget_meta;
      case "budget_pct": {
        const totalBudget = client.monthly_budget_google + client.monthly_budget_meta;
        return totalBudget > 0 ? (client.total_cost / totalBudget) * 100 : 0;
      }
      case "status":
        return client.status;
      default:
        return client[key];
    }
  };

  // KPI cards
  const kpiCards = [
    {
      label: "総消化額",
      value: formatCurrency(kpi.current.total_cost),
      change: calcChange(kpi.current.total_cost, kpi.previous.total_cost),
    },
    {
      label: "総CV数",
      value: formatNumber(kpi.current.total_conversions),
      change: calcChange(kpi.current.total_conversions, kpi.previous.total_conversions),
    },
    {
      label: "平均CPA",
      value: formatCurrency(kpi.current.avg_cpa),
      change: calcChange(kpi.current.avg_cpa, kpi.previous.avg_cpa),
      inverted: true,
    },
    {
      label: "平均ROAS",
      value: `${formatNumber(kpi.current.avg_roas, 2)}x`,
      change: calcChange(kpi.current.avg_roas, kpi.previous.avg_roas),
    },
  ];

  // Sort clients
  const sortedClients = [...clients].sort((a, b) => {
    const aVal = getSortValue(a, sortKey);
    const bVal = getSortValue(b, sortKey);
    if (typeof aVal === "string" || typeof bVal === "string") {
      const result = String(aVal).localeCompare(String(bVal), "ja");
      return sortAsc ? result : -result;
    }
    return sortAsc ? aVal - bVal : bVal - aVal;
  });

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  // Chart data
  const chartDataKey =
    chartMetric === "cost" ? "total_cost" : chartMetric === "cv" ? "total_conversions" : "avg_cpa";
  const chartLabel =
    chartMetric === "cost" ? "消化額" : chartMetric === "cv" ? "CV数" : "CPA";
  const chartFormatter = (v: number) =>
    chartMetric === "cv" ? formatNumber(v) : formatCurrency(v);

  return (
    <div className="space-y-8">
      {/* BIG 4 KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
          >
            <p className="text-sm font-medium text-gray-500">{card.label}</p>
            <p className="mt-2 text-2xl font-bold text-navy">{card.value}</p>
            <div className="mt-1">
              <ChangeIndicator value={card.change} inverted={card.inverted} />
              <span className="ml-1 text-xs text-gray-400">前月比</span>
            </div>
          </div>
        ))}
      </div>

      {/* Client Table */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-base font-semibold text-navy">クライアント一覧</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                {[
                  { key: "name", label: "クライアント" },
                  { key: "budget", label: "予算" },
                  { key: "total_cost", label: "消化額" },
                  { key: "budget_pct", label: "消化率" },
                  { key: "total_conversions", label: "CV" },
                  { key: "avg_cpa", label: "CPA" },
                  { key: "avg_roas", label: "ROAS" },
                  { key: "avg_ctr", label: "CTR" },
                  { key: "status", label: "ステータス" },
                ].map((col) => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key as SortKey)}
                    className="cursor-pointer px-4 py-3 hover:text-navy"
                  >
                    {col.label}
                    {sortKey === col.key && (sortAsc ? " ↑" : " ↓")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedClients.map((client) => {
                const totalBudget = client.monthly_budget_google + client.monthly_budget_meta;
                return (
                  <tr key={client.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/clients/${client.id}`}
                        className="font-medium text-blue hover:underline"
                      >
                        {client.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {totalBudget > 0 ? formatCurrency(totalBudget) : "--"}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {formatCurrency(client.total_cost)}
                    </td>
                    <td className="px-4 py-3">
                      <BudgetBar spent={client.total_cost} budget={totalBudget} />
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {formatNumber(client.total_conversions)}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {client.avg_cpa > 0 ? formatCurrency(client.avg_cpa) : "--"}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {client.avg_roas > 0 ? `${formatNumber(client.avg_roas, 2)}x` : "--"}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {client.avg_ctr > 0 ? `${formatNumber(client.avg_ctr, 2)}%` : "--"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={client.status} />
                    </td>
                  </tr>
                );
              })}
              {sortedClients.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-400">
                    クライアントが登録されていません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Daily Trend Chart */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-navy">日別推移</h2>
          <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
            {(["cost", "cv", "cpa"] as ChartMetric[]).map((m) => (
              <button
                key={m}
                onClick={() => setChartMetric(m)}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  chartMetric === m
                    ? "bg-white text-navy shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {m === "cost" ? "消化額" : m === "cv" ? "CV数" : "CPA"}
              </button>
            ))}
          </div>
        </div>
        {dailyTrend.length > 0 ? (
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={dailyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis
                dataKey="date"
                tickFormatter={(date: string | number | undefined) =>
                  String(date ?? "").slice(5)
                }
                tick={{ fontSize: 12, fill: "#6B7280" }}
              />
              <YAxis
                tickFormatter={(value: number | undefined) =>
                  chartFormatter(value ?? 0)
                }
                tick={{ fontSize: 12, fill: "#6B7280" }}
                width={80}
              />
              <Tooltip
                formatter={(value: number | undefined) => [
                  chartFormatter(value ?? 0),
                  chartLabel,
                ]}
                labelFormatter={(label) => String(label ?? "")}
              />
              <Line
                type="monotone"
                dataKey={chartDataKey}
                stroke="#2C5282"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-64 items-center justify-center text-gray-400">
            データがありません
          </div>
        )}
      </div>
    </div>
  );
}
