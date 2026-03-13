# ダッシュボード改修: レポート要件完全準拠（Phase 1-4）

全て実装してください。確認や質問は不要です。
具体的な提案・修正案・コード例まで自主的に出力してください。
完了後 npm run build で成功することを確認してください。

## 絶対に変更しないファイル
- `lib/auth.ts`
- `middleware.ts`
- `lib/meta-api.ts`（既存の関数は変更しない。新規export追加はOK）
- `next.config.ts`
- `package.json`（依存関係追加不要。recharts 3は既にある）

## 技術スタック
- Next.js 16.1.6 + React 19 + TypeScript
- Tailwind CSS 4（`@import "tailwindcss"` 方式、`tailwind.config.js`なし）
- Recharts 3（`recharts@^3.1.0`）
- 全コンポーネントは `"use client"` を先頭に記載
- 色: navyは `text-[#1a365d]`、blueは `bg-[#2C5282]`、blue-lightは `hover:bg-[#3B6BA5]`
- `@/` エイリアスを使う（例: `import { type TrendRow } from "@/components/dashboard/types"`）

---

## 1. KPI全体サマリー拡張（BigKpiCards + dashboard/page.tsx）

### 1-1. KpiMetric型の拡張
- ファイル: `components/dashboard/types.ts`
- 現状: KpiMetricは `label, value, previous, type, inverted?, subLabel?` のみ
- 変更: type に `"percent"` を追加、`target?: number` を追加
```typescript
export interface KpiMetric {
  label: string;
  value: number;
  previous: number;
  type: "currency" | "number" | "roas" | "percent";
  inverted?: boolean;
  subLabel?: string;
  target?: number;
}
```

### 1-2. BigKpiCardsに追加指標を表示
- ファイル: `components/dashboard/BigKpiCards.tsx`
- 変更:
  - `formatValue`: `type: "percent"` の場合 `${value.toFixed(1)}%` でフォーマット
  - `target` がある場合、前月比の下に `目標対比: {((value/target)*100).toFixed(1)}%` を小さく表示（`text-xs text-gray-500`）

### 1-3. dashboard/page.tsxのmetrics配列を8つに拡張
- ファイル: `app/dashboard/page.tsx`
- 現状: metricsは4つ（totalSpend, totalCv, avgCpa, avgRoas）
- 変更: 以下8つに拡張。既存4つの後に4つ追加
  - 表示回数（totalImpressions = projects.reduce impressions, type: "number"）
  - クリック数（totalClicks = projects.reduce clicks, type: "number"）
  - CTR（totalCtr = totalImpressions > 0 ? (totalClicks/totalImpressions)*100 : 0, type: "percent"）
  - CPC（avgCpc = totalClicks > 0 ? totalSpend/totalClicks : 0, type: "currency", inverted: true）
- prevRowsからも同様にprev値を計算（prevImpressions, prevClicks, prevCtr, prevCpc）
- daily配列の各rowには既に `impressions` と `clicks` がある（MetaInsights extend）

### 1-4. TrendRow型にimpressions, clicks, ctrを追加
- ファイル: `components/dashboard/types.ts`
```typescript
export interface TrendRow {
  date: string;
  spend: number;
  cv: number;
  cpa: number;
  impressions: number;
  clicks: number;
  ctr: number;
}
```
- `app/dashboard/page.tsx` の `trendRows` useMemo内でも impressions, clicks, ctr をマッピング

---

## 2. トレンドチャート拡張 + デバイス別分析

### 2-1. DailyTrendChartにimpressions/clicks/ctrタブ + 週別切替を追加
- ファイル: `components/dashboard/DailyTrendChart.tsx`
- 変更:
  - MetricTab拡張: `type MetricTab = "spend" | "cv" | "cpa" | "impressions" | "clicks" | "ctr";`
  - `granularity` state追加: `"daily" | "weekly"`
  - 「日別/週別」トグルボタンをタイトル右側に追加
  - 週別の場合は内部でrowsを週ごとにreduce:
```typescript
function aggregateWeekly(rows: TrendRow[]): TrendRow[] {
  const weeks = new Map<string, { spend: number; cv: number; impressions: number; clicks: number }>();
  rows.forEach(row => {
    const d = new Date(row.date);
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - d.getDay());
    const key = weekStart.toISOString().slice(0, 10);
    const existing = weeks.get(key) || { spend: 0, cv: 0, impressions: 0, clicks: 0 };
    existing.spend += row.spend;
    existing.cv += row.cv;
    existing.impressions += row.impressions;
    existing.clicks += row.clicks;
    weeks.set(key, existing);
  });
  return Array.from(weeks.entries()).map(([date, d]) => ({
    date,
    spend: d.spend,
    cv: d.cv,
    cpa: d.cv > 0 ? d.spend / d.cv : 0,
    impressions: d.impressions,
    clicks: d.clicks,
    ctr: d.impressions > 0 ? (d.clicks / d.impressions) * 100 : 0,
  })).sort((a, b) => a.date.localeCompare(b.date));
}
```
  - ctrタブ: YAxis tickFormatter を `${value.toFixed(1)}%` に
  - impressions/clicksタブ: 通貨フォーマットではなく `Math.round(value).toLocaleString("ja-JP")`
  - タブボタンは横スクロール可能な `flex gap-0.5 overflow-x-auto` で配置

