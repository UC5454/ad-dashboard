"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface CampaignDetail {
  campaign_id: string;
  campaign_name: string;
  impressions: string;
  clicks: string;
  spend: string;
  ctr: string;
  cpc: string;
  lp_views?: number;
  cv?: number;
  cpa?: number;
}

interface DailyPoint {
  date_start: string;
  spend: string;
  clicks: string;
  impressions: string;
  ctr: string;
  cv?: number;
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

function defaultDateRange() {
  const until = new Date();
  const since = new Date();
  since.setDate(until.getDate() - 29);
  const f = (d: Date) => d.toISOString().slice(0, 10);
  return { since: f(since), until: f(until) };
}

export default function CampaignDetailPage() {
  const params = useParams<{ campaignId: string }>();
  const searchParams = useSearchParams();
  const accountId = searchParams.get("accountId") || "";
  const campaignId = params.campaignId;

  const initialRange = useMemo(() => defaultDateRange(), []);
  const [since, setSince] = useState(initialRange.since);
  const [until, setUntil] = useState(initialRange.until);
  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const [dailyData, setDailyData] = useState<DailyPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!accountId || !campaignId) return;

    let mounted = true;

    const load = async () => {
      setLoading(true);
      setError("");

      try {
        const [campaignRes, dailyRes] = await Promise.all([
          fetch(`/api/meta/campaigns?account_id=${encodeURIComponent(accountId)}&date_preset=last_30d`),
          fetch(
            `/api/meta/campaign-daily?account_id=${encodeURIComponent(accountId)}&campaign_id=${encodeURIComponent(campaignId)}&since=${since}&until=${until}`,
          ),
        ]);

        if (!campaignRes.ok || !dailyRes.ok) {
          throw new Error("キャンペーン詳細の取得に失敗しました");
        }

        const campaigns = (await campaignRes.json()) as CampaignDetail[];
        const daily = (await dailyRes.json()) as DailyPoint[];

        if (!mounted) return;

        setCampaign(campaigns.find((item) => item.campaign_id === campaignId) || null);
        setDailyData(Array.isArray(daily) ? daily : []);
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "データ取得エラー");
          setCampaign(null);
          setDailyData([]);
        }
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
  }, [accountId, campaignId, since, until]);

  if (!accountId) {
    return <p className="text-sm text-red-600">accountId が指定されていません</p>;
  }

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#2C5282] border-t-transparent" />
      </div>
    );
  }

  const spend = Number.parseFloat(campaign?.spend || "0") || 0;
  const impressions = Number.parseFloat(campaign?.impressions || "0") || 0;
  const clicks = Number.parseFloat(campaign?.clicks || "0") || 0;
  const ctr = Number.parseFloat(campaign?.ctr || "0") || 0;
  const cpc = Number.parseFloat(campaign?.cpc || "0") || 0;
  const cv = campaign?.cv || 0;
  const cpa = campaign?.cpa || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/dashboard" className="text-sm text-[#2C5282] hover:underline">
            ← ダッシュボードへ戻る
          </Link>
          <h2 className="mt-2 text-2xl font-bold text-[#1B2A4A]">{campaign?.campaign_name || "キャンペーン詳細"}</h2>
        </div>
        <div className="flex gap-3">
          <label className="text-sm text-gray-700">
            開始日
            <input
              type="date"
              value={since}
              onChange={(event) => setSince(event.target.value)}
              className="mt-1 rounded-lg border border-gray-200 bg-white px-3 py-2"
            />
          </label>
          <label className="text-sm text-gray-700">
            終了日
            <input
              type="date"
              value={until}
              onChange={(event) => setUntil(event.target.value)}
              className="mt-1 rounded-lg border border-gray-200 bg-white px-3 py-2"
            />
          </label>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">消化額</p>
          <p className="mt-2 text-xl font-bold text-[#1B2A4A] tabular-nums">{formatCurrency(spend)}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">IMP</p>
          <p className="mt-2 text-xl font-bold text-[#1B2A4A] tabular-nums">{formatNumber(impressions)}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">クリック</p>
          <p className="mt-2 text-xl font-bold text-[#1B2A4A] tabular-nums">{formatNumber(clicks)}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">CTR</p>
          <p className="mt-2 text-xl font-bold text-[#1B2A4A] tabular-nums">{formatPercent(ctr)}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">CPC</p>
          <p className="mt-2 text-xl font-bold text-[#1B2A4A] tabular-nums">{formatCurrency(cpc)}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">CV</p>
          <p className="mt-2 text-xl font-bold text-[#1B2A4A] tabular-nums">{formatNumber(cv)}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">CPA</p>
          <p className="mt-2 text-xl font-bold text-[#1B2A4A] tabular-nums">{cv > 0 ? formatCurrency(cpa) : "-"}</p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-base font-semibold text-[#1B2A4A]">日次推移（消化額 / クリック）</h3>
        <ResponsiveContainer width="100%" height={360}>
          <LineChart data={dailyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis dataKey="date_start" tick={{ fontSize: 12, fill: "#64748B" }} />
            <YAxis
              yAxisId="left"
              tickFormatter={(value: number | undefined) => `¥${Math.round(value ?? 0).toLocaleString("ja-JP")}`}
              tick={{ fontSize: 12, fill: "#64748B" }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tickFormatter={(value: number | undefined) => Math.round(value ?? 0).toLocaleString("ja-JP")}
              tick={{ fontSize: 12, fill: "#64748B" }}
            />
            <Tooltip
              formatter={(value: number | string | undefined, name?: string) => {
                const numeric = Number.parseFloat(String(value || 0)) || 0;
                if (name === "spend") return [formatCurrency(numeric), "消化額"];
                return [formatNumber(numeric), "クリック"];
              }}
            />
            <Legend
              formatter={(value) => {
                if (value === "spend") return "消化額";
                if (value === "clicks") return "クリック";
                return value;
              }}
            />
            <Line yAxisId="left" dataKey="spend" type="monotone" stroke="#2C5282" strokeWidth={2} dot={false} />
            <Line yAxisId="right" dataKey="clicks" type="monotone" stroke="#3B82F6" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
