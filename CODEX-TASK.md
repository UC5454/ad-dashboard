# Fee込み表示追加 & クロス分析削除

全て実装してください。確認や質問は不要です。
具体的な提案・修正案・コード例まで自主的に出力してください。
完了後 npm run build で成功することを確認してください。

## 絶対に変更しないファイル
- `app/api/**/*` (APIルートは全て変更不可)
- `lib/budget.ts`
- `lib/settings.ts`
- `lib/storage.ts`
- `lib/projects.ts`
- `lib/api-client.ts`
- `auth.ts`
- `middleware.ts`
- `tailwind.config.ts`
- `app/dashboard/page.tsx`
- `app/settings/**/*`

## 技術スタック
- Next.js 16 (App Router) + React 19 + TypeScript strict
- Tailwind CSS 4 (カスタムカラー: navy=#1B2A4A, blue=#2C5282)
- recharts (既にインストール済み)
- `applyFee(amount, feeRate, method)` が `lib/budget.ts` にある。Fee込み金額計算に使う

---

## タスク1: 案件クロス分析ページの削除

### 1-1. ページ削除
- `app/dashboard/compare/page.tsx` を削除する（ディレクトリごと `app/dashboard/compare/` を削除）

### 1-2. サイドバーからリンク削除
- ファイル: `components/ui/Sidebar.tsx`
- `menuItems` 配列から `{ href: "/dashboard/compare", label: "案件クロス分析", ... }` の項目を削除する
- 他のmenuItemsはそのまま残す

---

## タスク2: 広告セットテーブルにFee込み列を追加

- ファイル: `app/dashboard/projects/[projectId]/page.tsx`
- 現状: 広告セット比較テーブル（行481-522付近）に「消化額」列はあるが「Fee込み」列がない
- 既に `applyFee` は import 済み、`budgetProgress`, `settings`, `feeLabelText` も定義済み

### 2-1. テーブルヘッダー
「消化額」ヘッダーの直後に以下を追加:
```tsx
<th className="px-3 py-2 text-left font-medium">{feeLabelText}</th>
```

### 2-2. テーブルボディ
各行の `{formatCurrency(row.spend)}` セルの直後に追加:
```tsx
<td className="px-3 py-2 tabular-nums">
  {formatCurrency(applyFee(row.spend, budgetProgress?.feeRate ?? settings.defaultFeeRate, settings.feeCalcMethod))}
</td>
```

### 2-3. colSpan更新
空データ時の `colSpan={9}` を `colSpan={10}` に更新

---

## タスク3: クリエイティブテーブルビューにFee込み列を追加

- ファイル: `app/dashboard/projects/[projectId]/page.tsx`
- 現状: クリエイティブ比較のテーブル表示（行548-598付近）に「消化額」列はあるが「Fee込み」列がない

### 3-1. テーブルヘッダー
「消化額」ヘッダーの直後に追加:
```tsx
<th className="px-3 py-2 text-left font-medium">{feeLabelText}</th>
```

### 3-2. テーブルボディ
各行の消化額セルの直後に追加:
```tsx
<td className="px-3 py-2 tabular-nums">
  {formatCurrency(applyFee(row.spend, budgetProgress?.feeRate ?? settings.defaultFeeRate, settings.feeCalcMethod))}
</td>
```

### 3-3. テーブル幅更新
`min-w-[1040px]` を `min-w-[1140px]` に変更

---

## タスク4: クリエイティブギャラリービューにFee込み表示を追加

- ファイル: `app/dashboard/projects/[projectId]/page.tsx`
- 現状: ギャラリービュー（行600-660付近）の各カードで「消化額, CV, CPA, CTR, CPC, IMP」を2つのgridで表示
- 期待動作: 消化額の下にFee込み金額を追加表示する

### 4-1. ギャラリーカードの変更
現状の2つのgrid（各3列）を3つのgridに変更:

**行1** (既存のまま): 消化額, CV, CPA
**行2** (変更): Fee込み, CTR, CPC
**行3** (新規): IMP

具体的なコード:
```tsx
{/* 行1: 消化額, CV, CPA（既存のまま） */}
<div className="mt-2 grid grid-cols-3 gap-2 text-xs text-gray-600">
  <div>
    <p className="text-gray-400">消化額</p>
    <p className="tabular-nums font-medium">{formatCurrency(row.spend)}</p>
  </div>
  <div>
    <p className="text-gray-400">CV</p>
    <p className="tabular-nums font-medium">{formatNumber(row.cv)}</p>
  </div>
  <div>
    <p className="text-gray-400">CPA</p>
    <p className="tabular-nums font-medium">{row.cv > 0 ? formatCurrency(row.cpa) : "-"}</p>
  </div>
</div>
{/* 行2: Fee込み, CTR, CPC */}
<div className="mt-2 grid grid-cols-3 gap-2 text-xs text-gray-600">
  <div>
    <p className="text-gray-400">{feeLabelText}</p>
    <p className="tabular-nums font-medium">{formatCurrency(applyFee(row.spend, budgetProgress?.feeRate ?? settings.defaultFeeRate, settings.feeCalcMethod))}</p>
  </div>
  <div>
    <p className="text-gray-400">CTR</p>
    <p className="tabular-nums font-medium">{formatPercent(row.ctr)}</p>
  </div>
  <div>
    <p className="text-gray-400">CPC</p>
    <p className="tabular-nums font-medium">
      {row.clicks > 0 ? formatCurrency(row.spend / row.clicks) : "-"}
    </p>
  </div>
</div>
{/* 行3: IMP */}
<div className="mt-2 grid grid-cols-3 gap-2 text-xs text-gray-600">
  <div>
    <p className="text-gray-400">IMP</p>
    <p className="tabular-nums font-medium">{formatNumber(row.impressions)}</p>
  </div>
</div>
```

---

## 実装上の注意

- `applyFee` は `@/lib/budget` から既にimport済み。追加importは不要
- `budgetProgress`, `settings`, `feeLabelText` は既に定義済みの変数。そのまま使う
- `formatCurrency`, `formatNumber`, `formatPercent` も全て既に定義済み
- Tailwindクラスは既存テーブルスタイルに合わせる（`px-3 py-2 tabular-nums`）
- TypeScript strict modeなのでany禁止
- `app/dashboard/compare/` ディレクトリごと削除する
