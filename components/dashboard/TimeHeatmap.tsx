"use client";

import { useMemo, useState } from "react";

interface HeatmapCell {
  day: number;
  hour: number;
  spend: number;
  cv: number;
  cpa: number;
}

type MetricTab = "cv" | "cpa" | "spend";

const DAYS = ["月", "火", "水", "木", "金", "土", "日"];

function formatCurrency(value: number): string {
  return `¥${Math.round(value).toLocaleString("ja-JP")}`;
}

function getValue(cell: HeatmapCell | undefined, tab: MetricTab): number {
  if (!cell) return 0;
  if (tab === "cv") return cell.cv;
  if (tab === "spend") return cell.spend;
  return cell.cpa;
}

function buildColor(value: number, min: number, max: number, tab: MetricTab): string {
  if (max <= min || value <= 0) return "rgba(226, 232, 240, 0.5)";
  const normalized = (value - min) / (max - min);
  const alpha = 0.1 + 0.8 * normalized;
  if (tab === "cpa") {
    return normalized <= 0.5 ? `rgba(56, 161, 105, ${0.9 - normalized * 0.5})` : `rgba(229, 62, 62, ${alpha})`;
  }
  return `rgba(44, 82, 130, ${alpha})`;
}

export default function TimeHeatmap({ data }: { data: HeatmapCell[] }) {
  const [tab, setTab] = useState<MetricTab>("cv");

  const lookup = useMemo(() => new Map(data.map((cell) => [`${cell.day}:${cell.hour}`, cell])), [data]);
  const values = useMemo(() => {
    const extracted = data.map((cell) => getValue(cell, tab)).filter((value) => value > 0);
    return {
      min: extracted.length > 0 ? Math.min(...extracted) : 0,
      max: extracted.length > 0 ? Math.max(...extracted) : 0,
    };
  }, [data, tab]);

  if (data.length === 0) {
    return (
      <section className="rounded-xl bg-white p-5 shadow-sm">
        <h3 className="text-base font-semibold text-[#1a365d]">曜日×時間帯分析</h3>
        <p className="mt-6 text-sm text-gray-500">データがありません</p>
      </section>
    );
  }

  return (
    <section className="rounded-xl bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-base font-semibold text-[#1a365d]">曜日×時間帯分析</h3>
        <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1 text-xs">
          <button
            type="button"
            onClick={() => setTab("cv")}
            className={`rounded-md px-3 py-1.5 ${tab === "cv" ? "bg-[#2C5282] text-white" : "text-gray-600"}`}
          >
            CV数
          </button>
          <button
            type="button"
            onClick={() => setTab("cpa")}
            className={`rounded-md px-3 py-1.5 ${tab === "cpa" ? "bg-[#2C5282] text-white" : "text-gray-600"}`}
          >
            CPA
          </button>
          <button
            type="button"
            onClick={() => setTab("spend")}
            className={`rounded-md px-3 py-1.5 ${tab === "spend" ? "bg-[#2C5282] text-white" : "text-gray-600"}`}
          >
            消化額
          </button>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <div className="min-w-[760px]">
          <div className="ml-12 grid grid-cols-24 gap-1 text-[10px] text-gray-400">
            {Array.from({ length: 24 }, (_, hour) => (
              <div key={hour} className="text-center">
                {hour % 3 === 0 ? hour : ""}
              </div>
            ))}
          </div>
          <div className="mt-2 space-y-1">
            {DAYS.map((dayLabel, day) => (
              <div key={dayLabel} className="flex items-center gap-2">
                <div className="w-10 text-right text-xs font-medium text-gray-500">{dayLabel}</div>
                <div className="grid grid-cols-24 gap-1">
                  {Array.from({ length: 24 }, (_, hour) => {
                    const cell = lookup.get(`${day}:${hour}`);
                    const value = getValue(cell, tab);
                    return (
                      <div
                        key={`${day}-${hour}`}
                        className="h-5 w-5 rounded-sm sm:h-6 sm:w-6"
                        style={{ backgroundColor: buildColor(value, values.min, values.max, tab) }}
                        title={`${dayLabel} ${hour}時 | CV: ${Math.round(cell?.cv ?? 0).toLocaleString("ja-JP")}, CPA: ${formatCurrency(
                          cell?.cpa ?? 0,
                        )}, 費用: ${formatCurrency(cell?.spend ?? 0)}`}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
