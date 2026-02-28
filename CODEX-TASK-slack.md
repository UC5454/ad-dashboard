# Slack通知設定UIの修正

全て実装してください。確認や質問は不要です。
具体的な提案・修正案・コード例まで自主的に出力してください。
完了後 npm run build で成功することを確認してください。

## 絶対に変更しないファイル
- lib/meta-api.ts, lib/auth.ts, lib/constants.ts, lib/meta-utils.ts, types/meta.ts
- app/api/ 配下のAPIルートファイル全て（app/api/slack-test/route.ts は変更OK）
- lib/settings.ts, lib/budget.ts, lib/slack.ts（既に実装済み）
- components/ui/Sidebar.tsx（既に実装済み）

## 技術スタック
- Next.js 16.1.6, React 19, TypeScript strict
- Tailwind CSS 4（カスタムカラー: navy=#1B2A4A, blue=#2C5282）
- 日本語UIで統一
- `npm run build` が成功すること

---

## 問題

`app/dashboard/settings/page.tsx` が以前は設定UI（手数料設定＋Slack通知設定）を持っていたが、リダイレクトだけのページに置き換わった。
ユーザーがダッシュボード内の「設定」にアクセスしてもSlack通知設定UIが表示されない。

## 修正内容

### 1. `app/dashboard/settings/page.tsx` にSlack通知設定UIを復元

現在のファイル:
```tsx
import { redirect } from "next/navigation";
export default function DashboardSettingsRedirectPage() {
  redirect("/settings");
}
```

これを以下のように**フル設定画面**に置き換える。
`app/settings/page.tsx` の内容をベースに、**dashboard配下のレイアウトで動作する "use client" ページ**として実装する。

含めるべきセクション:
1. **手数料設定セクション**
   - 計算方式の選択（外掛け/内掛けラジオボタン）
   - デフォルト手数料率の入力
2. **Slack通知設定セクション**
   - ON/OFFトグルスイッチ（`relative inline-flex h-6 w-11` のカスタムトグル）
   - Webhook URL入力フィールド（placeholder: `https://hooks.slack.com/services/T.../B.../...`）
   - チャンネル名メモ入力フィールド（placeholder: `#ad-alerts`）
   - テスト通知送信ボタン（`POST /api/slack-test` にwebhookUrlを送信）
   - テスト結果の表示（成功: 緑テキスト「送信成功」/ 失敗: 赤テキスト + エラーメッセージ）
3. **保存ボタン**
   - `saveSettings()` で `feeCalcMethod`, `defaultFeeRate`, `slack` を保存
   - 保存成功時に「保存しました」メッセージ表示

### 2. テスト通知はサーバーサイドAPI経由

テスト通知ボタンのクリック時:
```typescript
const res = await fetch("/api/slack-test", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ webhookUrl: slack.webhookUrl }),
});
const result = await res.json();
```
**絶対にクライアントサイドから直接Slack Webhook URLにfetchしない。**（CORSでブロックされる）

### 3. インポート先

```typescript
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type FeeCalcMethod, type SlackConfig } from "@/lib/settings";
```
- `sendSlackNotification` はインポートしない（サーバーサイドAPI経由で使う）

### 4. `app/settings/page.tsx` も同期

`app/settings/page.tsx` も同じ内容であることを確認する。
両方のページが同じSlack通知設定UIを持つこと。

### 5. デザインシステム準拠

- カード: `rounded-xl border border-gray-200 bg-white p-5 shadow-sm`
- ボタン（プライマリ）: `rounded-lg bg-blue px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-light`
- ボタン（セカンダリ）: `rounded-lg border border-blue bg-white px-4 py-2 text-sm font-medium text-blue hover:bg-blue/5`
- 入力フィールド: `w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue focus:ring-1 focus:ring-blue`
- トグル ON: `bg-blue`, OFF: `bg-gray-200`
- セクション見出し: `text-lg font-semibold text-navy`

## 完了条件
- `npm run build` が成功する
- `/dashboard/settings` にアクセスした時にSlack通知設定UIが表示される
- `/settings` にアクセスした時にも同じSlack通知設定UIが表示される
- テスト通知ボタンが `/api/slack-test` 経由で動作する
