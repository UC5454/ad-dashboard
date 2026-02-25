/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { actionValue } from "@/lib/meta-utils";
import type { MetaCreativeSummary } from "@/types/meta";

interface CampaignMetrics {
  campaign_id: string;
  campaign_name: string;
  impressions: string;
  clicks: string;
  spend: string;
  ctr: string;
  cv: number;
  cpa: number;
  lp_views: number;
}

interface AdsetMetrics {
  campaign_id: string;
  campaign_name: string;
  adset_id: string;
  adset_name: string;
  impressions: string;
  clicks: string;
  spend: string;
  ctr: string;
  cv: number;
  cpa: number;
  lp_views: number;
}

interface DailyPoint {
  date_start: string;
  spend: string;
  clicks: string;
  impressions: string;
  ctr: string;
  cv?: number;
  actions?: Array<{ action_type: string; value: string }>;
}

interface CampaignDetailResponse {
  campaign: CampaignMetrics;
  adsets: AdsetMetrics[];
  creatives: MetaCreativeSummary[];
  daily: DailyPoint[];
}

function formatCurrency(value: number): string {
  return `¥${Math.round(value).toLocaleString("ja-JP")}`;
}

function formatNumber(value: number): string {
  return Math.round(value).toLocaleString("ja-JP");
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function toNumeric(value: string | undefined): number {
  return Number.parseFloat(value || "0") || 0;
}

type CreativeView = "table" | "gallery";
type DatePreset = "today" | "yesterday" | "last_7d" | "last_30d" | "this_month";

export default function CampaignDetailPage() {
  const params = useParams<{ campaignId: string }>();
  const campaignId = params.campaignId;

  const [datePreset, setDatePreset] = useState<DatePreset>("last_30d");
  const [creativeView, setCreativeView] = useState<CreativeView>("table");
  const [detail, setDetail] = useState<CampaignDetailResponse | null>(null);
  const [creatives, setCreatives] = useState<MetaCreativeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!campaignId) return;

    let mounted = true;

    const load = async () => {
      setLoading(true);
      setError("");

      try {
        const [detailRes, creativesRes] = await Promise.all([
          fetch(
            `/api/meta/campaign-detail?campaign_id=${encodeURIComponent(campaignId)}&date_preset=${encodeURIComponent(datePreset)}`,
          ),
          fetch(
            `/api/meta/campaign-creatives?campaign_id=${encodeURIComponent(campaignId)}&date_preset=${encodeURIComponent(datePreset)}`,
          ),
        ]);

        if (!detailRes.ok || !creativesRes.ok) {
          throw new Error("キャンペーン詳細の取得に失敗しました");
        }

        const [detailData, creativesData] = await Promise.all([
          detailRes.json() as Promise<CampaignDetailResponse>,
          creativesRes.json() as Promise<MetaCreativeSummary[]>,
        ]);

        if (!mounted) return;

        setDetail(detailData);
        setCreatives(Array.isArray(creativesData) ? creativesData : []);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "データ取得エラー");
        setDetail(null);
        setCreatives([]);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [campaignId, datePreset]);

  const campaign = detail?.campaign ?? null;
  const adsets = detail?.adsets ?? [];
  const daily = detail?.daily ?? [];

  const rankedCreatives = useMemo(() => {
    return [...creatives].sort((a, b) => {
      if (b.cv !== a.cv) return b.cv - a.cv;
      return a.cpa - b.cpa;
    });
  }, [creatives]);

  const bestCreativeId = rankedCreatives[0]?.ad_id;
  const worstCreativeId = rankedCreatives[rankedCreatives.length - 1]?.ad_id;

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue border-t-transparent" />
      </div>
    );
  }

  if (!campaign) {
    return <p className="text-sm text-red-600">キャンペーンが見つかりません</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <Link href="/dashboard" className="text-sm text-blue hover:text-blue-light hover:underline">
            ← ダッシュボードへ戻る
          </Link>
          <h2 className="mt-2 text-2xl font-bold text-navy">{campaign.campaign_name}</h2>
        </div>
        <label className="text-sm text-gray-700">
          期間
          <select
            className="mt-1 rounded-lg border border-gray-200 bg-white px-3 py-2"
            value={datePreset}
            onChange={(event) => setDatePreset(event.target.value as DatePreset)}
          >
            <option value="today">今日</option>
            <option value="yesterday">昨日</option>
            <option value="last_7d">過去7日</option>
            <option value="last_30d">過去30日</option>
            <option value="this_month">今月</option>
          </select>
        </label>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <article className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">消化額</p>
          <p className="mt-2 text-xl font-bold text-navy tabular-nums">{formatCurrency(toNumeric(campaign.spend))}</p>
        </article>
        <article className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">CV</p>
          <p className="mt-2 text-xl font-bold text-navy tabular-nums">{formatNumber(campaign.cv || 0)}</p>
        </article>
        <article className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">CPA</p>
          <p className="mt-2 text-xl font-bold text-navy tabular-nums">
            {campaign.cv > 0 ? formatCurrency(campaign.cpa || 0) : "-"}
          </p>
        </article>
        <article className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">CTR</p>
          <p className="mt-2 text-xl font-bold text-navy tabular-nums">{formatPercent(toNumeric(campaign.ctr))}</p>
        </article>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-base font-semibold text-navy">日次推移（消化額 / CV）</h3>
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart
            data={daily.map((point) => ({
              ...point,
              spend: toNumeric(point.spend),
              cv: point.cv ?? actionValue(point.actions, "offsite_conversion.fb_pixel_custom"),
            }))}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis dataKey="date_start" tick={{ fill: "#64748B", fontSize: 12 }} />
            <YAxis tick={{ fill: "#64748B", fontSize: 12 }} />
            <Tooltip
              formatter={(value: number | string | undefined, name?: string) => {
                const num = Number.parseFloat(String(value ?? 0)) || 0;
                if (name === "spend") return [formatCurrency(num), "消化額"];
                return [formatNumber(num), "CV"];
              }}
            />
            <Area type="monotone" dataKey="spend" stroke="#2C5282" fill="#93C5FD" fillOpacity={0.35} />
            <Area type="monotone" dataKey="cv" stroke="#059669" fill="#6EE7B7" fillOpacity={0.25} />
          </AreaChart>
        </ResponsiveContainer>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-base font-semibold text-navy">広告セット比較</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left font-medium">広告セット</th>
                <th className="px-3 py-2 text-left font-medium">消化額</th>
                <th className="px-3 py-2 text-left font-medium">IMP</th>
                <th className="px-3 py-2 text-left font-medium">クリック</th>
                <th className="px-3 py-2 text-left font-medium">CTR</th>
                <th className="px-3 py-2 text-left font-medium">CV</th>
                <th className="px-3 py-2 text-left font-medium">CPA</th>
              </tr>
            </thead>
            <tbody>
              {[...adsets]
                .sort((a, b) => toNumeric(b.spend) - toNumeric(a.spend))
                .map((adset, index) => (
                  <tr key={adset.adset_id} className={index % 2 === 0 ? "bg-white" : "bg-gray-50/60"}>
                    <td className="px-3 py-2 font-medium text-navy">{adset.adset_name}</td>
                    <td className="px-3 py-2 tabular-nums">{formatCurrency(toNumeric(adset.spend))}</td>
                    <td className="px-3 py-2 tabular-nums">{formatNumber(toNumeric(adset.impressions))}</td>
                    <td className="px-3 py-2 tabular-nums">{formatNumber(toNumeric(adset.clicks))}</td>
                    <td className="px-3 py-2 tabular-nums">{formatPercent(toNumeric(adset.ctr))}</td>
                    <td className="px-3 py-2 tabular-nums">{formatNumber(adset.cv || 0)}</td>
                    <td className="px-3 py-2 tabular-nums">{adset.cv > 0 ? formatCurrency(adset.cpa || 0) : "-"}</td>
                  </tr>
                ))}
              {adsets.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-gray-500">
                    広告セットデータがありません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h3 className="text-base font-semibold text-navy">クリエイティブ比較</h3>
          <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1 text-xs">
            <button
              type="button"
              onClick={() => setCreativeView("table")}
              className={`rounded-md px-3 py-1.5 ${creativeView === "table" ? "bg-blue text-white" : "text-gray-600"}`}
            >
              テーブル
            </button>
            <button
              type="button"
              onClick={() => setCreativeView("gallery")}
              className={`rounded-md px-3 py-1.5 ${creativeView === "gallery" ? "bg-blue text-white" : "text-gray-600"}`}
            >
              ギャラリー
            </button>
          </div>
        </div>

        {creativeView === "table" ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">クリエイティブ</th>
                  <th className="px-3 py-2 text-left font-medium">消化額</th>
                  <th className="px-3 py-2 text-left font-medium">IMP</th>
                  <th className="px-3 py-2 text-left font-medium">CTR</th>
                  <th className="px-3 py-2 text-left font-medium">CV</th>
                  <th className="px-3 py-2 text-left font-medium">CPA</th>
                  <th className="px-3 py-2 text-left font-medium">評価</th>
                </tr>
              </thead>
              <tbody>
                {rankedCreatives.map((creative, index) => (
                  <tr key={creative.ad_id} className={index % 2 === 0 ? "bg-white" : "bg-gray-50/60"}>
                    <td className="px-3 py-2 font-medium text-navy">{creative.creative_name}</td>
                    <td className="px-3 py-2 tabular-nums">{formatCurrency(creative.spend)}</td>
                    <td className="px-3 py-2 tabular-nums">{formatNumber(creative.impressions)}</td>
                    <td className="px-3 py-2 tabular-nums">{formatPercent(creative.ctr)}</td>
                    <td className="px-3 py-2 tabular-nums">{formatNumber(creative.cv)}</td>
                    <td className="px-3 py-2 tabular-nums">{creative.cv > 0 ? formatCurrency(creative.cpa) : "-"}</td>
                    <td className="px-3 py-2">
                      {creative.ad_id === bestCreativeId && (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">Best</span>
                      )}
                      {creative.ad_id === worstCreativeId && (
                        <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700">Worst</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {rankedCreatives.map((creative) => (
              <article key={creative.ad_id} className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="mb-3 overflow-hidden rounded-md bg-gray-100">
                  {creative.thumbnail_url ? (
                    <img src={creative.thumbnail_url} alt={creative.creative_name} className="h-44 w-full object-cover" />
                  ) : (
                    <div className="flex h-44 items-center justify-center text-sm text-gray-500">サムネイルなし</div>
                  )}
                </div>
                <p className="line-clamp-2 text-sm font-semibold text-navy">{creative.creative_name}</p>
                <div className="mt-2 space-y-1 text-xs text-gray-600">
                  <p className="tabular-nums">消化額: {formatCurrency(creative.spend)}</p>
                  <p className="tabular-nums">CV: {formatNumber(creative.cv)}</p>
                  <p className="tabular-nums">CPA: {creative.cv > 0 ? formatCurrency(creative.cpa) : "-"}</p>
                </div>
                <div className="mt-3 flex gap-2">
                  {creative.ad_id === bestCreativeId && (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">Best</span>
                  )}
                  {creative.ad_id === worstCreativeId && (
                    <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700">Worst</span>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}

        {rankedCreatives.length === 0 && <p className="text-sm text-gray-500">クリエイティブデータがありません</p>}
      </section>
    </div>
  );
}
