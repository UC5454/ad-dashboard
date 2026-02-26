# UI全面ブラッシュアップ + 設定画面 + メニュー充実

全て実装してください。確認や質問は不要です。具体的な提案・修正案・コード例まで自主的に出力してください。完了後 npm run build で成功することを確認してください。

## 絶対に変更しないファイル
- lib/meta-api.ts
- lib/auth.ts
- lib/constants.ts
- lib/meta-utils.ts
- types/meta.ts

## 技術スタック
- Next.js 16.1.6, React 19, TypeScript strict
- Tailwind CSS 4（カスタムカラー: navy=#1B2A4A, blue=#2C5282）
- Recharts 3.7.0
- 日本語UIで統一
- `npm run build` が成功すること

---

## 1. サイドバーのメニューを充実させる

### 1-1. Sidebar.tsx のnavItemsを拡張

現在:
```typescript
const navItems = [
  { href: "/dashboard", label: "ダッシュボード", icon: "📊" },
  { href: "/dashboard/reports", label: "レポート", icon: "📄" },
];
```

変更後（セクション分け + アイコンをSVGに統一）:

```typescript
interface NavSection {
  title: string;
  items: { href: string; label: string; icon: React.ReactNode }[];
}

const navSections: NavSection[] = [
  {
    title: "分析",
    items: [
      { href: "/dashboard", label: "ダッシュボード", icon: <DashboardIcon /> },
      { href: "/dashboard/alerts", label: "アラート", icon: <AlertIcon /> },
    ],
  },
  {
    title: "レポート",
    items: [
      { href: "/dashboard/reports", label: "レポート生成", icon: <ReportIcon /> },
    ],
  },
  {
    title: "管理",
    items: [
      { href: "/dashboard/settings", label: "設定", icon: <SettingsIcon /> },
    ],
  },
];
```

SVGアイコンはインラインで小さなコンポーネントとして定義する（外部ライブラリ不要）。
サイズは `className="h-5 w-5"` で統一。

各セクションのタイトルは `text-xs font-semibold text-slate-400 uppercase tracking-wider` で表示。
セクション間に `mt-6` のスペース。

### 1-2. isActive関数を更新

```typescript
function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") {
    return pathname === "/dashboard" || pathname.startsWith("/dashboard/projects/");
  }
  return pathname.startsWith(href);
}
```
→ `/dashboard/alerts` と `/dashboard/settings` にも対応。現在のロジックでそのまま動くはず。

### 1-3. AppShell.tsx のtitlesを更新

```typescript
const titles: { prefix: string; title: string }[] = [
  { prefix: "/dashboard/settings", title: "設定" },
  { prefix: "/dashboard/alerts", title: "アラート一覧" },
  { prefix: "/dashboard/reports", title: "レポート" },
  { prefix: "/dashboard/projects/", title: "案件詳細" },
  { prefix: "/dashboard", title: "ダッシュボード" },
];
```

---

## 2. 設定ページの新規作成

### 2-1. app/dashboard/settings/page.tsx（新規作成）

**目的**: 予算・手数料率・アラート閾値を誰でもUI上で変更できるようにする。

**現状の問題**: 予算設定が `lib/budget.ts` の `DEFAULT_BUDGETS` にハードコードされていて、変更するにはコードを書き換える必要がある。

**解決方法**: localStorageに設定を保存し、クライアントサイドで読み込む。サーバーサイドDBは不要。

#### 設定画面の構成（3セクション）

**セクション1: 案件別予算設定**
```
┌────────────────────────────────────────────────────────────┐
│ 案件別予算設定                                              │
│                                                            │
│ ┌──────────────────────┬───────────┬──────────┬──────────┐ │
│ │ 案件名               │ 月間予算   │ 手数料率  │ 操作     │ │
│ ├──────────────────────┼───────────┼──────────┼──────────┤ │
│ │ CREETstage ライバー   │ ¥300,000  │ 20%      │ [編集]   │ │
│ │ フェイス美容外科       │ ¥500,000  │ 20%      │ [編集]   │ │
│ │ Trust株式会社         │ ¥200,000  │ 20%      │ [編集]   │ │
│ └──────────────────────┴───────────┴──────────┴──────────┘ │
│                                                            │
│ [+ 新規案件追加]                                            │
│                                                            │
│ ※ 案件名はMeta広告のキャンペーン名から自動抽出されます。       │
│   ここで案件名を追加すると、予算管理の対象になります。          │
└────────────────────────────────────────────────────────────┘
```

- 各行に「編集」ボタン → クリックで行内インライン編集モードになる
  - 月間予算: input type="number" + ¥表示
  - 手数料率: input type="number" + %表示（例: 20 → 0.2で保存）
- 「新規案件追加」ボタン → 空行を追加、案件名・月間予算・手数料率を入力
- 「削除」ボタン → 行を削除（確認モーダル不要、即削除）
- 「保存」ボタン → localStorageに保存し、画面上部に「保存しました」トースト表示

