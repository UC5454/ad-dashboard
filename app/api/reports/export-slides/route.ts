import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { applyFee } from "@/lib/budget";
import type { Session } from "next-auth";

interface ProjectMetrics {
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cv: number;
  cpa: number;
  purchase_roas?: number | null;
}

interface CampaignRow {
  campaign_name: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cv: number;
  cpa: number;
  purchase_roas?: number | null;
}

interface CreativeRow {
  creative_name: string;
  campaign_name: string;
  adset_name?: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cv: number;
  cpa: number;
  image_url?: string | null;
  thumbnail_url?: string | null;
}

interface DailyRow {
  date_start: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cv: number;
  cpa: number;
}

interface AnalysisBlock {
  summary: string;
  insights: string[];
  recommendations: string[];
}

interface ClientReportBlock {
  summary: string;
  performance: string;
  improvements: string[];
  retrospective: string[];
}

interface ReportData {
  projectName: string;
  datePreset: string;
  project: ProjectMetrics;
  campaigns: CampaignRow[];
  creatives: CreativeRow[];
  daily: DailyRow[];
  analysis: {
    overall: AnalysisBlock;
    clientReport: ClientReportBlock;
  };
  feeRate: number;
  feeCalcMethod: "markup" | "margin";
  monthlyBudget: number | null;
}

interface SlidesCreatePresentationResponse {
  presentationId?: string;
}

interface SlidesPresentationResponse {
  slides?: Array<{ objectId?: string }>;
}

interface RgbColor {
  red: number;
  green: number;
  blue: number;
}

interface EmuSize {
  width: number;
  height: number;
}

interface EmuPosition {
  x: number;
  y: number;
}

type SlidesBatchRequest = Record<string, unknown>;

const SLIDES_API = "https://slides.googleapis.com/v1/presentations";

const NAVY: RgbColor = { red: 0.106, green: 0.165, blue: 0.29 };
const LIGHT_GRAY: RgbColor = { red: 0.973, green: 0.98, blue: 0.988 };
const MID_GRAY: RgbColor = { red: 0.4, green: 0.46, blue: 0.54 };
const WHITE: RgbColor = { red: 1, green: 1, blue: 1 };
const BLUE: RgbColor = { red: 0.173, green: 0.322, blue: 0.51 };

const JA_DATE = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "Asia/Tokyo",
});

function roundInt(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value);
}

