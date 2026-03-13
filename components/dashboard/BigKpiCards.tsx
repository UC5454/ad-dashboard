"use client";

import { type KpiMetric } from "@/components/dashboard/types";

function formatCurrency(value: number): string {
  return `¥${Math.round(value).toLocaleString("ja-JP")}`;
}

function formatValue(metric: KpiMetric): string {
  if (metric.type === "currency") return formatCurrency(metric.value);
  if (metric.type === "roas") return `${metric.value.toFixed(2)}x`;
  if (metric.type === "percent") return `${metric.value.toFixed(1)}%`;
  return Math.round(metric.value).toLocaleString("ja-JP");
}

function changeText(metric: KpiMetric): { value: string; positive: boolean } {
  const base = metric.previous === 0 ? 0 : ((metric.value - metric.previous) / metric.previous) * 100;
  const positive = metric.inverted ? base <= 0 : base >= 0;
  const arrow = base >= 0 ? "↑" : "↓";
  return { value: `${arrow} ${Math.abs(base).toFixed(1)}%`, positive };
}

export default function BigKpiCards({ metrics }: { metrics: KpiMetric[] }) {
  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {metrics.map((metric) => {
        const change = changeText(metric);
        return (
          <article key={metric.label} className="rounded-xl bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">{metric.label}</p>
            <p className="mt-2 text-2xl font-bold tabular-nums text-navy">{formatValue(metric)}</p>
            {metric.subLabel && <p className="mt-1 text-xs text-gray-500">{metric.subLabel}</p>}
            <p className={`mt-2 text-xs font-medium ${change.positive ? "text-emerald-600" : "text-red-600"}`}>
              {change.value}
            </p>
            {metric.target !== undefined && metric.target > 0 && (
              <p className="mt-1 text-xs text-gray-500">
                目標対比: {((metric.value / metric.target) * 100).toFixed(1)}%
              </p>
            )}
          </article>
        );
      })}
    </section>
  );
}
