export async function sendSlackNotification(message: string): Promise<boolean> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl || webhookUrl.includes("placeholder")) {
    console.warn("Slack webhook URL not configured, skipping notification");
    return false;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: message }),
    });
    return response.ok;
  } catch (error) {
    console.error("Failed to send Slack notification:", error);
    return false;
  }
}

export function formatAlertMessage(alert: {
  clientName: string;
  platform: string;
  metric: string;
  severity: string;
  currentValue: number;
  movingAvg: number;
  deviationPct: number;
}): string {
  const emoji = alert.severity === "critical" ? "🚨" : "⚠️";
  const direction = alert.deviationPct > 0 ? "上昇" : "下降";

  return [
    `${emoji} *広告アラート [${alert.severity.toUpperCase()}]*`,
    `クライアント: ${alert.clientName}`,
    `媒体: ${alert.platform === "google" ? "Google Ads" : "Meta Ads"}`,
    `指標: ${alert.metric}`,
    `現在値: ${alert.currentValue.toLocaleString()}`,
    `7日移動平均: ${alert.movingAvg.toLocaleString()}`,
    `乖離率: ${Math.abs(alert.deviationPct).toFixed(1)}% ${direction}`,
  ].join("\n");
}
