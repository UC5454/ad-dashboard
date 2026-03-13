"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AlertBanner from "@/components/dashboard/AlertBanner";
import BigKpiCards from "@/components/dashboard/BigKpiCards";
import CampaignSummaryTable from "@/components/dashboard/CampaignSummaryTable";
import ClientTable from "@/components/dashboard/ClientTable";
import DailyTrendChart from "@/components/dashboard/DailyTrendChart";
import DemographicBreakdown from "@/components/dashboard/DemographicBreakdown";
import DeviceBreakdown from "@/components/dashboard/DeviceBreakdown";
import TimeHeatmap from "@/components/dashboard/TimeHeatmap";
import type { AlertItem, ClientRow, KpiMetric, TrendRow } from "@/components/dashboard/types";
import { generateAlerts } from "@/lib/alerts";
import { apiFetch } from "@/lib/api-client";
import { calculateBudgetProgress } from "@/lib/budget";
import { DEFAULT_SETTINGS, loadSettings, type FeeCalcMethod } from "@/lib/settings";
import { loadApiKeys, loadCompanies } from "@/lib/storage";
import type { MetaBreakdownInsights, MetaCreativeSummary, MetaInsights } from "@/types/meta";

type Period = "current_month" | "last_30";

interface ProjectRow {
  id: string;
  name: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cv: number;
  cpa: number;
}

interface DailyRow extends MetaInsights {
  cv?: number;
}

interface CampaignApiRow extends MetaInsights {
  campaign_id: string;
  campaign_name: string;
  cv?: number;
  cpa?: number;
}

interface DeviceData {
  device: string;
  spend: number;
  impressions: number;
  clicks: number;
  cv: number;
  cpa: number;
  ctr: number;
}

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

interface DemoCell {
  age: string;
  gender: string;
  spend: number;
  impressions: number;
  clicks: number;
  cv: number;
  cpa: number;
}

interface HeatmapCell {
  day: number;
  hour: number;
  spend: number;
  cv: number;
  cpa: number;
}

interface BreakdownRow extends MetaBreakdownInsights {
  cv?: number;
  cpa?: number;
}

function formatCurrency(value: number): string {
  return `¥${Math.round(value).toLocaleString("ja-JP")}`;
}

function formatDateRange(period: Period): string {
  const today = new Date();
  if (period === "current_month") {
    const from = new Date(today.getFullYear(), today.getMonth(), 1);
    return `${from.toLocaleDateString("ja-JP")} - ${today.toLocaleDateString("ja-JP")}`;
  }
  const from = new Date(today);
  from.setDate(today.getDate() - 29);
  return `${from.toLocaleDateString("ja-JP")} - ${today.toLocaleDateString("ja-JP")}`;
}

function toNumber(value: string | number | null | undefined): number {
  return Number.parseFloat(String(value ?? "0")) || 0;
}

function feeLabel(method: FeeCalcMethod): string {
  return method === "margin" ? "Fee込(内掛)" : "Fee込(外掛)";
}

function parseHourRange(value: string | undefined): number {
  const match = value?.match(/^(\d{2}):/);
  return match ? Number(match[1]) : 0;
}

function weekdayToMondayIndex(date: string): number {
  const raw = new Date(date).getDay();
  return raw === 0 ? 6 : raw - 1;
}

async function fetchJsonOrEmpty<T>(url: string, fallback: T): Promise<T> {
  try {
    const response = await apiFetch(url);
    if (!response.ok) {
      console.error(`API request failed: ${url}`, response.status);
      return fallback;
    }
    return (await response.json()) as T;
  } catch (error) {
    console.error(`API request error: ${url}`, error);
    return fallback;
  }
}

