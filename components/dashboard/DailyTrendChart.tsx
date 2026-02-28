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

type MetricTab = "spend" | "cv" | "cpa";

function formatCurrency(value: number): string {
  return `¥${Math.round(value).toLocaleString("ja-JP")}`;
}

export default function DailyTrendChart({ rows }: { rows: TrendRow[] }) {
  const [tab, setTab] = useState<MetricTab>("spend");

  const label = useMemo(() => {
    if (tab === "spend") return "消化額";
    if (tab === "cv") return "CV数";
    return "CPA";
  }, [tab]);

  return (
    <section className="rounded-xl bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-semibold text-navy">日次推移</h3>
        <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1 text-xs">
          <button
            type="button"
            onClick={() => setTab("spend")}
            className={`rounded-md px-3 py-1.5 ${tab === "spend" ? "bg-blue text-white" : "text-gray-600"}`}
          >
            消化額
          </button>
          <button
            type="button"
            onClick={() => setTab("cv")}
            className={`rounded-md px-3 py-1.5 ${tab === "cv" ? "bg-blue text-white" : "text-gray-600"}`}
          >
            CV数
          </button>
          <button
            type="button"
            onClick={() => setTab("cpa")}
            className={`rounded-md px-3 py-1.5 ${tab === "cpa" ? "bg-blue text-white" : "text-gray-600"}`}
          >
            CPA
          </button>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={rows}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
          <XAxis dataKey="date" tick={{ fill: "#64748B", fontSize: 12 }} />
          <YAxis
            tick={{ fill: "#64748B", fontSize: 12 }}
            tickFormatter={(value: number) =>
              tab === "cv" ? `${Math.round(value).toLocaleString("ja-JP")}` : `¥${Math.round(value).toLocaleString("ja-JP")}`
            }
          />
          <Tooltip
            formatter={(value: number | string | undefined) => {
              const num = Number.parseFloat(String(value ?? 0)) || 0;
              if (tab === "cv") return [Math.round(num).toLocaleString("ja-JP"), label];
              return [formatCurrency(num), label];
            }}
          />
          <Area type="monotone" dataKey={tab} stroke="#2C5282" fill="#BFDBFE" fillOpacity={0.5} />
          <Line type="monotone" dataKey={tab} stroke="#2C5282" dot={false} strokeWidth={2} />
        </ComposedChart>
      </ResponsiveContainer>
    </section>
  );
}
