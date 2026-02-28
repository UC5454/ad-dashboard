import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = rateLimit(`google-test:${session.user?.id || "anon"}`, 5, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "リクエスト回数の上限に達しました。1分後に再試行してください。" },
      { status: 429 },
    );
  }

  const { credentials } = (await req.json()) as { credentials?: Record<string, string> };
  if (!credentials?.refresh_token || !credentials?.client_id || !credentials?.client_secret) {
    return NextResponse.json({ ok: false, error: "認証情報が不足しています" });
  }

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: credentials.refresh_token,
        client_id: credentials.client_id,
        client_secret: credentials.client_secret,
      }),
    });
    if (!tokenRes.ok) {
      return NextResponse.json({ ok: false, error: "リフレッシュトークンが無効です" });
    }
    await tokenRes.json().catch(() => null);
    return NextResponse.json({ ok: true, message: "Google Ads認証成功" });
  } catch (e) {
    console.error("API error:", e);
    return NextResponse.json({ ok: false, error: "サーバーエラーが発生しました" });
  }
}
