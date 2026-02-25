/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type DatePreset = "today" | "yesterday" | "last_7d" | "last_30d" | "this_month";
type AiTab = "overall" | "daily" | "creative";
type CreativeView = "table" | "gallery";

interface AnalysisResult {
  summary: string;
  insights: string[];
  recommendations: string[];
}

interface ProjectSummary {
  id: string;
  name: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cv: number;
  cpa: number;
}

interface CampaignRow {
  campaign_id: string;
  campaign_name: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cv: number;
  cpa: number;
}

interface AdsetRow {
  adset_id: string;
  adset_name: string;
  campaign_id: string;
  campaign_name: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cv: number;
  cpa: number;
}

interface CreativeRow {
  ad_id: string;
  ad_name: string;
  campaign_id: string;
  campaign_name: string;
  adset_id: string;
  adset_name: string;
  creative_name: string;
  image_url: string | null;
  thumbnail_url: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cv: number;
  cpa: number;
}

interface DailyRow {
  date_start: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cv: number;
  cpa: number;
}

interface ProjectDetailResponse {
  project: ProjectSummary;
  campaigns: CampaignRow[];
  adsets: AdsetRow[];
  creatives: CreativeRow[];
  daily: DailyRow[];
  analysis: {
    overall: AnalysisResult;
    daily: AnalysisResult;
    creative: AnalysisResult;
  };
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

export default function ProjectDetailPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;

