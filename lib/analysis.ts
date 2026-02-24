import type {
  MetaAction,
  MetaAdInsights,
  MetaAdsetInsights,
  MetaCampaignInsights,
  MetaInsights,
} from "@/types/meta";

function readActionValue(actions: MetaAction[] | undefined, actionType: string): number {
  const action = actions?.find((item) => item.action_type === actionType);
  return action ? Number.parseFloat(action.value || "0") || 0 : 0;
}

export function generateAccountAnalysis(
  data: MetaInsights,
  campaigns: MetaCampaignInsights[],
): string[] {
  const comments: string[] = [];

  const ctr = Number.parseFloat(data.ctr || "0") || 0;
  if (ctr > 2) comments.push(`CTRが${ctr.toFixed(1)}%と高水準。クリエイティブの反応が良好`);
  if (ctr < 0.5) comments.push(`CTRが${ctr.toFixed(1)}%と低め。ターゲティングの見直しを推奨`);

  const spend = Number.parseFloat(data.spend || "0") || 0;
  const clicks = Number.parseFloat(data.clicks || "0") || 0;
  const cpc = clicks > 0 ? spend / clicks : 0;
  if (cpc > 200) comments.push(`CPCが¥${Math.round(cpc)}と高め。入札戦略の最適化を検討`);
  if (cpc > 0 && cpc < 80) comments.push(`CPCが¥${Math.round(cpc)}と効率的`);

  const cvCount = readActionValue(data.actions, "offsite_conversion.fb_pixel_custom");
  if (cvCount > 0) {
    const cpa = spend / cvCount;
    if (cpa < 200) comments.push(`CV単価¥${Math.round(cpa)}で非常に効率的な獲得`);
    if (cpa > 500) comments.push(`CV単価¥${Math.round(cpa)}。LP改善またはターゲット見直しを推奨`);
  }

  const freq = Number.parseFloat(data.frequency || "0") || 0;
  if (freq > 3) comments.push(`フリークエンシー${freq.toFixed(1)}回。広告疲れの可能性あり`);

  if (campaigns.length > 1) {
    const sorted = [...campaigns].sort(
      (a, b) => (Number.parseFloat(b.spend || "0") || 0) - (Number.parseFloat(a.spend || "0") || 0),
    );
    const top = sorted[0];
    comments.push(
      `最大消化: ${top.campaign_name}（¥${Math.round(Number.parseFloat(top.spend || "0") || 0).toLocaleString("ja-JP")}）`,
    );
  }

  if (comments.length === 0) {
    comments.push("現在の配信データでは大きな異常は検知されていません。");
  }

  return comments;
}

export interface MetricSnapshot {
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  lpv: number;
  cv: number;
  cpa: number;
}

export interface KpiCard {
  key: keyof MetricSnapshot;
  label: string;
  value: number;
  previous: number;
  deltaPct: number | null;
  format: "currency" | "number" | "percent";
}

export function parseMetricSnapshot(data: MetaInsights | null): MetricSnapshot {
  const spend = Number.parseFloat(data?.spend || "0") || 0;
  const impressions = Number.parseFloat(data?.impressions || "0") || 0;
  const clicks = Number.parseFloat(data?.clicks || "0") || 0;
  const ctr = Number.parseFloat(data?.ctr || "0") || 0;
  const cpc = Number.parseFloat(data?.cpc || "0") || 0;
  const lpv = readActionValue(data?.actions, "landing_page_view");
  const cv = readActionValue(data?.actions, "offsite_conversion.fb_pixel_custom");
  const cpa = cv > 0 ? spend / cv : 0;

  return { spend, impressions, clicks, ctr, cpc, lpv, cv, cpa };
}

function calcDelta(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}

export function buildKpiCards(current: MetricSnapshot, previous: MetricSnapshot): KpiCard[] {
  return [
    {
      key: "spend",
      label: "消化額",
      value: current.spend,
      previous: previous.spend,
      deltaPct: calcDelta(current.spend, previous.spend),
      format: "currency",
    },
    {
      key: "impressions",
      label: "IMP",
      value: current.impressions,
      previous: previous.impressions,
      deltaPct: calcDelta(current.impressions, previous.impressions),
      format: "number",
    },
    {
      key: "clicks",
      label: "クリック",
      value: current.clicks,
      previous: previous.clicks,
      deltaPct: calcDelta(current.clicks, previous.clicks),
      format: "number",
    },
    {
      key: "ctr",
      label: "CTR",
      value: current.ctr,
      previous: previous.ctr,
      deltaPct: calcDelta(current.ctr, previous.ctr),
      format: "percent",
    },
    {
      key: "cpc",
      label: "CPC",
      value: current.cpc,
      previous: previous.cpc,
      deltaPct: calcDelta(current.cpc, previous.cpc),
      format: "currency",
    },
    {
      key: "lpv",
      label: "LPV",
      value: current.lpv,
      previous: previous.lpv,
      deltaPct: calcDelta(current.lpv, previous.lpv),
      format: "number",
    },
    {
      key: "cv",
      label: "CV",
      value: current.cv,
      previous: previous.cv,
      deltaPct: calcDelta(current.cv, previous.cv),
      format: "number",
    },
    {
      key: "cpa",
      label: "CPA",
      value: current.cpa,
      previous: previous.cpa,
      deltaPct: calcDelta(current.cpa, previous.cpa),
      format: "currency",
    },
  ];
}

export interface BudgetPacing {
  elapsedDays: number;
  daysInMonth: number;
  spendToDate: number;
  projectedSpend: number;
  budget: number;
  utilizationPct: number;
  projectionPct: number;
}

export function calcBudgetPacing(spendToDate: number, budget: number, date = new Date()): BudgetPacing {
  const year = date.getFullYear();
  const month = date.getMonth();
  const elapsedDays = date.getDate();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const projectedSpend = elapsedDays > 0 ? (spendToDate / elapsedDays) * daysInMonth : 0;
  const utilizationPct = budget > 0 ? (spendToDate / budget) * 100 : 0;
  const projectionPct = budget > 0 ? (projectedSpend / budget) * 100 : 0;
  return { elapsedDays, daysInMonth, spendToDate, projectedSpend, budget, utilizationPct, projectionPct };
}

export function summarizeAdsetRisks(adsets: MetaAdsetInsights[]): string[] {
  if (adsets.length === 0) return [];
  const comments: string[] = [];
  const spendSorted = [...adsets].sort(
    (a, b) => (Number.parseFloat(b.spend || "0") || 0) - (Number.parseFloat(a.spend || "0") || 0),
  );
  const top = spendSorted[0];
  const topSpend = Number.parseFloat(top.spend || "0") || 0;
  comments.push(`広告セット最大消化: ${top.adset_name}（¥${Math.round(topSpend).toLocaleString("ja-JP")}）`);

  const highFreq = adsets
    .map((adset) => ({
      name: adset.adset_name,
      frequency: Number.parseFloat(adset.frequency || "0") || 0,
    }))
    .filter((row) => row.frequency >= 3);
  if (highFreq.length > 0) {
    comments.push(`高フリークエンシー広告セット ${highFreq.length}件（疲弊リスク）`);
  }

  return comments;
}

export function topCreativeByCv(ads: MetaAdInsights[]) {
  const rows = ads.map((ad) => {
    const spend = Number.parseFloat(ad.spend || "0") || 0;
    const cv = readActionValue(ad.actions, "offsite_conversion.fb_pixel_custom");
    return { ad, spend, cv, cpa: cv > 0 ? spend / cv : 0 };
  });
  rows.sort((a, b) => b.cv - a.cv);
  return rows[0] ?? null;
}
