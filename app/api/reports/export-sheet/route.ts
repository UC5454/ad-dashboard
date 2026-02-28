import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import type { Session } from "next-auth";

interface ReportData {
  projectName: string;
  datePreset: string;
  project: {
    spend: number;
    impressions: number;
    clicks: number;
    ctr: number;
    cv: number;
    cpa: number;
  };
  campaigns: Array<{
    campaign_name: string;
    spend: number;
    impressions: number;
    clicks: number;
    ctr: number;
    cv: number;
    cpa: number;
  }>;
  creatives: Array<{
    creative_name: string;
    campaign_name: string;
    spend: number;
    impressions: number;
    clicks: number;
    ctr: number;
    cv: number;
    cpa: number;
  }>;
  daily: Array<{
    date_start: string;
    spend: number;
    impressions: number;
    clicks: number;
    ctr: number;
    cv: number;
    cpa: number;
  }>;
  analysis: {
    overall: { summary: string; insights: string[]; recommendations: string[] };
    clientReport: { summary: string; performance: string; improvements: string[]; retrospective: string[] };
  };
  feeRate: number;
  feeCalcMethod: "markup" | "margin";
  monthlyBudget: number | null;
}

interface CreateSpreadsheetResponse {
  spreadsheetId?: string;
  spreadsheetUrl?: string;
  sheets?: Array<{ properties?: { sheetId?: number } }>;
}

function applyFee(amount: number, feeRate: number, method: "markup" | "margin"): number {
  if (method === "margin") {
    return feeRate < 1 ? amount / (1 - feeRate) : amount;
  }
  return amount * (1 + feeRate);
}

