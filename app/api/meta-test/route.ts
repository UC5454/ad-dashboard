import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { isValidToken } from "@/lib/validation";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = rateLimit(`meta-test:${session.user?.id || "anon"}`, 5, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "リクエスト回数の上限に達しました。1分後に再試行してください。" },
      { status: 429 },
    );
  }

  const { accessToken } = (await req.json()) as { accessToken?: string };
  if (!accessToken) return NextResponse.json({ ok: false, error: "トークンが未入力です" });
  if (!isValidToken(accessToken)) {
    return NextResponse.json({ ok: false, error: "アクセストークンの形式が不正です" });
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/me?access_token=${encodeURIComponent(accessToken)}`,
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return NextResponse.json({ ok: false, error: err?.error?.message || `HTTP ${res.status}` });
    }
    const data = (await res.json()) as { name?: string; id?: string };
    return NextResponse.json({ ok: true, name: data.name, id: data.id });
  } catch (e) {
    console.error("API error:", e);
    return NextResponse.json({ ok: false, error: "サーバーエラーが発生しました" });
  }
}