function formatCurrency(value: number): string {
  return `¥${roundInt(value).toLocaleString("ja-JP")}`;
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function calcCpc(spend: number, clicks: number): number {
  if (clicks <= 0) return 0;
  return spend / clicks;
}

function parseJstDate(dateText: string): Date {
  return new Date(`${dateText}T00:00:00+09:00`);
}

function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatPeriod(datePreset: string, daily: DailyRow[]): string {
  const validDates = daily.map((row) => row.date_start).filter((v) => /^\d{4}-\d{2}-\d{2}$/.test(v)).sort();
  if (validDates.length > 0) {
    const start = parseJstDate(validDates[0]);
    const end = parseJstDate(validDates[validDates.length - 1]);
    return `${JA_DATE.format(start)} - ${JA_DATE.format(end)}`;
  }

  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let start = new Date(end);

  switch (datePreset) {
    case "today":
      break;
    case "yesterday":
      start.setDate(end.getDate() - 1);
      end.setDate(end.getDate() - 1);
      break;
    case "last_7d":
      start.setDate(end.getDate() - 6);
      break;
    case "this_month":
      start = new Date(end.getFullYear(), end.getMonth(), 1);
      break;
    default:
      start.setDate(end.getDate() - 29);
      break;
  }

  return `${JA_DATE.format(start)} - ${JA_DATE.format(end)}`;
}

function topBySpend<T extends { spend: number }>(rows: T[], max: number): T[] {
  return [...rows].sort((a, b) => b.spend - a.spend).slice(0, max);
}

function createElementTransform(position: EmuPosition) {
  return {
    scaleX: 1,
    scaleY: 1,
    shearX: 0,
    shearY: 0,
    translateX: position.x,
    translateY: position.y,
    unit: "EMU",
  };
}

function createTextBoxRequests(params: {
  slideId: string;
  objectId: string;
  text: string;
  position: EmuPosition;
  size: EmuSize;
  fontSizePt: number;
  bold?: boolean;
  color?: RgbColor;
  center?: boolean;
}): SlidesBatchRequest[] {
  const color = params.color ?? NAVY;
  const requests: SlidesBatchRequest[] = [
    {
      createShape: {
        objectId: params.objectId,
        shapeType: "TEXT_BOX",
        elementProperties: {
          pageObjectId: params.slideId,
          size: {
            width: { magnitude: params.size.width, unit: "EMU" },
            height: { magnitude: params.size.height, unit: "EMU" },
          },
          transform: createElementTransform(params.position),
        },
      },
    },
    {
      insertText: {
        objectId: params.objectId,
        text: params.text,
      },
    },
    {
      updateTextStyle: {
        objectId: params.objectId,
        textRange: { type: "ALL" },
        style: {
          bold: Boolean(params.bold),
          fontSize: { magnitude: params.fontSizePt, unit: "PT" },
          foregroundColor: { opaqueColor: { rgbColor: color } },
        },
        fields: "bold,fontSize,foregroundColor",
      },
    },
  ];

  if (params.center) {
    requests.push({
      updateParagraphStyle: {
        objectId: params.objectId,
        textRange: { type: "ALL" },
        style: { alignment: "CENTER" },
        fields: "alignment",
      },
    });
  }

  return requests;
}

function createKpiBoxRequests(params: {
  slideId: string;
  boxId: string;
  label: string;
  value: string;
  position: EmuPosition;
  size: EmuSize;
}): SlidesBatchRequest[] {
  const text = `${params.label}\n${params.value}`;
  const valueStart = params.label.length + 1;

  return [
    {
      createShape: {
        objectId: params.boxId,
        shapeType: "ROUND_RECTANGLE",
        elementProperties: {
          pageObjectId: params.slideId,
          size: {
            width: { magnitude: params.size.width, unit: "EMU" },
            height: { magnitude: params.size.height, unit: "EMU" },
          },
          transform: createElementTransform(params.position),
        },
      },
    },
    {
      updateShapeProperties: {
        objectId: params.boxId,
        shapeProperties: {
          shapeBackgroundFill: {
            solidFill: { color: { rgbColor: LIGHT_GRAY } },
          },
          outline: {
            outlineFill: { solidFill: { color: { rgbColor: LIGHT_GRAY } } },
            weight: { magnitude: 1, unit: "PT" },
          },
        },
        fields: "shapeBackgroundFill.solidFill.color,outline.outlineFill.solidFill.color,outline.weight",
      },
    },
    {
      insertText: {
        objectId: params.boxId,
        text,
      },
    },
    {
      updateTextStyle: {
        objectId: params.boxId,
        textRange: { type: "ALL" },
        style: {
          bold: false,
          fontSize: { magnitude: 10, unit: "PT" },
          foregroundColor: { opaqueColor: { rgbColor: MID_GRAY } },
        },
        fields: "bold,fontSize,foregroundColor",
      },
    },
    {
      updateTextStyle: {
        objectId: params.boxId,
        textRange: { type: "FIXED_RANGE", startIndex: valueStart, endIndex: text.length },
        style: {
          bold: true,
          fontSize: { magnitude: 20, unit: "PT" },
          foregroundColor: { opaqueColor: { rgbColor: NAVY } },
        },
        fields: "bold,fontSize,foregroundColor",
      },
    },
    {
      updateParagraphStyle: {
        objectId: params.boxId,
        textRange: { type: "ALL" },
        style: { alignment: "CENTER" },
        fields: "alignment",
      },
    },
  ];
}

function createTableRequests(params: {
  slideId: string;
  tableId: string;
  headers: string[];
  rows: string[][];
  position: EmuPosition;
  size: EmuSize;
}): SlidesBatchRequest[] {
  const allRows = [params.headers, ...params.rows];
  const colCount = params.headers.length;

  const requests: SlidesBatchRequest[] = [
    {
      createTable: {
        objectId: params.tableId,
        rows: allRows.length,
        columns: colCount,
        elementProperties: {
          pageObjectId: params.slideId,
          size: {
            width: { magnitude: params.size.width, unit: "EMU" },
            height: { magnitude: params.size.height, unit: "EMU" },
          },
          transform: createElementTransform(params.position),
        },
      },
    },
  ];

  allRows.forEach((row, rowIndex) => {
    row.forEach((cell, columnIndex) => {
      requests.push({
        insertText: {
          objectId: params.tableId,
          cellLocation: { rowIndex, columnIndex },
          text: cell,
        },
      });
    });
  });

  requests.push({
    updateTableCellProperties: {
      objectId: params.tableId,
      tableRange: {
        location: { rowIndex: 0, columnIndex: 0 },
        rowSpan: 1,
        columnSpan: colCount,
      },
      tableCellProperties: {
        tableCellBackgroundFill: {
          solidFill: { color: { rgbColor: NAVY } },
        },
      },
      fields: "tableCellBackgroundFill.solidFill.color",
    },
  });

  for (let col = 0; col < colCount; col += 1) {
    requests.push({
      updateTextStyle: {
        objectId: params.tableId,
        cellLocation: { rowIndex: 0, columnIndex: col },
        textRange: { type: "ALL" },
        style: {
          bold: true,
          fontSize: { magnitude: 10, unit: "PT" },
          foregroundColor: { opaqueColor: { rgbColor: WHITE } },
        },
        fields: "bold,fontSize,foregroundColor",
      },
    });
  }

  return requests;
}

function buildBatchRequests(
  data: ReportData,
  coverSlideId: string,
  options: { includeCreativeImages?: boolean } = {},
): SlidesBatchRequest[] {
  const includeCreativeImages = options.includeCreativeImages ?? true;
  const periodText = formatPeriod(data.datePreset, data.daily);
  const submitDateText = JA_DATE.format(new Date());
  const cpc = calcCpc(data.project.spend, data.project.clicks);

  const slideKpi = "slide_kpi_summary";
  const slideCampaign = "slide_campaign_compare";
  const slideCreative = "slide_creative_compare";
  const slideDaily = "slide_daily_trend";
  const slideAnalysis = "slide_analysis";
  const slideAction = "slide_actions";

  const requests: SlidesBatchRequest[] = [
    {
      createSlide: {
        objectId: slideKpi,
        slideLayoutReference: { predefinedLayout: "BLANK" },
      },
    },
    {
      createSlide: {
        objectId: slideCampaign,
        slideLayoutReference: { predefinedLayout: "BLANK" },
      },
    },
    {
      createSlide: {
        objectId: slideCreative,
        slideLayoutReference: { predefinedLayout: "BLANK" },
      },
    },
    {
      createSlide: {
        objectId: slideDaily,
        slideLayoutReference: { predefinedLayout: "BLANK" },
      },
    },
    {
      createSlide: {
        objectId: slideAnalysis,
        slideLayoutReference: { predefinedLayout: "BLANK" },
      },
    },
    {
      createSlide: {
        objectId: slideAction,
        slideLayoutReference: { predefinedLayout: "BLANK" },
      },
    },
    {
      updatePageProperties: {
        objectId: coverSlideId,
        pageProperties: {
          pageBackgroundFill: {
            solidFill: {
              color: {
                rgbColor: NAVY,
              },
            },
          },
        },
        fields: "pageBackgroundFill.solidFill.color",
      },
    },
    ...createTextBoxRequests({
      slideId: coverSlideId,
      objectId: "cover_title",
      text: `${data.projectName} 広告運用レポート`,
      position: { x: 900000, y: 1950000 },
      size: { width: 8250000, height: 1000000 },
      fontSizePt: 28,
      bold: true,
      color: WHITE,
      center: true,
    }),
    ...createTextBoxRequests({
      slideId: coverSlideId,
      objectId: "cover_subtitle",
      text: `${periodText} | 提出日: ${submitDateText}`,
      position: { x: 1100000, y: 3100000 },
      size: { width: 7850000, height: 600000 },
      fontSizePt: 14,
      color: { red: 0.89, green: 0.91, blue: 0.96 },
      center: true,
    }),
    ...createTextBoxRequests({
      slideId: slideKpi,
      objectId: "kpi_title",
      text: "パフォーマンスサマリー",
      position: { x: 500000, y: 350000 },
      size: { width: 4500000, height: 550000 },
      fontSizePt: 24,
      bold: true,
      color: NAVY,
    }),
  ];

  const kpiMetrics = [
    { label: "消化額(Fee込)", value: formatCurrency(applyFee(data.project.spend, data.feeRate, data.feeCalcMethod)) },
    { label: "CV数", value: `${roundInt(data.project.cv).toLocaleString("ja-JP")}件` },
    { label: "CPA", value: data.project.cv > 0 ? formatCurrency(data.project.cpa) : "-" },
    { label: "CTR", value: formatPercent(data.project.ctr) },
    { label: "CPC", value: formatCurrency(cpc) },
  ];
  if (typeof data.project.purchase_roas === "number" && Number.isFinite(data.project.purchase_roas)) {
    kpiMetrics.push({ label: "ROAS", value: `${data.project.purchase_roas.toFixed(2)}x` });
  }

  const boxWidth = kpiMetrics.length > 5 ? 1400000 : 1700000;
  const boxHeight = 1450000;
  const gap = 120000;
  const totalWidth = boxWidth * kpiMetrics.length + gap * (kpiMetrics.length - 1);
  const maxSlideWidth = 10000000;
  const startX = Math.max(250000, Math.floor((maxSlideWidth - totalWidth) / 2));
  const boxY = 1650000;

  kpiMetrics.forEach((metric, index) => {
    requests.push(
      ...createKpiBoxRequests({
        slideId: slideKpi,
        boxId: `kpi_box_${index + 1}`,
        label: metric.label,
        value: metric.value,
        position: { x: startX + index * (boxWidth + gap), y: boxY },
        size: { width: boxWidth, height: boxHeight },
      }),
    );
  });

  const campaignRows = topBySpend(data.campaigns, 10).map((row, index) => [
    row.campaign_name,
    formatCurrency(applyFee(row.spend, data.feeRate, data.feeCalcMethod)),
    `${roundInt(row.cv).toLocaleString("ja-JP")}`,
    row.cv > 0 ? formatCurrency(row.cpa) : "-",
    formatPercent(row.ctr),
    `${index + 1}`,
  ]);

  requests.push(
    ...createTextBoxRequests({
      slideId: slideCampaign,
      objectId: "campaign_title",
      text: "キャンペーン別パフォーマンス",
      position: { x: 500000, y: 350000 },
      size: { width: 5200000, height: 550000 },
      fontSizePt: 24,
      bold: true,
      color: NAVY,
    }),
    ...createTableRequests({
      slideId: slideCampaign,
      tableId: "campaign_table",
      headers: ["キャンペーン名", "消化額(Fee込)", "CV", "CPA", "CTR", "ランク"],
      rows: campaignRows,
      position: { x: 400000, y: 1200000 },
      size: { width: 9250000, height: 3900000 },
    }),
  );

  requests.push(
    ...createTextBoxRequests({
      slideId: slideCreative,
      objectId: "creative_title",
      text: "クリエイティブ別パフォーマンス",
      position: { x: 500000, y: 350000 },
      size: { width: 5300000, height: 550000 },
      fontSizePt: 24,
      bold: true,
      color: NAVY,
    }),
  );

  const sortedCreatives = topBySpend(data.creatives, 10);
  const creativesWithImages = sortedCreatives
    .map((creative, index) => ({ creative, rank: index + 1 }))
    .filter(({ creative }) => Boolean(creative.thumbnail_url || creative.image_url));

  if (includeCreativeImages && creativesWithImages.length > 0) {
    creativesWithImages.slice(0, 5).forEach(({ creative, rank }, index) => {
      const imageUrl = creative.thumbnail_url || creative.image_url;
      if (!imageUrl) return;

      requests.push({
        createImage: {
          objectId: `cr_img_${index}`,
          url: imageUrl,
          elementProperties: {
            pageObjectId: slideCreative,
            size: {
              width: { magnitude: 1200000, unit: "EMU" },
              height: { magnitude: 1200000, unit: "EMU" },
            },
            transform: {
              scaleX: 1,
              scaleY: 1,
              translateX: 572000,
              translateY: 900000 + index * 750000,
              unit: "EMU",
            },
          },
        },
      });

      const infoText = [
        `ランク: ${rank}`,
        creative.creative_name,
        `消化額(Fee込): ${formatCurrency(applyFee(creative.spend, data.feeRate, data.feeCalcMethod))}`,
        `CV: ${roundInt(creative.cv).toLocaleString("ja-JP")} / CPA: ${creative.cv > 0 ? formatCurrency(creative.cpa) : "-"}`,
      ].join("\n");

      requests.push(
        ...createTextBoxRequests({
          slideId: slideCreative,
          objectId: `creative_info_${index}`,
          text: infoText,
          position: { x: 1950000, y: 920000 + index * 750000 },
          size: { width: 7700000, height: 620000 },
          fontSizePt: 11,
          color: NAVY,
        }),
      );
    });
  } else {
    const creativeRows = sortedCreatives.map((row, index) => [
      row.creative_name,
      formatCurrency(applyFee(row.spend, data.feeRate, data.feeCalcMethod)),
      `${roundInt(row.cv).toLocaleString("ja-JP")}`,
      row.cv > 0 ? formatCurrency(row.cpa) : "-",
      `${index + 1}`,
    ]);

    requests.push(
      ...createTableRequests({
        slideId: slideCreative,
        tableId: "creative_table",
        headers: ["クリエイティブ名", "消化額(Fee込)", "CV", "CPA", "ランク"],
        rows: creativeRows,
        position: { x: 450000, y: 1200000 },
        size: { width: 9150000, height: 3900000 },
      }),
    );
  }

  const recentDailyRows = [...data.daily]
    .sort((a, b) => a.date_start.localeCompare(b.date_start))
    .slice(-7)
    .map((row) => {
      const date = parseJstDate(row.date_start);
      return [
        toIsoDate(date),
        formatCurrency(applyFee(row.spend, data.feeRate, data.feeCalcMethod)),
        `${roundInt(row.cv).toLocaleString("ja-JP")}`,
        row.cv > 0 ? formatCurrency(row.cpa) : "-",
        formatPercent(row.ctr),
      ];
    });

  requests.push(
    ...createTextBoxRequests({
      slideId: slideDaily,
      objectId: "daily_title",
      text: "日次推移（直近7日間）",
      position: { x: 500000, y: 350000 },
      size: { width: 5000000, height: 550000 },
      fontSizePt: 24,
      bold: true,
      color: NAVY,
    }),
    ...createTableRequests({
      slideId: slideDaily,
      tableId: "daily_table",
      headers: ["日付", "消化額(Fee込)", "CV", "CPA", "CTR"],
      rows: recentDailyRows,
      position: { x: 500000, y: 1200000 },
      size: { width: 9000000, height: 3200000 },
    }),
  );

  const insightsText = ["■ 示唆", ...data.analysis.overall.insights.map((item) => `・${item}`)].join("\n");

  requests.push(
    ...createTextBoxRequests({
      slideId: slideAnalysis,
      objectId: "analysis_title",
      text: "分析・総評",
      position: { x: 500000, y: 350000 },
      size: { width: 2800000, height: 550000 },
      fontSizePt: 24,
      bold: true,
      color: NAVY,
    }),
    ...createTextBoxRequests({
      slideId: slideAnalysis,
      objectId: "analysis_summary",
      text: data.analysis.clientReport.summary || "-",
      position: { x: 500000, y: 1200000 },
      size: { width: 9100000, height: 850000 },
      fontSizePt: 14,
      color: NAVY,
    }),
    ...createTextBoxRequests({
      slideId: slideAnalysis,
      objectId: "analysis_performance",
      text: data.analysis.clientReport.performance || "-",
      position: { x: 500000, y: 2200000 },
      size: { width: 9100000, height: 900000 },
      fontSizePt: 14,
      color: MID_GRAY,
    }),
    ...createTextBoxRequests({
      slideId: slideAnalysis,
      objectId: "analysis_insights",
      text: insightsText,
      position: { x: 500000, y: 3250000 },
      size: { width: 9100000, height: 1900000 },
      fontSizePt: 13,
      color: NAVY,
    }),
  );

  const improvementsText = ["■ 改善施策", ...data.analysis.clientReport.improvements.map((item) => `・${item}`)].join("\n");
  const recommendationsText = ["■ 推奨アクション", ...data.analysis.overall.recommendations.map((item) => `・${item}`)].join("\n");

  requests.push(
    ...createTextBoxRequests({
      slideId: slideAction,
      objectId: "action_title",
      text: "改善施策・次月アクション",
      position: { x: 500000, y: 350000 },
      size: { width: 5000000, height: 550000 },
      fontSizePt: 24,
      bold: true,
      color: NAVY,
    }),
    ...createTextBoxRequests({
      slideId: slideAction,
      objectId: "action_improvements",
      text: improvementsText,
      position: { x: 500000, y: 1200000 },
      size: { width: 9100000, height: 1800000 },
      fontSizePt: 13,
      color: NAVY,
    }),
    ...createTextBoxRequests({
      slideId: slideAction,
      objectId: "action_recommendations",
      text: recommendationsText,
      position: { x: 500000, y: 3200000 },
      size: { width: 9100000, height: 1900000 },
      fontSizePt: 13,
      color: BLUE,
    }),
  );

  return requests;
}

async function slidesApiFetch<T>(url: string, accessToken: string, body: unknown): Promise<T> {
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
    console.error(`Slides API error (${response.status}):`, text);
    throw new Error(`スライドの作成中にエラーが発生しました（${response.status}）`);
  }
  return (await response.json()) as T;
}

