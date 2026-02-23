import { getDb } from "./db";
import { sendSlackNotification, formatAlertMessage } from "./slack";

interface AlertThreshold {
  metric: string;
  warningPct: number;
  criticalPct: number;
  direction: "increase" | "decrease" | "both";
  minAbsoluteValue: number; // Filter low-volume false positives
}

const THRESHOLDS: AlertThreshold[] = [
  { metric: "cpa", warningPct: 20, criticalPct: 40, direction: "increase", minAbsoluteValue: 1000 },
  { metric: "roas", warningPct: 15, criticalPct: 30, direction: "decrease", minAbsoluteValue: 0.5 },
  { metric: "ctr", warningPct: 20, criticalPct: 35, direction: "decrease", minAbsoluteValue: 0.5 },
  { metric: "conversions", warningPct: 30, criticalPct: 50, direction: "decrease", minAbsoluteValue: 1 },
];

// Budget pace thresholds (separate logic)
const BUDGET_WARNING_PCT = 15;
const BUDGET_CRITICAL_PCT = 30;

interface MetricRow {
  date: string;
  value: number;
}

export async function checkAnomalies(clientId: string, platform: string): Promise<void> {
  const db = getDb();

  for (const threshold of THRESHOLDS) {
    const rows = db
      .prepare(
        `SELECT date, ${threshold.metric} as value
         FROM ad_metrics
         WHERE client_id = ? AND platform = ? AND level = 'account'
         ORDER BY date DESC
         LIMIT 8`
      )
      .all(clientId, platform) as MetricRow[];

    if (rows.length < 8) continue;

    const today = rows[0];
    const movingAvg =
      rows.slice(1).reduce((sum, r) => sum + r.value, 0) / 7;

    if (movingAvg === 0 || today.value < threshold.minAbsoluteValue) continue;

    let deviationPct: number;
    if (threshold.direction === "increase") {
      deviationPct = ((today.value - movingAvg) / movingAvg) * 100;
    } else if (threshold.direction === "decrease") {
      deviationPct = ((movingAvg - today.value) / movingAvg) * 100;
    } else {
      deviationPct = Math.abs(((today.value - movingAvg) / movingAvg) * 100);
    }

    let severity: string | null = null;
    if (deviationPct >= threshold.criticalPct) {
      severity = "critical";
    } else if (deviationPct >= threshold.warningPct) {
      severity = "warning";
    }

    if (severity) {
      // Get client name
      const client = db
        .prepare("SELECT name FROM clients WHERE id = ?")
        .get(clientId) as { name: string } | undefined;

      const alertData = {
        clientName: client?.name || clientId,
        platform,
        metric: threshold.metric,
        severity,
        currentValue: today.value,
        movingAvg,
        deviationPct,
      };

      // Save alert
      db.prepare(
        `INSERT INTO alerts (client_id, platform, metric, severity, current_value, moving_avg, deviation_pct, message)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        clientId,
        platform,
        threshold.metric,
        severity,
        today.value,
        movingAvg,
        deviationPct,
        formatAlertMessage(alertData)
      );

      // Send Slack notification
      await sendSlackNotification(formatAlertMessage(alertData));
    }
  }
}

export function checkBudgetPace(clientId: string): void {
  const db = getDb();
  const client = db
    .prepare("SELECT * FROM clients WHERE id = ?")
    .get(clientId) as {
    name: string;
    monthly_budget_google: number;
    monthly_budget_meta: number;
  } | undefined;

  if (!client) return;

  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth = now.getDate();
  const expectedPace = dayOfMonth / daysInMonth;

  for (const platform of ["google", "meta"] as const) {
    const budget = platform === "google"
      ? client.monthly_budget_google
      : client.monthly_budget_meta;

    if (budget <= 0) continue;

    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const totalSpent = db
      .prepare(
        `SELECT COALESCE(SUM(cost), 0) as total
         FROM ad_metrics
         WHERE client_id = ? AND platform = ? AND level = 'account'
         AND date LIKE ?`
      )
      .get(clientId, platform, `${monthStr}%`) as { total: number };

    const actualPace = totalSpent.total / budget;
    const deviationPct = Math.abs((actualPace - expectedPace) / expectedPace) * 100;

    let severity: string | null = null;
    if (deviationPct >= BUDGET_CRITICAL_PCT) severity = "critical";
    else if (deviationPct >= BUDGET_WARNING_PCT) severity = "warning";

    if (severity) {
      const direction = actualPace > expectedPace ? "超過" : "遅延";
      db.prepare(
        `INSERT INTO alerts (client_id, platform, metric, severity, current_value, moving_avg, deviation_pct, message)
         VALUES (?, ?, 'budget_pace', ?, ?, ?, ?, ?)`
      ).run(
        clientId,
        platform,
        severity,
        actualPace * 100,
        expectedPace * 100,
        deviationPct,
        `${severity === "critical" ? "🚨" : "⚠️"} 予算消化${direction}: ${client.name} (${platform}) - 消化率 ${(actualPace * 100).toFixed(1)}% / 想定 ${(expectedPace * 100).toFixed(1)}%`
      );
    }
  }
}
