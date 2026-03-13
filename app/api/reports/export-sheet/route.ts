import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { applyFee } from "@/lib/budget";
import type { Session } from "next-auth";

interface ProjectMetrics {
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cv: number;
  cpa: number;
  purchase_roas?: number | null;
}

interface CampaignRow {
  campaign_name: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cv: number;
  cpa: number;
  purchase_roas?: number | null;
}

interface AdsetRow {
  campaign_name: string;
  adset_name: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cv: number;
  cpa: number;
}

interface CreativeRow {
  creative_name: string;
  campaign_name: string;
  adset_name?: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cv: number;
  cpa: number;
  image_url?: string | null;
  thumbnail_url?: string | null;
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

interface AnalysisBlock {
  summary: string;
  insights: string[];
  recommendations: string[];
}

interface ClientReportBlock {
  summary: string;
  performance: string;
  improvements: string[];
  retrospective: string[];
}

interface DeviceRow {
  device: string;
  spend: number;
  impressions: number;
  clicks: number;
  cv: number;
  cpa: number;
  ctr: number;
}

interface DemographicRow {
  age: string;
  gender: string;
  spend: number;
  impressions: number;
  clicks: number;
  cv: number;
  cpa: number;
}

interface HourlyRow {
  date_start: string;
  hourly_stats_aggregated_by_advertiser_time_zone: string;
  spend: number;
  cv: number;
  cpa: number;
}

interface ReportData {
  projectName: string;
  datePreset: string;
  project: ProjectMetrics;
  campaigns: CampaignRow[];
  adsets?: AdsetRow[];
  creatives: CreativeRow[];
  daily: DailyRow[];
  analysis: {
    overall: AnalysisBlock;
    clientReport: ClientReportBlock;
  };
  feeRate: number;
  feeCalcMethod: "markup" | "margin";
  monthlyBudget: number | null;
  previous?: {
    spend?: number;
    cv?: number;
    cpa?: number;
  };
  deviceBreakdown?: DeviceRow[];
  demographicBreakdown?: DemographicRow[];
  hourlyBreakdown?: HourlyRow[];
}

interface SpreadsheetColor {
  red: number;
  green: number;
  blue: number;
}

interface SheetProperties {
  sheetId?: number;
  title?: string;
}

interface SpreadsheetSheet {
  properties?: SheetProperties;
}

interface CreateSpreadsheetResponse {
  spreadsheetId?: string;
  spreadsheetUrl?: string;
  sheets?: SpreadsheetSheet[];
}

type CellValue = string | number;
type TableRows = CellValue[][];

const NAVY: SpreadsheetColor = { red: 0.106, green: 0.165, blue: 0.29 };
const BLUE: SpreadsheetColor = { red: 0.173, green: 0.322, blue: 0.51 };
const GREEN: SpreadsheetColor = { red: 0.02, green: 0.588, blue: 0.412 };
const ORANGE: SpreadsheetColor = { red: 0.851, green: 0.467, blue: 0.024 };
const TEAL: SpreadsheetColor = { red: 0.051, green: 0.58, blue: 0.533 };
const PURPLE: SpreadsheetColor = { red: 0.486, green: 0.227, blue: 0.929 };
const LIGHT_GRAY: SpreadsheetColor = { red: 0.95, green: 0.95, blue: 0.95 };
const ALTERNATE_ROW: SpreadsheetColor = { red: 0.973, green: 0.98, blue: 0.988 };
const WEEKEND_BG: SpreadsheetColor = { red: 0.937, green: 0.965, blue: 1 };
const BORDER_GRAY: SpreadsheetColor = { red: 0.85, green: 0.85, blue: 0.85 };

const RANK_COLORS: Record<"A" | "B" | "C" | "D", SpreadsheetColor> = {
  A: { red: 0.863, green: 0.988, blue: 0.906 },
  B: { red: 0.996, green: 0.953, blue: 0.78 },
  C: { red: 0.996, green: 0.886, blue: 0.886 },
  D: { red: 0.953, green: 0.957, blue: 0.965 },
};

const JA_WEEKDAY = new Intl.DateTimeFormat("ja-JP", { weekday: "short", timeZone: "Asia/Tokyo" });
const JA_DATE = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "Asia/Tokyo",
});

function roundInt(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value);
}

function toPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return value / 100;
}

function calcRate(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return numerator / denominator;
}

function calcCtr(clicks: number, impressions: number): number {
  return calcRate(clicks, impressions) * 100;
}

function calcCpa(spend: number, cv: number): number {
  if (cv <= 0) return 0;
  return spend / cv;
}

function calcCpc(spend: number, clicks: number): number {
  if (clicks <= 0) return 0;
  return spend / clicks;
}

function formatDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseDate(dateText: string): Date {
  return new Date(`${dateText}T00:00:00+09:00`);
}

function getPeriodRange(datePreset: string, daily: DailyRow[]): { start: Date; end: Date } {
  const dailyDates = daily
    .map((row) => row.date_start)
    .filter((v) => /^\d{4}-\d{2}-\d{2}$/.test(v))
    .sort();

  if (dailyDates.length > 0) {
    return {
      start: parseDate(dailyDates[0]),
      end: parseDate(dailyDates[dailyDates.length - 1]),
    };
  }

  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (datePreset === "today") {
    return { start: end, end };
  }
  if (datePreset === "yesterday") {
    const y = new Date(end);
    y.setDate(end.getDate() - 1);
    return { start: y, end: y };
  }
  if (datePreset === "last_7d") {
    const start = new Date(end);
    start.setDate(end.getDate() - 6);
    return { start, end };
  }
  if (datePreset === "this_month") {
    const start = new Date(end.getFullYear(), end.getMonth(), 1);
    return { start, end };
  }

  const start = new Date(end);
  start.setDate(end.getDate() - 29);
  return { start, end };
}

function formatPeriodJa(range: { start: Date; end: Date }): string {
  return `${JA_DATE.format(range.start)} ～ ${JA_DATE.format(range.end)}`;
}

function calcMonthOnMonth(current: number, previous?: number): string {
  if (previous === undefined || previous === null || previous === 0) {
    return "-";
  }
  const delta = ((current - previous) / previous) * 100;
  const arrow = delta >= 0 ? "↗" : "↘";
  return `${arrow}${Math.abs(delta).toFixed(1)}%`;
}