**セクション2: デフォルト手数料率**
```
┌────────────────────────────────────────────────┐
│ デフォルト手数料率                               │
│                                                │
│ 予算未設定の案件に適用される手数料率:              │
│ [ 20 ] %                                       │
│                                                │
│ [保存]                                          │
└────────────────────────────────────────────────┘
```

**セクション3: アラート閾値設定**
```
┌────────────────────────────────────────────────────────────┐
│ アラート閾値設定                                            │
│                                                            │
│ ┌──────────────────────────────────┬───────────┐           │
│ │ 項目                             │ 閾値      │           │
│ ├──────────────────────────────────┼───────────┤           │
│ │ 予算超過アラート（消化率 %）       │ [ 90 ] %  │           │
│ │ 予算ペース遅れ（理想の %）        │ [ 70 ] %  │           │
│ │ 着地予想超過（予算の倍率）         │ [ 1.1 ] x │           │
│ │ CPA高騰（平均の倍率）            │ [ 1.5 ] x │           │
│ │ CV急減（3日平均の %）            │ [ 50 ] %  │           │
│ │ CPC急騰（3日平均の倍率）         │ [ 2.0 ] x │           │
│ │ CPC急落（3日平均の %）           │ [ 50 ] %  │           │
│ │ CPM急騰（3日平均の倍率）         │ [ 2.0 ] x │           │
│ │ CV0クリエイティブ消化閾値         │ ¥[ 5000 ] │           │
│ │ 配信停滞（前日IMP比 %）          │ [ 30 ] %  │           │
│ └──────────────────────────────────┴───────────┘           │
│                                                            │
│ [デフォルトに戻す]  [保存]                                   │
└────────────────────────────────────────────────────────────┘
```

### 2-2. lib/settings.ts（新規作成）

localStorageの読み書きを管理するユーティリティ:

```typescript
const STORAGE_KEY = "ad-dashboard-settings";

export interface BudgetSetting {
  projectName: string;
  monthlyBudget: number;
  feeRate: number;
}

export interface AlertThresholds {
  budgetOverRate: number;        // 予算超過アラート消化率 (default: 90)
  budgetPaceLagRate: number;     // 予算ペース遅れ (default: 70)
  projectedOverMultiplier: number; // 着地予想超過倍率 (default: 1.1)
  cpaHighMultiplier: number;     // CPA高騰倍率 (default: 1.5)
  cvDropRate: number;            // CV急減% (default: 50)
  cpcSpikeMultiplier: number;    // CPC急騰倍率 (default: 2.0)
  cpcDropRate: number;           // CPC急落% (default: 50)
  cpmSpikeMultiplier: number;    // CPM急騰倍率 (default: 2.0)
  zeroConvSpendThreshold: number; // CV0クリエイティブ消化額閾値 (default: 5000)
  impDropRate: number;           // 配信停滞IMP低下率% (default: 30)
}

export interface DashboardSettings {
  budgets: BudgetSetting[];
  defaultFeeRate: number;
  alertThresholds: AlertThresholds;
}

export const DEFAULT_SETTINGS: DashboardSettings = {
  budgets: [
    { projectName: "CREETstage ライバー募集", monthlyBudget: 300000, feeRate: 0.2 },
    { projectName: "フェイス美容外科 来院者増加", monthlyBudget: 500000, feeRate: 0.2 },
    { projectName: "Trust株式会社 採用施策", monthlyBudget: 200000, feeRate: 0.2 },
  ],
  defaultFeeRate: 0.2,
  alertThresholds: {
    budgetOverRate: 90,
    budgetPaceLagRate: 70,
    projectedOverMultiplier: 1.1,
    cpaHighMultiplier: 1.5,
    cvDropRate: 50,
    cpcSpikeMultiplier: 2.0,
    cpcDropRate: 50,
    cpmSpikeMultiplier: 2.0,
    zeroConvSpendThreshold: 5000,
    impDropRate: 30,
  },
};

export function loadSettings(): DashboardSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<DashboardSettings>;
    return {
      budgets: parsed.budgets ?? DEFAULT_SETTINGS.budgets,
      defaultFeeRate: parsed.defaultFeeRate ?? DEFAULT_SETTINGS.defaultFeeRate,
      alertThresholds: { ...DEFAULT_SETTINGS.alertThresholds, ...parsed.alertThresholds },
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: DashboardSettings): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
```

### 2-3. lib/budget.ts を settings連携に変更

`DEFAULT_BUDGETS` と `DEFAULT_FEE_RATE` はそのまま残す（フォールバック用）。

`calculateBudgetProgress` の引数にオプションで `budgets` と `defaultFeeRate` を渡せるようにする:

```typescript
export function calculateBudgetProgress(
  projectName: string,
  currentSpend: number,
  budgets?: BudgetConfig[],
  defaultFeeRate?: number,
): BudgetProgress {
  const budgetList = budgets ?? DEFAULT_BUDGETS;
  const fallbackFeeRate = defaultFeeRate ?? DEFAULT_FEE_RATE;
  const config = budgetList.find((budget) => budget.projectName === projectName);
  // ... 以降は config || fallbackFeeRate を使う
}
```

