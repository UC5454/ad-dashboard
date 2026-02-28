# レポートのGoogleスプレッドシート出力機能

全て実装してください。確認や質問は不要です。具体的な提案・修正案・コード例まで自主的に出力してください。完了後 npm run build で成功することを確認してください。

## 絶対に変更しないファイル
- lib/meta-api.ts
- lib/meta-utils.ts
- types/meta.ts
- app/api/meta/ 配下のAPIルートファイル全て（読み取り参照のみ可）

## 技術スタック
- Next.js 16.1.6, React 19, TypeScript strict
- Tailwind CSS 4（カスタムカラー: navy=#1B2A4A, blue=#2C5282）
- next-auth 5.0.0-beta.30（既存Google OAuth）
- googleapis（新規追加: `npm install googleapis`）
- 日本語UIで統一
- `npm run build` が成功すること

---

## 概要

レポートページ（`app/dashboard/reports/page.tsx`）に「Googleスプレッドシートに出力」ボタンを追加。
ボタンを押すと、現在表示中のレポートデータをGoogleスプレッドシートとして新規作成し、URLを返す。

---

## 1. Google OAuthにSheetsスコープ追加 + アクセストークン保存

### 1-1. lib/auth.ts を修正

Google providerに`authorization`オプションでスコープを追加し、`account`コールバックでアクセストークンをJWTに保存する:

```typescript
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

const ALLOWED_DOMAIN = "digital-gorilla.co.jp";
type UserRole = "admin" | "editor" | "viewer";

function getEnv(...keys: string[]): string {
  for (const key of keys) {
    const value = process.env[key];
    if (value && value.trim().length > 0) {
      return value.trim();
    }
  }
  return "";
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: getEnv("AUTH_SECRET", "NEXTAUTH_SECRET"),
  trustHost: getEnv("AUTH_TRUST_HOST").toLowerCase() === "true" || process.env.VERCEL === "1",
  providers: [
    Google({
      clientId: getEnv("AUTH_GOOGLE_ID", "GOOGLE_CLIENT_ID"),
      clientSecret: getEnv("AUTH_GOOGLE_SECRET", "GOOGLE_CLIENT_SECRET"),
      authorization: {
        params: {
          scope: "openid email profile https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file",
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      const email = user.email;
      if (!email || !email.endsWith(`@${ALLOWED_DOMAIN}`)) {
        return false;
      }
      return true;
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.userId = user.id ?? token.sub;
        token.role = "admin" as UserRole;
      }
      // accountはログイン時のみ存在。アクセストークンとリフレッシュトークンを保存
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.accessTokenExpires = account.expires_at ? account.expires_at * 1000 : 0;
      }
      // トークンの有効期限チェック & リフレッシュ
      if (token.accessTokenExpires && typeof token.accessTokenExpires === "number" && Date.now() < token.accessTokenExpires) {
        return token;
      }
      // 期限切れの場合はリフレッシュを試みる
      if (token.refreshToken && typeof token.refreshToken === "string") {
        try {
          const response = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              client_id: getEnv("AUTH_GOOGLE_ID", "GOOGLE_CLIENT_ID"),
              client_secret: getEnv("AUTH_GOOGLE_SECRET", "GOOGLE_CLIENT_SECRET"),
              grant_type: "refresh_token",
              refresh_token: token.refreshToken,
            }),
          });
          const data = await response.json() as { access_token?: string; expires_in?: number };
          if (data.access_token) {
            token.accessToken = data.access_token;
            token.accessTokenExpires = Date.now() + (data.expires_in ?? 3600) * 1000;
          }
        } catch {
          // リフレッシュ失敗時はそのまま返す
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id =
          typeof token.userId === "string"
            ? token.userId
            : typeof token.sub === "string"
              ? token.sub
              : "";
        session.user.role = "admin";
      }
      // セッションにアクセストークンを公開（サーバーサイドAPIルートで使用）
      (session as any).accessToken = token.accessToken;
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
});
```

### 1-2. types/next-auth.d.ts を拡張

```typescript
import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: "admin" | "editor" | "viewer";
    };
    accessToken?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    role?: string;
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpires?: number;
  }
}
```

---

## 2. スプレッドシート作成APIルート

### 2-1. app/api/reports/export-sheet/route.ts を新規作成

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { google } from "googleapis";

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

