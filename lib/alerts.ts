export interface Alert {
  type: "warning" | "critical" | "info";
  category: "budget" | "performance" | "creative";
  title: string;
  message: string;
  projectName?: string;
}

interface ProjectInput {
  name: string;
  spend: number;
  cv: number;
  cpa: number;
  ctr: number;
}

interface DailyInput {
  date_start: string;
  spend: number;
  cv: number;
  impressions?: number;
  clicks?: number;
}

interface CreativeInput {
  creative_name: string;
  spend: number;
  cv: number;
  ctr: number;
}

interface BudgetInput {
  projectName: string;
  monthlyBudget: number;
}

function getBudget(projectName: string, budgets: BudgetInput[]): BudgetInput | undefined {
  return budgets.find((budget) => budget.projectName === projectName);
}

function calcIdealRate(): { idealRate: number; daysElapsed: number; daysInMonth: number } {
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysElapsed = now.getDate();
  const idealRate = (daysElapsed / daysInMonth) * 100;
  return { idealRate, daysElapsed, daysInMonth };
}

export function generateAlerts(
  projects: ProjectInput[],
  daily: DailyInput[],
  creatives: CreativeInput[],
  budgets: BudgetInput[],
): Alert[] {
  const alerts: Alert[] = [];
  const { idealRate, daysElapsed, daysInMonth } = calcIdealRate();

  projects.forEach((project) => {
    const budget = getBudget(project.name, budgets);
    if (!budget) return;

    const consumptionRate = (project.spend / budget.monthlyBudget) * 100;
    const projectedSpend = daysElapsed > 0 ? (project.spend / daysElapsed) * daysInMonth : 0;

    if (consumptionRate > 90) {
      alerts.push({
        type: "critical",
        category: "budget",
        title: "予算超過",
        message: `${project.name}の消化率が${consumptionRate.toFixed(1)}%に達しています。`,
        projectName: project.name,
      });
    }

    if (consumptionRate < idealRate * 0.7) {
      alerts.push({
        type: "warning",
        category: "budget",
        title: "予算ペース遅れ",
        message: `${project.name}の消化率が理想進捗の70%未満です。`,
        projectName: project.name,
      });
    }

    if (projectedSpend > budget.monthlyBudget * 1.1) {
      alerts.push({
        type: "warning",
        category: "budget",
        title: "着地予想超過",
        message: `${project.name}の着地予想が月間予算を10%以上上回る見込みです。`,
        projectName: project.name,
      });
    }
  });

  const cpaTargets = projects.filter((project) => project.cv > 0 && project.cpa > 0);
  const avgCpa =
    cpaTargets.length > 0 ? cpaTargets.reduce((sum, project) => sum + project.cpa, 0) / cpaTargets.length : 0;

  if (avgCpa > 0) {
    projects.forEach((project) => {
      if (project.cv <= 0) return;
      if (project.cpa >= avgCpa * 1.5) {
        alerts.push({
          type: "warning",
          category: "performance",
          title: "CPA高騰",
          message: `${project.name}のCPAが全体平均の1.5倍以上です。`,
          projectName: project.name,
        });
      }
    });
  }

  const sortedDaily = [...daily].sort((a, b) => a.date_start.localeCompare(b.date_start));
  if (sortedDaily.length >= 4) {
    const latest = sortedDaily[sortedDaily.length - 1];
    const recent = sortedDaily.slice(-4, -1);
    const avgCv = recent.reduce((sum, row) => sum + (row.cv || 0), 0) / recent.length;
    if (avgCv > 0 && latest.cv <= avgCv * 0.5) {
      alerts.push({
        type: "warning",
        category: "performance",
        title: "CV急減",
        message: "直近日のCVが3日平均の50%以下です。",
      });
    }
  }

  if (sortedDaily.length >= 2) {
    const latest = sortedDaily[sortedDaily.length - 1];
    const previous = sortedDaily[sortedDaily.length - 2];
    if ((previous.impressions ?? 0) > 0 && (latest.impressions ?? 0) <= (previous.impressions ?? 0) * 0.3) {
      alerts.push({
        type: "info",
        category: "performance",
        title: "配信停滞",
        message: "直近日のIMPが前日比30%以下です。",
      });
    }
  }

  if (sortedDaily.length >= 4) {
    const latest = sortedDaily[sortedDaily.length - 1];
    const recent = sortedDaily.slice(-4, -1);

    const latestClicks = latest.clicks ?? 0;
    const latestImpressions = latest.impressions ?? 0;
    const latestCpc = latestClicks > 0 ? latest.spend / latestClicks : 0;
    const avgCpc =
      recent.reduce((sum, row) => {
        const clicks = row.clicks ?? 0;
        return sum + (clicks > 0 ? row.spend / clicks : 0);
      }, 0) / recent.length;

    if (latestClicks > 0 && avgCpc > 0 && latestCpc >= avgCpc * 2) {
      alerts.push({
        type: "warning",
        category: "performance",
        title: "CPC急騰",
        message: `直近日のCPCが¥${Math.round(latestCpc).toLocaleString("ja-JP")}で、3日平均¥${Math.round(avgCpc).toLocaleString("ja-JP")}の2倍以上です。入札・ターゲティングを確認してください。`,
      });
    }

    if (latestClicks > 0 && avgCpc > 0 && latestCpc <= avgCpc * 0.5) {
      alerts.push({
        type: "info",
        category: "performance",
        title: "CPC急落",
        message: `直近日のCPCが¥${Math.round(latestCpc).toLocaleString("ja-JP")}で、3日平均¥${Math.round(avgCpc).toLocaleString("ja-JP")}の50%以下です。品質向上の可能性があります。`,
      });
    }

    const latestCpm = latestImpressions > 0 ? (latest.spend / latestImpressions) * 1000 : 0;
    const avgCpm =
      recent.reduce((sum, row) => {
        const impressions = row.impressions ?? 0;
        return sum + (impressions > 0 ? (row.spend / impressions) * 1000 : 0);
      }, 0) / recent.length;

    if (latestImpressions > 0 && avgCpm > 0 && latestCpm >= avgCpm * 2) {
      alerts.push({
        type: "warning",
        category: "performance",
        title: "CPM急騰",
        message: `直近日のCPMが¥${Math.round(latestCpm).toLocaleString("ja-JP")}で、3日平均の2倍以上です。競合状況やオーディエンス設定を確認してください。`,
      });
    }
  }

  if (sortedDaily.length >= 2) {
    const latest = sortedDaily[sortedDaily.length - 1];
    const previous = sortedDaily[sortedDaily.length - 2];
    if ((previous.impressions ?? 0) > 0 && (latest.impressions ?? 0) === 0) {
      alerts.push({
        type: "critical",
        category: "performance",
        title: "配信停止検知",
        message: "直近日のインプレッションが0です。審査落ち・配信停止の可能性があります。管理画面を確認してください。",
      });
    }
  }

  creatives.forEach((creative) => {
    if (creative.cv === 0 && creative.spend >= 5000) {
      alerts.push({
        type: "critical",
        category: "creative",
        title: "CV0高消化クリエイティブ",
        message: `${creative.creative_name}がCV 0件で消化額¥${Math.round(creative.spend).toLocaleString("ja-JP")}です。`,
      });
    }
  });

  return alerts;
}
