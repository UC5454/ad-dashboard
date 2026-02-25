# ミーティングフィードバック反映: CPC指標・異常検知・手数料管理

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

## 1. CPC指標の追加（全画面に追加）

菊池さんのフィードバック: 「cpcとか入ってなかったな」

### 1-1. ダッシュボード KPIカードにCPC追加
- ファイル: `app/dashboard/page.tsx`
- 現在6枚（総消化額、総CV、平均CPA、CTR、総クリック数、総IMP）
- **7枚目として「平均CPC」を追加**: summary.clicks > 0 ? summary.spend / summary.clicks : 0
- グリッドを `grid-cols-2 md:grid-cols-4 xl:grid-cols-7` に変更

### 1-2. ダッシュボード案件一覧テーブルにCPC列追加
- ファイル: `app/dashboard/page.tsx`
- テーブルヘッダに「CPC」列を追加（CTRとCVの間に配置）
- 値: `project.clicks > 0 ? formatCurrency(project.spend / project.clicks) : "-"`

### 1-3. ダッシュボード日次データテーブルにCPC列追加
- ファイル: `app/dashboard/page.tsx`
- 日次テーブルに「CPC」列を追加（CTRとCVの間に配置）
- dailyRowsのmapに `cpc: clicks > 0 ? spend / clicks : 0` を追加

### 1-4. 案件詳細 KPIカードにCPC追加
- ファイル: `app/dashboard/projects/[projectId]/page.tsx`
- 現在6枚 → **7枚構成**に
- `grid-cols-2 md:grid-cols-4 lg:grid-cols-7`
- CPC = `detail.project.clicks > 0 ? detail.project.spend / detail.project.clicks : 0`

### 1-5. 案件詳細のキャンペーン比較テーブルにCPC列追加
- ファイル: `app/dashboard/projects/[projectId]/page.tsx`
- ヘッダに「CPC」列追加（CTRとCVの間）
- 値: `row.clicks > 0 ? formatCurrency(row.spend / row.clicks) : "-"`

### 1-6. 案件詳細の広告セット比較テーブルにCPC列追加
- 同上の形式でCPC列追加

### 1-7. 案件詳細のクリエイティブ比較テーブルにCPC列追加
- テーブルビューにCPC列追加

### 1-8. レポートページにもCPC追加
- ファイル: `app/dashboard/reports/page.tsx`
- 日次配信テーブルにCPC列追加
- KPIサマリにもCPC表示

---

## 2. パフォーマンス急変検知アラート（ATOMにもない独自機能）

菊池さんのフィードバック: 「CPCが200円で推移してたのに急に500円になったらアラート欲しい」「配信ストップしたら通知欲しい」

### 2-1. lib/alerts.ts にアラートルール追加

既存の `generateAlerts` 関数に以下のルールを追加する。
**既存のインターフェースは変更しない**。DailyInputに既にある `impressions` フィールドを活用する。

追加するアラートルール:

```typescript
// ルール8: CPC急騰（warning）
// 直近3日間の平均CPCと比較して、最新日のCPCが2倍以上
// daily配列の各行の clicks と spend からCPCを算出
// 条件: latest.clicks > 0 && avgCpc > 0 && latestCpc >= avgCpc * 2
// メッセージ: "直近日のCPCが¥{latestCpc}で、3日平均¥{avgCpc}の2倍以上です。入札・ターゲティングを確認してください。"

// ルール9: CPC急落（info）
// 直近3日間の平均CPCと比較して、最新日のCPCが50%以下
// 条件: latest.clicks > 0 && avgCpc > 0 && latestCpc <= avgCpc * 0.5
// メッセージ: "直近日のCPCが¥{latestCpc}で、3日平均¥{avgCpc}の50%以下です。品質向上の可能性があります。"

// ルール10: 配信停止検知（critical）
// 直近日のimpressions === 0 かつ 前日のimpressions > 0
// メッセージ: "直近日のインプレッションが0です。審査落ち・配信停止の可能性があります。管理画面を確認してください。"

// ルール11: CPM急騰（warning）
// CPM = spend / impressions * 1000
// 直近3日平均CPMと比較して最新日CPMが2倍以上
// 条件: latest.impressions > 0 && avgCpm > 0 && latestCpm >= avgCpm * 2
// メッセージ: "直近日のCPMが¥{latestCpm}で、3日平均の2倍以上です。競合状況やオーディエンス設定を確認してください。"
```

### 2-2. DailyInputインターフェースの確認

現在の `DailyInput` は以下の通り（変更不要、既に `impressions` がある）:
```typescript
interface DailyInput {
  date_start: string;
  spend: number;
  cv: number;
  impressions?: number;
}
```

このimpressionを使ってCPC/CPM計算用に `clicks` も渡す必要がある。
DailyInputに `clicks?: number` を追加する。

### 2-3. ダッシュボードのalertRows計算を更新
- ファイル: `app/dashboard/page.tsx`
- normalizedDailyに `clicks` を追加:
```typescript
const normalizedDaily = daily.map((row) => ({
  date_start: row.date_start,
  spend: toNumber(row.spend),
  cv: row.cv ?? 0,
  impressions: toNumber(row.impressions),
  clicks: toNumber(row.clicks),
}));
```

