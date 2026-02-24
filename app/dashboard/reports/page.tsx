"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MetaAccount, MetaCampaignInsights, MetaInsights } from "@/types/meta";

interface DailyRow extends MetaInsights {
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

function monthRange(value: string): { since: string; until: string } {
  const [year, month] = value.split("-").map((v) => Number(v));
  const since = new Date(year, month - 1, 1);
  const until = new Date(year, month, 0);
  const ymd = (d: Date) => d.toISOString().slice(0, 10);
  return { since: ymd(since), until: ymd(until) };
}

function downloadCSV(filename: string, rows: string[][]) {
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

async function loadExternalModule(moduleName: string): Promise<unknown> {
  const importer = new Function("name", "return import(name);") as (name: string) => Promise<unknown>;
  return importer(moduleName);
}

export default function ReportsPage() {
  const now = new Date();
  const initialMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [accounts, setAccounts] = useState<MetaAccount[]>([]);
  const [accountId, setAccountId] = useState("");
  const [period, setPeriod] = useState(initialMonth);
  const [campaigns, setCampaigns] = useState<MetaCampaignInsights[]>([]);
  const [daily, setDaily] = useState<DailyRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [bootLoading, setBootLoading] = useState(false);
  const [error, setError] = useState("");

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === accountId) || null,
    [accounts, accountId],
  );

