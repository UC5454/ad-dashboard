import type { FeeCalcMethod } from "@/lib/settings";

export interface BudgetConfig {
  projectName: string;
  monthlyBudget: number;
  feeRate: number;
}

export const DEFAULT_FEE_RATE = 0.2;

export const DEFAULT_BUDGETS: BudgetConfig[] = [
  { projectName: "CREETstage ライバー募集", monthlyBudget: 300000, feeRate: DEFAULT_FEE_RATE },
  { projectName: "フェイス美容外科 来院者増加", monthlyBudget: 500000, feeRate: DEFAULT_FEE_RATE },
  { projectName: "Trust株式会社 採用施策", monthlyBudget: 200000, feeRate: DEFAULT_FEE_RATE },
];

export interface BudgetProgress {
  monthlyBudget: number | null;
  currentSpend: number;
  feeRate: number;
  spendWithFee: number;
  consumptionRate: number | null;
  remainingBudget: number | null;
  daysElapsed: number;
  daysInMonth: number;
  idealRate: number;
  projectedSpend: number | null;
  projectedSpendWithFee: number | null;
  paceStatus: "under" | "on-track" | "over";
}

export function applyFee(amount: number, feeRate: number, method: FeeCalcMethod): number {
  if (method === "margin") {
    return feeRate < 1 ? amount / (1 - feeRate) : amount;
  }
  return amount * (1 + feeRate);
}

export function calculateBudgetProgress(
  projectName: string,
  currentSpend: number,
  budgets?: BudgetConfig[],
  defaultFeeRate?: number,
  feeCalcMethod?: FeeCalcMethod,
): BudgetProgress {
  const budgetList = budgets ?? DEFAULT_BUDGETS;
  const fallbackFeeRate = defaultFeeRate ?? DEFAULT_FEE_RATE;
  const method = feeCalcMethod ?? "markup";
  const config = budgetList.find((budget) => budget.projectName === projectName);
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysElapsed = now.getDate();
  const idealRate = (daysElapsed / daysInMonth) * 100;

  if (!config) {
    const spendWithFee = applyFee(currentSpend, fallbackFeeRate, method);
    return {
      monthlyBudget: null,
      currentSpend,
      feeRate: fallbackFeeRate,
      spendWithFee,
      consumptionRate: null,
      remainingBudget: null,
      daysElapsed,
      daysInMonth,
      idealRate,
      projectedSpend: null,
      projectedSpendWithFee: null,
      paceStatus: "on-track",
    };
  }

  const consumptionRate = (currentSpend / config.monthlyBudget) * 100;
  const remainingBudget = config.monthlyBudget - currentSpend;
  const projectedSpend = daysElapsed > 0 ? (currentSpend / daysElapsed) * daysInMonth : 0;
  const spendWithFee = applyFee(currentSpend, config.feeRate, method);
  const projectedSpendWithFee = applyFee(projectedSpend, config.feeRate, method);

  let paceStatus: "under" | "on-track" | "over" = "on-track";
  if (consumptionRate > idealRate + 10) paceStatus = "over";
  else if (consumptionRate < idealRate - 10) paceStatus = "under";

  return {
    monthlyBudget: config.monthlyBudget,
    currentSpend,
    feeRate: config.feeRate,
    spendWithFee,
    consumptionRate,
    remainingBudget,
    daysElapsed,
    daysInMonth,
    idealRate,
    projectedSpend,
    projectedSpendWithFee,
    paceStatus,
  };
}