---

## 3. 手数料（Fee）管理機能

レポートサンプルExcelでは「利用額(Fee抜き)」と「利用額(Fee込み)」が並記されている（Fee込み = Fee抜き × 1.2 = 20%手数料）。

### 3-1. lib/budget.ts に手数料率を追加

```typescript
export interface BudgetConfig {
  projectName: string;
  monthlyBudget: number;
  feeRate: number; // 手数料率（例: 0.2 = 20%）
}

export const DEFAULT_BUDGETS: BudgetConfig[] = [
  { projectName: "CREETstage ライバー募集", monthlyBudget: 300000, feeRate: 0.2 },
  { projectName: "フェイス美容外科 来院者増加", monthlyBudget: 500000, feeRate: 0.2 },
  { projectName: "Trust株式会社 採用施策", monthlyBudget: 200000, feeRate: 0.2 },
];
```

### 3-2. BudgetProgressに手数料関連フィールド追加

```typescript
export interface BudgetProgress {
  // ...既存フィールドはそのまま...
  feeRate: number;              // 手数料率
  spendWithFee: number;         // 手数料込み消化額 = currentSpend * (1 + feeRate)
  projectedSpendWithFee: number | null; // 手数料込み着地予想
}
```

`calculateBudgetProgress` の戻り値に `feeRate`, `spendWithFee`, `projectedSpendWithFee` を追加。
予算未設定の案件は `feeRate: 0`, `spendWithFee: currentSpend`, `projectedSpendWithFee: null` とする。

### 3-3. ダッシュボードの予算進捗セクションに手数料込み金額を表示
- ファイル: `app/dashboard/page.tsx`
- 予算進捗の各案件行に「Fee込み: ¥xxx」を追加表示
- フォーマット: `Fee込み: {formatCurrency(progress.spendWithFee)}`
- 案件一覧テーブルにも「消化額(税別)」の横に小さく「Fee込: ¥xxx」を表示

### 3-4. 案件詳細にも手数料込み表示
- ファイル: `app/dashboard/projects/[projectId]/page.tsx`
- KPIカード「消化額」の下に小さく「Fee込: ¥xxx」を表示
- 予算進捗セクションにも手数料込み金額を表示

### 3-5. レポートページにFee込み金額を追加
- ファイル: `app/dashboard/reports/page.tsx`
- レポートプレビューの予算進捗セクションに「Fee込み金額」を追加

---

## 4. 日次チャートの改善

### 4-1. ダッシュボードの日次チャートにCPC推移を追加
- ファイル: `app/dashboard/page.tsx`
- 現在: 消化額のAreaChartのみ
- 追加: 右Y軸にCPC推移（LineChart）を重ねる
- dailyデータに `cpc: clicks > 0 ? spend / clicks : 0` を計算して追加
- CPC線の色: `#F59E0B`（amber/オレンジ）、strokeDasharray="5 5" で点線
- Tooltipに「CPC: ¥xxx」を追加

### 4-2. 案件詳細の日次チャートにもCPC追加
- ファイル: `app/dashboard/projects/[projectId]/page.tsx`
- 既存: spend + cv の2軸AreaChart
- 追加: CPC推移を第3のデータとして右Y軸に追加（点線、amber色）

---

## 5. AI分析にCPC関連の分析を追加

### 5-1. lib/ai-analysis.ts の分析ロジック更新

各分析関数にCPC関連の分析を追加:

- **generateOverallAnalysis**:
  - 案件ごとのCPC比較を追加（CPC = spend / clicks）
  - CPCが他案件の2倍以上の場合、recommendationsに「CPCが高い案件の入札調整を検討」を追加

- **generateDailyAnalysis**:
  - CPC推移の分析を追加
  - CPCが急騰/急落した日があればinsightsに追記

- **generateCreativeAnalysis**:
  - クリエイティブごとのCPC比較を追加
  - CPCが最も低いクリエイティブを「クリック効率が最も高い」としてinsightsに追加

---

## 実装上の注意

1. **既存の型・インターフェースとの整合性**: types/meta.tsは変更禁止。cpcフィールドは既に `MetaInsights` に `cpc: string` として定義済み。API Routeでは既に `cpc` をfieldsに含めて取得している
2. **CPC計算方法**: APIから取得したcpcを使うか、spend/clicksで計算するかはcontextによる。
   - APIレスポンス（route.ts）: `cpc` フィールドが使える場合はそれを使用。undefinedの場合はspend/clicksで計算
   - クライアントサイド（page.tsx）: spend/clicksで計算
3. **手数料率のデフォルト**: 予算未設定の案件でも、全体のデフォルト手数料率として0.2（20%）を使う。`DEFAULT_FEE_RATE = 0.2` として定数化
4. **日本語表示**: 「CPC」はそのまま英語表記。「手数料込み」は「Fee込」と略記
5. **colSpan更新を忘れないこと**: テーブルに列を追加したら、空データ時のcolSpanも更新する
