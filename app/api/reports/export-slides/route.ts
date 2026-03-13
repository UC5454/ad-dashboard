import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import type { Session } from "next-auth";
import { execFile } from "node:child_process";
import { join } from "node:path";

interface ReportPayload {
  projectName: string;
  datePreset: string;
  project: Record<string, unknown>;
  campaigns: Record<string, unknown>[];
  creatives: Record<string, unknown>[];
  daily: Record<string, unknown>[];
  analysis: Record<string, unknown>;
  feeRate: number;
  feeCalcMethod: "markup" | "margin";
  monthlyBudget: number | null;
  deviceBreakdown?: Record<string, unknown>[];
  demographicBreakdown?: Record<string, unknown>[];
  hourlyBreakdown?: Record<string, unknown>[];
}

interface ScriptResult {
  ok: boolean;
  presentationId?: string;
  presentationUrl?: string;
  error?: string;
}

function isValidPayload(body: unknown): body is ReportPayload {
  if (typeof body !== "object" || body === null) return false;
  const data = body as Partial<ReportPayload>;
  if (typeof data.projectName !== "string" || data.projectName.length === 0) return false;
  if (typeof data.datePreset !== "string") return false;
  if (!data.project || typeof data.project !== "object") return false;
  if (!Array.isArray(data.campaigns) || !Array.isArray(data.daily)) return false;
  if (typeof data.feeRate !== "number") return false;
  if (data.feeCalcMethod !== "markup" && data.feeCalcMethod !== "margin") return false;
  return true;
}

function runPythonScript(inputJson: string): Promise<ScriptResult> {
  return new Promise((resolve) => {
    const scriptPath = join(process.cwd(), "scripts", "generate-pptx-report.py");

    const child = execFile(
      "python3",
      [scriptPath],
      { maxBuffer: 10 * 1024 * 1024, timeout: 300_000 },
      (error, stdout, stderr) => {
        if (error) {
          const msg = stderr?.trim() || error.message || "スクリプト実行エラー";
          resolve({ ok: false, error: msg });
          return;
        }

        try {
          const result = JSON.parse(stdout.trim()) as ScriptResult;
          resolve(result);
        } catch {
          resolve({ ok: false, error: `スクリプト出力のパースに失敗: ${stdout.slice(0, 200)}` });
        }
      },
    );

    if (child.stdin) {
      child.stdin.write(inputJson);
      child.stdin.end();
    }
  });
}

export async function POST(req: NextRequest) {
  const session = (await auth()) as Session | null;
  if (!session?.accessToken) {
    return NextResponse.json({ ok: false, error: "Google認証が必要です" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = (await req.json()) as unknown;
  } catch {
    return NextResponse.json({ ok: false, error: "リクエスト形式が不正です" }, { status: 400 });
  }

  if (!isValidPayload(body)) {
    return NextResponse.json({ ok: false, error: "リクエストデータが不正です" }, { status: 400 });
  }

  try {
    const result = await runPythonScript(JSON.stringify(body));

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      presentationId: result.presentationId,
      presentationUrl: result.presentationUrl,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "スライドレポート生成に失敗しました";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
