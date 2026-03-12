# セキュリティ修正 + 品質改善 + 機能追加

全て実装してください。確認や質問は不要です。
完了後 npm run build で成功することを確認してください。

## 絶対に変更しないファイル
- `app/api/auth/[...nextauth]/route.ts`
- `lib/auth.ts`
- `middleware.ts`
- `components/ui/Sidebar.tsx`
- `components/settings/SettingsPageContent.tsx`

## 技術スタック
- Next.js 16.1.6, React 19, TypeScript strict
- Tailwind CSS 4
- 日本語UI統一

---

## タスク1: check-env APIルートに認証追加【セキュリティ/HIGH】

### ファイル: `app/api/meta/check-env/route.ts`

現在、認証チェックが一切ない。`auth()` でセッションを検証する:

```typescript
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const hasToken = !!process.env.META_ACCESS_TOKEN;
  return NextResponse.json({ configured: hasToken });
}
```

---

## タスク2: エラーメッセージの情報漏洩防止【セキュリティ/HIGH】

### ファイル: `app/api/reports/export-slides/route.ts`

現在、Google Slides API のエラーレスポンスをそのままクライアントに返している（788行目、802行目）。

#### 変更: `slidesFetch` 関数（788行目付近）
```typescript
// 変更前:
throw new Error(`Slides API error (${response.status}): ${text}`);

// 変更後:
console.error(`Slides API error (${response.status}):`, text);
throw new Error(`スライドの作成中にエラーが発生しました（${response.status}）`);
```

#### 変更: `slidesGetFetch` 関数（802行目付近）
```typescript
// 変更前:
throw new Error(`Slides API error (${response.status}): ${text}`);

// 変更後:
console.error(`Slides API GET error (${response.status}):`, text);
throw new Error(`スライドデータの取得中にエラーが発生しました（${response.status}）`);
```

### ファイル: `app/api/reports/export-sheet/route.ts`

同様に、Sheets API のエラーレスポンスにも同じ処理を適用する。`throw new Error` でAPIレスポンスのテキストをそのまま含めている箇所を全て修正:

```typescript
// 変更前:
throw new Error(`Sheets API error (${response.status}): ${text}`);

// 変更後:
console.error(`Sheets API error (${response.status}):`, text);
throw new Error(`シートの作成中にエラーが発生しました（${response.status}）`);
```

---

## タスク3: applyFee 関数の重複排除【コード品質】

### 問題
`applyFee` が3箇所に定義されている:
- `lib/budget.ts` (正規版)
- `app/api/reports/export-sheet/route.ts` (重複)
- `app/api/reports/export-slides/route.ts` (重複)

### 修正

#### ファイル: `app/api/reports/export-sheet/route.ts`
1. ファイル内の `function applyFee(...)` 定義を**削除**
2. 先頭のimportに追加: `import { applyFee } from "@/lib/budget";`
3. `applyFee` の呼び出し箇所はそのままでOK（シグネチャ互換）

#### ファイル: `app/api/reports/export-slides/route.ts`
1. ファイル内の `function applyFee(...)` 定義を**削除**
2. 先頭のimportに追加: `import { applyFee } from "@/lib/budget";`
3. `applyFee` の呼び出し箇所はそのままでOK

---

## タスク4: CSV BOM追加（Excel日本語文字化け対策）【機能改善】

### ファイル: `app/dashboard/reports/page.tsx`

`downloadCSV` 関数（107行目付近）で、Blobの先頭にUTF-8 BOMを追加する:

```typescript
// 変更前:
function downloadCSV(filename: string, rows: string[][]) {
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });

// 変更後:
function downloadCSV(filename: string, rows: string[][]) {
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
```

---

## タスク5: PDF複数ページ対応【機能改善】

### ファイル: `app/dashboard/reports/page.tsx`

PDF出力が1ページしか対応していない（251行目付近）。A4サイズを超えるコンテンツを複数ページに分割する:

```typescript
// 変更前:
const canvas = await html2canvasFn(preview, { scale: 2 });
const imageData = canvas.toDataURL("image/png");
const pdf = new jsPDFCtor("p", "mm", "a4");
const width = pdf.internal.pageSize.getWidth();
const height = (canvas.height * width) / canvas.width;

pdf.addImage(imageData, "PNG", 0, 0, width, height);
pdf.save(`project_report_${datePreset}_${selectedProjectId}.pdf`);

// 変更後:
const canvas = await html2canvasFn(preview, { scale: 2 });
const imageData = canvas.toDataURL("image/png");
const pdf = new jsPDFCtor("p", "mm", "a4");
const pageWidth = pdf.internal.pageSize.getWidth();
const pageHeight = pdf.internal.pageSize.getHeight();
const imgHeight = (canvas.height * pageWidth) / canvas.width;

let heightLeft = imgHeight;
let position = 0;

pdf.addImage(imageData, "PNG", 0, position, pageWidth, imgHeight);
heightLeft -= pageHeight;

while (heightLeft > 0) {
  position -= pageHeight;
  pdf.addPage();
  pdf.addImage(imageData, "PNG", 0, position, pageWidth, imgHeight);
  heightLeft -= pageHeight;
}

pdf.save(`project_report_${datePreset}_${selectedProjectId}.pdf`);
```