export default function DashboardPage() {
  const [period, setPeriod] = useState<Period>("last_30");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [setupMissing, setSetupMissing] = useState(false);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [daily, setDaily] = useState<DailyRow[]>([]);
  const [creatives, setCreatives] = useState<MetaCreativeSummary[]>([]);
  const [deviceData, setDeviceData] = useState<DeviceData[]>([]);
  const [campaignsData, setCampaignsData] = useState<CampaignSummaryData[]>([]);
  const [demographicData, setDemographicData] = useState<DemoCell[]>([]);
  const [heatmapData, setHeatmapData] = useState<HeatmapCell[]>([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  useEffect(() => {
    setSettings(loadSettings());
  }, []);

  useEffect(() => {
    let mounted = true;
    const datePreset = period === "current_month" ? "this_month" : "last_30d";

    const run = async () => {
      setLoading(true);
      setError("");

      const keys = loadApiKeys();
      const companies = loadCompanies();
      if (companies.length === 0 && keys.length === 0) {
        try {
          const envRes = await fetch("/api/meta/check-env");
          const envData = (await envRes.json()) as { configured: boolean };
          if (!envData.configured) {
            if (!mounted) return;
            setSetupMissing(true);
            setProjects([]);
            setDaily([]);
            setCreatives([]);
            setDeviceData([]);
            setCampaignsData([]);
            setDemographicData([]);
            setHeatmapData([]);
            setLoading(false);
            return;
          }
        } catch {
          if (!mounted) return;
          setSetupMissing(true);
          setLoading(false);
          return;
        }
      }

      setSetupMissing(false);

      try {
        const [projectData, dailyData, creativeData, deviceRaw, campaignRaw, demographicRaw, hourlyRaw] = await Promise.all([
          fetchJsonOrEmpty<ProjectRow[]>(`/api/meta/projects?date_preset=${datePreset}`, []),
          fetchJsonOrEmpty<DailyRow[]>(`/api/meta/daily?date_preset=${datePreset}`, []),
          fetchJsonOrEmpty<MetaCreativeSummary[]>(`/api/meta/creatives?date_preset=${datePreset}`, []),
          fetchJsonOrEmpty<BreakdownRow[]>(`/api/meta/breakdowns?dimension=impression_device&date_preset=${datePreset}`, []),
          fetchJsonOrEmpty<CampaignApiRow[]>(`/api/meta/campaigns?date_preset=${datePreset}`, []),
          fetchJsonOrEmpty<BreakdownRow[]>(`/api/meta/breakdowns?dimension=age,gender&date_preset=${datePreset}`, []),
          fetchJsonOrEmpty<BreakdownRow[]>(
            `/api/meta/breakdowns?dimension=hourly_stats_aggregated_by_advertiser_time_zone&date_preset=${datePreset}`,
            [],
          ),
        ]);

        const deviceNormalized = deviceRaw.map((row) => ({
          device: row.impression_device || "unknown",
          spend: toNumber(row.spend),
          impressions: toNumber(row.impressions),
          clicks: toNumber(row.clicks),
          cv: Number(row.cv) || 0,
          cpa: Number(row.cpa) || 0,
          ctr: toNumber(row.ctr),
        }));

        const totalCampaignSpend = campaignRaw.reduce((sum, row) => sum + toNumber(row.spend), 0);
        const campaignNormalized = campaignRaw
          .map((row) => {
            const spend = toNumber(row.spend);
            const impressions = toNumber(row.impressions);
            const clicks = toNumber(row.clicks);
            const cv = Number(row.cv) || 0;
            return {
              campaign_id: row.campaign_id,
              campaign_name: row.campaign_name || "名称未設定",
              spend,
              impressions,
              clicks,
              ctr: toNumber(row.ctr),
              cv,
              cpa: Number(row.cpa) || (cv > 0 ? spend / cv : 0),
              spendShare: totalCampaignSpend > 0 ? (spend / totalCampaignSpend) * 100 : 0,
            };
          })
          .sort((a, b) => b.spend - a.spend)
          .slice(0, 10);

        const demographicNormalized = demographicRaw.map((row) => ({
          age: row.age || "unknown",
          gender: row.gender || "unknown",
          spend: toNumber(row.spend),
          impressions: toNumber(row.impressions),
          clicks: toNumber(row.clicks),
          cv: Number(row.cv) || 0,
          cpa: Number(row.cpa) || 0,
        }));

        const hourlyMap = new Map<string, HeatmapCell>();
        hourlyRaw.forEach((row) => {
          const day = weekdayToMondayIndex(row.date_start);
          const hour = parseHourRange(row.hourly_stats_aggregated_by_advertiser_time_zone);
          const key = `${day}:${hour}`;
          const current = hourlyMap.get(key) ?? { day, hour, spend: 0, cv: 0, cpa: 0 };
          current.spend += toNumber(row.spend);
          current.cv += Number(row.cv) || 0;
          current.cpa = current.cv > 0 ? current.spend / current.cv : 0;
          hourlyMap.set(key, current);
        });

        if (!mounted) return;
        setProjects(projectData);
        setDaily(dailyData);
        setCreatives(creativeData);
        setDeviceData(deviceNormalized);
        setCampaignsData(campaignNormalized);
        setDemographicData(demographicNormalized);
        setHeatmapData(Array.from(hourlyMap.values()));
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "データ取得エラー");
        setProjects([]);
        setDaily([]);
        setCreatives([]);
        setDeviceData([]);
        setCampaignsData([]);
        setDemographicData([]);
        setHeatmapData([]);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void run();

    return () => {
      mounted = false;
    };
  }, [period]);

  const projectRows = useMemo(() => {
    return projects.map((project) => {
      const progress = calculateBudgetProgress(
        project.name,
        project.spend,
        settings.budgets,
        settings.defaultFeeRate,
        settings.feeCalcMethod,
      );
      const roas = project.spend > 0 ? (project.cv * 10000) / project.spend : 0;
      return {
        id: project.id,
        name: project.name,
        monthlyBudgetGoogle: progress.monthlyBudget ?? 0,
        monthlyBudgetMeta: 0,
        spend: project.spend,
        spendWithFee: progress.spendWithFee,
        feeLabel: feeLabel(settings.feeCalcMethod),
        cv: project.cv,
        cpa: project.cpa,
        roas,
        ctr: project.ctr,
        status:
          progress.monthlyBudget === null
            ? ("archived" as const)
            : progress.paceStatus === "over"
              ? ("paused" as const)
              : ("active" as const),
      } satisfies ClientRow;
    });
  }, [projects, settings]);

  const metrics = useMemo(() => {
    const totalSpend = projectRows.reduce((sum, row) => sum + row.spend, 0);
    const totalSpendWithFee = projectRows.reduce((sum, row) => sum + row.spendWithFee, 0);
    const totalCv = projectRows.reduce((sum, row) => sum + row.cv, 0);
    const avgCpa = totalCv > 0 ? totalSpend / totalCv : 0;
    const avgRoas = projectRows.length > 0 ? projectRows.reduce((sum, row) => sum + row.roas, 0) / projectRows.length : 0;
    const totalImpressions = projects.reduce((sum, row) => sum + row.impressions, 0);
    const totalClicks = projects.reduce((sum, row) => sum + row.clicks, 0);
    const totalCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const avgCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;

    const series = [...daily]
      .map((row) => {
        const spend = toNumber(row.spend);
        const impressions = toNumber(row.impressions);
        const clicks = toNumber(row.clicks);
        const cv = Number(row.cv) || 0;
        return {
          date: row.date_start,
          spend,
          cv,
          cpa: cv > 0 ? spend / cv : 0,
          impressions,
          clicks,
          ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date))
      .filter((row) => row.spend >= 0);

    const split = Math.max(1, Math.floor(series.length / 2));
    const prevRows = series.slice(0, split);
    const prevSpend = prevRows.reduce((sum, row) => sum + row.spend, 0);
    const prevCv = prevRows.reduce((sum, row) => sum + row.cv, 0);
    const prevCpa = prevCv > 0 ? prevSpend / prevCv : 0;
    const prevRoas = prevSpend > 0 ? (prevCv * 10000) / prevSpend : 0;
    const prevImpressions = prevRows.reduce((sum, row) => sum + row.impressions, 0);
    const prevClicks = prevRows.reduce((sum, row) => sum + row.clicks, 0);
    const prevCtr = prevImpressions > 0 ? (prevClicks / prevImpressions) * 100 : 0;
    const prevCpc = prevClicks > 0 ? prevSpend / prevClicks : 0;

    return [
      {
        label: "総消化額",
        value: totalSpendWithFee,
        previous: prevSpend,
        type: "currency",
        inverted: true,
        subLabel: `媒体費: ${formatCurrency(totalSpend)} / ${feeLabel(settings.feeCalcMethod)}`,
      },
      { label: "総CV数", value: totalCv, previous: prevCv, type: "number" },
      { label: "平均CPA", value: avgCpa, previous: prevCpa, type: "currency", inverted: true },
      { label: "平均ROAS", value: avgRoas, previous: prevRoas, type: "roas" },
      { label: "表示回数", value: totalImpressions, previous: prevImpressions, type: "number" },
      { label: "クリック数", value: totalClicks, previous: prevClicks, type: "number" },
      { label: "CTR", value: totalCtr, previous: prevCtr, type: "percent" },
      { label: "CPC", value: avgCpc, previous: prevCpc, type: "currency", inverted: true },
    ] satisfies KpiMetric[];
  }, [projectRows, projects, daily, settings]);

  const trendRows = useMemo(() => {
    return daily
      .map((row) => {
        const spend = toNumber(row.spend);
        const impressions = toNumber(row.impressions);
        const clicks = toNumber(row.clicks);
        const cv = Number(row.cv) || 0;
        return {
          date: row.date_start,
          spend,
          cv,
          cpa: cv > 0 ? spend / cv : 0,
          impressions,
          clicks,
          ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
        } satisfies TrendRow;
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [daily]);

  const alerts = useMemo(() => {
    const generated = generateAlerts(
      projects.map((project) => ({
        name: project.name,
        spend: project.spend,
        cv: project.cv,
        cpa: project.cpa,
        ctr: project.ctr,
      })),
      daily.map((row) => ({
        date_start: row.date_start,
        spend: toNumber(row.spend),
        cv: Number(row.cv) || 0,
        impressions: toNumber(row.impressions),
        clicks: toNumber(row.clicks),
      })),
      creatives.map((row) => ({
        creative_name: row.creative_name,
        spend: row.spend,
        cv: row.cv,
        ctr: row.ctr,
      })),
      settings.budgets.map((row) => ({ projectName: row.projectName, monthlyBudget: row.monthlyBudget })),
      settings.alertThresholds,
    );
    return generated.map((row, idx) => ({
      id: `${row.type}-${idx}`,
      type: row.type,
      title: row.title,
      message: row.message,
      projectName: row.projectName,
    })) satisfies AlertItem[];
  }, [projects, daily, creatives, settings]);

  const averageCampaignCpa = useMemo(() => {
    if (campaignsData.length === 0) return undefined;
    const totalCv = campaignsData.reduce((sum, row) => sum + row.cv, 0);
    const totalSpend = campaignsData.reduce((sum, row) => sum + row.spend, 0);
    return totalCv > 0 ? totalSpend / totalCv : undefined;
  }, [campaignsData]);

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AlertBanner alerts={alerts} slackEnabled={settings.slack.enabled} />

      <section className="rounded-xl bg-white p-5 shadow-sm">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-bold text-navy">ダッシュボード</h2>
            <p className="mt-1 text-sm text-gray-500">集計期間: {formatDateRange(period)}</p>
          </div>
          <label className="text-sm text-gray-700">
            期間
            <select
              className="ml-2 rounded-lg border border-gray-200 bg-white px-3 py-2"
              value={period}
              onChange={(event) => setPeriod(event.target.value as Period)}
            >
              <option value="current_month">今月</option>
              <option value="last_30">過去30日</option>
            </select>
          </label>
        </div>
      </section>

      {setupMissing ? (
        <section className="rounded-xl border-2 border-dashed border-amber-300 bg-amber-50 p-6 text-center">
          <h3 className="text-lg font-semibold text-amber-800">初期設定が必要です</h3>
          <p className="mt-2 text-sm text-amber-700">広告データを表示するには、APIキーと案件の登録が必要です。</p>
          <div className="mt-4 flex justify-center gap-3">
            <Link
              href="/settings/api-keys"
              className="rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white hover:bg-blue-light"
            >
              APIキーを登録
            </Link>
            <Link
              href="/settings/clients"
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-navy hover:bg-gray-50"
            >
              案件を登録
            </Link>
          </div>
        </section>
      ) : (
        <>
          {error && <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}

          <BigKpiCards metrics={metrics} />
          <ClientTable rows={projectRows} />
          <CampaignSummaryTable campaigns={campaignsData} targetCpa={averageCampaignCpa} />
          <DailyTrendChart rows={trendRows} />
          <DeviceBreakdown data={deviceData} />
          <section className="space-y-6">
            <h3 className="text-lg font-semibold text-[#1a365d]">詳細分析</h3>
            <DemographicBreakdown data={demographicData} />
            <TimeHeatmap data={heatmapData} />
          </section>
        </>
      )}
    </div>
  );
}
