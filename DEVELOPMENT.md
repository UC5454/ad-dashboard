# 広告ダッシュボード - 開発仕様書

## 技術スタック

| レイヤー | 技術 |
|----------|------|
| Frontend | Next.js 15 (App Router) + React 19 + Tailwind CSS 4 |
| Auth | NextAuth.js v5 (Auth.js) |
| DB | SQLite (better-sqlite3) — ローカルファイルDB |
| API Routes | Next.js Route Handlers |
| Data Pipeline | Python 3.12 (google-ads / facebook-business SDK) |
| Charts | Recharts |
| PDF | jsPDF + html2canvas (フロントエンド生成) |
| Deployment | ローカル開発 → Vercel (将来) |

## ディレクトリ構成

```
ad-dashboard/
├── app/                          # Next.js App Router
│   ├── layout.tsx                # Root layout (auth provider)
│   ├── page.tsx                  # Landing → redirect to dashboard
│   ├── login/
│   │   └── page.tsx              # ログイン画面
│   ├── dashboard/
│   │   ├── layout.tsx            # Dashboard layout (sidebar + header)
│   │   ├── page.tsx              # メインダッシュボード (BIG KPI + クライアント一覧)
│   │   ├── clients/
│   │   │   └── [clientId]/
│   │   │       └── page.tsx      # クライアント別詳細
│   │   ├── compare/
│   │   │   └── page.tsx          # 媒体比較
│   │   ├── alerts/
│   │   │   └── page.tsx          # アラート履歴
│   │   └── reports/
│   │       └── page.tsx          # レポート生成・ダウンロード
│   ├── settings/
│   │   ├── page.tsx              # 設定トップ
│   │   ├── api-keys/
│   │   │   └── page.tsx          # APIキー管理
│   │   ├── clients/
│   │   │   └── page.tsx          # クライアント管理
│   │   └── users/
│   │       └── page.tsx          # ユーザー管理
│   └── api/
│       ├── auth/
│       │   └── [...nextauth]/
│       │       └── route.ts      # NextAuth handler
│       ├── clients/
│       │   └── route.ts          # CRUD
│       ├── api-keys/
│       │   └── route.ts          # APIキー登録・暗号化保存
│       ├── dashboard/
│       │   └── route.ts          # ダッシュボードデータ取得
│       ├── alerts/
│       │   └── route.ts          # アラート履歴
│       └── reports/
│           └── route.ts          # レポート生成
├── components/
│   ├── ui/                       # 汎用UIコンポーネント
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Input.tsx
│   │   ├── Select.tsx
│   │   ├── Table.tsx
│   │   ├── Badge.tsx
│   │   ├── Modal.tsx
│   │   └── Sidebar.tsx
│   ├── dashboard/
│   │   ├── BigKpiCards.tsx        # BIG 4 KPI カード
│   │   ├── ClientTable.tsx       # クライアント一覧テーブル
│   │   ├── PlatformComparison.tsx # Google vs Meta 比較
│   │   ├── DailyTrendChart.tsx   # 日別推移グラフ
│   │   ├── BudgetProgress.tsx    # 予算消化率バー
│   │   └── AlertBanner.tsx       # アラートバナー
│   ├── settings/
│   │   ├── ApiKeyForm.tsx        # APIキー登録フォーム
│   │   ├── ClientForm.tsx        # クライアント登録フォーム
│   │   └── UserForm.tsx          # ユーザー管理フォーム
│   └── auth/
│       └── LoginForm.tsx         # ログインフォーム
├── lib/
│   ├── db.ts                     # SQLite接続・マイグレーション
│   ├── auth.ts                   # NextAuth設定
│   ├── crypto.ts                 # APIキー暗号化/復号化
│   ├── google-ads.ts             # Google Ads API ラッパー
│   ├── meta-ads.ts               # Meta Ads API ラッパー
│   ├── alerts.ts                 # 異常値検知ロジック
│   ├── slack.ts                  # Slack通知
│   └── reports.ts                # レポート生成
├── pipeline/                     # Python データ取得パイプライン
│   ├── config/
│   │   └── clients.yaml
│   ├── fetchers/
│   │   ├── google_ads_fetcher.py
│   │   ├── meta_ads_fetcher.py
│   │   └── unified_formatter.py
│   ├── writers/
│   │   ├── sheets_writer.py
│   │   └── db_writer.py          # SQLiteにも書き込み（ダッシュボード用）
│   ├── alerts/
│   │   └── anomaly_detector.py
│   ├── main.py
│   └── requirements.txt
├── prisma/ or migrations/
│   └── schema.sql                # SQLiteスキーマ
├── public/
│   └── logo.svg
├── .env.example
├── .env.local                    # 環境変数（Git除外）
├── .gitignore
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── DEVELOPMENT.md
```

## DBスキーマ (SQLite)