async function slidesGetFetch<T>(url: string, accessToken: string): Promise<T> {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!response.ok) {
    const text = await response.text();
    console.error(`Slides API GET error (${response.status}):`, text);
    throw new Error(`スライドデータの取得中にエラーが発生しました（${response.status}）`);
  }
  return (await response.json()) as T;
}

function isValidReportData(body: unknown): body is ReportData {
  if (typeof body !== "object" || body === null) return false;
  const data = body as Partial<ReportData>;
  if (typeof data.projectName !== "string" || data.projectName.length === 0) return false;
  if (typeof data.datePreset !== "string") return false;
  if (!data.project || typeof data.project !== "object") return false;
  if (!Array.isArray(data.campaigns) || !Array.isArray(data.creatives) || !Array.isArray(data.daily)) return false;
  if (!data.analysis || typeof data.analysis !== "object") return false;
  if (typeof data.feeRate !== "number") return false;
  if (data.feeCalcMethod !== "markup" && data.feeCalcMethod !== "margin") return false;
  return true;
}

export async function POST(req: NextRequest) {
  const session = (await auth()) as Session | null;
  const accessToken = session?.accessToken;

  if (!accessToken) {
    return NextResponse.json({ ok: false, error: "Google認証が必要です" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = (await req.json()) as unknown;
  } catch {
    return NextResponse.json({ ok: false, error: "リクエスト形式が不正です" }, { status: 400 });
  }

  if (!isValidReportData(body)) {
    return NextResponse.json({ ok: false, error: "リクエストデータが不正です" }, { status: 400 });
  }

  const data: ReportData = body;

  try {
    const createResponse = await slidesApiFetch<SlidesCreatePresentationResponse>(SLIDES_API, accessToken, {
      title: `${data.projectName} 広告運用レポート`,
    });

    const presentationId = createResponse.presentationId;
    if (!presentationId) {
      throw new Error("プレゼンテーションIDの取得に失敗しました");
    }

    const presentation = await slidesGetFetch<SlidesPresentationResponse>(`${SLIDES_API}/${presentationId}`, accessToken);
    const coverSlideId = presentation.slides?.[0]?.objectId;

    if (!coverSlideId) {
      throw new Error("表紙スライドIDの取得に失敗しました");
    }

    const requests = buildBatchRequests(data, coverSlideId, { includeCreativeImages: true });

    try {
      await slidesApiFetch<{ replies?: unknown[] }>(`${SLIDES_API}/${presentationId}:batchUpdate`, accessToken, {
        requests,
      });
    } catch {
      const fallbackRequests = buildBatchRequests(data, coverSlideId, { includeCreativeImages: false });
      await slidesApiFetch<{ replies?: unknown[] }>(`${SLIDES_API}/${presentationId}:batchUpdate`, accessToken, {
        requests: fallbackRequests,
      });
    }

    return NextResponse.json({
      ok: true,
      presentationId,
      presentationUrl: `https://docs.google.com/presentation/d/${presentationId}/edit`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Googleスライド出力に失敗しました";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
