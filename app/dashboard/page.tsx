"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import BigKpiCards from "@/components/dashboard/BigKpiCards";
import ClientTable from "@/components/dashboard/ClientTable";
import DailyTrendChart from "@/components/dashboard/DailyTrendChart";
import AlertBanner from "@/components/dashboard/AlertBanner";
import type { AlertItem, ClientRow, KpiMetric, TrendRow } from "@/components/dashboard/types";
import { calculateBudgetProgress } from "@/lib/budget";
import { generateAlerts } from "@/lib/alerts";
import { apiFetch } from "@/lib/api-client";
import { DEFAULT_SETTINGS, loadSettings, type FeeCalcMethod } from "@/lib/settings";
import { loadApiKeys, loadCompanies } from "@/lib/storage";
import type { MetaCreativeSummary, MetaInsights } from "@/types/meta";

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

export default function DashboardPage() {
  const [period, setPeriod] = useState<Period>("last_30");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [setupMissing, setSetupMissing] = useState(false);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [daily, setDaily] = useState<DailyRow[]>([]);
  const [creatives, setCreatives] = useState<MetaCreativeSummary[]>([]);
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
        // localStorage未設定でもサーバー側env変数があればOK
        try {
          const envRes = await fetch("/api/meta/check-env");
          const envData = (await envRes.json()) as { configured: boolean };
          if (!envData.configured) {
            if (!mounted) return;
            setSetupMissing(true);
            setProjects([]);
            setDaily([]);
            setCreatives([]);
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
        const [projectRes, dailyRes, creativeRes] = await Promise.all([
          apiFetch(`/api/meta/projects?date_preset=${datePreset}`),
          apiFetch(`/api/meta/daily?date_preset=${datePreset}`),
          apiFetch(`/api/meta/creatives?date_preset=${datePreset}`),
        ]);

        if (!projectRes.ok || !dailyRes.ok || !creativeRes.ok) {
          throw new Error("ダッシュボードデータの取得に失敗しました");
        }

        const [projectData, dailyData, creativeData] = await Promise.all([
          projectRes.json() as Promise<ProjectRow[]>,
          dailyRes.json() as Promise<DailyRow[]>,
          creativeRes.json() as Promise<MetaCreativeSummary[]>,
        ]);

        if (!mounted) return;
        setProjects(Array.isArray(projectData) ? projectData : []);
        setDaily(Array.isArray(dailyData) ? dailyData : []);
        setCreatives(Array.isArray(creativeData) ? creativeData : []);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "データ取得エラー");
        setProjects([]);
        setDaily([]);
        setCreatives([]);
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
      } as ClientRow;
    });
  }, [projects, settings]);

  const metrics = useMemo(() => {
    const totalSpend = projectRows.reduce((sum, row) => sum + row.spend, 0);
    const totalSpendWithFee = projectRows.reduce((sum, row) => sum + row.spendWithFee, 0);
    const totalCv = projectRows.reduce((sum, row) => sum + row.cv, 0);
    const avgCpa = totalCv > 0 ? totalSpend / totalCv : 0;
    const avgRoas = projectRows.length > 0 ? projectRows.reduce((sum, row) => sum + row.roas, 0) / projectRows.length : 0;

    const series = [...daily]
      .map((row) => ({ date: row.date_start, spend: toNumber(row.spend), cv: row.cv ?? 0 }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .filter((row) => row.spend >= 0);
    const split = Math.max(1, Math.floor(series.length / 2));
    const prevRows = series.slice(0, split);

    const prevSpend = prevRows.reduce((sum, row) => sum + row.spend, 0);
    const prevCv = prevRows.reduce((sum, row) => sum + row.cv, 0);
    const prevCpa = prevCv > 0 ? prevSpend / prevCv : 0;
    const prevRoas = prevSpend > 0 ? (prevCv * 10000) / prevSpend : 0;

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
    ] satisfies KpiMetric[];
  }, [projectRows, daily, settings]);

  const trendRows = useMemo(() => {
    return daily
      .map((row) => {
        const spend = toNumber(row.spend);
        const cv = row.cv ?? 0;
        return {
          date: row.date_start,
          spend,
          cv,
          cpa: cv > 0 ? spend / cv : 0,
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
        cv: row.cv ?? 0,
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
    })) as AlertItem[];
  }, [projects, daily, creatives, settings]);

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
          <p className="mt-2 text-sm text-amber-700">
            広告データを表示するには、APIキーと案件の登録が必要です。
          </p>
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
          <DailyTrendChart rows={trendRows} />
        </>
      )}
    </div>
  );
}
