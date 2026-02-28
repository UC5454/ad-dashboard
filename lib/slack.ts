import type { SlackConfig } from "@/lib/settings";

export async function sendSlackNotification(
  config: SlackConfig,
  alerts: { type: string; title: string; message: string; projectName?: string }[],
): Promise<{ ok: boolean; error?: string }> {
  if (!config.enabled || !config.webhookUrl) {
    return { ok: false, error: "Slack通知が無効です" };
  }

  const blocks = [
    {
      type: "header",
      text: { type: "plain_text", text: "🔔 広告ダッシュボード アラート", emoji: true },
    },
    { type: "divider" },
    ...alerts.map((alert) => ({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${alert.type === "critical" ? "🔴" : alert.type === "warning" ? "🟡" : "🔵"} *${alert.title}*${alert.projectName ? ` (${alert.projectName})` : ""}\n${alert.message}`,
      },
    })),
  ];

  try {
    const res = await fetch(config.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blocks }),
    });
    if (!res.ok) return { ok: false, error: `Slack API error: ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
