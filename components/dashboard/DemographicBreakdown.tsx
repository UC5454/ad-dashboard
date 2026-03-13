"use client";

import { useMemo, useState } from "react";

interface DemoCell {
  age: string;
  gender: string;
  spend: number;
  impressions: number;
  clicks: number;
  cv: number;
  cpa: number;
}

type MetricTab = "cv" | "cpa" | "spend";

const AGES = ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"];
const GENDERS = ["male", "female", "unknown"];

function formatCurrency(value: number): string {
  return `¥${Math.round(value).toLocaleString("ja-JP")}`;
}

function getValue(cell: DemoCell | undefined, tab: MetricTab): number {
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
    const inverseAlpha = 0.1 + 0.8 * normalized;
    return normalized <= 0.5 ? `rgba(56, 161, 105, ${1 - inverseAlpha * 0.5})` : `rgba(229, 62, 62, ${inverseAlpha})`;
  }
  return `rgba(44, 82, 130, ${alpha})`;
}

export default function DemographicBreakdown({ data }: { data: DemoCell[] }) {
  const [tab, setTab] = useState<MetricTab>("cv");

  const lookup = useMemo(() => {
    return new Map(data.map((cell) => [`${cell.age}:${cell.gender}`, cell]));
  }, [data]);

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
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-[#1a365d]">年齢×性別分析</h3>
        </div>
        <p className="mt-6 text-sm text-gray-500">データがありません</p>
      </section>
    );
  }

  return (
    <section className="rounded-xl bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-base font-semibold text-[#1a365d]">年齢×性別分析</h3>
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
            費用
          </button>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[520px] border-separate border-spacing-2 text-sm">
          <thead>
            <tr>
              <th className="px-2 py-2 text-left text-xs font-medium text-gray-500">年齢帯</th>
              {GENDERS.map((gender) => (
                <th key={gender} className="px-2 py-2 text-left text-xs font-medium uppercase text-gray-500">
                  {gender}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {AGES.map((age) => (
              <tr key={age}>
                <td className="px-2 py-3 font-medium text-navy">{age}</td>
                {GENDERS.map((gender) => {
                  const cell = lookup.get(`${age}:${gender}`);
                  const value = getValue(cell, tab);
                  return (
                    <td
                      key={`${age}-${gender}`}
                      className="rounded-lg px-3 py-4 text-center tabular-nums"
                      style={{ backgroundColor: buildColor(value, values.min, values.max, tab) }}
                      title={`CV: ${Math.round(cell?.cv ?? 0).toLocaleString("ja-JP")}, CPA: ${formatCurrency(
                        cell?.cpa ?? 0,
                      )}, 費用: ${formatCurrency(cell?.spend ?? 0)}`}
                    >
                      {tab === "cpa" ? formatCurrency(value) : Math.round(value).toLocaleString("ja-JP")}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
