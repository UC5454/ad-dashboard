"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface PlatformMetric {
  platform: string;
  total_cost: number;
  total_impressions: number;
  total_clicks: number;
  total_conversions: number;
  total_conversion_value: number;
  avg_ctr: number;
  avg_cpc: number;
  avg_cpa: number;
  avg_roas: number;
}

interface Campaign {
  campaign_name: string;
  platform: string;
  cost: number;
  conversions: number;
  cpa: number;
  roas: number;
  ctr: number;
}

interface ClientDetail {
  id: string;
  name: string;
  status: string;
  google_ads_account_id: string | null;
  meta_ads_account_id: string | null;
  monthly_budget_google: number;
  monthly_budget_meta: number;
}

interface ReportData {
  client: ClientDetail;
  period: string;
  platformSummary: PlatformMetric[];
  dailyTrend: { date: string; cost: number; conversions: number; cpa: number }[];
  campaigns: Campaign[];
}

function fmt(v: number): string {
  return `¥${Math.round(v).toLocaleString()}`;
}

function PlatformBadge({ platform }: { platform: string }) {
  const isGoogle = platform === "google";
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
        isGoogle ? "bg-blue-100 text-blue-700" : "bg-indigo-100 text-indigo-700"
      }`}
    >
      {isGoogle ? "Google" : "Meta"}
    </span>
  );
}

export default function ClientDetailPage() {
  const params = useParams();
  const clientId = params.clientId as string;
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  useEffect(() => {
    setLoading(true);
    fetch(`/api/reports?clientId=${clientId}&period=${period}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [clientId, period]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue border-t-transparent" />
      </div>
    );
  }

  if (!data || !data.client) {
    return <p className="text-center text-gray-500">クライアントが見つかりません</p>;
  }

  const { client, platformSummary, dailyTrend, campaigns } = data;
  const totalBudget = client.monthly_budget_google + client.monthly_budget_meta;
  const totalCost = platformSummary.reduce((s, p) => s + p.total_cost, 0);
  const totalCV = platformSummary.reduce((s, p) => s + p.total_conversions, 0);

  return (
    <div className="space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/dashboard" className="hover:text-blue">ダッシュボード</Link>
        <span>/</span>
        <span className="text-navy font-medium">{client.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-navy">{client.name}</h2>
          <p className="mt-1 text-sm text-gray-500">
            月間予算: {totalBudget > 0 ? fmt(totalBudget) : "未設定"} | 消化額: {fmt(totalCost)} | CV: {totalCV}
          </p>
        </div>
        <input
          type="month"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue focus:outline-none"
        />
      </div>

      {/* Platform Summary */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {platformSummary.map((p) => (
          <div key={p.platform} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <PlatformBadge platform={p.platform} />
              <span className="text-sm font-medium text-gray-700">
                {p.platform === "google" ? "Google Ads" : "Meta Ads"}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "消化額", value: fmt(p.total_cost) },
                { label: "CV", value: p.total_conversions.toLocaleString() },
                { label: "CPA", value: p.avg_cpa > 0 ? fmt(p.avg_cpa) : "--" },
                { label: "ROAS", value: p.avg_roas > 0 ? `${p.avg_roas.toFixed(2)}x` : "--" },
                { label: "CTR", value: p.avg_ctr > 0 ? `${p.avg_ctr.toFixed(2)}%` : "--" },
                { label: "CPC", value: p.avg_cpc > 0 ? fmt(p.avg_cpc) : "--" },
              ].map((m) => (
                <div key={m.label}>
                  <p className="text-xs text-gray-500">{m.label}</p>
                  <p className="text-lg font-semibold text-navy">{m.value}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
        {platformSummary.length === 0 && (
          <div className="col-span-2 rounded-xl border border-gray-200 bg-white p-8 text-center text-gray-400">
            この期間のデータがありません
          </div>
        )}
      </div>

      {/* Daily Trend */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-base font-semibold text-navy">日別推移</h3>
        {dailyTrend.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={dailyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="date" tickFormatter={(d: string) => d.slice(5)} tick={{ fontSize: 12 }} />
              <YAxis yAxisId="left" tickFormatter={(v: number) => fmt(v)} tick={{ fontSize: 12 }} width={80} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} width={40} />
              <Tooltip formatter={(v: number, name: string) => [name === "conversions" ? v : fmt(v), name === "cost" ? "消化額" : name === "conversions" ? "CV" : "CPA"]} />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="cost" stroke="#2C5282" strokeWidth={2} name="消化額" dot={false} />
              <Line yAxisId="right" type="monotone" dataKey="conversions" stroke="#38A169" strokeWidth={2} name="CV" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-48 items-center justify-center text-gray-400">データなし</div>
        )}
      </div>

      {/* Campaign Breakdown */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <h3 className="text-base font-semibold text-navy">キャンペーン別</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                <th className="px-4 py-3">キャンペーン</th>
                <th className="px-4 py-3">媒体</th>
                <th className="px-4 py-3">消化額</th>
                <th className="px-4 py-3">CV</th>
                <th className="px-4 py-3">CPA</th>
                <th className="px-4 py-3">ROAS</th>
                <th className="px-4 py-3">CTR</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {campaigns.map((c, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{c.campaign_name}</td>
                  <td className="px-4 py-3"><PlatformBadge platform={c.platform} /></td>
                  <td className="px-4 py-3">{fmt(c.cost)}</td>
                  <td className="px-4 py-3">{c.conversions}</td>
                  <td className="px-4 py-3">{c.cpa > 0 ? fmt(c.cpa) : "--"}</td>
                  <td className="px-4 py-3">{c.roas > 0 ? `${c.roas.toFixed(2)}x` : "--"}</td>
                  <td className="px-4 py-3">{c.ctr > 0 ? `${c.ctr.toFixed(2)}%` : "--"}</td>
                </tr>
              ))}
              {campaigns.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">キャンペーンデータなし</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