### 2-2. 新規コンポーネント: DeviceBreakdown.tsx
- ファイル: `components/dashboard/DeviceBreakdown.tsx`（新規作成）
- 目的: デバイス別の費用比率（PieChart）+ CPA比較（BarChart）
- props:
```typescript
interface DeviceData {
  device: string;
  spend: number;
  impressions: number;
  clicks: number;
  cv: number;
  cpa: number;
  ctr: number;
}
export default function DeviceBreakdown({ data }: { data: DeviceData[] })
```
- レイアウト:
  - セクションタイトル: `デバイス別分析`
  - 左半分: PieChart（費用比率）- `PieChart`, `Pie`, `Cell`, `Legend`, `Tooltip`
  - 右半分: BarChart（CPA比較）- 横棒グラフ `BarChart` layout="vertical"
  - sm以下は縦並び（`grid grid-cols-1 md:grid-cols-2 gap-4`）
  - 色配列: `["#2C5282", "#38A169", "#D69E2E", "#E53E3E", "#805AD5"]`
  - データが空の場合: `データがありません` メッセージ

### 2-3. dashboard/page.tsxにDeviceBreakdownを追加
- deviceData state追加
- useEffect内のPromise.allに `apiFetch(\`/api/meta/breakdowns?dimension=impression_device&date_preset=\${datePreset}\`)` を追加
- レスポンスをDeviceData[]に変換:
```typescript
const deviceNormalized = (deviceRaw as any[]).map(row => ({
  device: row.impression_device || "unknown",
  spend: Number(row.spend) || 0,
  impressions: Number(row.impressions) || 0,
  clicks: Number(row.clicks) || 0,
  cv: row.cv || 0,
  cpa: row.cpa || 0,
  ctr: Number(row.ctr) || 0,
}));
```
- DailyTrendChartの下に `<DeviceBreakdown data={deviceData} />` を配置

---

## 3. キャンペーン別サマリー（CampaignSummaryTable）

### 3-1. 新規コンポーネント: CampaignSummaryTable.tsx
- ファイル: `components/dashboard/CampaignSummaryTable.tsx`（新規作成）
- props:
```typescript
interface CampaignSummaryData {
  campaign_id: string;
  campaign_name: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cv: number;
  cpa: number;
  spendShare: number;
}

interface CampaignSummaryTableProps {
  campaigns: CampaignSummaryData[];
  targetCpa?: number;
}
```
- UI:
  - タイトル: `キャンペーン別実績（TOP10）`
  - ソートボタン: 費用順 / CV順
  - テーブル列: キャンペーン名 | 消化額 | 費用シェア（横棒バー+%） | IMP | クリック | CTR | CV | CPA | CVR
  - CPA色分け: targetCpaあり → CPA ≤ targetCpa は `text-[#2C5282]`、超過は `text-red-600`
  - 費用シェアバー: `<div className="h-2 rounded-full bg-gray-100"><div className="h-full bg-[#2C5282] rounded-full" style={{width: `${share}%`}} /></div>`
  - レスポンシブ: overflow-x-auto

### 3-2. dashboard/page.tsxにキャンペーンデータ取得・表示追加
- campaignsData state追加
- useEffect内で `/api/meta/campaigns?date_preset=${datePreset}` をfetch
- spendShareを計算し、TOP10にslice
- ClientTableの下に配置

---

## 4. 詳細ドリルダウン: 属性別 + 時間帯ヒートマップ

### 4-1. breakdowns APIの拡張
- ファイル: `app/api/meta/breakdowns/route.ts`
- ALLOWED_BREAKDOWNSに追加:
```typescript
const ALLOWED_BREAKDOWNS = new Set([
  "age",
  "gender",
  "country",
  "publisher_platform",
  "platform_position",
  "impression_device",
  "age,gender",
  "region",
  "hourly_stats_aggregated_by_advertiser_time_zone",
]);
```
- MetaBreakdownInsightsに追加（types/meta.ts）:
```typescript
export interface MetaBreakdownInsights extends MetaInsights {
  // 既存fields...
  region?: string;
  hourly_stats_aggregated_by_advertiser_time_zone?: string;
}
```