async function googleApiFetch<T>(url: string, accessToken: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google API error (${response.status}): ${text}`);
  }

  return (await response.json()) as T;
}

export async function POST(request: NextRequest) {
  const session = (await auth()) as Session | null;
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accessToken = session.accessToken;
  if (!accessToken) {
    return NextResponse.json(
      { error: "Google Sheetsへのアクセス権限がありません。再ログインしてください。" },
      { status: 403 },
    );
  }

  let data: ReportData;
  try {
    data = (await request.json()) as ReportData;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const feeRate = data.feeRate ?? 0.2;
  const feeMethod = data.feeCalcMethod ?? "markup";
  const feeLabelText = feeMethod === "margin" ? "Fee込(内掛)" : "Fee込(外掛)";

  try {
    const now = new Date();
    const dateStr = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${String(now.getDate()).padStart(2, "0")}`;
    const title = `広告レポート_${data.projectName}_${data.datePreset}_${dateStr}`;

    const spreadsheet = await googleApiFetch<CreateSpreadsheetResponse>(
      "https://sheets.googleapis.com/v4/spreadsheets",
      accessToken,
      {
        properties: {
          title,
          locale: "ja_JP",
        },
        sheets: [
          { properties: { title: "サマリー", index: 0 } },
          { properties: { title: "日次推移", index: 1 } },
          { properties: { title: "キャンペーン別", index: 2 } },
          { properties: { title: "クリエイティブ別", index: 3 } },
          { properties: { title: "AI分析", index: 4 } },
        ],
      },
    );

    const spreadsheetId = spreadsheet.spreadsheetId;
    const spreadsheetUrl = spreadsheet.spreadsheetUrl;

    if (!spreadsheetId || !spreadsheetUrl) {
      return NextResponse.json({ error: "スプレッドシートの作成に失敗しました" }, { status: 500 });
    }

    const totalCpc = data.project.clicks > 0 ? data.project.spend / data.project.clicks : 0;
    const spendWithFee = applyFee(data.project.spend, feeRate, feeMethod);

    const summaryRows: (string | number)[][] = [
      ["広告運用レポート"],
      [],
      ["案件名", data.projectName],
      ["期間", data.datePreset],
      ["出力日", dateStr],
      ["手数料方式", feeLabelText],
      ["手数料率", `${(feeRate * 100).toFixed(0)}%`],
      [],
      ["KPI サマリー"],
      ["指標", "値"],
      ["消化額（媒体費）", data.project.spend],
      [feeLabelText + "消化額", Math.round(spendWithFee)],
      ["インプレッション", data.project.impressions],
      ["クリック数", data.project.clicks],
      ["CTR", `${data.project.ctr.toFixed(2)}%`],
      ["CPC", Math.round(totalCpc)],
      ["CV数", data.project.cv],
      ["CPA", data.project.cv > 0 ? Math.round(data.project.cpa) : "-"],
    ];

    if (data.monthlyBudget !== null && data.monthlyBudget > 0) {
      summaryRows.push([]);
      summaryRows.push(["予算情報"]);
      summaryRows.push(["月間予算", data.monthlyBudget]);
      summaryRows.push(["消化率", `${((data.project.spend / data.monthlyBudget) * 100).toFixed(1)}%`]);
      summaryRows.push(["残予算", data.monthlyBudget - data.project.spend]);
    }

    const dailyRows: (string | number)[][] = [["日付", "消化額", feeLabelText, "IMP", "クリック", "CTR", "CPC", "CV", "CPA"]];
    data.daily.forEach((row) => {
      const cpc = row.clicks > 0 ? Math.round(row.spend / row.clicks) : 0;
      const rowFee = applyFee(row.spend, feeRate, feeMethod);
      dailyRows.push([
        row.date_start,
        Math.round(row.spend),
        Math.round(rowFee),
        row.impressions,
        row.clicks,
        `${row.ctr.toFixed(2)}%`,
        cpc,
        row.cv,
        row.cv > 0 ? Math.round(row.cpa) : 0,
      ]);
    });

    const totalSpend = data.daily.reduce((sum, row) => sum + row.spend, 0);
    const totalImp = data.daily.reduce((sum, row) => sum + row.impressions, 0);
    const totalClicks = data.daily.reduce((sum, row) => sum + row.clicks, 0);
    const totalCv = data.daily.reduce((sum, row) => sum + row.cv, 0);

    dailyRows.push([
      "合計",
      Math.round(totalSpend),
      Math.round(applyFee(totalSpend, feeRate, feeMethod)),
      totalImp,
      totalClicks,
      totalImp > 0 ? `${((totalClicks / totalImp) * 100).toFixed(2)}%` : "0%",
      totalClicks > 0 ? Math.round(totalSpend / totalClicks) : 0,
      totalCv,
      totalCv > 0 ? Math.round(totalSpend / totalCv) : 0,
    ]);

    const campRows: (string | number)[][] = [[
      "キャンペーン名",
      "消化額",
      feeLabelText,
      "IMP",
      "クリック",
      "CTR",
      "CPC",
      "CV",
      "CPA",
    ]];

    data.campaigns.forEach((row) => {
      const cpc = row.clicks > 0 ? Math.round(row.spend / row.clicks) : 0;
      const rowFee = applyFee(row.spend, feeRate, feeMethod);
      campRows.push([
        row.campaign_name,
        Math.round(row.spend),
        Math.round(rowFee),
        row.impressions,
        row.clicks,
        `${row.ctr.toFixed(2)}%`,
        cpc,
        row.cv,
        row.cv > 0 ? Math.round(row.cpa) : 0,
      ]);
    });

    const crRows: (string | number)[][] = [[
      "クリエイティブ名",
      "キャンペーン",
      "消化額",
      feeLabelText,
      "IMP",
      "クリック",
      "CTR",
      "CPC",
      "CV",
      "CPA",
    ]];

    data.creatives.forEach((row) => {
      const cpc = row.clicks > 0 ? Math.round(row.spend / row.clicks) : 0;
      const rowFee = applyFee(row.spend, feeRate, feeMethod);
      crRows.push([
        row.creative_name,
        row.campaign_name,
        Math.round(row.spend),
        Math.round(rowFee),
        row.impressions,
        row.clicks,
        `${row.ctr.toFixed(2)}%`,
        cpc,
        row.cv,
        row.cv > 0 ? Math.round(row.cpa) : 0,
      ]);
    });

    const aiRows: (string | number)[][] = [
      ["AI分析レポート"],
      [],
      ["総合分析"],
      [data.analysis.overall.summary],
      [],
      ["示唆"],
      ...data.analysis.overall.insights.map((item) => [item]),
      [],
      ["改善提案"],
      ...data.analysis.overall.recommendations.map((item) => [item]),
      [],
      ["クライアント向けコメント"],
      [data.analysis.clientReport.summary],
      [data.analysis.clientReport.performance],
      [],
      ["次月に向けた改善施策"],
      ...data.analysis.clientReport.improvements.map((item) => [item]),
      [],
      ["今月の振り返り"],
      ...data.analysis.clientReport.retrospective.map((item) => [item]),
    ];

    await googleApiFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
      accessToken,
      {
        valueInputOption: "USER_ENTERED",
        data: [
          { range: "サマリー!A1", values: summaryRows },
          { range: "日次推移!A1", values: dailyRows },
          { range: "キャンペーン別!A1", values: campRows },
          { range: "クリエイティブ別!A1", values: crRows },
          { range: "AI分析!A1", values: aiRows },
        ],
      },
    );

    const sheetIds = (spreadsheet.sheets || []).map((sheet) => sheet.properties?.sheetId).filter((id): id is number => typeof id === "number");
    const formatRequests: Array<Record<string, unknown>> = [];

    sheetIds.forEach((sheetId) => {
      formatRequests.push({
        repeatCell: {
          range: {
            sheetId,
            startRowIndex: 0,
            endRowIndex: 1,
            startColumnIndex: 0,
            endColumnIndex: 15,
          },
          cell: {
            userEnteredFormat: {
              backgroundColor: { red: 0.106, green: 0.165, blue: 0.29 },
              textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 }, fontSize: 11 },
            },
          },
          fields: "userEnteredFormat(backgroundColor,textFormat)",
        },
      });

      formatRequests.push({
        autoResizeDimensions: {
          dimensions: {
            sheetId,
            dimension: "COLUMNS",
            startIndex: 0,
            endIndex: 15,
          },
        },
      });
    });

    if (sheetIds.length > 0) {
      formatRequests.push({
        repeatCell: {
          range: {
            sheetId: sheetIds[0],
            startRowIndex: 0,
            endRowIndex: 1,
            startColumnIndex: 0,
            endColumnIndex: 1,
          },
          cell: {
            userEnteredFormat: {
              textFormat: { bold: true, fontSize: 16, foregroundColor: { red: 0.106, green: 0.165, blue: 0.29 } },
            },
          },
          fields: "userEnteredFormat(textFormat)",
        },
      });

      formatRequests.push({
        repeatCell: {
          range: {
            sheetId: sheetIds[0],
            startRowIndex: 8,
            endRowIndex: 9,
            startColumnIndex: 0,
            endColumnIndex: 1,
          },
          cell: {
            userEnteredFormat: {
              textFormat: { bold: true, fontSize: 13, foregroundColor: { red: 0.106, green: 0.165, blue: 0.29 } },
            },
          },
          fields: "userEnteredFormat(textFormat)",
        },
      });
    }

    if (sheetIds.length > 1) {
      const dailyTotalRow = dailyRows.length - 1;
      formatRequests.push({
        repeatCell: {
          range: {
            sheetId: sheetIds[1],
            startRowIndex: dailyTotalRow,
            endRowIndex: dailyTotalRow + 1,
            startColumnIndex: 0,
            endColumnIndex: 9,
          },
          cell: {
            userEnteredFormat: {
              textFormat: { bold: true },
              backgroundColor: { red: 0.95, green: 0.95, blue: 0.95 },
            },
          },
          fields: "userEnteredFormat(textFormat,backgroundColor)",
        },
      });
    }

    await googleApiFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
      accessToken,
      {
        requests: formatRequests,
      },
    );

    return NextResponse.json({
      ok: true,
      spreadsheetId,
      spreadsheetUrl,
      title,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "スプレッドシートの作成に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