  const [datePreset, setDatePreset] = useState<DatePreset>("last_30d");
  const [activeAiTab, setActiveAiTab] = useState<AiTab>("overall");
  const [creativeView, setCreativeView] = useState<CreativeView>("table");
  const [detail, setDetail] = useState<ProjectDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!projectId) return;

    let mounted = true;

    const load = async () => {
      setLoading(true);
      setError("");

      try {
        const res = await fetch(
          `/api/meta/project-detail?project_id=${encodeURIComponent(projectId)}&date_preset=${encodeURIComponent(datePreset)}`,
        );

        if (!res.ok) {
          throw new Error("案件詳細の取得に失敗しました");
        }

        const data = (await res.json()) as ProjectDetailResponse;
        if (!mounted) return;
        setDetail(data);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "データ取得エラー");
        setDetail(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [projectId, datePreset]);

  const aiPanel = useMemo(() => {
    if (!detail) return null;
    if (activeAiTab === "overall") return detail.analysis.overall;
    if (activeAiTab === "daily") return detail.analysis.daily;
    return detail.analysis.creative;
  }, [activeAiTab, detail]);

  const rankedCreatives = useMemo(() => {
    const rows = detail?.creatives || [];
    return [...rows].sort((a, b) => {
      if (b.cv !== a.cv) return b.cv - a.cv;
      return a.cpa - b.cpa;
    });
  }, [detail?.creatives]);

  const bestCreativeId = rankedCreatives[0]?.ad_id;
  const worstCreativeId = rankedCreatives[rankedCreatives.length - 1]?.ad_id;

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue border-t-transparent" />
      </div>
    );
  }

  if (!detail) {
    return <p className="text-sm text-red-600">案件が見つかりません</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <Link href="/dashboard" className="text-sm text-blue hover:text-blue-light hover:underline">
            ← ダッシュボードへ戻る
          </Link>
          <h2 className="mt-2 text-2xl font-bold text-navy">{detail.project.name}</h2>
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
          <p className="mt-2 text-xl font-bold text-navy tabular-nums">{formatCurrency(detail.project.spend)}</p>
        </article>
        <article className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">CV</p>
          <p className="mt-2 text-xl font-bold text-navy tabular-nums">{formatNumber(detail.project.cv)}</p>
        </article>
        <article className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">CPA</p>
          <p className="mt-2 text-xl font-bold text-navy tabular-nums">
            {detail.project.cv > 0 ? formatCurrency(detail.project.cpa) : "-"}
          </p>
        </article>
        <article className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">CTR</p>
          <p className="mt-2 text-xl font-bold text-navy tabular-nums">{formatPercent(detail.project.ctr)}</p>
        </article>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveAiTab("overall")}
            className={`rounded-lg px-3 py-2 text-sm ${activeAiTab === "overall" ? "bg-blue text-white" : "text-gray-600"}`}
          >
            総合分析
          </button>
          <button
            type="button"
            onClick={() => setActiveAiTab("daily")}
            className={`rounded-lg px-3 py-2 text-sm ${activeAiTab === "daily" ? "bg-blue text-white" : "text-gray-600"}`}
          >
            日次分析
          </button>
          <button
            type="button"
            onClick={() => setActiveAiTab("creative")}
            className={`rounded-lg px-3 py-2 text-sm ${activeAiTab === "creative" ? "bg-blue text-white" : "text-gray-600"}`}
          >
            クリエイティブ分析
          </button>
        </div>

        {aiPanel && (
          <div className="space-y-4">
            <p className="rounded-lg bg-blue/10 px-3 py-2 text-sm text-navy">{aiPanel.summary}</p>
            <div>
              <h4 className="text-sm font-semibold text-navy">示唆</h4>
              <ul className="mt-2 space-y-1 text-sm text-gray-700">
                {aiPanel.insights.map((item, index) => (
                  <li key={`${item}-${index}`} className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-blue" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-navy">改善提案</h4>
              <ul className="mt-2 space-y-1 text-sm text-gray-700">
                {aiPanel.recommendations.map((item, index) => (
                  <li key={`${item}-${index}`} className="flex items-start gap-2">
                    <span className="text-amber">→</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-base font-semibold text-navy">日次推移（消化額 / CV）</h3>
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart data={detail.daily}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis dataKey="date_start" tick={{ fill: "#64748B", fontSize: 12 }} />
            <YAxis yAxisId="left" tick={{ fill: "#64748B", fontSize: 12 }} />
            <YAxis yAxisId="right" orientation="right" tick={{ fill: "#64748B", fontSize: 12 }} />
            <Tooltip
              formatter={(value: number | string | undefined, name?: string) => {
                const num = Number.parseFloat(String(value ?? 0)) || 0;
                if (name === "spend") return [formatCurrency(num), "消化額"];
                return [formatNumber(num), "CV"];
              }}
            />
            <Area yAxisId="left" type="monotone" dataKey="spend" stroke="#2C5282" fill="#93C5FD" fillOpacity={0.35} />
            <Area yAxisId="right" type="monotone" dataKey="cv" stroke="#059669" fill="#6EE7B7" fillOpacity={0.25} />
          </AreaChart>
        </ResponsiveContainer>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-base font-semibold text-navy">キャンペーン比較</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left font-medium">キャンペーン名</th>
                <th className="px-3 py-2 text-left font-medium">消化額</th>
                <th className="px-3 py-2 text-left font-medium">IMP</th>
                <th className="px-3 py-2 text-left font-medium">クリック</th>
                <th className="px-3 py-2 text-left font-medium">CTR</th>
                <th className="px-3 py-2 text-left font-medium">CV</th>
                <th className="px-3 py-2 text-left font-medium">CPA</th>
              </tr>
            </thead>
            <tbody>
              {detail.campaigns.map((row, index) => (
                <tr key={row.campaign_id} className={index % 2 === 0 ? "bg-white" : "bg-gray-50/60"}>
                  <td className="px-3 py-2 font-medium text-navy">{row.campaign_name}</td>
                  <td className="px-3 py-2 tabular-nums">{formatCurrency(row.spend)}</td>
                  <td className="px-3 py-2 tabular-nums">{formatNumber(row.impressions)}</td>
                  <td className="px-3 py-2 tabular-nums">{formatNumber(row.clicks)}</td>
                  <td className="px-3 py-2 tabular-nums">{formatPercent(row.ctr)}</td>
                  <td className="px-3 py-2 tabular-nums">{formatNumber(row.cv)}</td>
                  <td className="px-3 py-2 tabular-nums">{row.cv > 0 ? formatCurrency(row.cpa) : "-"}</td>
                </tr>
              ))}
              {detail.campaigns.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-gray-500">
                    キャンペーンデータがありません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-base font-semibold text-navy">広告セット比較</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left font-medium">広告セット名</th>
                <th className="px-3 py-2 text-left font-medium">キャンペーン名</th>
                <th className="px-3 py-2 text-left font-medium">消化額</th>
                <th className="px-3 py-2 text-left font-medium">IMP</th>
                <th className="px-3 py-2 text-left font-medium">クリック</th>
                <th className="px-3 py-2 text-left font-medium">CTR</th>
                <th className="px-3 py-2 text-left font-medium">CV</th>
                <th className="px-3 py-2 text-left font-medium">CPA</th>
              </tr>
            </thead>
            <tbody>
              {detail.adsets.map((row, index) => (
                <tr key={row.adset_id} className={index % 2 === 0 ? "bg-white" : "bg-gray-50/60"}>
                  <td className="px-3 py-2 font-medium text-navy">{row.adset_name}</td>
                  <td className="px-3 py-2">{row.campaign_name}</td>
                  <td className="px-3 py-2 tabular-nums">{formatCurrency(row.spend)}</td>
                  <td className="px-3 py-2 tabular-nums">{formatNumber(row.impressions)}</td>
                  <td className="px-3 py-2 tabular-nums">{formatNumber(row.clicks)}</td>
                  <td className="px-3 py-2 tabular-nums">{formatPercent(row.ctr)}</td>
                  <td className="px-3 py-2 tabular-nums">{formatNumber(row.cv)}</td>
                  <td className="px-3 py-2 tabular-nums">{row.cv > 0 ? formatCurrency(row.cpa) : "-"}</td>
                </tr>
              ))}
              {detail.adsets.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-gray-500">
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
            <table className="w-full min-w-[1040px] text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">クリエイティブ名</th>
                  <th className="px-3 py-2 text-left font-medium">キャンペーン名</th>
                  <th className="px-3 py-2 text-left font-medium">消化額</th>
                  <th className="px-3 py-2 text-left font-medium">IMP</th>
                  <th className="px-3 py-2 text-left font-medium">クリック</th>
                  <th className="px-3 py-2 text-left font-medium">CTR</th>
                  <th className="px-3 py-2 text-left font-medium">CV</th>
                  <th className="px-3 py-2 text-left font-medium">CPA</th>
                  <th className="px-3 py-2 text-left font-medium">評価</th>
                </tr>
              </thead>
              <tbody>
                {rankedCreatives.map((row, index) => (
                  <tr key={row.ad_id} className={index % 2 === 0 ? "bg-white" : "bg-gray-50/60"}>
                    <td className="px-3 py-2 font-medium text-navy">{row.creative_name}</td>
                    <td className="px-3 py-2">{row.campaign_name}</td>
                    <td className="px-3 py-2 tabular-nums">{formatCurrency(row.spend)}</td>
                    <td className="px-3 py-2 tabular-nums">{formatNumber(row.impressions)}</td>
                    <td className="px-3 py-2 tabular-nums">{formatNumber(row.clicks)}</td>
                    <td className="px-3 py-2 tabular-nums">{formatPercent(row.ctr)}</td>
                    <td className="px-3 py-2 tabular-nums">{formatNumber(row.cv)}</td>
                    <td className="px-3 py-2 tabular-nums">{row.cv > 0 ? formatCurrency(row.cpa) : "-"}</td>
                    <td className="px-3 py-2">
                      {row.ad_id === bestCreativeId && (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">Best</span>
                      )}
                      {row.ad_id === worstCreativeId && (
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
            {rankedCreatives.map((row) => (
              <article key={row.ad_id} className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="mb-3 overflow-hidden rounded-md bg-gray-100">
                  {row.image_url || row.thumbnail_url ? (
                    <img
                      src={row.image_url || row.thumbnail_url || ""}
                      alt={row.creative_name}
                      className="h-44 w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-44 items-center justify-center text-sm text-gray-500">画像なし</div>
                  )}
                </div>
                <p className="line-clamp-2 text-sm font-semibold text-navy">{row.creative_name}</p>
                <div className="mt-2 space-y-1 text-xs text-gray-600">
                  <p className="tabular-nums">消化額: {formatCurrency(row.spend)}</p>
                  <p className="tabular-nums">CV: {formatNumber(row.cv)}</p>
                  <p className="tabular-nums">CPA: {row.cv > 0 ? formatCurrency(row.cpa) : "-"}</p>
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
