# CODEX-TASK: ユーザー管理修正 + 案件管理 + 案件クロス分析

全て実装してください。確認や質問は不要です。具体的な提案・修正案・コード例まで自主的に出力してください。完了後 npm run build で成功することを確認してください。

## 絶対に変更しないファイル

以下のファイルは一切変更しないでください:

- `lib/auth.ts`
- `lib/meta-api.ts`
- `app/api/reports/export-sheet/route.ts`
- `app/api/meta/*/route.ts`（全てのMeta APIルート）
- `app/api/meta/check-env/route.ts`
- `app/dashboard/reports/page.tsx`
- `app/dashboard/alerts/page.tsx`
- `app/dashboard/projects/[projectId]/page.tsx`
- `types/next-auth.d.ts`
- `lib/constants.ts`

## 技術スタック
- Next.js 16 (App Router) + React 19 + TypeScript strict
- Tailwind CSS 4 (カスタムカラー: navy=#1B2A4A, blue=#2C5282)
- recharts（チャートライブラリ、既にインストール済み）
- NextAuth v5 (beta.30)
- localStorage ベースのデータ永続化（lib/storage.ts）

---

## タスク1: ユーザー管理ページ修正

### ファイル: `app/settings/users/page.tsx`

### 問題
- `/api/users` というAPIルートが存在しない → 常にエラー表示

### 修正
**fetch('/api/users') を完全に削除。** NextAuth の useSession() からログイン中ユーザーの情報を表示するシンプルなプロフィールカード画面にする。

1. `useSession()` でログイン中のユーザー情報（name, email, image）を取得して表示
2. ロール管理は削除（`role` の表示・編集・判定を全て削除）
3. 表示項目:
   - ユーザー名（Googleアカウント名）
   - メールアドレス
   - プロフィール画像（Google アバター、img要素で円形64x64、`next/image`は使わずimgタグで可）
   - ログイン状態（「ログイン中」緑バッジ）
4. UIデザイン:
   - プロフィールカード形式（テーブルではなく）
   - 背景: `rounded-xl bg-white shadow-sm p-6`
   - ヘッダーは「アカウント情報」に変更
   - セッションがない場合は「ログインしていません」表示

---

## タスク2: クライアント管理 → 案件管理にリデザイン

### 問題
- 現在の「クライアント管理」はGoogle Ads ID / Meta Ads IDを手動入力する複雑な設計
- 実際の運用では、Meta広告のキャンペーン群を「案件（会社名）」単位でグルーピングして管理する

### A. lib/storage.ts に StoredCompany を追加

```ts
export interface StoredCompany {
  id: string;
  companyName: string;           // 会社名（例: "CREETstage", "フェイス美容外科"）
  campaignKeywords: string[];    // キャンペーン名に含まれるキーワード（部分一致でグルーピング）
  monthlyBudget: number;         // 月間予算
  feeRate: number;               // 手数料率（0.2 = 20%）
  status: "active" | "paused" | "archived";
  createdAt: string;
}
```

追加する関数:
- `const COMPANIES_KEY = "ad-dashboard-companies-data";`
- `loadCompanies(): StoredCompany[]` — localStorageから読み込み。旧CLIENTS_KEYデータがあればマイグレーション（name→companyName, monthlyBudgetMeta→monthlyBudget, feeRate=0.2をデフォ設定, campaignKeywords=[name]）
- `saveCompanies(companies: StoredCompany[]): void`

**既存の StoredClient / loadClients / saveClients / getMetaToken 等は残す（他ファイルが参照している可能性）。** ただし loadClients() 内部で loadCompanies() への委譲は不要。そのまま残す。

### B. 案件管理ページ: `app/settings/clients/page.tsx`

全面リライト。StoredCompany を使った案件管理UIにする。

**ヘッダー**: 「案件管理」/ 「広告キャンペーンを会社（案件）単位でグルーピングします」

**テーブル**:
| 会社名 | マッチキーワード | 月間予算 | 手数料率 | ステータス | 操作 |

**新規登録モーダル**:
- 会社名（必須テキスト入力）
- マッチキーワード（テキスト入力、カンマ区切り。ヘルプ: 「キャンペーン名に含まれるキーワードをカンマ区切りで入力。いずれかが含まれるキャンペーンがこの案件にグルーピングされます」）
- 月間予算（数値入力、円）
- 手数料率（数値入力、%表示、デフォルト20）
- ステータス（selectでactive/paused）

**編集**: 行の「編集」ボタン → 同じモーダルを編集モードで開く（既存データpre-fill）
**削除**: 行の「削除」ボタン → confirm後削除

roleチェックは全て削除。全ユーザーが操作可能。

### C. lib/projects.ts のグルーピング改修

`groupCampaignsToProjects()` を修正:

```ts
export function groupCampaignsToProjects(campaigns: MetaCampaignInsights[]): ProjectSummary[] {
  // サーバーサイド（typeof window === "undefined"）では loadCompanies() は空配列を返す
  // → 既存の extractProjectName フォールバックを使う
  let companies: StoredCompany[] = [];
  if (typeof window !== "undefined") {
    const { loadCompanies } = require("@/lib/storage");  // dynamic import避けるため
    companies = loadCompanies();
  }

  if (companies.length === 0) {
    // === 既存ロジック（extractProjectName）をそのまま維持 ===
    const groupMap = new Map<string, MetaCampaignInsights[]>();
    for (const campaign of campaigns) {
      const projectName = extractProjectName(campaign.campaign_name || "");
      if (!projectName) continue;
      const existing = groupMap.get(projectName) || [];
      existing.push(campaign);
      groupMap.set(projectName, existing);
    }
    return Array.from(groupMap.entries()).map(([name, matched]) => {
      // ...既存の集計ロジック
    }).filter(p => p.campaigns.length > 0);
  }

  // === キーワードマッチング ===
  const companyMap = new Map<string, { company: StoredCompany; campaigns: MetaCampaignInsights[] }>();
  const unmatched: MetaCampaignInsights[] = [];

  for (const company of companies) {
    companyMap.set(company.id, { company, campaigns: [] });
  }

  for (const campaign of campaigns) {
    const name = campaign.campaign_name || "";
    let matched = false;
    for (const company of companies) {
      if (company.status !== "active") continue;
      if (company.campaignKeywords.some(kw => kw && name.includes(kw))) {
        companyMap.get(company.id)!.campaigns.push(campaign);
        matched = true;
        break;
      }
    }
    if (!matched) unmatched.push(campaign);
  }

  const results: ProjectSummary[] = [];

  for (const [, { company, campaigns: matched }] of companyMap) {
    if (matched.length === 0) continue;
    // 集計（既存ロジックと同じ）
    const spend = matched.reduce((sum, c) => sum + numeric(c.spend), 0);
    const impressions = matched.reduce((sum, c) => sum + numeric(c.impressions), 0);
    const clicks = matched.reduce((sum, c) => sum + numeric(c.clicks), 0);
    const cv = matched.reduce((sum, c) => sum + actionValue(c.actions, "offsite_conversion.fb_pixel_custom"), 0);
    results.push({
      id: company.id,
      name: company.companyName,
      campaigns: matched,
      spend, impressions, clicks, cv,
      cpa: cv > 0 ? spend / cv : 0,
      ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    });
  }

  // 未分類
  if (unmatched.length > 0) {
    const spend = unmatched.reduce((sum, c) => sum + numeric(c.spend), 0);
    const impressions = unmatched.reduce((sum, c) => sum + numeric(c.impressions), 0);
    const clicks = unmatched.reduce((sum, c) => sum + numeric(c.clicks), 0);
    const cv = unmatched.reduce((sum, c) => sum + actionValue(c.actions, "offsite_conversion.fb_pixel_custom"), 0);
    results.push({
      id: "__unmatched__",
      name: "未分類",
      campaigns: unmatched,
      spend, impressions, clicks, cv,
      cpa: cv > 0 ? spend / cv : 0,
      ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    });
  }

  return results;
}
```

**注意**: `require("@/lib/storage")` ではなく、ファイル先頭で `import { loadCompanies } from "@/lib/storage"` して、`typeof window !== "undefined"` のガードで呼ぶ形にすること。ただしサーバーサイドでimport自体はエラーにならない（loadCompanies内部で `canUseStorage()` が false を返す）ので、単純にimportして呼んでOK。

### D. サイドバー: `components/ui/Sidebar.tsx`

settingItemsの変更:
- `{ href: "/settings/clients", label: "クライアント管理", ... }` → `label: "案件管理"` に変更

### E. ダッシュボード: `app/dashboard/page.tsx`

`loadClients` の import を `loadCompanies` に変更。
setupMissing のチェック:
```ts
const companies = loadCompanies();
const keys = loadApiKeys();
// companiesが空でもenv変数があればOK（既存の check-env ロジック維持）
if (companies.length === 0 && keys.length === 0) {
  // 既存のenv変数チェックロジック
}
```

### F. api-client.ts

`loadClients` → `loadCompanies` に変更。
ただし `getActiveClient()` の内部ロジックは StoredCompany に合わない（metaApiKeyId等がない）。
**対策**: `getMetaHeaders()` を簡略化。companiesからはヘッダーを付与しない（env変数フォールバックに任せる）。

```ts
import { loadCompanies } from "@/lib/storage";

export async function apiFetch(url: string, options?: RequestInit): Promise<Response> {
  // env変数フォールバックがあるので、ヘッダー付与は不要
  // 将来的にクライアント別トークンが必要になったら再実装
  return fetch(url, options);
}
```

---

## タスク3: 媒体比較 → 案件クロス分析にリデザイン

### ファイル: `app/dashboard/compare/page.tsx`

全面リライト。

### ヘッダー
- タイトル: 「案件クロス分析」
- サブタイトル: 「案件間のパフォーマンスを比較し、予算配分を最適化」
- 期間セレクター（今月 / 過去30日）

### データ取得
- `/api/meta/projects?date_preset=xxx` から案件別データを取得
- `loadCompanies()` から月間予算・手数料率を取得してマージ

### セクション1: 案件比較カード（横並び grid）
- 案件ごとにカードを表示（`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4`）
- 各カード内:
  - 会社名（太字）
  - 消化額 / 月間予算（プログレスバー。`h-2 rounded-full bg-gray-200` の中に `bg-blue` のバー）
  - 消化率%テキスト
  - CV数（大きめ数字）
  - CPA（前期間比は不要、シンプルに値のみ）
  - CTR
  - ペースバッジ:
    - 日割り消化率 vs 月日数経過率 の比較
    - 経過率の±10%以内 → 「順調」緑バッジ
    - 経過率より20%以上低い → 「遅れ」黄バッジ
    - 経過率より10%以上高い → 「超過ペース」赤バッジ
- カード上部に2pxカラーバー:
  - CPAが全案件平均の80%以下 → 緑 (`bg-emerald-500`)
  - CPAが全案件平均の120%以上 → 赤 (`bg-red-500`)
  - それ以外 → 黄 (`bg-amber-500`)

### セクション2: レーダーチャート（recharts RadarChart）
- `import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend } from "recharts";`
- 軸（5つ）: 消化率, CV数, CPA効率, CTR, クリック数
- 各値は0-100に正規化（max値を100とする）
- 各案件を異なる色の Radar で重ね表示
- 色: `#2C5282`(blue), `#38A169`(green), `#D69E2E`(gold), `#E53E3E`(red), `#805AD5`(purple)
- Legend で案件名を表示

### セクション3: 予算配分サジェスト
- カード形式: `rounded-xl bg-white shadow-sm p-5`
- タイトル: 「予算配分サジェスト」
- 案件ごとに1行:
  - 会社名 | CPA | CV | バッジ | コメント
  - バッジロジック:
    - CPA < 全案件平均CPA × 0.8 → 「予算増額推奨」（緑バッジ `bg-emerald-50 text-emerald-700`）
    - CPA > 全案件平均CPA × 1.5 → 「改善優先」（赤バッジ `bg-red-50 text-red-700`）
    - それ以外 → 「現状維持」（グレーバッジ `bg-gray-100 text-gray-600`）
  - コメント自動生成:
    - 緑: `CPAが全案件平均の${ratio}%で効率的。予算増額でCV獲得をスケール可能`
    - 赤: `CPAが全案件平均の${ratio}%。クリエイティブ改善またはターゲティングの見直しを検討`
    - グレー: `CPAは平均水準。現行の運用を継続しつつ改善余地を探索`

### セクション4: 詳細比較テーブル
- 全案件の指標を横並びテーブルで比較
- 列: 案件名 | 消化額 | IMP | クリック | CTR | CPC | CV | CPA | 月間予算 | 消化率
- **最も良い値のセルに `bg-emerald-50` を適用**
- **最も悪い値のセルに `bg-red-50` を適用**
- 「良い/悪い」の定義:
  - 消化額: ハイライトなし（大小で良悪なし）
  - IMP, クリック, CV: 大きい方が良い（緑）、小さい方が悪い（赤）
  - CTR: 高い方が良い
  - CPC, CPA: 低い方が良い（緑）、高い方が悪い（赤）
  - 消化率: ハイライトなし
- **案件が1つしかない場合はハイライトなし**

### サイドバー
`components/ui/Sidebar.tsx` の menuItems:
- `{ href: "/dashboard/compare", label: "媒体比較", ... }` → `label: "案件クロス分析"` に変更

---

## UIデザインガイドライン（全タスク共通）

- カラーパレット: navy=#1B2A4A, blue=#2C5282, 背景=gray-50, カード=white
- カードは全て `rounded-xl bg-white shadow-sm p-5`
- ヘッダーは `text-2xl font-bold text-navy`
- サブテキストは `text-sm text-gray-500`
- テーブルヘッダーは `bg-gray-50 text-xs text-gray-500`
- ボタン（主）: `bg-blue text-white rounded-lg px-4 py-2`
- ボタン（副）: `border border-gray-200 text-gray-700 rounded-lg px-4 py-2`
- 数値は `tabular-nums` で等幅表示
- 金額は `¥${Math.round(value).toLocaleString("ja-JP")}` フォーマット

## ビルド

修正後、`npx next build` でエラーがないことを確認すること。TypeScriptの型エラーも全て解決すること。
