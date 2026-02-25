export interface BudgetConfig {
  projectName: string;
  monthlyBudget: number;
}

export const DEFAULT_BUDGETS: BudgetConfig[] = [
  { projectName: "CREETstage ライバー募集", monthlyBudget: 300000 },
  { projectName: "フェイス美容外科 来院者増加", monthlyBudget: 500000 },
  { projectName: "Trust株式会社 採用施策", monthlyBudget: 200000 },
];

export interface BudgetProgress {
  monthlyBudget: number | null;
  currentSpend: number;
  consumptionRate: number | null;
  remainingBudget: number | null;
  daysElapsed: number;
  daysInMonth: number;
  idealRate: number;
  projectedSpend: number | null;
  paceStatus: "under" | "on-track" | "over";
}

export function calculateBudgetProgress(projectName: string, currentSpend: number): BudgetProgress {
  const config = DEFAULT_BUDGETS.find((budget) => budget.projectName === projectName);
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysElapsed = now.getDate();
  const idealRate = (daysElapsed / daysInMonth) * 100;

  if (!config) {
    return {
      monthlyBudget: null,
      currentSpend,
      consumptionRate: null,
      remainingBudget: null,
      daysElapsed,
      daysInMonth,
      idealRate,
      projectedSpend: null,
      paceStatus: "on-track",
    };
  }

  const consumptionRate = (currentSpend / config.monthlyBudget) * 100;
  const remainingBudget = config.monthlyBudget - currentSpend;
  const projectedSpend = daysElapsed > 0 ? (currentSpend / daysElapsed) * daysInMonth : 0;

  let paceStatus: "under" | "on-track" | "over" = "on-track";
  if (consumptionRate > idealRate + 10) paceStatus = "over";
  else if (consumptionRate < idealRate - 10) paceStatus = "under";

  return {
    monthlyBudget: config.monthlyBudget,
    currentSpend,
    consumptionRate,
    remainingBudget,
    daysElapsed,
    daysInMonth,
    idealRate,
    projectedSpend,
    paceStatus,
  };
}
