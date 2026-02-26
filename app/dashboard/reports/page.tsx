"use client";

import { useEffect, useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { calculateBudgetProgress } from "@/lib/budget";
import { DEFAULT_SETTINGS, loadSettings } from "@/lib/settings";

type DatePreset = "today" | "yesterday" | "last_7d" | "last_30d" | "this_month";

interface ProjectRow {
  id: string;
  name: string;
}

interface AnalysisResult {
  summary: string;
  insights: string[];
  recommendations: string[];
}

interface ClientReportResult {
  summary: string;
  performance: string;
  improvements: string[];
  retrospective: string[];
}

interface CampaignRow {
  campaign_id: string;
  campaign_name: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc?: number;
  cv: number;
  cpa: number;
}

interface CreativeRow {
  ad_id: string;
  ad_name: string;
  creative_name: string;
  campaign_name: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc?: number;
  cv: number;
  cpa: number;
}

interface DailyRow {
  date_start: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc?: number;
  cv: number;
  cpa: number;
}

interface ProjectDetailResponse {
  project: {
    id: string;
    name: string;
    spend: number;
    impressions: number;
    clicks: number;
    ctr: number;
    cpc?: number;
    cv: number;
    cpa: number;
  };
  campaigns: CampaignRow[];
  creatives: CreativeRow[];
  daily: DailyRow[];
  analysis: {
    overall: AnalysisResult;
    daily: AnalysisResult;
    creative: AnalysisResult;
    clientReport: ClientReportResult;
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
  const [datePreset, setDatePreset] = useState<DatePreset>("last_30d");
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [detail, setDetail] = useState<ProjectDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [bootLoading, setBootLoading] = useState(false);
  const [error, setError] = useState("");
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  useEffect(() => {
    setSettings(loadSettings());
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadProjects = async () => {
      setBootLoading(true);
      try {
        const res = await fetch("/api/meta/projects?date_preset=last_30d");
        if (!res.ok) throw new Error("案件取得に失敗しました");

        const rows = (await res.json()) as Array<{ id: string; name: string }>;
        if (!mounted) return;

        const mapped = Array.isArray(rows) ? rows.map((row) => ({ id: row.id, name: row.name })) : [];

        setProjects(mapped);
        if (mapped.length > 0) {
          setSelectedProjectId(mapped[0].id);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "データ取得エラー");
        }
      } finally {
        if (mounted) setBootLoading(false);
      }
    };

    void loadProjects();

    return () => {
      mounted = false;
    };
  }, []);

  const selectedProjectName = useMemo(() => {
    return projects.find((project) => project.id === selectedProjectId)?.name || "未選択";
  }, [projects, selectedProjectId]);

  const budgetProgress = useMemo(() => {
    if (!detail) return null;
    return calculateBudgetProgress(
      detail.project.name,
      detail.project.spend,
      settings.budgets,
      settings.defaultFeeRate,
    );
  }, [detail, settings]);

  const onLoadReport = async () => {
    if (!selectedProjectId) {
      setError("案件を選択してください");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch(
        `/api/meta/project-detail?project_id=${encodeURIComponent(selectedProjectId)}&date_preset=${encodeURIComponent(datePreset)}`,
      );

      if (!res.ok) {
        throw new Error("レポートデータの取得に失敗しました");
      }

      const data = (await res.json()) as ProjectDetailResponse;
      setDetail(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "レポート取得エラー");
      setDetail(null);
    } finally {
      setLoading(false);
    }
  };

  const onDownloadPdf = async () => {
    const preview = document.getElementById("report-preview");
    if (!preview || !detail) return;

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
      setError("PDFライブラリの読み込みに失敗しました。依存関係を確認してください。");
      return;
    }

    const canvas = await html2canvasFn(preview, { scale: 2 });
    const imageData = canvas.toDataURL("image/png");
    const pdf = new jsPDFCtor("p", "mm", "a4");
    const width = pdf.internal.pageSize.getWidth();
    const height = (canvas.height * width) / canvas.width;

    pdf.addImage(imageData, "PNG", 0, 0, width, height);
    pdf.save(`project_report_${datePreset}_${selectedProjectId}.pdf`);
  };

  const onDownloadCsv = () => {
    if (!detail) return;

    const rows: string[][] = [["日付", "消化額", "IMP", "クリック", "CTR", "CPC", "CV", "CPA"]];
    detail.daily.forEach((row) => {
      const cpc = row.clicks > 0 ? row.spend / row.clicks : 0;
      rows.push([
        row.date_start,
        String(Math.round(row.spend)),
        String(Math.round(row.impressions)),
        String(Math.round(row.clicks)),
        row.ctr.toFixed(1),
        String(Math.round(cpc)),
        String(Math.round(row.cv)),
        String(Math.round(row.cpa)),
      ]);
    });

    rows.push([]);
    rows.push(["キャンペーン", "消化額", "IMP", "クリック", "CTR", "CPC", "CV", "CPA"]);
    detail.campaigns.forEach((row) => {
      const cpc = row.clicks > 0 ? row.spend / row.clicks : 0;
      rows.push([
        row.campaign_name,
        String(Math.round(row.spend)),
        String(Math.round(row.impressions)),
        String(Math.round(row.clicks)),
        row.ctr.toFixed(1),
        String(Math.round(cpc)),
        String(Math.round(row.cv)),
        String(Math.round(row.cpa)),
      ]);
    });

    rows.push([]);
    rows.push(["クリエイティブ", "キャンペーン", "消化額", "IMP", "クリック", "CTR", "CPC", "CV", "CPA"]);
    detail.creatives.forEach((row) => {
      const cpc = row.clicks > 0 ? row.spend / row.clicks : 0;
      rows.push([
        row.creative_name,
        row.campaign_name,
        String(Math.round(row.spend)),
        String(Math.round(row.impressions)),
        String(Math.round(row.clicks)),
        row.ctr.toFixed(1),
        String(Math.round(cpc)),
        String(Math.round(row.cv)),
        String(Math.round(row.cpa)),
      ]);
    });

    downloadCSV(`project_report_${datePreset}_${selectedProjectId}.csv`, rows);
  };

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-2xl font-bold text-navy">レポート生成</h2>
        <p className="mt-1 text-sm text-gray-500">案件単位のレポートを生成します</p>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="text-sm text-gray-700">
            対象案件
            <select
              value={selectedProjectId}
              onChange={(event) => setSelectedProjectId(event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2"
            >
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm text-gray-700">
            期間
            <select
              value={datePreset}
              onChange={(event) => setDatePreset(event.target.value as DatePreset)}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2"
            >
              <option value="today">今日</option>
              <option value="yesterday">昨日</option>
              <option value="last_7d">過去7日</option>
              <option value="last_30d">過去30日</option>
              <option value="this_month">今月</option>
            </select>
          </label>

          <div className="flex items-end">
            <button
              type="button"
              onClick={onLoadReport}
              className="w-full rounded-lg bg-blue px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-light"
            >
              レポート生成
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

      <section id="report-preview" className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <header>
          <h3 className="text-xl font-bold text-navy">案件レポート</h3>
          <p className="mt-1 text-sm text-gray-500">
            {selectedProjectName} / {datePreset}
          </p>
        </header>

        {detail ? (
          <>
            <section className="grid grid-cols-1 gap-4 md:grid-cols-5">
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-xs text-gray-500">消化額</p>
                <p className="mt-1 text-lg font-semibold text-navy tabular-nums">{formatCurrency(detail.project.spend)}</p>
                <p className="mt-1 text-xs text-gray-500">Fee込: {formatCurrency(budgetProgress?.spendWithFee ?? detail.project.spend)}</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-xs text-gray-500">CV</p>
                <p className="mt-1 text-lg font-semibold text-navy tabular-nums">{formatNumber(detail.project.cv)}</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-xs text-gray-500">CPA</p>
                <p className="mt-1 text-lg font-semibold text-navy tabular-nums">
                  {detail.project.cv > 0 ? formatCurrency(detail.project.cpa) : "-"}
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-xs text-gray-500">CTR</p>
                <p className="mt-1 text-lg font-semibold text-navy tabular-nums">{formatPercent(detail.project.ctr)}</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-xs text-gray-500">CPC</p>
                <p className="mt-1 text-lg font-semibold text-navy tabular-nums">
                  {detail.project.clicks > 0 ? formatCurrency(detail.project.spend / detail.project.clicks) : "-"}
                </p>
              </div>
            </section>

            {budgetProgress && (
              <section className="rounded-lg border border-gray-200 p-4">
                <h4 className="text-base font-semibold text-navy">予算進捗</h4>
                {budgetProgress.monthlyBudget === null ? (
                  <p className="mt-2 text-sm text-gray-500">予算未設定のため、進捗を算出できません。</p>
                ) : (
                  <>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span className="font-medium text-navy">{detail.project.name}</span>
                      <span className="text-xs text-gray-500 tabular-nums">
                        {formatCurrency(detail.project.spend)} / {formatCurrency(budgetProgress.monthlyBudget)}
                      </span>
                    </div>
                    <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-100">
                      <div
                        className={`h-full ${
                          budgetProgress.paceStatus === "under"
                            ? "bg-blue"
                            : budgetProgress.paceStatus === "over"
                              ? "bg-red-500"
                              : "bg-emerald-500"
                        }`}
                        style={{ width: `${Math.min(budgetProgress.consumptionRate ?? 0, 130)}%` }}
                      />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-600">
                      <span className="tabular-nums">Fee込: {formatCurrency(budgetProgress.spendWithFee)}</span>
                      <span className="tabular-nums">理想: {formatPercent(budgetProgress.idealRate)}</span>
                      <span className="tabular-nums">
                        実績: {formatPercent(budgetProgress.consumptionRate ?? 0)}
                      </span>
                      <span className="tabular-nums">
                        着地予想: {budgetProgress.projectedSpend ? formatCurrency(budgetProgress.projectedSpend) : "-"}
                      </span>
                      <span className="tabular-nums">
                        Fee込着地: {budgetProgress.projectedSpendWithFee ? formatCurrency(budgetProgress.projectedSpendWithFee) : "-"}
                      </span>
                      <span className="tabular-nums">
                        残予算: {budgetProgress.remainingBudget !== null ? formatCurrency(budgetProgress.remainingBudget) : "-"}
                      </span>
                    </div>
                  </>
                )}
              </section>
            )}

            <section className="space-y-3 rounded-lg border border-gray-200 p-4">
              <h4 className="text-base font-semibold text-navy">AI分析</h4>
              {[detail.analysis.overall, detail.analysis.daily, detail.analysis.creative].map((block, index) => (
                <div key={`analysis-${index}`} className="rounded-lg bg-gray-50 p-3">
                  <p className="text-sm font-medium text-navy">{block.summary}</p>
                  <p className="mt-2 text-xs font-semibold text-gray-600">示唆</p>
                  <ul className="mt-1 space-y-1 text-sm text-gray-700">
                    {block.insights.map((item, itemIndex) => (
                      <li key={`${item}-${itemIndex}`}>・{item}</li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs font-semibold text-gray-600">改善提案</p>
                  <ul className="mt-1 space-y-1 text-sm text-gray-700">
                    {block.recommendations.map((item, itemIndex) => (
                      <li key={`${item}-${itemIndex}`}>・{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>

            <section className="space-y-3 rounded-lg border border-gray-200 p-4">
              <h4 className="text-base font-semibold text-navy">クライアント向けコメント</h4>
              <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
                <p className="font-medium text-navy">{detail.analysis.clientReport.summary}</p>
                <p className="mt-2">{detail.analysis.clientReport.performance}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-600">次月に向けた改善施策</p>
                <ul className="mt-1 space-y-1 text-sm text-gray-700">
                  {detail.analysis.clientReport.improvements.map((item, index) => (
                    <li key={`improvement-${index}`} className="flex items-start gap-2">
                      <span className="text-amber">→</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-600">今月の振り返り</p>
                <ul className="mt-1 space-y-1 text-sm text-gray-700">
                  {detail.analysis.clientReport.retrospective.map((item, index) => {
                    const isPositive = item.includes("良かった点");
                    const isIssue = item.includes("課題");
                    const colorClass = isPositive ? "text-emerald-700" : isIssue ? "text-amber-700" : "text-gray-700";
                    return (
                      <li key={`retro-${index}`} className={colorClass}>
                        ・{item}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </section>

            <div className="h-72 rounded-lg border border-gray-200 p-3">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={detail.daily}>
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
                  <Line yAxisId="left" dataKey="spend" stroke="#2C5282" strokeWidth={2} dot={false} />
                  <Line yAxisId="right" dataKey="cv" stroke="#059669" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">日付</th>
                    <th className="px-3 py-2 text-left font-medium">消化額</th>
                    <th className="px-3 py-2 text-left font-medium">IMP</th>
                    <th className="px-3 py-2 text-left font-medium">クリック</th>
                    <th className="px-3 py-2 text-left font-medium">CTR</th>
                    <th className="px-3 py-2 text-left font-medium">CPC</th>
                    <th className="px-3 py-2 text-left font-medium">CV</th>
                    <th className="px-3 py-2 text-left font-medium">CPA</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.daily.map((row, index) => (
                    <tr key={`${row.date_start}-${index}`} className={index % 2 === 0 ? "bg-white" : "bg-gray-50/60"}>
                      <td className="px-3 py-2">{row.date_start}</td>
                      <td className="px-3 py-2 tabular-nums">{formatCurrency(row.spend)}</td>
                      <td className="px-3 py-2 tabular-nums">{formatNumber(row.impressions)}</td>
                      <td className="px-3 py-2 tabular-nums">{formatNumber(row.clicks)}</td>
                      <td className="px-3 py-2 tabular-nums">{formatPercent(row.ctr)}</td>
                      <td className="px-3 py-2 tabular-nums">{row.clicks > 0 ? formatCurrency(row.spend / row.clicks) : "-"}</td>
                      <td className="px-3 py-2 tabular-nums">{formatNumber(row.cv)}</td>
                      <td className="px-3 py-2 tabular-nums">{row.cv > 0 ? formatCurrency(row.cpa) : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">キャンペーン</th>
                    <th className="px-3 py-2 text-left font-medium">消化額</th>
                    <th className="px-3 py-2 text-left font-medium">IMP</th>
                    <th className="px-3 py-2 text-left font-medium">クリック</th>
                    <th className="px-3 py-2 text-left font-medium">CTR</th>
                    <th className="px-3 py-2 text-left font-medium">CPC</th>
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
                      <td className="px-3 py-2 tabular-nums">{row.clicks > 0 ? formatCurrency(row.spend / row.clicks) : "-"}</td>
                      <td className="px-3 py-2 tabular-nums">{formatNumber(row.cv)}</td>
                      <td className="px-3 py-2 tabular-nums">{row.cv > 0 ? formatCurrency(row.cpa) : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full min-w-[980px] text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">クリエイティブ</th>
                    <th className="px-3 py-2 text-left font-medium">キャンペーン</th>
                    <th className="px-3 py-2 text-left font-medium">消化額</th>
                    <th className="px-3 py-2 text-left font-medium">IMP</th>
                    <th className="px-3 py-2 text-left font-medium">クリック</th>
                    <th className="px-3 py-2 text-left font-medium">CTR</th>
                    <th className="px-3 py-2 text-left font-medium">CPC</th>
                    <th className="px-3 py-2 text-left font-medium">CV</th>
                    <th className="px-3 py-2 text-left font-medium">CPA</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.creatives.map((row, index) => (
                    <tr key={row.ad_id} className={index % 2 === 0 ? "bg-white" : "bg-gray-50/60"}>
                      <td className="px-3 py-2 font-medium text-navy">{row.creative_name}</td>
                      <td className="px-3 py-2">{row.campaign_name}</td>
                      <td className="px-3 py-2 tabular-nums">{formatCurrency(row.spend)}</td>
                      <td className="px-3 py-2 tabular-nums">{formatNumber(row.impressions)}</td>
                      <td className="px-3 py-2 tabular-nums">{formatNumber(row.clicks)}</td>
                      <td className="px-3 py-2 tabular-nums">{formatPercent(row.ctr)}</td>
                      <td className="px-3 py-2 tabular-nums">{row.clicks > 0 ? formatCurrency(row.spend / row.clicks) : "-"}</td>
                      <td className="px-3 py-2 tabular-nums">{formatNumber(row.cv)}</td>
                      <td className="px-3 py-2 tabular-nums">{row.cv > 0 ? formatCurrency(row.cpa) : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="text-sm text-gray-500">対象条件を選択してレポートを生成してください。</p>
        )}
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
