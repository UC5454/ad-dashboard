"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { generateAccountAnalysis } from "@/lib/analysis";
import type { MetaAccount, MetaAction, MetaCampaignInsights, MetaInsights } from "@/types/meta";

type SortKey =
  | "campaign_name"
  | "spend"
  | "impressions"
  | "clicks"
  | "ctr"
  | "cpc"
  | "lp_views"
  | "cv"
  | "cpa";

interface CampaignRow extends MetaCampaignInsights {
  lp_views?: number;
  cv?: number;
  cpa?: number;
  calc_cpc?: number;
}

interface AccountInsightsResponse extends MetaInsights {
  link_click?: number;
  landing_page_view?: number;
  cv?: number;
}

const presetLabels: Record<string, string> = {
  today: "今日",
  yesterday: "昨日",
  last_7d: "過去7日",
  last_30d: "過去30日",
  this_month: "今月",
};

function actionValue(actions: MetaAction[] | undefined, actionType: string): number {
  const action = actions?.find((item) => item.action_type === actionType);
  return action ? Number.parseFloat(action.value || "0") || 0 : 0;
}

function formatCurrency(value: number): string {
  return `¥${Math.round(value).toLocaleString("ja-JP")}`;
}

function formatNumber(value: number): string {
  return value.toLocaleString("ja-JP");
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function getPresetRangeLabel(insights: AccountInsightsResponse | null, datePreset: string): string {
  if (insights?.date_start && insights?.date_stop) {
    return `${insights.date_start} 〜 ${insights.date_stop}`;
  }
  return presetLabels[datePreset] || datePreset;
}

export default function DashboardPage() {
  const router = useRouter();

  const [accountId, setAccountId] = useState<string>("");
  const [datePreset, setDatePreset] = useState("last_30d");
  const [accounts, setAccounts] = useState<MetaAccount[]>([]);
  const [insights, setInsights] = useState<AccountInsightsResponse | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [error, setError] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("spend");
  const [sortAsc, setSortAsc] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadAccounts = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/meta/accounts");
        if (!res.ok) {
          throw new Error("アカウントの取得に失敗しました");
        }

        const data = (await res.json()) as MetaAccount[];
        if (!mounted) return;

        setAccounts(data);
        if (data.length > 0) {
          setAccountId(data[0].id);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "データ取得エラー");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void loadAccounts();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!accountId) return;

    let mounted = true;

    const loadDetailData = async () => {
      setDetailsLoading(true);
      setError("");
      try {
        const [insightsRes, campaignsRes] = await Promise.all([
          fetch(`/api/meta/insights?account_id=${encodeURIComponent(accountId)}&date_preset=${datePreset}`),
          fetch(`/api/meta/campaigns?account_id=${encodeURIComponent(accountId)}&date_preset=${datePreset}`),
        ]);

        if (!insightsRes.ok || !campaignsRes.ok) {
          throw new Error("指標データの取得に失敗しました");
        }

        const [insightsData, campaignsData] = await Promise.all([
          insightsRes.json() as Promise<AccountInsightsResponse | null>,
          campaignsRes.json() as Promise<CampaignRow[]>,
        ]);

        if (!mounted) return;

        setInsights(insightsData);
        setCampaigns(Array.isArray(campaignsData) ? campaignsData : []);
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "データ取得エラー");
          setInsights(null);
          setCampaigns([]);
        }
      } finally {
        if (mounted) {
          setDetailsLoading(false);
        }
      }
    };

    void loadDetailData();

    return () => {
      mounted = false;
    };
  }, [accountId, datePreset]);

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === accountId) || null,
    [accountId, accounts],
  );

  const kpis = useMemo(() => {
    const spend = Number.parseFloat(insights?.spend || "0") || 0;
    const impressions = Number.parseFloat(insights?.impressions || "0") || 0;
    const clicks = Number.parseFloat(insights?.clicks || "0") || 0;
    const ctr = Number.parseFloat(insights?.ctr || "0") || 0;

    return [
      { label: "消化金額", value: formatCurrency(spend) },
      { label: "IMP", value: formatNumber(Math.round(impressions)) },
      { label: "クリック", value: formatNumber(Math.round(clicks)) },
      { label: "CTR", value: formatPercent(ctr) },
    ];
  }, [insights]);

  const sortedCampaigns = useMemo(() => {
    const rows = [...campaigns];

    rows.sort((a, b) => {
      const aVal =
        sortKey === "campaign_name"
          ? a.campaign_name
          : sortKey === "lp_views"
            ? a.lp_views ?? actionValue(a.actions, "landing_page_view")
            : sortKey === "cv"
              ? a.cv ?? actionValue(a.actions, "offsite_conversion.fb_pixel_custom")
              : sortKey === "cpa"
                ? a.cpa ?? (a.cv ? (Number.parseFloat(a.spend || "0") || 0) / a.cv : 0)
                : sortKey === "cpc"
                  ? a.calc_cpc ?? (Number.parseFloat(a.cpc || "0") || 0)
                  : Number.parseFloat(String(a[sortKey])) || 0;

      const bVal =
        sortKey === "campaign_name"
          ? b.campaign_name
          : sortKey === "lp_views"
            ? b.lp_views ?? actionValue(b.actions, "landing_page_view")
            : sortKey === "cv"
              ? b.cv ?? actionValue(b.actions, "offsite_conversion.fb_pixel_custom")
              : sortKey === "cpa"
                ? b.cpa ?? (b.cv ? (Number.parseFloat(b.spend || "0") || 0) / b.cv : 0)
                : sortKey === "cpc"
                  ? b.calc_cpc ?? (Number.parseFloat(b.cpc || "0") || 0)
                  : Number.parseFloat(String(b[sortKey])) || 0;

      if (typeof aVal === "string" || typeof bVal === "string") {
        const compare = String(aVal).localeCompare(String(bVal), "ja");
        return sortAsc ? compare : -compare;
      }

      return sortAsc ? aVal - bVal : bVal - aVal;
    });

    return rows;
  }, [campaigns, sortAsc, sortKey]);

  const analysisComments = useMemo(() => {
    if (!insights) return [];
    return generateAccountAnalysis(insights, campaigns);
  }, [insights, campaigns]);

  const onSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc((prev) => !prev);
      return;
    }
    setSortKey(key);
    setSortAsc(false);
  };

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#2C5282] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6 bg-gray-50">
      <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#1B2A4A]">Meta Ads ダッシュボード</h2>
          <p className="mt-1 text-sm text-gray-500">{getPresetRangeLabel(insights, datePreset)}</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="text-sm text-gray-700">
            アカウント
            <select
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
              value={accountId}
              onChange={(event) => setAccountId(event.target.value)}
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}（{account.account_id}）
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-gray-700">
            期間
            <select
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
              value={datePreset}
              onChange={(event) => setDatePreset(event.target.value)}
            >
              <option value="today">今日</option>
              <option value="yesterday">昨日</option>
              <option value="last_7d">過去7日</option>
              <option value="last_30d">過去30日</option>
              <option value="this_month">今月</option>
            </select>
          </label>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {detailsLoading ? (
        <div className="flex h-64 items-center justify-center rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#2C5282] border-t-transparent" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {kpis.map((kpi) => (
              <div key={kpi.label} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <p className="text-sm text-gray-500">{kpi.label}</p>
                <p className="mt-2 text-2xl font-bold text-[#1B2A4A] tabular-nums">{kpi.value}</p>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500">
                <tr>
                  {[
                    { key: "campaign_name", label: "キャンペーン名" },
                    { key: "spend", label: "消化額" },
                    { key: "impressions", label: "IMP" },
                    { key: "clicks", label: "クリック" },
                    { key: "ctr", label: "CTR" },
                    { key: "cpc", label: "CPC" },
                    { key: "lp_views", label: "LPV" },
                    { key: "cv", label: "CV" },
                    { key: "cpa", label: "CPA" },
                  ].map((col) => (
                    <th
                      key={col.key}
                      className="cursor-pointer px-4 py-3 text-left font-medium hover:text-[#1B2A4A]"
                      onClick={() => onSort(col.key as SortKey)}
                    >
                      {col.label}
                      {sortKey === col.key ? (sortAsc ? " ↑" : " ↓") : ""}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedCampaigns.map((campaign, index) => {
                  const spend = Number.parseFloat(campaign.spend || "0") || 0;
                  const impressions = Number.parseFloat(campaign.impressions || "0") || 0;
                  const clicks = Number.parseFloat(campaign.clicks || "0") || 0;
                  const ctr = Number.parseFloat(campaign.ctr || "0") || 0;
                  const lpViews = campaign.lp_views ?? actionValue(campaign.actions, "landing_page_view");
                  const cv = campaign.cv ?? actionValue(campaign.actions, "offsite_conversion.fb_pixel_custom");
                  const cpc = campaign.calc_cpc ?? (clicks > 0 ? spend / clicks : 0);
                  const cpa = campaign.cpa ?? (cv > 0 ? spend / cv : 0);

                  return (
                    <tr
                      key={campaign.campaign_id}
                      className={`cursor-pointer ${index % 2 === 0 ? "bg-white" : "bg-gray-50/60"} hover:bg-blue-50`}
                      onClick={() =>
                        router.push(
                          `/dashboard/campaigns/${campaign.campaign_id}?accountId=${encodeURIComponent(accountId)}`,
                        )
                      }
                    >
                      <td className="px-4 py-3 font-medium text-[#1B2A4A]">{campaign.campaign_name}</td>
                      <td className="px-4 py-3 tabular-nums">{formatCurrency(spend)}</td>
                      <td className="px-4 py-3 tabular-nums">{formatNumber(Math.round(impressions))}</td>
                      <td className="px-4 py-3 tabular-nums">{formatNumber(Math.round(clicks))}</td>
                      <td className="px-4 py-3 tabular-nums">{formatPercent(ctr)}</td>
                      <td className="px-4 py-3 tabular-nums">{formatCurrency(cpc)}</td>
                      <td className="px-4 py-3 tabular-nums">{formatNumber(Math.round(lpViews))}</td>
                      <td className="px-4 py-3 tabular-nums">{formatNumber(Math.round(cv))}</td>
                      <td className="px-4 py-3 tabular-nums">{cv > 0 ? formatCurrency(cpa) : "-"}</td>
                    </tr>
                  );
                })}
                {sortedCampaigns.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                      キャンペーンデータがありません
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <section className="rounded-xl border-l-4 border-[#2C5282] bg-blue-50 p-4">
            <h3 className="text-base font-semibold text-[#1B2A4A]">分析コメント</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-700">
              {analysisComments.map((comment) => (
                <li key={comment}>{comment}</li>
              ))}
            </ul>
          </section>

          {selectedAccount && (
            <p className="text-xs text-gray-500">
              通貨: {selectedAccount.currency} / タイムゾーン: {selectedAccount.timezone_name}
            </p>
          )}
        </>
      )}
    </div>
  );
}