function extractMonth(dateText: string): string {
  const date = parseDate(dateText);
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function buildDailySeries(range: { start: Date; end: Date }, daily: DailyRow[]): DailyRow[] {
  const byDate = new Map(daily.map((row) => [row.date_start, row]));
  const rows: DailyRow[] = [];
  const cursor = new Date(range.start);

  while (cursor <= range.end) {
    const dateKey = formatDate(cursor);
    const row = byDate.get(dateKey);
    rows.push(
      row ?? {
        date_start: dateKey,
        spend: 0,
        impressions: 0,
        clicks: 0,
        ctr: 0,
        cv: 0,
        cpa: 0,
      },
    );
    cursor.setDate(cursor.getDate() + 1);
  }

  return rows;
}

function aggregateByMonth(daily: DailyRow[], feeRate: number, feeMethod: "markup" | "margin") {
  const grouped = new Map<string, { impressions: number; clicks: number; spend: number; spendWithFee: number; cv: number }>();

  daily.forEach((row) => {
    const month = extractMonth(row.date_start);
    const curr = grouped.get(month) ?? { impressions: 0, clicks: 0, spend: 0, spendWithFee: 0, cv: 0 };
    curr.impressions += row.impressions;
    curr.clicks += row.clicks;
    curr.spend += row.spend;
    curr.spendWithFee += applyFee(row.spend, feeRate, feeMethod);
    curr.cv += row.cv;
    grouped.set(month, curr);
  });

  return Array.from(grouped.entries())
    .map(([month, m]) => ({
      month,
      impressions: m.impressions,
      clicks: m.clicks,
      ctr: calcCtr(m.clicks, m.impressions),
      cpc: calcCpc(m.spend, m.clicks),
      spendWithFee: m.spendWithFee,
      cv: m.cv,
      cvr: calcRate(m.cv, m.clicks) * 100,
      cpa: calcCpa(m.spend, m.cv),
    }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

function computeRanks<T extends { spend: number; cv: number }>(rows: T[]): string[] {
  const totalSpend = rows.reduce((sum, row) => sum + row.spend, 0);
  const totalCv = rows.reduce((sum, row) => sum + row.cv, 0);

  if (totalCv <= 0) {
    return rows.map(() => "-");
  }

  const avgCpa = totalSpend / totalCv;

  return rows.map((row) => {
    if (row.cv > 0) {
      return row.spend / row.cv < avgCpa ? "A" : "B";
    }
    return row.spend >= avgCpa ? "C" : "D";
  });
}

function toCampaignTableRows(campaigns: CampaignRow[], feeRate: number, feeMethod: "markup" | "margin"): TableRows {
  const ranks = computeRanks(campaigns);
  const totalSpend = campaigns.reduce((sum, row) => sum + row.spend, 0);
  const totalImp = campaigns.reduce((sum, row) => sum + row.impressions, 0);
  const totalClicks = campaigns.reduce((sum, row) => sum + row.clicks, 0);
  const totalCv = campaigns.reduce((sum, row) => sum + row.cv, 0);

  const rows: TableRows = [
    [
      "No.",
      "キャンペーン",
      "表示回数",
      "クリック数",
      "クリック率",
      "クリック単価",
      "ご利用額(Fee抜)",
      "ご利用額(Fee込)",
      "獲得件数",
      "獲得率",
      "獲得単価",
      "ROAS",
      "ランク",
    ],
    [
      "合計",
      "-",
      roundInt(totalImp),
      roundInt(totalClicks),
      toPercent(calcCtr(totalClicks, totalImp)),
      roundInt(calcCpc(totalSpend, totalClicks)),
      roundInt(totalSpend),
      roundInt(applyFee(totalSpend, feeRate, feeMethod)),
      roundInt(totalCv),
      toPercent(calcRate(totalCv, totalClicks) * 100),
      roundInt(calcCpa(totalSpend, totalCv)),
      "-",
      "-",
    ],
  ];

  campaigns.forEach((row, index) => {
    rows.push([
      index + 1,
      row.campaign_name,
      roundInt(row.impressions),
      roundInt(row.clicks),
      toPercent(row.ctr),
      roundInt(calcCpc(row.spend, row.clicks)),
      roundInt(row.spend),
      roundInt(applyFee(row.spend, feeRate, feeMethod)),
      roundInt(row.cv),
      toPercent(calcRate(row.cv, row.clicks) * 100),
      roundInt(calcCpa(row.spend, row.cv)),
      typeof row.purchase_roas === "number" && Number.isFinite(row.purchase_roas) ? row.purchase_roas : "-",
      ranks[index],
    ]);
  });

  return rows;
}

function aggregateAdsetsFromCreatives(creatives: CreativeRow[]): AdsetRow[] {
  const map = new Map<string, AdsetRow>();

  creatives.forEach((row) => {
    const adsetName = row.adset_name?.trim() || "未分類";
    const key = `${row.campaign_name}__${adsetName}`;
    const curr = map.get(key) ?? {
      campaign_name: row.campaign_name,
      adset_name: adsetName,
      spend: 0,
      impressions: 0,
      clicks: 0,
      ctr: 0,
      cv: 0,
      cpa: 0,
    };
    curr.spend += row.spend;
    curr.impressions += row.impressions;
    curr.clicks += row.clicks;
    curr.cv += row.cv;
    curr.ctr = calcCtr(curr.clicks, curr.impressions);
    curr.cpa = calcCpa(curr.spend, curr.cv);
    map.set(key, curr);
  });

  return Array.from(map.values()).sort((a, b) => b.spend - a.spend);
}

function toAdsetTableRows(adsets: AdsetRow[], feeRate: number, feeMethod: "markup" | "margin"): TableRows {
  const ranks = computeRanks(adsets);
  const totalSpend = adsets.reduce((sum, row) => sum + row.spend, 0);
  const totalImp = adsets.reduce((sum, row) => sum + row.impressions, 0);
  const totalClicks = adsets.reduce((sum, row) => sum + row.clicks, 0);
  const totalCv = adsets.reduce((sum, row) => sum + row.cv, 0);

  const rows: TableRows = [
    [
      "No.",
      "キャンペーン",
      "広告セット",
      "表示回数",
      "クリック数",
      "クリック率",
      "クリック単価",
      "ご利用額(Fee抜)",
      "ご利用額(Fee込)",
      "獲得件数",
      "獲得率",
      "獲得単価",
      "ランク",
    ],
    [
      "合計",
      "-",
      "-",
      roundInt(totalImp),
      roundInt(totalClicks),
      toPercent(calcCtr(totalClicks, totalImp)),
      roundInt(calcCpc(totalSpend, totalClicks)),
      roundInt(totalSpend),
      roundInt(applyFee(totalSpend, feeRate, feeMethod)),
      roundInt(totalCv),
      toPercent(calcRate(totalCv, totalClicks) * 100),
      roundInt(calcCpa(totalSpend, totalCv)),
      "-",
    ],
  ];

  adsets.forEach((row, index) => {
    rows.push([
      index + 1,
      row.campaign_name,
      row.adset_name,
      roundInt(row.impressions),
      roundInt(row.clicks),
      toPercent(row.ctr),
      roundInt(calcCpc(row.spend, row.clicks)),
      roundInt(row.spend),
      roundInt(applyFee(row.spend, feeRate, feeMethod)),
      roundInt(row.cv),
      toPercent(calcRate(row.cv, row.clicks) * 100),
      roundInt(calcCpa(row.spend, row.cv)),
      ranks[index],
    ]);
  });

  return rows;
}

function toCreativeTableRows(creatives: CreativeRow[], feeRate: number, feeMethod: "markup" | "margin"): TableRows {
  const ranks = computeRanks(creatives);
  const totalSpend = creatives.reduce((sum, row) => sum + row.spend, 0);
  const totalImp = creatives.reduce((sum, row) => sum + row.impressions, 0);
  const totalClicks = creatives.reduce((sum, row) => sum + row.clicks, 0);
  const totalCv = creatives.reduce((sum, row) => sum + row.cv, 0);

  const rows: TableRows = [
    [
      "No.",
      "画像",
      "キャンペーン",
      "広告セット",
      "クリエイティブ名",
      "表示回数",
      "クリック数",
      "クリック率",
      "クリック単価",
      "ご利用額(Fee抜)",
      "ご利用額(Fee込)",
      "獲得件数",
      "獲得率",
      "獲得単価",
      "ランク",
    ],
    [
      "合計",
      "",
      "-",
      "-",
      "-",
      roundInt(totalImp),
      roundInt(totalClicks),
      toPercent(calcCtr(totalClicks, totalImp)),
      roundInt(calcCpc(totalSpend, totalClicks)),
      roundInt(totalSpend),
      roundInt(applyFee(totalSpend, feeRate, feeMethod)),
      roundInt(totalCv),
      toPercent(calcRate(totalCv, totalClicks) * 100),
      roundInt(calcCpa(totalSpend, totalCv)),
      "-",
    ],
  ];

  creatives.forEach((row, index) => {
    const imageUrl = row.thumbnail_url || row.image_url;
    const imageFormula = imageUrl ? `=IMAGE("${imageUrl.replaceAll('"', '""')}")` : "";
    rows.push([
      index + 1,
      imageFormula,
      row.campaign_name,
      row.adset_name?.trim() || "未分類",
      row.creative_name,
      roundInt(row.impressions),
      roundInt(row.clicks),
      toPercent(row.ctr),
      roundInt(calcCpc(row.spend, row.clicks)),
      roundInt(row.spend),
      roundInt(applyFee(row.spend, feeRate, feeMethod)),
      roundInt(row.cv),
      toPercent(calcRate(row.cv, row.clicks) * 100),
      roundInt(calcCpa(row.spend, row.cv)),
      ranks[index],
    ]);
  });

  return rows;
}

function toA1Col(colIndex: number): string {
  let n = colIndex;
  let result = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    result = String.fromCharCode(65 + r) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
}

function buildOverviewRows(
  range: { start: Date; end: Date },
  daily: DailyRow[],
  feeRate: number,
  feeMethod: "markup" | "margin",
): TableRows {
  const allDaily = buildDailySeries(range, daily);
  const monthly = aggregateByMonth(allDaily, feeRate, feeMethod);
  const currentMonth = monthly[monthly.length - 1];
  const previousMonth = monthly.length > 1 ? monthly[monthly.length - 2] : null;

  const rows: TableRows = [];
  rows.push(["全体概要"]);
  rows.push([]);
  rows.push(["1. 月別推移"]);
  rows.push([]);
  rows.push([
    "月",
    "表示回数",
    "クリック数",
    "クリック率",
    "クリック単価",
    "ご利用額(Fee込)",
    "獲得件数",
    "獲得率",
    "獲得単価",
  ]);

  if (currentMonth) {
    rows.push([
      currentMonth.month,
      roundInt(currentMonth.impressions),
      roundInt(currentMonth.clicks),
      toPercent(currentMonth.ctr),
      roundInt(currentMonth.cpc),
      roundInt(currentMonth.spendWithFee),
      roundInt(currentMonth.cv),
      toPercent(currentMonth.cvr),
      roundInt(currentMonth.cpa),
    ]);
  } else {
    rows.push(["-", 0, 0, 0, 0, 0, 0, 0, 0]);
  }

  if (previousMonth) {
    const diffImp = currentMonth.impressions - previousMonth.impressions;
    const diffClicks = currentMonth.clicks - previousMonth.clicks;
    const diffCtr = currentMonth.ctr - previousMonth.ctr;
    const diffCpc = currentMonth.cpc - previousMonth.cpc;
    const diffSpend = currentMonth.spendWithFee - previousMonth.spendWithFee;
    const diffCv = currentMonth.cv - previousMonth.cv;
    const diffCvr = currentMonth.cvr - previousMonth.cvr;
    const diffCpa = currentMonth.cpa - previousMonth.cpa;
    const withArrow = (value: number) => `${value >= 0 ? "↗" : "↘"}${Math.abs(value).toFixed(2)}`;

    rows.push([
      "前月差",
      withArrow(diffImp),
      withArrow(diffClicks),
      withArrow(diffCtr),
      withArrow(diffCpc),
      withArrow(diffSpend),
      withArrow(diffCv),
      withArrow(diffCvr),
      withArrow(diffCpa),
    ]);
  } else {
    rows.push(["前月差", "-", "-", "-", "-", "-", "-", "-", "-"]);
  }

  rows.push([]);
  rows.push(["2. 日別推移"]);
  rows.push([]);
  rows.push([
    "日付",
    "表示回数",
    "クリック数",
    "クリック率",
    "クリック単価",
    "ご利用額(Fee込)",
    "獲得件数",
    "獲得率",
    "獲得単価",
  ]);

  const firstMonth = new Date(range.start.getFullYear(), range.start.getMonth(), 1);
  const monthLast = new Date(firstMonth.getFullYear(), firstMonth.getMonth() + 1, 0);
  const dayRowsMap = new Map(allDaily.map((row) => [row.date_start, row]));

  for (let day = 1; day <= 31; day += 1) {
    if (day > monthLast.getDate()) {
      rows.push([`-${String(day).padStart(2, "0")}`, 0, 0, 0, 0, 0, 0, 0, 0]);
      continue;
    }

    const date = new Date(firstMonth.getFullYear(), firstMonth.getMonth(), day);
    const key = formatDate(date);
    const row = dayRowsMap.get(key) ?? {
      date_start: key,
      impressions: 0,
      clicks: 0,
      ctr: 0,
      spend: 0,
      cv: 0,
      cpa: 0,
    };

    rows.push([
      `${String(day).padStart(2, "0")}日`,
      roundInt(row.impressions),
      roundInt(row.clicks),
      toPercent(row.ctr),
      roundInt(calcCpc(row.spend, row.clicks)),
      roundInt(applyFee(row.spend, feeRate, feeMethod)),
      roundInt(row.cv),
      toPercent(calcRate(row.cv, row.clicks) * 100),
      roundInt(calcCpa(row.spend, row.cv)),
    ]);
  }

  return rows;
}

function buildDailyTrendRows(range: { start: Date; end: Date }, daily: DailyRow[], feeRate: number, feeMethod: "markup" | "margin") {
  const rows: TableRows = [
    ["日付", "曜日", "表示回数", "クリック数", "クリック率", "クリック単価", "ご利用額(Fee抜)", "ご利用額(Fee込)", "獲得件数", "獲得率", "獲得単価"],
  ];

  const normalized = buildDailySeries(range, daily);

  normalized.forEach((row) => {
    const date = parseDate(row.date_start);
    rows.push([
      row.date_start,
      JA_WEEKDAY.format(date),
      roundInt(row.impressions),
      roundInt(row.clicks),
      toPercent(row.ctr),
      roundInt(calcCpc(row.spend, row.clicks)),
      roundInt(row.spend),
      roundInt(applyFee(row.spend, feeRate, feeMethod)),
      roundInt(row.cv),
      toPercent(calcRate(row.cv, row.clicks) * 100),
      roundInt(calcCpa(row.spend, row.cv)),
    ]);
  });

  const totalSpend = normalized.reduce((sum, row) => sum + row.spend, 0);
  const totalImp = normalized.reduce((sum, row) => sum + row.impressions, 0);
  const totalClicks = normalized.reduce((sum, row) => sum + row.clicks, 0);
  const totalCv = normalized.reduce((sum, row) => sum + row.cv, 0);

  rows.push([
    "合計",
    "-",
    roundInt(totalImp),
    roundInt(totalClicks),
    toPercent(calcCtr(totalClicks, totalImp)),
    roundInt(calcCpc(totalSpend, totalClicks)),
    roundInt(totalSpend),
    roundInt(applyFee(totalSpend, feeRate, feeMethod)),
    roundInt(totalCv),
    toPercent(calcRate(totalCv, totalClicks) * 100),
    roundInt(calcCpa(totalSpend, totalCv)),
  ]);

  return rows;
}

function buildAiRows(data: ReportData): TableRows {
  const rows: TableRows = [];

  rows.push(["1. 総合分析"]);
  rows.push(["サマリー", data.analysis.overall.summary]);
  rows.push(["示唆", data.analysis.overall.insights.join("\n") || "-"]);
  rows.push(["推奨アクション", data.analysis.overall.recommendations.join("\n") || "-"]);
  rows.push([]);

  rows.push(["2. クライアント向けコメント"]);
  rows.push(["総評", data.analysis.clientReport.summary]);
  rows.push(["期間内パフォーマンス", data.analysis.clientReport.performance]);
  rows.push([]);

  rows.push(["3. 改善施策"]);
  rows.push(["アクション", data.analysis.clientReport.improvements.join("\n") || "-"]);
  rows.push([]);

  rows.push(["4. 振り返り"]);
  rows.push(["振り返り", data.analysis.clientReport.retrospective.join("\n") || "-"]);

  return rows;
}

function toDeviceTableRows(devices: DeviceRow[], feeRate: number, feeMethod: "markup" | "margin"): TableRows {
  const totalSpend = devices.reduce((sum, row) => sum + row.spend, 0);
  const totalImp = devices.reduce((sum, row) => sum + row.impressions, 0);
  const totalClicks = devices.reduce((sum, row) => sum + row.clicks, 0);
  const totalCv = devices.reduce((sum, row) => sum + row.cv, 0);

  const rows: TableRows = [
    ["デバイス", "表示回数", "クリック数", "クリック率", "ご利用額(Fee抜)", "ご利用額(Fee込)", "獲得件数", "獲得単価", "構成比(費用)"],
    [
      "合計",
      roundInt(totalImp),
      roundInt(totalClicks),
      toPercent(calcCtr(totalClicks, totalImp)),
      roundInt(totalSpend),
      roundInt(applyFee(totalSpend, feeRate, feeMethod)),
      roundInt(totalCv),
      roundInt(calcCpa(totalSpend, totalCv)),
      1,
    ],
  ];

  devices.forEach((row) => {
    rows.push([
      row.device,
      roundInt(row.impressions),
      roundInt(row.clicks),
      toPercent(row.ctr),
      roundInt(row.spend),
      roundInt(applyFee(row.spend, feeRate, feeMethod)),
      roundInt(row.cv),
      roundInt(row.cpa),
      totalSpend > 0 ? row.spend / totalSpend : 0,
    ]);
  });

  return rows;
}

function toDemographicTableRows(demographics: DemographicRow[]): TableRows {
  const AGES = ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"];
  const GENDERS = ["male", "female", "unknown"];
  const GENDER_JA: Record<string, string> = { male: "男性", female: "女性", unknown: "不明" };

  const rows: TableRows = [];

  // CV heatmap
  rows.push(["CV数（年齢×性別）"]);
  rows.push(["", ...AGES]);
  GENDERS.forEach((gender) => {
    const row: CellValue[] = [GENDER_JA[gender] || gender];
    AGES.forEach((age) => {
      const match = demographics.find((d) => d.age === age && d.gender === gender);
      row.push(match ? roundInt(match.cv) : 0);
    });
    rows.push(row);
  });

  rows.push([]);

  // CPA heatmap
  rows.push(["CPA（年齢×性別）"]);
  rows.push(["", ...AGES]);
  GENDERS.forEach((gender) => {
    const row: CellValue[] = [GENDER_JA[gender] || gender];
    AGES.forEach((age) => {
      const match = demographics.find((d) => d.age === age && d.gender === gender);
      row.push(match ? roundInt(match.cpa) : 0);
    });
    rows.push(row);
  });

  rows.push([]);

  // Spend heatmap
  rows.push(["消化額（年齢×性別）"]);
  rows.push(["", ...AGES]);
  GENDERS.forEach((gender) => {
    const row: CellValue[] = [GENDER_JA[gender] || gender];
    AGES.forEach((age) => {
      const match = demographics.find((d) => d.age === age && d.gender === gender);
      row.push(match ? roundInt(match.spend) : 0);
    });
    rows.push(row);
  });

  return rows;
}

function toHeatmapTableRows(hourlyData: HourlyRow[]): TableRows {
  const DAYS_JA = ["月", "火", "水", "木", "金", "土", "日"];
  const HOURS = Array.from({ length: 24 }, (_, i) => i);

  // Aggregate: day of week × hour → { spend, cv }
  const grid = new Map<string, { spend: number; cv: number }>();
  hourlyData.forEach((row) => {
    const date = new Date(`${row.date_start}T00:00:00+09:00`);
    const jsDow = date.getDay(); // 0=Sun
    const mondayIndex = jsDow === 0 ? 6 : jsDow - 1; // 0=Mon
    const hourMatch = row.hourly_stats_aggregated_by_advertiser_time_zone?.match(/^(\d+)/);
    const hour = hourMatch ? Number.parseInt(hourMatch[1], 10) : 0;
    const key = `${mondayIndex}-${hour}`;
    const curr = grid.get(key) ?? { spend: 0, cv: 0 };
    curr.spend += row.spend;
    curr.cv += row.cv;
    grid.set(key, curr);
  });

  const rows: TableRows = [];

  // CV heatmap
  rows.push(["CV数（曜日×時間帯）"]);
  rows.push(["", ...HOURS.map((h) => `${h}時`)]);
  DAYS_JA.forEach((dayLabel, dayIndex) => {
    const row: CellValue[] = [dayLabel];
    HOURS.forEach((hour) => {
      const cell = grid.get(`${dayIndex}-${hour}`);
      row.push(cell ? roundInt(cell.cv) : 0);
    });
    rows.push(row);
  });

  rows.push([]);

  // CPA heatmap
  rows.push(["CPA（曜日×時間帯）"]);
  rows.push(["", ...HOURS.map((h) => `${h}時`)]);
  DAYS_JA.forEach((dayLabel, dayIndex) => {
    const row: CellValue[] = [dayLabel];
    HOURS.forEach((hour) => {
      const cell = grid.get(`${dayIndex}-${hour}`);
      row.push(cell && cell.cv > 0 ? roundInt(cell.spend / cell.cv) : 0);
    });
    rows.push(row);
  });

  rows.push([]);

  // Spend heatmap
  rows.push(["消化額（曜日×時間帯）"]);
  rows.push(["", ...HOURS.map((h) => `${h}時`)]);
  DAYS_JA.forEach((dayLabel, dayIndex) => {
    const row: CellValue[] = [dayLabel];
    HOURS.forEach((hour) => {
      const cell = grid.get(`${dayIndex}-${hour}`);
      row.push(cell ? roundInt(cell.spend) : 0);
    });
    rows.push(row);
  });

  return rows;
}

function headerRequest(sheetId: number, rowIndex: number, colCount: number) {
  return {
    repeatCell: {
      range: {
        sheetId,
        startRowIndex: rowIndex,
        endRowIndex: rowIndex + 1,
        startColumnIndex: 0,
        endColumnIndex: colCount,
      },
      cell: {
        userEnteredFormat: {
          backgroundColor: NAVY,
          textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 }, fontSize: 10 },
        },
      },
      fields: "userEnteredFormat(backgroundColor,textFormat)",
    },
  };
}

function totalRowRequest(sheetId: number, rowIndex: number, colCount: number) {
  return {
    repeatCell: {
      range: {
        sheetId,
        startRowIndex: rowIndex,
        endRowIndex: rowIndex + 1,
        startColumnIndex: 0,
        endColumnIndex: colCount,
      },
      cell: {
        userEnteredFormat: {
          backgroundColor: LIGHT_GRAY,
          textFormat: { bold: true },
        },
      },
      fields: "userEnteredFormat(backgroundColor,textFormat)",
    },
  };
}

function borderRequest(sheetId: number, startRow: number, endRow: number, startCol: number, endCol: number) {
  return {
    updateBorders: {
      range: {
        sheetId,
        startRowIndex: startRow,
        endRowIndex: endRow,
        startColumnIndex: startCol,
        endColumnIndex: endCol,
      },
      top: { style: "SOLID", color: BORDER_GRAY },
      bottom: { style: "SOLID", color: BORDER_GRAY },
      left: { style: "SOLID", color: BORDER_GRAY },
      right: { style: "SOLID", color: BORDER_GRAY },
      innerHorizontal: { style: "SOLID", color: BORDER_GRAY },
      innerVertical: { style: "SOLID", color: BORDER_GRAY },
    },
  };
}

function numberFormatRequest(
  sheetId: number,
  startRow: number,
  endRow: number,
  startCol: number,
  endCol: number,
  pattern: string,
) {
  return {
    repeatCell: {
      range: {
        sheetId,
        startRowIndex: startRow,
        endRowIndex: endRow,
        startColumnIndex: startCol,
        endColumnIndex: endCol,
      },
      cell: {
        userEnteredFormat: {
          numberFormat: {
            type: "NUMBER",
            pattern,
          },
        },
      },
      fields: "userEnteredFormat.numberFormat",
    },
  };
}

async function googleApiFetch<T>(url: string, accessToken: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`Sheets API error (${response.status}):`, text);
    throw new Error(`シートの作成中にエラーが発生しました（${response.status}）`);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return (await response.json()) as T;
}

export async function POST(request: NextRequest) {
  const session = (await auth()) as Session | null;
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accessToken = session.accessToken;
  if (!accessToken) {
    return NextResponse.json(
      { error: "Google Sheetsへのアクセス権限がありません。再ログインしてください。" },
      { status: 403 },
    );
  }

  let data: ReportData;
  try {
    data = (await request.json()) as ReportData;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const feeRate = data.feeRate ?? 0.2;
  const feeMethod = data.feeCalcMethod ?? "markup";

  try {
    const now = new Date();
    const outputDate = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${String(now.getDate()).padStart(2, "0")}`;
    const period = getPeriodRange(data.datePreset, data.daily);
    const periodLabel = formatPeriodJa(period);
    const title = `広告運用レポート_${data.projectName}_${outputDate}`;

    const spreadsheet = await googleApiFetch<CreateSpreadsheetResponse>(
      "https://sheets.googleapis.com/v4/spreadsheets",
      accessToken,
      {
        properties: { title, locale: "ja_JP" },
        sheets: [
          { properties: { title: "表紙", index: 0, tabColor: NAVY } },
          { properties: { title: "サマリー", index: 1, tabColor: BLUE } },
          { properties: { title: "全体概要", index: 2, tabColor: GREEN } },
          { properties: { title: "キャンペーン別", index: 3, tabColor: ORANGE } },
          { properties: { title: "広告セット別", index: 4, tabColor: ORANGE } },
          { properties: { title: "クリエイティブ別", index: 5, tabColor: ORANGE } },
          { properties: { title: "日次推移", index: 6, tabColor: TEAL } },
          { properties: { title: "AI分析", index: 7, tabColor: PURPLE } },
          { properties: { title: "デバイス別", index: 8, tabColor: TEAL } },
          { properties: { title: "属性別(年齢×性別)", index: 9, tabColor: GREEN } },
          { properties: { title: "曜日×時間帯", index: 10, tabColor: ORANGE } },
        ],
      },
    );

    const spreadsheetId = spreadsheet.spreadsheetId;
    const spreadsheetUrl = spreadsheet.spreadsheetUrl;

    if (!spreadsheetId || !spreadsheetUrl || !spreadsheet.sheets) {
      return NextResponse.json({ error: "スプレッドシートの作成に失敗しました" }, { status: 500 });
    }

    const spendWithFee = applyFee(data.project.spend, feeRate, feeMethod);
    const consumptionRate = data.monthlyBudget && data.monthlyBudget > 0 ? (spendWithFee / data.monthlyBudget) * 100 : 0;

    const coverRows: TableRows = [
      [""],
      [""],
      [`${data.projectName}　御中`],
      [""],
      [""],
      [""],
      [""],
      [""],
      [""],
      [""],
      [""],
      [""],
      [""],
      [periodLabel],
      [""],
      [""],
      [""],
      [""],
      [""],
      [`提出日: ${outputDate}`],
    ];

    const summaryRows: TableRows = [
      ["1. 予算サマリー"],
      ["ご予算/月", data.monthlyBudget ? roundInt(data.monthlyBudget) : "-"],
      ["ご利用額/月", roundInt(spendWithFee)],
      ["ご利用率/月", data.monthlyBudget ? toPercent(consumptionRate) : "-"],
      [],
      ["2. 広告結果サマリー"],
      ["獲得件数", roundInt(data.project.cv), calcMonthOnMonth(data.project.cv, data.previous?.cv)],
      ["獲得単価", roundInt(data.project.cpa), calcMonthOnMonth(data.project.cpa, data.previous?.cpa)],
      [
        "ROAS",
        typeof data.project.purchase_roas === "number" && Number.isFinite(data.project.purchase_roas)
          ? `${data.project.purchase_roas.toFixed(2)}x`
          : "-",
        "-",
      ],
      ["ご利用額", roundInt(data.project.spend), calcMonthOnMonth(data.project.spend, data.previous?.spend)],
      [],
      ["3. 総評"],
      [periodLabel],
      [`獲得件数：${roundInt(data.project.cv)}件　　獲得単価：¥${roundInt(data.project.cpa).toLocaleString("ja-JP")}`],
      ["■ 期間内パフォーマンス"],
      [data.analysis.clientReport.summary],
      [data.analysis.clientReport.performance],
    ];

    const overviewRows = buildOverviewRows(period, data.daily, feeRate, feeMethod);
    const campaignRows = toCampaignTableRows(data.campaigns, feeRate, feeMethod);
    const adsetRows = toAdsetTableRows(data.adsets && data.adsets.length > 0 ? data.adsets : aggregateAdsetsFromCreatives(data.creatives), feeRate, feeMethod);
    const creativeRows = toCreativeTableRows(data.creatives, feeRate, feeMethod);
    const dailyTrendRows = buildDailyTrendRows(period, data.daily, feeRate, feeMethod);
    const aiRows = buildAiRows(data);
    const deviceRows = toDeviceTableRows(data.deviceBreakdown ?? [], feeRate, feeMethod);
    const demographicRows = toDemographicTableRows(data.demographicBreakdown ?? []);
    const heatmapRows = toHeatmapTableRows(data.hourlyBreakdown ?? []);

    await googleApiFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
      accessToken,
      {
        valueInputOption: "USER_ENTERED",
        data: [
          { range: "表紙!A1", values: coverRows },
          { range: "サマリー!A3", values: summaryRows },
          { range: "全体概要!A1", values: overviewRows },
          { range: "キャンペーン別!A1", values: campaignRows },
          { range: "広告セット別!A1", values: adsetRows },
          { range: "クリエイティブ別!A1", values: creativeRows },
          { range: "日次推移!A1", values: dailyTrendRows },
          { range: "AI分析!A1", values: aiRows },
          { range: "デバイス別!A1", values: deviceRows },
          { range: "'属性別(年齢×性別)'!A1", values: demographicRows },
          { range: "'曜日×時間帯'!A1", values: heatmapRows },
        ],
      },
    );

    const sheetIdByName = new Map<string, number>();
    spreadsheet.sheets.forEach((sheet) => {
      const id = sheet.properties?.sheetId;
      const titleKey = sheet.properties?.title;
      if (typeof id === "number" && typeof titleKey === "string") {
        sheetIdByName.set(titleKey, id);
      }
    });

    const formatRequests: Array<Record<string, unknown>> = [];

    const appendCommonTableStyle = (sheetName: string, rows: TableRows, headerRows: number[], totalRows: number[]) => {
      const sheetId = sheetIdByName.get(sheetName);
      if (sheetId === undefined) return;

      const colCount = rows[0]?.length ?? 1;
      headerRows.forEach((rowIndex) => {
        formatRequests.push(headerRequest(sheetId, rowIndex, colCount));
      });
      totalRows.forEach((rowIndex) => {
        formatRequests.push(totalRowRequest(sheetId, rowIndex, colCount));
      });
      formatRequests.push(borderRequest(sheetId, 0, rows.length, 0, colCount));
      formatRequests.push({
        autoResizeDimensions: {
          dimensions: {
            sheetId,
            dimension: "COLUMNS",
            startIndex: 0,
            endIndex: Math.max(colCount, 1),
          },
        },
      });
    };

    const coverSheetId = sheetIdByName.get("表紙");
    if (coverSheetId !== undefined) {
      formatRequests.push({
        mergeCells: {
          range: {
            sheetId: coverSheetId,
            startRowIndex: 2,
            endRowIndex: 3,
            startColumnIndex: 0,
            endColumnIndex: 6,
          },
          mergeType: "MERGE_ALL",
        },
      });

      formatRequests.push({
        repeatCell: {
          range: {
            sheetId: coverSheetId,
            startRowIndex: 2,
            endRowIndex: 3,
            startColumnIndex: 0,
            endColumnIndex: 1,
          },
          cell: {
            userEnteredFormat: {
              textFormat: { fontSize: 18, bold: true, foregroundColor: NAVY },
            },
          },
          fields: "userEnteredFormat.textFormat",
        },
      });

      formatRequests.push({
        repeatCell: {
          range: {
            sheetId: coverSheetId,
            startRowIndex: 2,
            endRowIndex: coverRows.length,
            startColumnIndex: 0,
            endColumnIndex: 6,
          },
          cell: {
            userEnteredFormat: {
              textFormat: { foregroundColor: NAVY, fontSize: 12 },
            },
          },
          fields: "userEnteredFormat.textFormat",
        },
      });

      formatRequests.push({
        autoResizeDimensions: {
          dimensions: {
            sheetId: coverSheetId,
            dimension: "COLUMNS",
            startIndex: 0,
            endIndex: 6,
          },
        },
      });
    }

    const summarySheetId = sheetIdByName.get("サマリー");
    if (summarySheetId !== undefined) {
      const summaryStartRowIndex = 2;
      const summaryEndRowIndex = summaryStartRowIndex + summaryRows.length;
      [2, 7, 13].forEach((rowIndex) => {
        formatRequests.push(headerRequest(summarySheetId, rowIndex, 6));
      });
      formatRequests.push(borderRequest(summarySheetId, summaryStartRowIndex, summaryEndRowIndex, 0, 6));
      formatRequests.push(numberFormatRequest(summarySheetId, 3, 6, 1, 2, "¥#,##0"));
      formatRequests.push(numberFormatRequest(summarySheetId, 3, 6, 2, 3, "0.0%"));
      formatRequests.push(numberFormatRequest(summarySheetId, 8, 10, 1, 2, "¥#,##0"));
      formatRequests.push(numberFormatRequest(summarySheetId, 11, 12, 1, 2, "¥#,##0"));
      formatRequests.push({
        autoResizeDimensions: {
          dimensions: { sheetId: summarySheetId, dimension: "COLUMNS", startIndex: 0, endIndex: 10 },
        },
      });
    }

    const overviewSheetId = sheetIdByName.get("全体概要");
    if (overviewSheetId !== undefined) {
      formatRequests.push(headerRequest(overviewSheetId, 4, 9));
      formatRequests.push(headerRequest(overviewSheetId, 11, 9));
      formatRequests.push({
        repeatCell: {
          range: {
            sheetId: overviewSheetId,
            startRowIndex: 5,
            endRowIndex: overviewRows.length,
            startColumnIndex: 0,
            endColumnIndex: 9,
          },
          cell: { userEnteredFormat: { horizontalAlignment: "RIGHT" } },
          fields: "userEnteredFormat.horizontalAlignment",
        },
      });
      formatRequests.push({
        repeatCell: {
          range: {
            sheetId: overviewSheetId,
            startRowIndex: 12,
            endRowIndex: overviewRows.length,
            startColumnIndex: 0,
            endColumnIndex: 9,
          },
          cell: { userEnteredFormat: { backgroundColor: ALTERNATE_ROW } },
          fields: "userEnteredFormat.backgroundColor",
        },
      });
      formatRequests.push(numberFormatRequest(overviewSheetId, 5, overviewRows.length, 1, 3, "#,##0"));
      formatRequests.push(numberFormatRequest(overviewSheetId, 5, overviewRows.length, 3, 4, "0.00%"));
      formatRequests.push(numberFormatRequest(overviewSheetId, 5, overviewRows.length, 4, 6, "¥#,##0"));
      formatRequests.push(numberFormatRequest(overviewSheetId, 5, overviewRows.length, 6, 7, "#,##0"));
      formatRequests.push(numberFormatRequest(overviewSheetId, 5, overviewRows.length, 7, 8, "0.00%"));
      formatRequests.push(numberFormatRequest(overviewSheetId, 5, overviewRows.length, 8, 9, "¥#,##0"));
      formatRequests.push(borderRequest(overviewSheetId, 4, overviewRows.length, 0, 9));
      formatRequests.push({
        autoResizeDimensions: {
          dimensions: { sheetId: overviewSheetId, dimension: "COLUMNS", startIndex: 0, endIndex: 9 },
        },
      });
    }

    appendCommonTableStyle("キャンペーン別", campaignRows, [0], [1]);
    appendCommonTableStyle("広告セット別", adsetRows, [0], [1]);
    appendCommonTableStyle("クリエイティブ別", creativeRows, [0], [1]);

    const campaignSheetId = sheetIdByName.get("キャンペーン別");
    if (campaignSheetId !== undefined) {
      formatRequests.push(numberFormatRequest(campaignSheetId, 1, campaignRows.length, 2, 4, "#,##0"));
      formatRequests.push(numberFormatRequest(campaignSheetId, 1, campaignRows.length, 4, 5, "0.00%"));
      formatRequests.push(numberFormatRequest(campaignSheetId, 1, campaignRows.length, 5, 8, "¥#,##0"));
      formatRequests.push(numberFormatRequest(campaignSheetId, 1, campaignRows.length, 8, 9, "#,##0"));
      formatRequests.push(numberFormatRequest(campaignSheetId, 1, campaignRows.length, 9, 10, "0.00%"));
      formatRequests.push(numberFormatRequest(campaignSheetId, 1, campaignRows.length, 10, 11, "¥#,##0"));
      formatRequests.push(numberFormatRequest(campaignSheetId, 1, campaignRows.length, 11, 12, "0.00"));

      for (let i = 2; i < campaignRows.length; i += 1) {
        const rank = String(campaignRows[i][12]);
        if (rank in RANK_COLORS) {
          formatRequests.push({
            repeatCell: {
              range: {
                sheetId: campaignSheetId,
                startRowIndex: i,
                endRowIndex: i + 1,
                startColumnIndex: 12,
                endColumnIndex: 13,
              },
              cell: { userEnteredFormat: { backgroundColor: RANK_COLORS[rank as "A" | "B" | "C" | "D"] } },
              fields: "userEnteredFormat.backgroundColor",
            },
          });
        }
      }
    }

    const adsetSheetId = sheetIdByName.get("広告セット別");
    if (adsetSheetId !== undefined) {
      formatRequests.push(numberFormatRequest(adsetSheetId, 1, adsetRows.length, 3, 5, "#,##0"));
      formatRequests.push(numberFormatRequest(adsetSheetId, 1, adsetRows.length, 5, 6, "0.00%"));
      formatRequests.push(numberFormatRequest(adsetSheetId, 1, adsetRows.length, 6, 9, "¥#,##0"));
      formatRequests.push(numberFormatRequest(adsetSheetId, 1, adsetRows.length, 9, 10, "#,##0"));
      formatRequests.push(numberFormatRequest(adsetSheetId, 1, adsetRows.length, 10, 11, "0.00%"));
      formatRequests.push(numberFormatRequest(adsetSheetId, 1, adsetRows.length, 11, 12, "¥#,##0"));

      for (let i = 2; i < adsetRows.length; i += 1) {
        const rank = String(adsetRows[i][12]);
        if (rank in RANK_COLORS) {
          formatRequests.push({
            repeatCell: {
              range: {
                sheetId: adsetSheetId,
                startRowIndex: i,
                endRowIndex: i + 1,
                startColumnIndex: 12,
                endColumnIndex: 13,
              },
              cell: { userEnteredFormat: { backgroundColor: RANK_COLORS[rank as "A" | "B" | "C" | "D"] } },
              fields: "userEnteredFormat.backgroundColor",
            },
          });
        }
      }
    }

    const creativeSheetId = sheetIdByName.get("クリエイティブ別");
    if (creativeSheetId !== undefined) {
      formatRequests.push(numberFormatRequest(creativeSheetId, 1, creativeRows.length, 5, 7, "#,##0"));
      formatRequests.push(numberFormatRequest(creativeSheetId, 1, creativeRows.length, 7, 8, "0.00%"));
      formatRequests.push(numberFormatRequest(creativeSheetId, 1, creativeRows.length, 8, 11, "¥#,##0"));
      formatRequests.push(numberFormatRequest(creativeSheetId, 1, creativeRows.length, 11, 12, "#,##0"));
      formatRequests.push(numberFormatRequest(creativeSheetId, 1, creativeRows.length, 12, 13, "0.00%"));
      formatRequests.push(numberFormatRequest(creativeSheetId, 1, creativeRows.length, 13, 14, "¥#,##0"));

      for (let i = 2; i < creativeRows.length; i += 1) {
        const rank = String(creativeRows[i][14]);
        if (rank in RANK_COLORS) {
          formatRequests.push({
            repeatCell: {
              range: {
                sheetId: creativeSheetId,
                startRowIndex: i,
                endRowIndex: i + 1,
                startColumnIndex: 14,
                endColumnIndex: 15,
              },
              cell: { userEnteredFormat: { backgroundColor: RANK_COLORS[rank as "A" | "B" | "C" | "D"] } },
              fields: "userEnteredFormat.backgroundColor",
            },
          });
        }
      }

      for (let i = 2; i < creativeRows.length; i += 1) {
        formatRequests.push({
          updateDimensionProperties: {
            range: {
              sheetId: creativeSheetId,
              dimension: "ROWS",
              startIndex: i,
              endIndex: i + 1,
            },
            properties: {
              pixelSize: 60,
            },
            fields: "pixelSize",
          },
        });
      }

      formatRequests.push({
        updateDimensionProperties: {
          range: {
            sheetId: creativeSheetId,
            dimension: "COLUMNS",
            startIndex: 1,
            endIndex: 2,
          },
          properties: {
            pixelSize: 80,
          },
          fields: "pixelSize",
        },
      });
    }

    const dailySheetId = sheetIdByName.get("日次推移");
    if (dailySheetId !== undefined) {
      formatRequests.push(headerRequest(dailySheetId, 0, 11));
      formatRequests.push(totalRowRequest(dailySheetId, dailyTrendRows.length - 1, 11));
      formatRequests.push(numberFormatRequest(dailySheetId, 1, dailyTrendRows.length, 2, 4, "#,##0"));
      formatRequests.push(numberFormatRequest(dailySheetId, 1, dailyTrendRows.length, 4, 5, "0.00%"));
      formatRequests.push(numberFormatRequest(dailySheetId, 1, dailyTrendRows.length, 5, 8, "¥#,##0"));
      formatRequests.push(numberFormatRequest(dailySheetId, 1, dailyTrendRows.length, 8, 9, "#,##0"));
      formatRequests.push(numberFormatRequest(dailySheetId, 1, dailyTrendRows.length, 9, 10, "0.00%"));
      formatRequests.push(numberFormatRequest(dailySheetId, 1, dailyTrendRows.length, 10, 11, "¥#,##0"));
      formatRequests.push(borderRequest(dailySheetId, 0, dailyTrendRows.length, 0, 11));

      for (let i = 1; i < dailyTrendRows.length - 1; i += 1) {
        const weekday = String(dailyTrendRows[i][1]);
        if (weekday === "土" || weekday === "日") {
          formatRequests.push({
            repeatCell: {
              range: {
                sheetId: dailySheetId,
                startRowIndex: i,
                endRowIndex: i + 1,
                startColumnIndex: 0,
                endColumnIndex: 11,
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: WEEKEND_BG,
                },
              },
              fields: "userEnteredFormat.backgroundColor",
            },
          });
        }
      }

      formatRequests.push({
        autoResizeDimensions: {
          dimensions: { sheetId: dailySheetId, dimension: "COLUMNS", startIndex: 0, endIndex: 11 },
        },
      });
    }

    const aiSheetId = sheetIdByName.get("AI分析");
    if (aiSheetId !== undefined) {
      [0, 5, 9, 12].forEach((rowIndex) => {
        formatRequests.push(headerRequest(aiSheetId, rowIndex, 2));
      });
      formatRequests.push(borderRequest(aiSheetId, 0, aiRows.length, 0, 2));
      formatRequests.push({
        repeatCell: {
          range: {
            sheetId: aiSheetId,
            startRowIndex: 0,
            endRowIndex: aiRows.length,
            startColumnIndex: 0,
            endColumnIndex: 2,
          },
          cell: {
            userEnteredFormat: {
              wrapStrategy: "WRAP",
              verticalAlignment: "TOP",
            },
          },
          fields: "userEnteredFormat(wrapStrategy,verticalAlignment)",
        },
      });
      formatRequests.push({
        autoResizeDimensions: {
          dimensions: { sheetId: aiSheetId, dimension: "COLUMNS", startIndex: 0, endIndex: 2 },
        },
      });
    }

    // Device breakdown formatting
    const deviceSheetId = sheetIdByName.get("デバイス別");
    if (deviceSheetId !== undefined) {
      appendCommonTableStyle("デバイス別", deviceRows, [0], [1]);
      formatRequests.push(numberFormatRequest(deviceSheetId, 1, deviceRows.length, 1, 3, "#,##0"));
      formatRequests.push(numberFormatRequest(deviceSheetId, 1, deviceRows.length, 3, 4, "0.00%"));
      formatRequests.push(numberFormatRequest(deviceSheetId, 1, deviceRows.length, 4, 6, "¥#,##0"));
      formatRequests.push(numberFormatRequest(deviceSheetId, 1, deviceRows.length, 6, 7, "#,##0"));
      formatRequests.push(numberFormatRequest(deviceSheetId, 1, deviceRows.length, 7, 8, "¥#,##0"));
      formatRequests.push(numberFormatRequest(deviceSheetId, 1, deviceRows.length, 8, 9, "0.0%"));
    }

    // Demographic breakdown formatting
    const demoSheetId = sheetIdByName.get("属性別(年齢×性別)");
    if (demoSheetId !== undefined) {
      // Section headers (CV, CPA, Spend)
      [0, 5, 10].forEach((rowIndex) => {
        formatRequests.push(headerRequest(demoSheetId, rowIndex, 7));
      });
      // Sub-headers (age labels)
      [1, 6, 11].forEach((rowIndex) => {
        formatRequests.push({
          repeatCell: {
            range: { sheetId: demoSheetId, startRowIndex: rowIndex, endRowIndex: rowIndex + 1, startColumnIndex: 0, endColumnIndex: 7 },
            cell: { userEnteredFormat: { backgroundColor: LIGHT_GRAY, textFormat: { bold: true } } },
            fields: "userEnteredFormat(backgroundColor,textFormat)",
          },
        });
      });
      formatRequests.push(numberFormatRequest(demoSheetId, 2, 5, 1, 7, "#,##0"));
      formatRequests.push(numberFormatRequest(demoSheetId, 7, 10, 1, 7, "¥#,##0"));
      formatRequests.push(numberFormatRequest(demoSheetId, 12, 15, 1, 7, "¥#,##0"));
      formatRequests.push(borderRequest(demoSheetId, 0, demographicRows.length, 0, 7));
      formatRequests.push({
        autoResizeDimensions: {
          dimensions: { sheetId: demoSheetId, dimension: "COLUMNS", startIndex: 0, endIndex: 7 },
        },
      });
    }

    // Hourly heatmap formatting
    const heatmapSheetId = sheetIdByName.get("曜日×時間帯");
    if (heatmapSheetId !== undefined) {
      // Section headers
      [0, 10, 20].forEach((rowIndex) => {
        formatRequests.push(headerRequest(heatmapSheetId, rowIndex, 25));
      });
      // Sub-headers (hour labels)
      [1, 11, 21].forEach((rowIndex) => {
        formatRequests.push({
          repeatCell: {
            range: { sheetId: heatmapSheetId, startRowIndex: rowIndex, endRowIndex: rowIndex + 1, startColumnIndex: 0, endColumnIndex: 25 },
            cell: { userEnteredFormat: { backgroundColor: LIGHT_GRAY, textFormat: { bold: true, fontSize: 9 } } },
            fields: "userEnteredFormat(backgroundColor,textFormat)",
          },
        });
      });
      formatRequests.push(numberFormatRequest(heatmapSheetId, 2, 9, 1, 25, "#,##0"));
      formatRequests.push(numberFormatRequest(heatmapSheetId, 12, 19, 1, 25, "¥#,##0"));
      formatRequests.push(numberFormatRequest(heatmapSheetId, 22, 29, 1, 25, "¥#,##0"));
      formatRequests.push(borderRequest(heatmapSheetId, 0, heatmapRows.length, 0, 25));
      formatRequests.push({
        autoResizeDimensions: {
          dimensions: { sheetId: heatmapSheetId, dimension: "COLUMNS", startIndex: 0, endIndex: 25 },
        },
      });
    }

    // broad numeric format catch-up for campaign/adset/creative detail tables
    [
      ["キャンペーン別", campaignRows],
      ["広告セット別", adsetRows],
      ["クリエイティブ別", creativeRows],
    ].forEach(([name, rows]) => {
      const sheetId = sheetIdByName.get(name as string);
      if (sheetId === undefined) return;
      const colCount = (rows as TableRows)[0]?.length ?? 1;
      formatRequests.push(numberFormatRequest(sheetId, 1, (rows as TableRows).length, 0, colCount, "#,##0"));
    });

    await googleApiFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
      accessToken,
      {
        requests: formatRequests,
      },
    );

    return NextResponse.json({
      ok: true,
      spreadsheetId,
      spreadsheetUrl,
      title,
      coverMergeRange: `表紙!A3:${toA1Col(6)}3`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "スプレッドシートの作成に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