function applyFee(amount: number, feeRate: number, method: "markup" | "margin"): number {
  if (method === "margin") {
    return feeRate < 1 ? amount / (1 - feeRate) : amount;
  }
  return amount * (1 + feeRate);
}

export async function POST(request: NextRequest) {
  const session = await auth() as any;
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
    data = await request.json() as ReportData;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const feeRate = data.feeRate ?? 0.2;
  const feeMethod = data.feeCalcMethod ?? "markup";
  const feeLabelText = feeMethod === "margin" ? "Fee込(内掛)" : "Fee込(外掛)";

  try {
    const authClient = new google.auth.OAuth2();
    authClient.setCredentials({ access_token: accessToken });

    const sheets = google.sheets({ version: "v4", auth: authClient });
    const drive = google.drive({ version: "v3", auth: authClient });

    // 日付フォーマット
    const now = new Date();
    const dateStr = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${String(now.getDate()).padStart(2, "0")}`;
    const title = `広告レポート_${data.projectName}_${data.datePreset}_${dateStr}`;

    // 1. スプレッドシート新規作成
    const spreadsheet = await sheets.spreadsheets.create({
      requestBody: {
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
    });

    const spreadsheetId = spreadsheet.data.spreadsheetId!;
    const spreadsheetUrl = spreadsheet.data.spreadsheetUrl!;

    // 2. 各シートにデータ書き込み
    const totalCpc = data.project.clicks > 0 ? data.project.spend / data.project.clicks : 0;
    const spendWithFee = applyFee(data.project.spend, feeRate, feeMethod);

    // --- サマリーシート ---
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

    // --- 日次推移シート ---
    const dailyHeader = ["日付", "消化額", feeLabelText, "IMP", "クリック", "CTR", "CPC", "CV", "CPA"];
    const dailyRows: (string | number)[][] = [dailyHeader];
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
    // 合計行
    const totalSpend = data.daily.reduce((s, r) => s + r.spend, 0);
    const totalImp = data.daily.reduce((s, r) => s + r.impressions, 0);
    const totalClicks = data.daily.reduce((s, r) => s + r.clicks, 0);
    const totalCv = data.daily.reduce((s, r) => s + r.cv, 0);
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

    // --- キャンペーン別シート ---
    const campHeader = ["キャンペーン名", "消化額", feeLabelText, "IMP", "クリック", "CTR", "CPC", "CV", "CPA"];
    const campRows: (string | number)[][] = [campHeader];
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

    // --- クリエイティブ別シート ---
    const crHeader = ["クリエイティブ名", "キャンペーン", "消化額", feeLabelText, "IMP", "クリック", "CTR", "CPC", "CV", "CPA"];
    const crRows: (string | number)[][] = [crHeader];
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

    // --- AI分析シート ---
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

    // 3. 全シートにデータを一括書き込み
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: "USER_ENTERED",
        data: [
          { range: "サマリー!A1", values: summaryRows },
          { range: "日次推移!A1", values: dailyRows },
          { range: "キャンペーン別!A1", values: campRows },
          { range: "クリエイティブ別!A1", values: crRows },
          { range: "AI分析!A1", values: aiRows },
        ],
      },
    });

    // 4. フォーマット適用（ヘッダー太字、列幅調整、数値フォーマット）
    const sheetIds = spreadsheet.data.sheets!.map((s) => s.properties!.sheetId!);

    const formatRequests: any[] = [];

    // 各シートのヘッダー行を太字+背景色
    sheetIds.forEach((sheetId, idx) => {
      // サマリーはタイトル行、他はヘッダー行
      const headerRow = idx === 0 ? 0 : 0;
      formatRequests.push({
        repeatCell: {
          range: {
            sheetId,
            startRowIndex: headerRow,
            endRowIndex: headerRow + 1,
            startColumnIndex: 0,
            endColumnIndex: 15,
          },
          cell: {
            userEnteredFormat: {
              backgroundColor: { red: 0.106, green: 0.165, blue: 0.290 }, // navy
              textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 }, fontSize: 11 },
            },
          },
          fields: "userEnteredFormat(backgroundColor,textFormat)",
        },
      });

      // 列幅自動調整
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

    // サマリーシートのタイトル行は大きく
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
            textFormat: { bold: true, fontSize: 16, foregroundColor: { red: 0.106, green: 0.165, blue: 0.290 } },
          },
        },
        fields: "userEnteredFormat(textFormat)",
      },
    });

    // KPIセクションヘッダー
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
            textFormat: { bold: true, fontSize: 13, foregroundColor: { red: 0.106, green: 0.165, blue: 0.290 } },
          },
        },
        fields: "userEnteredFormat(textFormat)",
      },
    });

    // 日次推移の合計行を太字
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

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: formatRequests,
      },
    });

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
```

---

## 3. レポートページにスプレッドシート出力ボタン追加

### 3-1. app/dashboard/reports/page.tsx を修正

既存のPDF/CSVダウンロードボタンセクションに「Googleスプレッドシートに出力」ボタンを追加:

```tsx
// 状態追加
const [sheetLoading, setSheetLoading] = useState(false);
const [sheetResult, setSheetResult] = useState<{ ok: boolean; url?: string; error?: string } | null>(null);

// スプレッドシート出力ハンドラ
const onExportSheet = async () => {
  if (!detail) return;
  setSheetLoading(true);
  setSheetResult(null);

  try {
    const res = await fetch("/api/reports/export-sheet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectName: selectedProjectName,
        datePreset,
        project: detail.project,
        campaigns: detail.campaigns,
        creatives: detail.creatives,
        daily: detail.daily,
        analysis: detail.analysis,
        feeRate: budgetProgress?.feeRate ?? settings.defaultFeeRate,
        feeCalcMethod: settings.feeCalcMethod,
        monthlyBudget: budgetProgress?.monthlyBudget ?? null,
      }),
    });

    const result = await res.json() as { ok?: boolean; spreadsheetUrl?: string; error?: string };
    if (result.ok && result.spreadsheetUrl) {
      setSheetResult({ ok: true, url: result.spreadsheetUrl });
      // 新しいタブでスプレッドシートを開く
      window.open(result.spreadsheetUrl, "_blank");
    } else {
      setSheetResult({ ok: false, error: result.error || "エクスポートに失敗しました" });
    }
  } catch (err) {
    setSheetResult({ ok: false, error: err instanceof Error ? err.message : "エクスポートに失敗しました" });
  } finally {
    setSheetLoading(false);
  }
};
```

ボタンセクション（既存のPDF/CSVボタンの隣に追加）:

```tsx
<section className="flex flex-wrap items-center gap-3">
  <button
    type="button"
    onClick={onDownloadPdf}
    disabled={!detail}
    className="rounded-lg bg-blue px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-light disabled:opacity-40 disabled:cursor-not-allowed"
  >
    PDF ダウンロード
  </button>
  <button
    type="button"
    onClick={onDownloadCsv}
    disabled={!detail}
    className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
  >
    CSV ダウンロード
  </button>
  <button
    type="button"
    onClick={onExportSheet}
    disabled={!detail || sheetLoading}
    className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed"
  >
    {sheetLoading ? (
      <span className="flex items-center gap-2">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
        作成中...
      </span>
    ) : (
      "Googleスプレッドシートに出力"
    )}
  </button>

  {/* スプレッドシート作成結果 */}
  {sheetResult && (
    <span className={`text-sm ${sheetResult.ok ? "text-emerald-600" : "text-red-600"}`}>
      {sheetResult.ok ? (
        <a href={sheetResult.url} target="_blank" rel="noopener noreferrer" className="underline hover:no-underline">
          ✓ スプレッドシートを開く
        </a>
      ) : (
        `✕ ${sheetResult.error}`
      )}
    </span>
  )}
</section>
```

---

## 4. 依存関係の追加

`npm install googleapis` を実行して `package.json` に `googleapis` を追加してください。

---

## 5. 実装上の注意

- `lib/auth.ts` のscope追加により、既存ユーザーは再ログインが必要（consent画面が表示される）
- `session.accessToken` はサーバーサイドの `auth()` で取得できるが、クライアントサイドの `useSession()` では取得できない設計にする（セキュリティ上）
- `(session as any).accessToken` のキャストは `types/next-auth.d.ts` の拡張で型安全にする
- Google Sheetsのスプレッドシートは作成ユーザーのDriveに保存される
- `npm run build` が成功すること
- TypeScript strictモードでエラーがないこと
- 全てのUI文言は日本語
- lib/meta-api.ts、lib/meta-utils.ts、types/meta.ts、app/api/meta/配下は変更禁止
