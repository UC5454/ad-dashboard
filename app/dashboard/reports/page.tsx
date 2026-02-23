"use client";

import { useEffect, useMemo, useState } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface Client {
  id: string;
  name: string;
}

interface PlatformSummary {
  platform: string;
  total_cost: number;
  total_conversions: number;
  total_conversion_value: number;
  avg_cpa: number;
  avg_roas: number;
}

interface DailyTrend {
  date: string;
  cost: number;
  conversions: number;
  cpa: number;
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

interface ReportData {
  client: { id: string; name: string };
  period: string;
  platformSummary: PlatformSummary[];
  dailyTrend: DailyTrend[];
  campaigns: Campaign[];
}

function currentMonthValue(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function fmtCurrency(value: number): string {
  return `¥${Math.round(value).toLocaleString("ja-JP")}`;
}

function fmtPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function fmtRoas(value: number): string {
  return `${value.toFixed(2)}x`;
}

export default function ReportsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState("");
  const [period, setPeriod] = useState(currentMonthValue);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    const loadClients = async () => {
      const res = await fetch("/api/clients");
      const data = (await res.json()) as Client[];
      if (mounted) {
        setClients(Array.isArray(data) ? data : []);
        if (Array.isArray(data) && data.length > 0) {
          setClientId(data[0].id);
        }
      }
    };

    void loadClients();

    return () => {
      mounted = false;
    };
  }, []);

  const summary = useMemo(() => {
    if (!reportData) return null;
    const totalCost = reportData.platformSummary.reduce((sum, p) => sum + p.total_cost, 0);
    const totalCv = reportData.platformSummary.reduce((sum, p) => sum + p.total_conversions, 0);
    const totalValue = reportData.platformSummary.reduce(
      (sum, p) => sum + p.total_conversion_value,
      0
    );
    return {
      totalCost,
      totalCv,
      cpa: totalCv > 0 ? totalCost / totalCv : 0,
      roas: totalCost > 0 ? totalValue / totalCost : 0,
    };
  }, [reportData]);

  const handleLoadReport = async () => {
    if (!clientId || !period) return;

    setLoading(true);
    setError("");

    const res = await fetch(`/api/reports?clientId=${clientId}&period=${period}`);
    if (!res.ok) {
      setLoading(false);
      setError("レポートデータの取得に失敗しました");
      return;
    }

    const data = (await res.json()) as ReportData;
    setReportData(data);
    setLoading(false);
  };

  const handleDownloadPdf = async () => {
    const el = document.getElementById("report-preview");
    if (!el || !reportData) return;

    setPdfLoading(true);

    try {
      const canvas = await html2canvas(el, { scale: 2 });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const width = pdf.internal.pageSize.getWidth();
      const height = (canvas.height * width) / canvas.width;
      pdf.addImage(imgData, "PNG", 0, 0, width, height);
      pdf.save(`report_${period}.pdf`);

      await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, period }),
      });
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-navy">レポート生成</h2>
        <p className="mt-1 text-sm text-gray-500">クライアント別の月次レポートを作成します</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-200 flex flex-wrap items-end gap-4">
        <label className="text-sm text-gray-700">
          クライアント
          <select
            className="ml-2 rounded-lg border border-gray-200 px-3 py-2 text-sm"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
          >
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm text-gray-700">
          期間
          <input
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="ml-2 rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
        </label>

        <button
          type="button"
          onClick={handleLoadReport}
          disabled={loading || !clientId}
          className="bg-blue text-white rounded-lg px-4 py-2.5 hover:bg-blue-light disabled:opacity-60"
        >
          {loading ? "読込中..." : "レポートデータ読込"}
        </button>

        <button
          type="button"
          onClick={handleDownloadPdf}
          disabled={!reportData || pdfLoading}
          className="border border-gray-200 bg-white rounded-lg px-4 py-2.5 hover:bg-gray-50 disabled:opacity-60"
        >
          {pdfLoading ? "出力中..." : "PDF ダウンロード"}
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {reportData && summary && (
        <section id="report-preview" className="space-y-6 bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div>
            <h3 className="text-xl font-bold text-navy">{reportData.client.name} 月次レポート</h3>
            <p className="text-sm text-gray-500">対象期間: {reportData.period}</p>
          </div>

          <div>
            <h4 className="mb-2 text-base font-semibold text-navy">エグゼクティブサマリー</h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-gray-200 p-3"><p className="text-xs text-gray-500">消化額</p><p className="text-lg font-semibold text-navy">{fmtCurrency(summary.totalCost)}</p></div>
              <div className="rounded-lg border border-gray-200 p-3"><p className="text-xs text-gray-500">CV</p><p className="text-lg font-semibold text-navy">{summary.totalCv.toLocaleString("ja-JP")}</p></div>
              <div className="rounded-lg border border-gray-200 p-3"><p className="text-xs text-gray-500">CPA</p><p className="text-lg font-semibold text-navy">{fmtCurrency(summary.cpa)}</p></div>
              <div className="rounded-lg border border-gray-200 p-3"><p className="text-xs text-gray-500">ROAS</p><p className="text-lg font-semibold text-navy">{fmtRoas(summary.roas)}</p></div>
            </div>
          </div>

          <div>
            <h4 className="mb-2 text-base font-semibold text-navy">媒体別サマリー</h4>
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500">
                  <tr>
                    <th className="px-3 py-2 text-left">媒体</th>
                    <th className="px-3 py-2 text-right">消化額</th>
                    <th className="px-3 py-2 text-right">CV</th>
                    <th className="px-3 py-2 text-right">CPA</th>
                    <th className="px-3 py-2 text-right">ROAS</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.platformSummary.map((row) => (
                    <tr key={row.platform} className="border-t border-gray-100">
                      <td className="px-3 py-2">{row.platform === "google" ? "Google Ads" : "Meta Ads"}</td>
                      <td className="px-3 py-2 text-right">{fmtCurrency(row.total_cost)}</td>
                      <td className="px-3 py-2 text-right">{row.total_conversions.toLocaleString("ja-JP")}</td>
                      <td className="px-3 py-2 text-right">{fmtCurrency(row.avg_cpa)}</td>
                      <td className="px-3 py-2 text-right">{fmtRoas(row.avg_roas)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h4 className="mb-2 text-base font-semibold text-navy">日別推移</h4>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={reportData.dailyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="date" tick={{ fill: "#64748B", fontSize: 12 }} />
                <YAxis tick={{ fill: "#64748B", fontSize: 12 }} />
                <Tooltip formatter={(value: number | undefined, name: string | undefined) => {
                  const numericValue = value ?? 0;
                  if (name === "cost" || name === "cpa") return fmtCurrency(numericValue);
                  if (name === "conversions") return numericValue.toLocaleString("ja-JP");
                  return numericValue.toLocaleString("ja-JP");
                }} />
                <Line type="monotone" dataKey="cost" stroke="#2C5282" strokeWidth={2} name="cost" dot={false} />
                <Line type="monotone" dataKey="conversions" stroke="#059669" strokeWidth={2} name="conversions" dot={false} />
                <Line type="monotone" dataKey="cpa" stroke="#D97706" strokeWidth={2} name="cpa" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div>
            <h4 className="mb-2 text-base font-semibold text-navy">キャンペーン別</h4>
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500">
                  <tr>
                    <th className="px-3 py-2 text-left">キャンペーン名</th>
                    <th className="px-3 py-2 text-left">媒体</th>
                    <th className="px-3 py-2 text-right">消化額</th>
                    <th className="px-3 py-2 text-right">CV</th>
                    <th className="px-3 py-2 text-right">CPA</th>
                    <th className="px-3 py-2 text-right">ROAS</th>
                    <th className="px-3 py-2 text-right">CTR</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.campaigns.map((campaign, idx) => (
                    <tr key={`${campaign.campaign_name}-${idx}`} className="border-t border-gray-100">
                      <td className="px-3 py-2">{campaign.campaign_name}</td>
                      <td className="px-3 py-2">{campaign.platform === "google" ? "Google Ads" : "Meta Ads"}</td>
                      <td className="px-3 py-2 text-right">{fmtCurrency(campaign.cost)}</td>
                      <td className="px-3 py-2 text-right">{campaign.conversions.toLocaleString("ja-JP")}</td>
                      <td className="px-3 py-2 text-right">{fmtCurrency(campaign.cpa)}</td>
                      <td className="px-3 py-2 text-right">{fmtRoas(campaign.roas)}</td>
                      <td className="px-3 py-2 text-right">{fmtPercent(campaign.ctr)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