```sql
-- ユーザー管理
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,           -- ID/パス認証用（bcrypt）
  name TEXT,
  role TEXT DEFAULT 'viewer',   -- admin / editor / viewer
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- APIキー管理
CREATE TABLE api_keys (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL,       -- 'google_ads' / 'meta_ads'
  key_name TEXT NOT NULL,       -- 表示名
  encrypted_data TEXT NOT NULL, -- AES-256暗号化されたキー/トークンJSON
  created_by TEXT REFERENCES users(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- クライアント管理
CREATE TABLE clients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  google_ads_account_id TEXT,
  meta_ads_account_id TEXT,
  monthly_budget_google INTEGER DEFAULT 0,
  monthly_budget_meta INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',  -- active / paused / archived
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 広告データ（日次）
CREATE TABLE ad_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  client_id TEXT REFERENCES clients(id),
  platform TEXT NOT NULL,        -- 'google' / 'meta'
  level TEXT NOT NULL,           -- 'account' / 'campaign' / 'adset' / 'ad'
  campaign_id TEXT,
  campaign_name TEXT,
  adset_id TEXT,
  adset_name TEXT,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  cost INTEGER DEFAULT 0,        -- 円単位
  conversions REAL DEFAULT 0,
  conversion_value INTEGER DEFAULT 0,
  ctr REAL DEFAULT 0,
  cpc REAL DEFAULT 0,
  cpa REAL DEFAULT 0,
  roas REAL DEFAULT 0,
  cvr REAL DEFAULT 0,
  reach INTEGER DEFAULT 0,       -- Meta only
  frequency REAL DEFAULT 0,      -- Meta only
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(date, client_id, platform, level, campaign_id, adset_id)
);

-- アラート履歴
CREATE TABLE alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id TEXT REFERENCES clients(id),
  platform TEXT,
  metric TEXT NOT NULL,
  severity TEXT NOT NULL,        -- 'warning' / 'critical'
  current_value REAL,
  moving_avg REAL,
  deviation_pct REAL,
  message TEXT,
  notified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  resolved_at DATETIME
);

-- レポート生成履歴
CREATE TABLE reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id TEXT REFERENCES clients(id),
  period TEXT NOT NULL,          -- '2026-02'
  file_path TEXT,
  generated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## 認証仕様

### Google OAuth (ドメイン制限)
- プロバイダ: Google
- 許可ドメイン: `@digital-gorilla.co.jp` のみ
- NextAuth.jsのcallbacksでemailドメインをチェック
- 未許可ドメインはサインインを拒否

### ID/パスワード認証
- NextAuth.js Credentials Provider
- bcryptでパスワードハッシュ
- usersテーブルに保存
- 管理者がユーザーを事前登録

### 認証フロー
1. /login にアクセス
2. Google OAuthボタン or メール/パスワード入力
3. 認証成功 → /dashboard にリダイレクト
4. 認証失敗 → エラーメッセージ表示
5. 未認証で/dashboard等にアクセス → /login にリダイレクト

## APIキー管理仕様

### 暗号化
- AES-256-GCM で暗号化
- 暗号化キーは環境変数 `ENCRYPTION_KEY` に保存
- DBには暗号化済みデータのみ保存

### 登録フロー
1. /settings/api-keys にアクセス
2. 「新規登録」ボタン → モーダル表示
3. プラットフォーム選択（Google Ads / Meta Ads）
4. 各プラットフォーム固有のフィールド入力:
   - Google Ads: developer_token, client_id, client_secret, refresh_token, login_customer_id
   - Meta Ads: app_id, app_secret, access_token
5. 「テスト接続」ボタンで接続確認
6. 保存 → 暗号化してDB保存

### テスト接続
- Google Ads: ListAccessibleCustomers API呼び出し
- Meta Ads: /me/adaccounts エンドポイント呼び出し
- 成功: 緑バッジ + アカウント数表示
- 失敗: 赤バッジ + エラーメッセージ

## UI設計方針

### デザインシステム
- カラーパレット: Navy(#1B2A4A) / Blue(#2C5282) / White / Light Gray
- フォント: Inter (見出し) / system-ui (本文)
- カード型レイアウト、影あり、角丸
- レスポンシブ対応（デスクトップ優先）

### ダッシュボード画面
- 上部: BIG 4 KPIカード（総消化額 / 総CV / 平均CPA / 平均ROAS）
  - 前月比の矢印 + パーセンテージ表示
  - 増加=緑、減少=赤
- 中部: クライアント一覧テーブル
  - ソート・フィルタ機能
  - ステータスバッジ（アクティブ=緑、リスクあり=黄、停止=赤）
  - 消化率プログレスバー
- 下部: 日別推移グラフ（Recharts）
  - 消化額、CV、CPA切り替え
  - 全クライアント合算 or 個別フィルタ

### サイドバー
- ロゴ + アプリ名
- ナビゲーション: ダッシュボード / クライアント / 媒体比較 / アラート / レポート
- 設定: APIキー / クライアント管理 / ユーザー管理
- ユーザー情報 + ログアウト