---

## タスク6: レポートUIにCVR（獲得率）列を追加【機能追加】

### ファイル: `app/dashboard/reports/page.tsx`

レポートプレビュー内のキャンペーン別テーブルとクリエイティブ別テーブルにCVR列を追加する。

#### 変更1: キャンペーン別テーブルのヘッダーにCVR追加
キャンペーン別のテーブルヘッダー（`<th>`タグの並び）の「CPA」の後に「CVR」を追加:
```tsx
<th>CVR</th>
```

#### 変更2: キャンペーン別テーブルの各行にCVR値を表示
CPAのセルの後に:
```tsx
<td>{row.clicks > 0 ? ((row.cv / row.clicks) * 100).toFixed(2) + "%" : "-"}</td>
```

#### 変更3: クリエイティブ別テーブルにも同様にCVR列を追加
ヘッダーとデータ行の両方にCVRを追加する。

#### 変更4: CSV出力にもCVR列を追加
`onDownloadCsv` 関数のヘッダー行とデータ行に「CVR」を追加:
- ヘッダー: `"CVR"` を `"CPA"` の後に追加
- データ: `row.clicks > 0 ? ((row.cv / row.clicks) * 100).toFixed(2) : "0"` を追加

---

## タスク7: レポートのfetchをapiFetchに統一【セキュリティ】

### ファイル: `app/dashboard/reports/page.tsx`

レポートページで `fetch("/api/reports/export-sheet", ...)` と `fetch("/api/reports/export-slides", ...)` を使っている箇所を全て `apiFetch` に変更する。

1. importに追加: `import { apiFetch } from "@/lib/api-client";`
2. `fetch("/api/reports/export-sheet"` → `apiFetch("/api/reports/export-sheet"`
3. `fetch("/api/reports/export-slides"` → `apiFetch("/api/reports/export-slides"`
4. `fetch("/api/meta/` → `apiFetch("/api/meta/` （もし直接fetchしている箇所があれば）

※ `apiFetch` は `lib/api-client.ts` に既に存在する。Meta APIヘッダーを自動付与する関数。

---

## タスク8: ROAS指標をレポートに追加【機能追加】

### 概要
ROAS（Return on Ad Spend）= 売上 / 広告費 × 100(%)
現在のMeta APIレスポンスに `purchase_roas` が含まれる場合はそれを使用し、含まれない場合は「-」表示する。

### ファイル: `app/api/reports/export-sheet/route.ts`

#### 変更1: サマリーシートにROAS行を追加
KPI一覧にROASを追加（CVの下、またはCPAの下に配置）:
```
ROAS | {roas値}x（購入ROASがある場合。ない場合は「-」）
```

※ roas値は `body.summary` に `purchase_roas` フィールドがある場合のみ。なければスキップ。

#### 変更2: キャンペーン別シートにROAS列を追加
ヘッダー行の最後（ランクの前）に「ROAS」列を追加。
各行の値は `campaign.purchase_roas` があればそれ、なければ「-」。

### ファイル: `app/api/reports/export-slides/route.ts`

KPIサマリースライドにROASボックスを追加（空きがあれば）。purchase_roasがない場合はスキップ。

### ファイル: `app/dashboard/reports/page.tsx`

レポートプレビューのサマリー部分にROASを表示。`detail.summary` に `purchase_roas` があれば表示。

**注意**: `purchase_roas` は Meta API の既存レスポンスに含まれている可能性がある。含まれていない場合は、インターフェースにOptionalフィールドとして追加し、UIでは「-」表示する。各種interfaceに `purchase_roas?: number | null;` を追加すること。

---

## タスク9: export-sheetのクリエイティブ別シートに画像列を追加【機能追加】

**注意**: CODEX-TASK.mdの前回タスク（クリエイティブ画像追加）が未完了の場合のみ実施。既に画像列が実装されている場合はスキップ。

### ファイル: `app/api/reports/export-sheet/route.ts`

#### 確認
CreativeRow インターフェースに `image_url` / `thumbnail_url` が既にあるか確認。
なければ追加:
```typescript
interface CreativeRow {
  // 既存フィールド...
  image_url?: string | null;
  thumbnail_url?: string | null;
}
```

クリエイティブ別シートのヘッダーに「画像」列が既にあるか確認。
なければ、No.の次に追加し、`=IMAGE("url")` 関数でサムネイルを表示する。

---

## 実装上の注意

- **`npm run build` が成功すること**を最優先で確認
- TypeScript strict: 型エラーなし
- 全て日本語UI
- `lib/budget.ts` の `applyFee` はexport済み。型 `FeeCalcMethod = "markup" | "margin"` も同ファイルからexport
- エラーメッセージは日本語で統一（「サーバーエラーが発生しました」等）
- セキュリティ修正はサーバーログ（`console.error`）にだけ詳細を出し、クライアントには汎用メッセージを返す
- 既存の認証フロー（NextAuth + Google OAuth + middleware.ts）を壊さないこと
