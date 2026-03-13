export type FeeCalcMethod = "markup" | "margin";

export interface KpiMetric {
  label: string;
  value: number;
  previous: number;
  type: "currency" | "number" | "roas" | "percent";
  inverted?: boolean;
  subLabel?: string;
  target?: number;
}

export interface ClientRow {
  id: string;
  name: string;
  monthlyBudgetGoogle: number;
  monthlyBudgetMeta: number;
  spend: number;
  spendWithFee: number;
  feeLabel: string;
  cv: number;
  cpa: number;
  roas: number;
  ctr: number;
  status: "active" | "paused" | "archived";
}

export interface TrendRow {
  date: string;
  spend: number;
  cv: number;
  cpa: number;
  impressions: number;
  clicks: number;
  ctr: number;
}

export interface AlertItem {
  id: string;
  type: "critical" | "warning" | "info";
  title: string;
  message: string;
  projectName?: string;
}
