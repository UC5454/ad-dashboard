"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
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
  platform: "google" | "meta";
  total_cost: number;
  total_conversions: number;
  total_conversion_value: number;
}

interface ReportResponse {
  platformSummary: PlatformSummary[];
}

interface ClientPlatformData {
  clientId: string;
  clientName: string;
  googleCost: number;
  metaCost: number;
  googleCv: number;
  metaCv: number;
  googleValue: number;
  metaValue: number;
}

function currentMonthValue(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function fmtCurrency(value: number): string {
  return `¥${Math.round(value).toLocaleString("ja-JP")}`;
}

function fmtRoas(value: number): string {
  return `${value.toFixed(2)}x`;
}

export default function ComparePage() {
  const [period, setPeriod] = useState<string>(currentMonthValue);
  const [rows, setRows] = useState<ClientPlatformData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const clientsRes = await fetch("/api/clients");
        if (!clientsRes.ok) throw new Error("クライアント取得に失敗しました");
        const clients = (await clientsRes.json()) as Client[];

        const reportResponses = await Promise.all(
          clients.map(async (client) => {
            const res = await fetch(
              `/api/reports?clientId=${client.id}&period=${period}`
            );
            if (!res.ok) {
              return {
                client,
                platformSummary: [],
              };
            }
            const report = (await res.json()) as ReportResponse;
            return {
              client,
              platformSummary: report.platformSummary || [],
            };
          })
        );

        const nextRows = reportResponses.map(({ client, platformSummary }) => {
          const google = platformSummary.find((s) => s.platform === "google");
          const meta = platformSummary.find((s) => s.platform === "meta");

          return {
            clientId: client.id,
            clientName: client.name,
            googleCost: google?.total_cost || 0,
            metaCost: meta?.total_cost || 0,
            googleCv: google?.total_conversions || 0,
            metaCv: meta?.total_conversions || 0,
            googleValue: google?.total_conversion_value || 0,
            metaValue: meta?.total_conversion_value || 0,
          };
        });

        if (mounted) {
          setRows(nextRows);
        }
      } catch (e) {
        if (mounted) {
          setError(e instanceof Error ? e.message : "データ取得に失敗しました");
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
  }, [period]);

  const totals = useMemo(() => {
    const googleCost = rows.reduce((sum, row) => sum + row.googleCost, 0);
    const metaCost = rows.reduce((sum, row) => sum + row.metaCost, 0);
    const googleCv = rows.reduce((sum, row) => sum + row.googleCv, 0);
    const metaCv = rows.reduce((sum, row) => sum + row.metaCv, 0);
    const googleValue = rows.reduce((sum, row) => sum + row.googleValue, 0);
    const metaValue = rows.reduce((sum, row) => sum + row.metaValue, 0);

    return {
      google: {
        cost: googleCost,
        cv: googleCv,
        cpa: googleCv > 0 ? googleCost / googleCv : 0,
        roas: googleCost > 0 ? googleValue / googleCost : 0,
      },
      meta: {
        cost: metaCost,
        cv: metaCv,
        cpa: metaCv > 0 ? metaCost / metaCv : 0,
        roas: metaCost > 0 ? metaValue / metaCost : 0,
      },
    };
  }, [rows]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-bold text-navy">媒体比較</h2>
          <p className="mt-1 text-sm text-gray-500">期間: {period}</p>
        </div>
        <input
          type="month"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-200">
          <h3 className="text-base font-semibold text-navy">Google Ads</h3>
          <dl className="mt-3 space-y-1 text-sm text-gray-700">
            <div className="flex justify-between"><dt>合計消化額</dt><dd className="font-semibold">{fmtCurrency(totals.google.cost)}</dd></div>
            <div className="flex justify-between"><dt>合計CV</dt><dd className="font-semibold tabular-nums">{totals.google.cv.toLocaleString("ja-JP")}</dd></div>
            <div className="flex justify-between"><dt>CPA</dt><dd className="font-semibold">{fmtCurrency(totals.google.cpa)}</dd></div>
            <div className="flex justify-between"><dt>ROAS</dt><dd className="font-semibold">{fmtRoas(totals.google.roas)}</dd></div>
          </dl>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-200">
          <h3 className="text-base font-semibold text-navy">Meta Ads</h3>
          <dl className="mt-3 space-y-1 text-sm text-gray-700">
            <div className="flex justify-between"><dt>合計消化額</dt><dd className="font-semibold">{fmtCurrency(totals.meta.cost)}</dd></div>
            <div className="flex justify-between"><dt>合計CV</dt><dd className="font-semibold tabular-nums">{totals.meta.cv.toLocaleString("ja-JP")}</dd></div>
            <div className="flex justify-between"><dt>CPA</dt><dd className="font-semibold">{fmtCurrency(totals.meta.cpa)}</dd></div>
            <div className="flex justify-between"><dt>ROAS</dt><dd className="font-semibold">{fmtRoas(totals.meta.roas)}</dd></div>
          </dl>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-200">
        <h3 className="mb-4 text-base font-semibold text-navy">クライアント別消化額</h3>
        <ResponsiveContainer width="100%" height={360}>
          <BarChart data={rows}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis dataKey="clientName" tick={{ fill: "#64748B", fontSize: 12 }} />
            <YAxis
              tickFormatter={(value: number | undefined) =>
                `¥${(value ?? 0).toLocaleString("ja-JP")}`
              }
              tick={{ fill: "#64748B", fontSize: 12 }}
            />
            <Tooltip formatter={(value: number | undefined) => fmtCurrency(value ?? 0)} />
            <Legend />
            <Bar dataKey="googleCost" name="Google Ads" fill="#2C5282" radius={[4, 4, 0, 0]} />
            <Bar dataKey="metaCost" name="Meta Ads" fill="#3B6BA5" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
