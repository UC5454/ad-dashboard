"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { type ClientRow } from "@/components/dashboard/types";

type SortKey = "name" | "spend" | "cv" | "cpa" | "roas" | "ctr";

function formatCurrency(value: number): string {
  return `¥${Math.round(value).toLocaleString("ja-JP")}`;
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function formatRoas(value: number): string {
  return `${value.toFixed(2)}x`;
}

function statusBadge(status: ClientRow["status"]): string {
  if (status === "active") return "rounded-full bg-emerald-50 text-emerald-700 text-xs px-2 py-0.5";
  if (status === "paused") return "rounded-full bg-amber-50 text-amber-700 text-xs px-2 py-0.5";
  return "rounded-full bg-gray-100 text-gray-600 text-xs px-2 py-0.5";
}

export default function ClientTable({ rows }: { rows: ClientRow[] }) {
  const router = useRouter();
  const [sortKey, setSortKey] = useState<SortKey>("spend");
  const [asc, setAsc] = useState(false);

  const sorted = useMemo(() => {
    const next = [...rows].sort((a, b) => {
      const dir = asc ? 1 : -1;
      if (sortKey === "name") return a.name.localeCompare(b.name) * dir;
      return ((a[sortKey] as number) - (b[sortKey] as number)) * dir;
    });
    return next;
  }, [rows, sortKey, asc]);

  const onSort = (key: SortKey) => {
    if (sortKey === key) {
      setAsc((prev) => !prev);
      return;
    }
    setSortKey(key);
    setAsc(false);
  };

  return (
    <section className="overflow-hidden rounded-xl bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1040px] text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500">
            <tr>
              <th className="px-4 py-3 text-left font-medium">
                <button type="button" onClick={() => onSort("name")}>クライアント名</button>
              </th>
              <th className="px-4 py-3 text-left font-medium">予算</th>
              <th className="px-4 py-3 text-left font-medium">
                <button type="button" onClick={() => onSort("spend")}>消化額</button>
              </th>
              <th className="px-4 py-3 text-left font-medium">消化率</th>
              <th className="px-4 py-3 text-left font-medium">
                <button type="button" onClick={() => onSort("cv")}>CV</button>
              </th>
              <th className="px-4 py-3 text-left font-medium">
                <button type="button" onClick={() => onSort("cpa")}>CPA</button>
              </th>
              <th className="px-4 py-3 text-left font-medium">
                <button type="button" onClick={() => onSort("roas")}>ROAS</button>
              </th>
              <th className="px-4 py-3 text-left font-medium">
                <button type="button" onClick={() => onSort("ctr")}>CTR</button>
              </th>
              <th className="px-4 py-3 text-left font-medium">ステータス</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => {
              const budget = row.monthlyBudgetGoogle + row.monthlyBudgetMeta;
              const rate = budget > 0 ? (row.spendWithFee / budget) * 100 : 0;
              const barColor = rate < 80 ? "bg-emerald-500" : rate <= 100 ? "bg-amber-500" : "bg-red-500";
              return (
                <tr
                  key={row.id}
                  className="cursor-pointer border-t border-gray-100 hover:bg-gray-50"
                  onClick={() => router.push(`/dashboard/clients/${encodeURIComponent(row.id)}`)}
                >
                  <td className="px-4 py-3 font-medium text-navy">{row.name}</td>
                  <td className="px-4 py-3 tabular-nums">{budget > 0 ? formatCurrency(budget) : "-"}</td>
                  <td className="px-4 py-3 tabular-nums">
                    <p className="font-semibold text-navy">{formatCurrency(row.spendWithFee)}</p>
                    <p className="text-xs text-gray-500">媒体費: {formatCurrency(row.spend)} / {row.feeLabel}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="h-2 w-28 overflow-hidden rounded-full bg-gray-100">
                      <div className={`h-full ${barColor}`} style={{ width: `${Math.min(rate, 130)}%` }} />
                    </div>
                    <p className="mt-1 text-xs tabular-nums text-gray-500">{formatPercent(rate)}</p>
                  </td>
                  <td className="px-4 py-3 tabular-nums">{Math.round(row.cv).toLocaleString("ja-JP")}</td>
                  <td className="px-4 py-3 tabular-nums">{row.cv > 0 ? formatCurrency(row.cpa) : "-"}</td>
                  <td className="px-4 py-3 tabular-nums">{formatRoas(row.roas)}</td>
                  <td className="px-4 py-3 tabular-nums">{formatPercent(row.ctr)}</td>
                  <td className="px-4 py-3">
                    <span className={statusBadge(row.status)}>{row.status}</span>
                  </td>
                </tr>
              );
            })}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-gray-500">
                  クライアントデータがありません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
