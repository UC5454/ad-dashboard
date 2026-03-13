"use client";

import { useMemo, useState } from "react";

interface CampaignSummaryData {
  campaign_id: string;
  campaign_name: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cv: number;
  cpa: number;
  spendShare: number;
}

interface CampaignSummaryTableProps {
  campaigns: CampaignSummaryData[];
  targetCpa?: number;
}

type SortMode = "spend" | "cv";

function formatCurrency(value: number): string {
  return `¥${Math.round(value).toLocaleString("ja-JP")}`;
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export default function CampaignSummaryTable({ campaigns, targetCpa }: CampaignSummaryTableProps) {
  const [sortMode, setSortMode] = useState<SortMode>("spend");

  const rows = useMemo(() => {
    return [...campaigns]
      .sort((a, b) => (sortMode === "spend" ? b.spend - a.spend : b.cv - a.cv))
      .slice(0, 10);
  }, [campaigns, sortMode]);

  return (
    <section className="rounded-xl bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-base font-semibold text-[#1a365d]">キャンペーン別実績（TOP10）</h3>
        <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1 text-xs">
          <button
            type="button"
            onClick={() => setSortMode("spend")}
            className={`rounded-md px-3 py-1.5 ${sortMode === "spend" ? "bg-[#2C5282] text-white" : "text-gray-600"}`}
          >
            費用順
          </button>
          <button
            type="button"
            onClick={() => setSortMode("cv")}
            className={`rounded-md px-3 py-1.5 ${sortMode === "cv" ? "bg-[#2C5282] text-white" : "text-gray-600"}`}
          >
            CV順
          </button>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[920px] text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500">
            <tr>
              <th className="px-4 py-3 text-left font-medium">キャンペーン名</th>
              <th className="px-4 py-3 text-left font-medium">消化額</th>
              <th className="px-4 py-3 text-left font-medium">費用シェア</th>
              <th className="px-4 py-3 text-left font-medium">IMP</th>
              <th className="px-4 py-3 text-left font-medium">クリック</th>
              <th className="px-4 py-3 text-left font-medium">CTR</th>
              <th className="px-4 py-3 text-left font-medium">CV</th>
              <th className="px-4 py-3 text-left font-medium">CPA</th>
              <th className="px-4 py-3 text-left font-medium">CVR</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((campaign) => {
              const cvr = campaign.clicks > 0 ? (campaign.cv / campaign.clicks) * 100 : 0;
              const cpaClass =
                targetCpa !== undefined && targetCpa > 0
                  ? campaign.cpa <= targetCpa
                    ? "text-[#2C5282]"
                    : "text-red-600"
                  : "text-navy";
              return (
                <tr key={campaign.campaign_id} className="border-t border-gray-100">
                  <td className="px-4 py-3 font-medium text-navy">{campaign.campaign_name || "-"}</td>
                  <td className="px-4 py-3 tabular-nums">{formatCurrency(campaign.spend)}</td>
                  <td className="px-4 py-3">
                    <div className="w-40">
                      <div className="h-2 rounded-full bg-gray-100">
                        <div
                          className="h-full rounded-full bg-[#2C5282]"
                          style={{ width: `${Math.max(0, Math.min(100, campaign.spendShare))}%` }}
                        />
                      </div>
                      <p className="mt-1 text-xs tabular-nums text-gray-500">{formatPercent(campaign.spendShare)}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 tabular-nums">{Math.round(campaign.impressions).toLocaleString("ja-JP")}</td>
                  <td className="px-4 py-3 tabular-nums">{Math.round(campaign.clicks).toLocaleString("ja-JP")}</td>
                  <td className="px-4 py-3 tabular-nums">{formatPercent(campaign.ctr)}</td>
                  <td className="px-4 py-3 tabular-nums">{Math.round(campaign.cv).toLocaleString("ja-JP")}</td>
                  <td className={`px-4 py-3 tabular-nums font-medium ${cpaClass}`}>
                    {campaign.cv > 0 ? formatCurrency(campaign.cpa) : "-"}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{formatPercent(cvr)}</td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-gray-500">
                  データがありません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
