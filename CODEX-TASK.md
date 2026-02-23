# Codex実装タスク — 広告ダッシュボード 残り全画面

全て実装してください。確認や質問は不要です。

## 前提
- Next.js 16 + React 19 + Tailwind CSS v4 + Recharts
- 認証: NextAuth.js v5（lib/auth.ts 実装済み）
- DB: SQLite（lib/db.ts, migrations/schema.sql 実装済み）
- デザイン: Navy(#1B2A4A) / Blue(#2C5282) / White / LightGray(#F7FAFC)
- 既存API Routes: /api/dashboard, /api/clients, /api/api-keys, /api/alerts, /api/reports（全て実装済み）
- 既存UI: app/dashboard/layout.tsx, app/dashboard/page.tsx, app/dashboard/clients/[clientId]/page.tsx（実装済み）

## タスク一覧

### 1. サイドバー共通化（components/layout/）

app/dashboard/layout.tsx からサイドバーとヘッダーを抽出して共通化する。

**作成ファイル:**
- `components/layout/Sidebar.tsx` — サイドバー本体
- `components/layout/AppShell.tsx` — サイドバー+ヘッダー+mainのラッパー

**ナビゲーション:**
```
メイン:
- ダッシュボード (/dashboard) 📊
- 媒体比較 (/dashboard/compare) ⚖️
- アラート (/dashboard/alerts) 🔔
- レポート (/dashboard/reports) 📄
設定:
- APIキー管理 (/settings/api-keys) 🔑
- クライアント管理 (/settings/clients) 🏢
- ユーザー管理 (/settings/users) 👤
```

**修正ファイル:**
- `app/dashboard/layout.tsx` → AppShellを使うようにリファクタ

**新規ファイル:**
- `app/settings/layout.tsx` → 同じAppShellを使う

### 2. 媒体比較ページ

**ファイル:** `app/dashboard/compare/page.tsx`（新規）

- "use client"
- 期間セレクター（`<input type="month">`）
- 全クライアントのデータを `/api/clients` と各クライアントの `/api/reports?clientId=xxx&period=YYYY-MM` から取得
- Google Ads / Meta Ads の2枚のKPIカード（合計消化額・CV・CPA・ROAS）
- Recharts BarChart: クライアントごとの消化額を媒体別に表示
- デザイン: 既存UIスタイル踏襲

### 3. アラート履歴ページ

**ファイル:** `app/dashboard/alerts/page.tsx`（新規）

- "use client"
- `GET /api/alerts` でアラート一覧取得
- フィルター: 重要度（全て/warning/critical）、未解決のみトグル
- アラートをカード形式で表示:
  - warning: `border-l-4 border-yellow-400 bg-yellow-50`
  - critical: `border-l-4 border-red-400 bg-red-50`
  - 解決済み: `opacity-50`
- 「解決済みにする」ボタン → `PATCH /api/alerts` body: `{ id }`
- 各カード: クライアント名、媒体、指標名、現在値、移動平均、乖離率%、通知日時

### 4. レポート生成ページ

**ファイル:** `app/dashboard/reports/page.tsx`（新規）

- "use client"
- クライアント選択（`GET /api/clients`でドロップダウン）+ 期間選択
- 「レポートデータ読込」→ `GET /api/reports?clientId=xxx&period=YYYY-MM`
- レポートプレビュー（id="report-preview"）:
  - エグゼクティブサマリー（消化額/CV/CPA/ROAS）
  - 媒体別テーブル
  - 日別推移 LineChart
  - キャンペーン別テーブル
- 「PDF ダウンロード」ボタン:
```tsx
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
const el = document.getElementById("report-preview");
const canvas = await html2canvas(el!, { scale: 2 });
const imgData = canvas.toDataURL("image/png");
const pdf = new jsPDF("p", "mm", "a4");
const w = pdf.internal.pageSize.getWidth();
const h = (canvas.height * w) / canvas.width;
pdf.addImage(imgData, "PNG", 0, 0, w, h);
pdf.save(`report_${period}.pdf`);
```

### 5. APIキー管理画面

**ファイル:** `app/settings/api-keys/page.tsx`（新規）

- "use client"
- `GET /api/api-keys` でAPIキー一覧表示（id, platform, key_name, created_at）
- 「新規登録」→ モーダル表示:
  - プラットフォーム切替タブ（Google Ads / Meta Ads）
  - Google Ads: developer_token, client_id, client_secret, refresh_token, login_customer_id
  - Meta Ads: app_id, app_secret, access_token
  - 表示名
  - 「保存」→ `POST /api/api-keys` body: `{ platform, key_name, credentials: {...} }`
- 削除ボタン → 確認後 `DELETE /api/api-keys?id=xxx`
- モーダル: `fixed inset-0 bg-black/50` + `bg-white rounded-2xl p-6 max-w-lg`

### 6. クライアント管理画面

**ファイル:** `app/settings/clients/page.tsx`（新規）

- "use client"
- `GET /api/clients` で一覧表示
- テーブル: 名前 / Google Ads ID / Meta Ads ID / Google月次予算 / Meta月次予算 / ステータス
- 「新規登録」モーダル: name(必須), google_ads_account_id, meta_ads_account_id, monthly_budget_google, monthly_budget_meta
- `POST /api/clients` で作成

### 7. ユーザー管理画面

**ファイル:** `app/settings/users/page.tsx`（新規）
**ファイル:** `app/api/users/route.ts`（新規 — ユーザーCRUD API）

**API Route（新規）:**
```typescript
// GET: 全ユーザー一覧（admin only）
// POST: 新規ユーザー作成（admin only）、bcryptでpassword_hash生成
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
```

**UI:**
- ユーザー一覧テーブル: 名前 / メール / ロール / 登録日
- ロールバッジ: admin=紫, editor=青, viewer=灰
- 新規登録モーダル: name, email, password, role(select)

### 8. Settings トップページ

**ファイル:** `app/settings/page.tsx`（新規）

3つのリンクカード:
- APIキー管理 → /settings/api-keys
- クライアント管理 → /settings/clients
- ユーザー管理 → /settings/users

## 完了条件
- `npm run build` が成功する
- 全ページが正しくルーティングされる
- サイドバーが全ページで共通表示される
- 既存のdashboard/page.tsx, dashboard/clients/[clientId]/page.tsx が壊れない