### 2-4. lib/alerts.ts を settings連携に変更

`generateAlerts` の第5引数にオプションで `AlertThresholds` を渡せるようにする:

```typescript
export function generateAlerts(
  projects: ProjectInput[],
  daily: DailyInput[],
  creatives: CreativeInput[],
  budgets: BudgetInput[],
  thresholds?: Partial<AlertThresholds>,
): Alert[] {
  const t = { ...DEFAULT_THRESHOLDS, ...thresholds };
  // 各ルールで t.budgetOverRate, t.cpaHighMultiplier 等を使う
}
```

`DEFAULT_THRESHOLDS` はlib/alerts.ts内にハードコードでOK（loadSettingsのDEFAULT_SETTINGSと同じ値）。

### 2-5. ダッシュボード・案件詳細でsettingsを読み込む

- `app/dashboard/page.tsx`: useEffect内またはuseMemoで `loadSettings()` を呼び、予算・閾値をcalculateBudgetProgress/generateAlertsに渡す
- `app/dashboard/projects/[projectId]/page.tsx`: 同様にsettingsを読み込む
- `app/dashboard/reports/page.tsx`: 同様にsettingsを読み込む

---

## 3. アラート一覧ページの新規作成

### 3-1. app/dashboard/alerts/page.tsx（新規作成）

ダッシュボードに表示しているアラートバナーと同じデータを、より詳細に一覧表示するページ。

構成:
- ページ上部: フィルタ（全て / critical / warning / info）のタブ
- フィルタの下: カテゴリフィルタ（全て / 予算 / パフォーマンス / クリエイティブ）のドロップダウン
- アラート一覧: カード形式で表示
  - 各カードに: アラートタイプバッジ（critical/warning/info）、タイトル、メッセージ、カテゴリバッジ、案件名
  - critical: 赤枠・赤背景
  - warning: amber枠・amber背景
  - info: blue枠・blue背景
- アラートがない場合: 「現在アラートはありません。全ての指標は正常範囲内です。」と表示
- データは `/api/meta/projects`, `/api/meta/daily`, `/api/meta/creatives` から取得し、クライアントサイドで `generateAlerts()` を呼ぶ
- settingsからalertThresholdsを読み込んで使う

---

## 4. ダッシュボードUIのブラッシュアップ

### 4-1. KPIカードの改善
- ファイル: `app/dashboard/page.tsx`
- 現在: 7枚が横並び。小さいディスプレイだと窮屈
- 改善: `grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7` のようにブレークポイントを増やしてレスポンシブ対応を強化
- 各KPIカードに小さなアイコン（テキストでOK: 💰📈📊 等）を追加して視認性UP（ただしemoji不可なのでSVGかテキスト装飾）
- KPIの値が0の場合は`text-gray-400`でグレーアウト

### 4-2. 予算進捗セクションの改善
- 予算未設定の案件は「設定画面で予算を設定できます」というリンク付きメッセージを表示
- `<Link href="/dashboard/settings">設定画面</Link>` へのリンク

### 4-3. アラートバナーの改善
- ダッシュボードのアラートバナーに「全てのアラートを見る →」リンクを追加
- `<Link href="/dashboard/alerts">全てのアラートを見る →</Link>`

---

## 5. 案件詳細UIの改善

### 5-1. 案件詳細のKPIカード
- 同様にレスポンシブ対応強化
- `grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7`

### 5-2. 予算進捗で「設定画面で予算を設定できます」リンク追加（ダッシュボードと同じ）

### 5-3. settings連携
- calculateBudgetProgressにloadSettings()の結果を渡す

---

## 6. 全画面共通のUI統一

### 6-1. セクションカードのスタイル統一
全てのセクションカードを以下のスタイルで統一:
```
rounded-xl border border-gray-200 bg-white p-5 shadow-sm
```

### 6-2. テーブルのスタイル統一
全てのテーブルヘッダを以下で統一:
```
bg-gray-50 text-xs text-gray-500
th: px-3 py-2 text-left font-medium
```

### 6-3. ボタンスタイル統一
- プライマリ: `rounded-lg bg-blue px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-light`
- セカンダリ: `rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50`
- danger: `rounded-lg bg-red-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-600`

---

## 実装の優先順位

1. lib/settings.ts を作成
2. lib/budget.ts, lib/alerts.ts をsettings連携に更新
3. Sidebar.tsx, AppShell.tsx のメニュー更新
4. app/dashboard/settings/page.tsx を作成
5. app/dashboard/alerts/page.tsx を作成
6. 各ダッシュボードページでloadSettings()を使うように更新
7. UIブラッシュアップ（KPIカード、予算進捗リンク、アラートリンク）
8. npm run build で確認
