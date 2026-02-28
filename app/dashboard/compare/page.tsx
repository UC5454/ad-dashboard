"use client";

import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { apiFetch } from "@/lib/api-client";

interface CampaignRow {
  campaign_name: string;
  spend: string;
  impressions: string;
  clicks: string;
  cv: number;
  cpa: number;
}

type Period = "current_month" | "last_30";

type Platform = "Google Ads" | "Meta Ads";

interface Totals {
  platform: Platform;
  spend: number;
  cv: number;
  cpa: number;
  roas: number;
  ctr: number;
}

function toNumber(value: string | number | null | undefined): number {
  return Number.parseFloat(String(value ?? "0")) || 0;
}

function formatCurrency(value: number): string {
  return `¥${Math.round(value).toLocaleString("ja-JP")}`;
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function inferPlatform(name: string): Platform {
  const lower = name.toLowerCase();
  if (lower.includes("google") || lower.includes("gdn") || lower.includes("yt") || lower.includes("youtube")) {
    return "Google Ads";
  }
  return "Meta Ads";
}

export default function ComparePage() {
  const [period, setPeriod] = useState<Period>("last_30");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rows, setRows] = useState<CampaignRow[]>([]);

  useEffect(() => {
    let mounted = true;
    const datePreset = period === "current_month" ? "this_month" : "last_30d";

    const run = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await apiFetch(`/api/meta/campaigns?date_preset=${datePreset}`);
        if (!res.ok) throw new Error("媒体比較データの取得に失敗しました");
        const data = (await res.json()) as CampaignRow[];
        if (!mounted) return;
        setRows(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "データ取得エラー");
        setRows([]);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void run();
    return () => {
      mounted = false;
    };
  }, [period]);

  const totals = useMemo(() => {
    const initial: Record<Platform, Totals> = {
      "Google Ads": { platform: "Google Ads", spend: 0, cv: 0, cpa: 0, roas: 0, ctr: 0 },
      "Meta Ads": { platform: "Meta Ads", spend: 0, cv: 0, cpa: 0, roas: 0, ctr: 0 },
    };
    const clickMap: Record<Platform, number> = { "Google Ads": 0, "Meta Ads": 0 };
    const impMap: Record<Platform, number> = { "Google Ads": 0, "Meta Ads": 0 };

    rows.forEach((row) => {
      const platform = inferPlatform(row.campaign_name || "");
      const spend = toNumber(row.spend);
      const cv = toNumber(row.cv);
      const clicks = toNumber(row.clicks);
      const impressions = toNumber(row.impressions);

      initial[platform].spend += spend;
      initial[platform].cv += cv;
      clickMap[platform] += clicks;
      impMap[platform] += impressions;
    });

    (Object.keys(initial) as Platform[]).forEach((platform) => {
      const t = initial[platform];
      t.cpa = t.cv > 0 ? t.spend / t.cv : 0;
      t.roas = t.spend > 0 ? (t.cv * 10000) / t.spend : 0;
      t.ctr = impMap[platform] > 0 ? (clickMap[platform] / impMap[platform]) * 100 : 0;
    });

    return [initial["Google Ads"], initial["Meta Ads"]];
  }, [rows]);

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl bg-white p-5 shadow-sm">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-bold text-navy">媒体比較</h2>
            <p className="mt-1 text-sm text-gray-500">Google Ads と Meta Ads の横断比較</p>
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

      {error && <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {totals.map((row) => (
          <article key={row.platform} className="rounded-xl bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-navy">{row.platform}</h3>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <p className="text-gray-500">消化額</p>
              <p className="text-right tabular-nums font-medium text-navy">{formatCurrency(row.spend)}</p>
              <p className="text-gray-500">CV</p>
              <p className="text-right tabular-nums font-medium text-navy">{Math.round(row.cv).toLocaleString("ja-JP")}</p>
              <p className="text-gray-500">CPA</p>
              <p className="text-right tabular-nums font-medium text-navy">{row.cv > 0 ? formatCurrency(row.cpa) : "-"}</p>
              <p className="text-gray-500">ROAS</p>
              <p className="text-right tabular-nums font-medium text-navy">{row.roas.toFixed(2)}x</p>
              <p className="text-gray-500">CTR</p>
              <p className="text-right tabular-nums font-medium text-navy">{formatPercent(row.ctr)}</p>
            </div>
          </article>
        ))}
      </section>

      <section className="rounded-xl bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-base font-semibold text-navy">媒体別比較チャート</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={totals}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis dataKey="platform" />
            <YAxis tickFormatter={(v) => `¥${Math.round(v).toLocaleString("ja-JP")}`} />
            <Tooltip formatter={(value: number | string | undefined) => [formatCurrency(Number(value || 0)), "消化額"]} />
            <Bar dataKey="spend" fill="#2C5282" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </section>

      <section className="overflow-hidden rounded-xl bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500">
            <tr>
              <th className="px-4 py-3 text-left font-medium">指標</th>
              <th className="px-4 py-3 text-left font-medium">Google Ads</th>
              <th className="px-4 py-3 text-left font-medium">Meta Ads</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-gray-100"><td className="px-4 py-3">消化額</td><td className="px-4 py-3">{formatCurrency(totals[0].spend)}</td><td className="px-4 py-3">{formatCurrency(totals[1].spend)}</td></tr>
            <tr className="border-t border-gray-100"><td className="px-4 py-3">CV</td><td className="px-4 py-3">{Math.round(totals[0].cv).toLocaleString("ja-JP")}</td><td className="px-4 py-3">{Math.round(totals[1].cv).toLocaleString("ja-JP")}</td></tr>
            <tr className="border-t border-gray-100"><td className="px-4 py-3">CPA</td><td className="px-4 py-3">{totals[0].cv > 0 ? formatCurrency(totals[0].cpa) : "-"}</td><td className="px-4 py-3">{totals[1].cv > 0 ? formatCurrency(totals[1].cpa) : "-"}</td></tr>
            <tr className="border-t border-gray-100"><td className="px-4 py-3">ROAS</td><td className="px-4 py-3">{totals[0].roas.toFixed(2)}x</td><td className="px-4 py-3">{totals[1].roas.toFixed(2)}x</td></tr>
            <tr className="border-t border-gray-100"><td className="px-4 py-3">CTR</td><td className="px-4 py-3">{formatPercent(totals[0].ctr)}</td><td className="px-4 py-3">{formatPercent(totals[1].ctr)}</td></tr>
          </tbody>
        </table>
      </section>
    </div>
  );
}