  useEffect(() => {
    let mounted = true;
    const loadAccounts = async () => {
      setBootLoading(true);
      try {
        const res = await fetch("/api/meta/accounts");
        if (!res.ok) throw new Error("アカウント取得に失敗しました");
        const data = (await res.json()) as MetaAccount[];
        if (!mounted) return;
        setAccounts(data);
        if (data.length > 0) setAccountId(data[0].id);
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "データ取得エラー");
        }
      } finally {
        if (mounted) setBootLoading(false);
      }
    };
    void loadAccounts();
    return () => {
      mounted = false;
    };
  }, []);

  const summary = useMemo(() => {
    return campaigns.reduce(
      (acc, row) => {
        const spend = Number.parseFloat(row.spend || "0") || 0;
        const impressions = Number.parseFloat(row.impressions || "0") || 0;
        const clicks = Number.parseFloat(row.clicks || "0") || 0;
        const cv = row.actions?.find((a) => a.action_type === "offsite_conversion.fb_pixel_custom")?.value || "0";

        acc.spend += spend;
        acc.impressions += impressions;
        acc.clicks += clicks;
        acc.cv += Number.parseFloat(cv) || 0;
        return acc;
      },
      { spend: 0, impressions: 0, clicks: 0, cv: 0 },
    );
  }, [campaigns]);

  const ctr = summary.impressions > 0 ? (summary.clicks / summary.impressions) * 100 : 0;
  const cpa = summary.cv > 0 ? summary.spend / summary.cv : 0;

  const onLoadReport = async () => {
    if (!accountId) return;

    const range = monthRange(period);
    setLoading(true);
    setError("");
    try {
      const [campaignsRes, dailyRes] = await Promise.all([
        fetch(`/api/meta/campaigns?account_id=${encodeURIComponent(accountId)}&date_preset=last_30d`),
        fetch(`/api/meta/daily?account_id=${encodeURIComponent(accountId)}&since=${range.since}&until=${range.until}`),
      ]);

      if (!campaignsRes.ok || !dailyRes.ok) {
        throw new Error("レポートデータの取得に失敗しました");
      }

      const [campaignRows, dailyRows] = await Promise.all([
        campaignsRes.json() as Promise<MetaCampaignInsights[]>,
        dailyRes.json() as Promise<DailyRow[]>,
      ]);

      setCampaigns(Array.isArray(campaignRows) ? campaignRows : []);
      setDaily(Array.isArray(dailyRows) ? dailyRows : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "レポート取得エラー");
      setCampaigns([]);
      setDaily([]);
    } finally {
      setLoading(false);
    }
  };

  const onDownloadPdf = async () => {
    const preview = document.getElementById("report-preview");
    if (!preview) return;

    let jsPDFCtor: any;
    let html2canvasFn: any;
    try {
      const [jspdfModule, html2canvasModule] = await Promise.all([
        loadExternalModule("jspdf"),
        loadExternalModule("html2canvas"),
      ]);
      jsPDFCtor = (jspdfModule as { default?: any }).default;
      html2canvasFn = (html2canvasModule as { default?: any }).default;
    } catch {
      setError("PDFライブラリの読み込みに失敗しました。依存関係をインストールしてください。");
      return;
    }

    const canvas = await html2canvasFn(preview, { scale: 2 });
    const imageData = canvas.toDataURL("image/png");
    const pdf = new jsPDFCtor("p", "mm", "a4");
    const width = pdf.internal.pageSize.getWidth();
    const height = (canvas.height * width) / canvas.width;

    pdf.addImage(imageData, "PNG", 0, 0, width, height);
    pdf.save(`meta_report_${period}.pdf`);
  };

  const onDownloadCsv = () => {
    const rows: string[][] = [["日付", "消化額", "IMP", "クリック", "CTR", "CV"]];
    daily.forEach((row) => {
      const spend = Number.parseFloat(row.spend || "0") || 0;
      const impressions = Number.parseFloat(row.impressions || "0") || 0;
      const clicks = Number.parseFloat(row.clicks || "0") || 0;
      const ctr = Number.parseFloat(row.ctr || "0") || 0;
      const cv = row.cv || 0;
      rows.push([
        row.date_start,
        String(Math.round(spend)),
        String(Math.round(impressions)),
        String(Math.round(clicks)),
        ctr.toFixed(1),
        String(Math.round(cv)),
      ]);
    });
    rows.push([]);
    rows.push(["キャンペーン", "消化額", "IMP", "クリック", "CTR", "CV"]);
    campaigns.forEach((row) => {
      const cv = row.actions?.find((a) => a.action_type === "offsite_conversion.fb_pixel_custom")?.value || "0";
      rows.push([row.campaign_name, row.spend, row.impressions, row.clicks, row.ctr, cv]);
    });

    downloadCSV(`meta_report_${period}.csv`, rows);
  };

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-bold text-navy">レポート生成</h2>
        <p className="mt-1 text-sm text-gray-500">月次レポートをPDF/CSVで出力します</p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="text-sm text-gray-700">
            アカウント
            <select
              value={accountId}
              onChange={(event) => setAccountId(event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2"
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-gray-700">
            対象月
            <input
              type="month"
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2"
            />
          </label>
          <div className="flex items-end">
            <button
              type="button"
              onClick={onLoadReport}
              className="w-full rounded-lg bg-blue px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-light"
            >
              レポートデータ読込
            </button>
          </div>
        </div>

        {(bootLoading || loading) && (
          <div className="mt-4 flex items-center gap-2 text-sm text-gray-600">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue border-t-transparent" />
            読み込み中...
          </div>
        )}

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </section>

      <section id="report-preview" className="space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <header>
          <h3 className="text-xl font-bold text-navy">Meta Ads 月次レポート</h3>
          <p className="mt-1 text-sm text-gray-500">
            {selectedAccount?.name || "未選択"} / {period}
          </p>
        </header>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="rounded-lg bg-gray-50 p-4">
            <p className="text-xs text-gray-500">消化額</p>
            <p className="mt-1 text-lg font-semibold text-navy tabular-nums">{formatCurrency(summary.spend)}</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-4">
            <p className="text-xs text-gray-500">IMP</p>
            <p className="mt-1 text-lg font-semibold text-navy tabular-nums">{formatNumber(summary.impressions)}</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-4">
            <p className="text-xs text-gray-500">CV</p>
            <p className="mt-1 text-lg font-semibold text-navy tabular-nums">{formatNumber(summary.cv)}</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-4">
            <p className="text-xs text-gray-500">CPA</p>
            <p className="mt-1 text-lg font-semibold text-navy tabular-nums">{summary.cv > 0 ? formatCurrency(cpa) : "-"}</p>
          </div>
        </div>

        <div className="h-72 rounded-lg border border-gray-200 p-3">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={daily}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="date_start" tick={{ fill: "#64748B", fontSize: 12 }} />
              <YAxis
                yAxisId="left"
                tick={{ fill: "#64748B", fontSize: 12 }}
                tickFormatter={(v: number) => `¥${Math.round(v).toLocaleString("ja-JP")}`}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fill: "#64748B", fontSize: 12 }}
                tickFormatter={(v: number) => Math.round(v).toLocaleString("ja-JP")}
              />
              <Tooltip
                formatter={(value: number | string | undefined, name?: string) => {
                  const num = Number.parseFloat(String(value ?? 0)) || 0;
                  if (name === "spend") return [formatCurrency(num), "消化額"];
                  return [formatNumber(num), "CV"];
                }}
              />
              <Line yAxisId="left" dataKey="spend" stroke="#2C5282" strokeWidth={2} dot={false} />
              <Line yAxisId="right" dataKey="cv" stroke="#059669" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left font-medium">キャンペーン</th>
                <th className="px-3 py-2 text-left font-medium">消化額</th>
                <th className="px-3 py-2 text-left font-medium">IMP</th>
                <th className="px-3 py-2 text-left font-medium">クリック</th>
                <th className="px-3 py-2 text-left font-medium">CTR</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((campaign, index) => (
                <tr key={campaign.campaign_id} className={index % 2 === 0 ? "bg-white" : "bg-gray-50/60"}>
                  <td className="px-3 py-2 font-medium text-navy">{campaign.campaign_name}</td>
                  <td className="px-3 py-2 tabular-nums">{formatCurrency(Number.parseFloat(campaign.spend || "0") || 0)}</td>
                  <td className="px-3 py-2 tabular-nums">{formatNumber(Number.parseFloat(campaign.impressions || "0") || 0)}</td>
                  <td className="px-3 py-2 tabular-nums">{formatNumber(Number.parseFloat(campaign.clicks || "0") || 0)}</td>
                  <td className="px-3 py-2 tabular-nums">{formatPercent(Number.parseFloat(campaign.ctr || "0") || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-gray-500">全体CTR: {formatPercent(ctr)}</p>
      </section>

      <section className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onDownloadPdf}
          className="rounded-lg bg-blue px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-light"
        >
          PDF ダウンロード
        </button>
        <button
          type="button"
          onClick={onDownloadCsv}
          className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          CSV ダウンロード
        </button>
      </section>
    </div>
  );
}
