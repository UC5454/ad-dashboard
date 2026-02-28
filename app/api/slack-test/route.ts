import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { isValidSlackWebhookUrl } from "@/lib/validation";

const ALLOWED_HOSTS = new Set(["hooks.slack.com"]);

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = rateLimit(`slack-test:${session.user?.id || "anon"}`, 5, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "リクエスト回数の上限に達しました。1分後に再試行してください。" },
      { status: 429 },
    );
  }

  const { webhookUrl } = (await req.json()) as { webhookUrl?: string };
  if (!webhookUrl) {
    return NextResponse.json({ ok: false, error: "URLが未入力です" });
  }

  if (!isValidSlackWebhookUrl(webhookUrl)) {
    return NextResponse.json({
      ok: false,
      error: "Slack Webhook URL（hooks.slack.com）のみ使用できます",
    });
  }

  // SSRF対策: Slack webhook URLのみ許可
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(webhookUrl);
  } catch {
    return NextResponse.json({ ok: false, error: "無効なURLです" });
  }

  if (!ALLOWED_HOSTS.has(parsedUrl.hostname)) {
    return NextResponse.json({
      ok: false,
      error: "Slack Webhook URL（hooks.slack.com）のみ使用できます",
    });
  }

  if (parsedUrl.protocol !== "https:") {
    return NextResponse.json({ ok: false, error: "HTTPS URLのみ使用できます" });
  }

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: "🔔 広告ダッシュボード テスト通知",
              emoji: true,
            },
          },
          { type: "divider" },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "✅ Slack連携が正常に設定されました。アラート発生時にこのチャンネルに通知されます。",
            },
          },
        ],
      }),
    });
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: `HTTP ${res.status}` });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("API error:", e);
    return NextResponse.json({ ok: false, error: "サーバーエラーが発生しました" });
  }
}
