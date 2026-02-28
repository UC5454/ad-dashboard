const STORAGE_KEY = "ad-dashboard-settings";

export interface BudgetSetting {
  projectName: string;
  monthlyBudget: number;
  feeRate: number;
}

export type FeeCalcMethod = "markup" | "margin";

export interface AlertThresholds {
  budgetOverRate: number;
  budgetPaceLagRate: number;
  projectedOverMultiplier: number;
  cpaHighMultiplier: number;
  cvDropRate: number;
  cpcSpikeMultiplier: number;
  cpcDropRate: number;
  cpmSpikeMultiplier: number;
  zeroConvSpendThreshold: number;
  impDropRate: number;
}

export interface SlackConfig {
  webhookUrl: string;
  enabled: boolean;
  channelName?: string;
}

export interface DashboardSettings {
  budgets: BudgetSetting[];
  defaultFeeRate: number;
  feeCalcMethod: FeeCalcMethod;
  alertThresholds: AlertThresholds;
  slack: SlackConfig;
}

export const DEFAULT_SETTINGS: DashboardSettings = {
  budgets: [
    { projectName: "CREETstage ライバー募集", monthlyBudget: 300000, feeRate: 0.2 },
    { projectName: "フェイス美容外科 来院者増加", monthlyBudget: 500000, feeRate: 0.2 },
    { projectName: "Trust株式会社 採用施策", monthlyBudget: 200000, feeRate: 0.2 },
  ],
  defaultFeeRate: 0.2,
  feeCalcMethod: "markup",
  slack: {
    webhookUrl: "",
    enabled: false,
    channelName: "",
  },
  alertThresholds: {
    budgetOverRate: 90,
    budgetPaceLagRate: 70,
    projectedOverMultiplier: 1.1,
    cpaHighMultiplier: 1.5,
    cvDropRate: 50,
    cpcSpikeMultiplier: 2.0,
    cpcDropRate: 50,
    cpmSpikeMultiplier: 2.0,
    zeroConvSpendThreshold: 5000,
    impDropRate: 30,
  },
};

export function loadSettings(): DashboardSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<DashboardSettings>;
    return {
      budgets: parsed.budgets ?? DEFAULT_SETTINGS.budgets,
      defaultFeeRate: parsed.defaultFeeRate ?? DEFAULT_SETTINGS.defaultFeeRate,
      feeCalcMethod: parsed.feeCalcMethod ?? DEFAULT_SETTINGS.feeCalcMethod,
      slack: parsed.slack ?? DEFAULT_SETTINGS.slack,
      alertThresholds: { ...DEFAULT_SETTINGS.alertThresholds, ...parsed.alertThresholds },
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: DashboardSettings): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