### 4-2. 新規コンポーネント: DemographicBreakdown.tsx
- ファイル: `components/dashboard/DemographicBreakdown.tsx`（新規作成）
- props:
```typescript
interface DemoCell {
  age: string;
  gender: string;
  spend: number;
  impressions: number;
  clicks: number;
  cv: number;
  cpa: number;
}
export default function DemographicBreakdown({ data }: { data: DemoCell[] })
```
- レイアウト:
  - タイトル: `年齢×性別分析`
  - タブ: 「CV数」「CPA」「費用」切替
  - テーブル: 行=年齢帯（18-24, 25-34, 35-44, 45-54, 55-64, 65+）、列=性別（male, female, unknown）
  - ヒートマップ色:
    - CV/費用: min-max正規化 → `rgba(44, 82, 130, ${0.1 + 0.8 * normalized})`
    - CPA: 低い=緑系 `rgba(56, 161, 105, ...)` 高い=赤系 `rgba(229, 62, 62, ...)`
  - セルにホバーでツールチップ（title属性でOK: `CV: X, CPA: ¥Y, 費用: ¥Z`）
  - データが空の場合: メッセージ表示

### 4-3. 新規コンポーネント: TimeHeatmap.tsx
- ファイル: `components/dashboard/TimeHeatmap.tsx`（新規作成）
- props:
```typescript
interface HeatmapCell {
  day: number;  // 0=月, 1=火, ..., 6=日
  hour: number; // 0-23
  spend: number;
  cv: number;
  cpa: number;
}
export default function TimeHeatmap({ data }: { data: HeatmapCell[] })
```
- レイアウト:
  - タイトル: `曜日×時間帯分析`
  - タブ: 「CV数」「CPA」「消化額」
  - 7行×24列のグリッド
  - 曜日ラベル（縦）: `["月", "火", "水", "木", "金", "土", "日"]`
  - 時間ラベル（横）: `0, 1, 2, ... 23`（3時間おきに表示: 0, 3, 6, 9, 12, 15, 18, 21）
  - セル: `w-5 h-5 sm:w-6 sm:h-6` の正方形、rounded-sm
  - 色: DemographicBreakdownと同じヒートマップロジック
  - ホバー: title属性 `{曜日} {hour}時 | CV: {cv}, CPA: ¥{cpa}, 費用: ¥{spend}`
  - overflow-x-auto でスマホ対応

### 4-4. dashboard/page.tsxにドリルダウンセクション追加
- demographicData, heatmapData のstate追加
- useEffect内で並行fetch:
  - `/api/meta/breakdowns?dimension=age,gender&date_preset=${datePreset}` → DemoCell[]に変換
  - `/api/meta/breakdowns?dimension=hourly_stats_aggregated_by_advertiser_time_zone&date_preset=${datePreset}` → HeatmapCell[]に変換
    - hourly breakdownのレスポンスから時間帯を抽出（`"00:00:00 - 00:59:59"` → hour: 0）
    - date_startから曜日を算出（`new Date(date_start).getDay()`、0=日→6に変換して月=0始まりにする）
    - 同じ(day, hour)の行をreduce（spend/cv/cpa合計）
- DeviceBreakdownの下にセクション追加:
```tsx
<section className="space-y-6">
  <h3 className="text-lg font-semibold text-[#1a365d]">詳細分析</h3>
  <DemographicBreakdown data={demographicData} />
  <TimeHeatmap data={heatmapData} />
</section>
```

---

## 実装上の注意

1. **既存コンポーネントの破壊的変更禁止**: BigKpiCards, DailyTrendChart, ClientTableは拡張する形で
2. **型安全**: `any` は使わない。全ての新規コードにTypeScript型を付ける。ただしAPI responseの変換時のみ `as` キャスト許可
3. **レスポンシブ**: 全コンポーネントがモバイル（375px幅）で崩れないこと
4. **"use client"**: 新規コンポーネントの先頭に必ず記載
5. **Recharts 3**: v3のAPIを使う。`ResponsiveContainer`, `PieChart`, `Pie`, `Cell`, `BarChart`, `Bar` 等
6. **エラーハンドリング**: API fetchが失敗した場合は空配列をセットし、UIにはデータなしメッセージを表示。console.errorでログは出す
7. **TrendRow型変更の影響**: DailyTrendChartのprops型が変わるので、page.tsxのtrendRowsマッピングも必ず更新すること
8. **breakdowns APIのレスポンス**: normalizedオブジェクトに `cv` と `cpa` が含まれる（route.ts内で計算済み）
