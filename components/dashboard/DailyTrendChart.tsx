"use client";

import { useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ComposedChart,
} from "recharts";
import { type TrendRow } from "@/components/dashboard/types";

type MetricTab = "spend" | "cv" | "cpa" | "impressions" | "clicks" | "ctr";
type Granularity = "daily" | "weekly";

function aggregateWeekly(rows: TrendRow[]): TrendRow[] {
  const weeks = new Map<string, { spend: number; cv: number; impressions: number; clicks: number }>();
  rows.forEach((row) => {
    const d = new Date(row.date);
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - d.getDay());
    const key = weekStart.toISOString().slice(0, 10);
    const existing = weeks.get(key) || { spend: 0, cv: 0, impressions: 0, clicks: 0 };
    existing.spend += row.spend;
    existing.cv += row.cv;
    existing.impressions += row.impressions;
    existing.clicks += row.clicks;
    weeks.set(key, existing);
  });

  return Array.from(weeks.entries())
    .map(([date, value]) => ({
      date,
      spend: value.spend,
      cv: value.cv,
      cpa: value.cv > 0 ? value.spend / value.cv : 0,
      impressions: value.impressions,
      clicks: value.clicks,
      ctr: value.impressions > 0 ? (value.clicks / value.impressions) * 100 : 0,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function formatCurrency(value: number): string {
  return `¥${Math.round(value).toLocaleString("ja-JP")}`;
}

function formatCount(value: number): string {
  return Math.round(value).toLocaleString("ja-JP");
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export default function DailyTrendChart({ rows }: { rows: TrendRow[] }) {
  const [tab, setTab] = useState<MetricTab>("spend");
  const [granularity, setGranularity] = useState<Granularity>("daily");

  const label = useMemo(() => {
    if (tab === "spend") return "消化額";
    if (tab === "cv") return "CV数";
    if (tab === "impressions") return "表示回数";
    if (tab === "clicks") return "クリック数";
    if (tab === "ctr") return "CTR";
    return "CPA";
  }, [tab]);

  const chartRows = useMemo(() => {
    return granularity === "weekly" ? aggregateWeekly(rows) : rows;
  }, [granularity, rows]);

  const tickFormatter = (value: number): string => {
    if (tab === "cv" || tab === "impressions" || tab === "clicks") return formatCount(value);
    if (tab === "ctr") return formatPercent(value);
    return formatCurrency(value);
  };

  const tooltipFormatter = (value: number | string | undefined): [string, string] => {
    const num = Number.parseFloat(String(value ?? 0)) || 0;
    if (tab === "cv" || tab === "impressions" || tab === "clicks") return [formatCount(num), label];
    if (tab === "ctr") return [formatPercent(num), label];
    return [formatCurrency(num), label];
  };

  const tabs: Array<{ key: MetricTab; label: string }> = [
    { key: "spend", label: "消化額" },
    { key: "cv", label: "CV数" },
    { key: "cpa", label: "CPA" },
    { key: "impressions", label: "表示回数" },
    { key: "clicks", label: "クリック数" },
    { key: "ctr", label: "CTR" },
  ];

  return (
    <section className="rounded-xl bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-base font-semibold text-navy">日次推移</h3>
          <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1 text-xs">
            <button
              type="button"
              onClick={() => setGranularity("daily")}
              className={`rounded-md px-3 py-1.5 ${
                granularity === "daily" ? "bg-[#2C5282] text-white" : "text-gray-600"
              }`}
            >
              日別
            </button>
            <button
              type="button"
              onClick={() => setGranularity("weekly")}
              className={`rounded-md px-3 py-1.5 ${
                granularity === "weekly" ? "bg-[#2C5282] text-white" : "text-gray-600"
              }`}
            >
              週別
            </button>
          </div>
        </div>
        <div className="flex gap-0.5 overflow-x-auto rounded-lg border border-gray-200 bg-white p-1 text-xs">
          {tabs.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={`shrink-0 rounded-md px-3 py-1.5 ${
                tab === item.key ? "bg-[#2C5282] text-white" : "text-gray-600"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={chartRows}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
          <XAxis dataKey="date" tick={{ fill: "#64748B", fontSize: 12 }} />
          <YAxis tick={{ fill: "#64748B", fontSize: 12 }} tickFormatter={tickFormatter} />
          <Tooltip formatter={tooltipFormatter} />
          <Area type="monotone" dataKey={tab} stroke="#2C5282" fill="#BFDBFE" fillOpacity={0.5} />
          <Line type="monotone" dataKey={tab} stroke="#2C5282" dot={false} strokeWidth={2} />
        </ComposedChart>
      </ResponsiveContainer>
    </section>
  );
}
