-- Ad Dashboard SQLite Schema
-- Version: 1.0.0

-- ユーザー管理
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  name TEXT,
  role TEXT DEFAULT 'viewer' CHECK(role IN ('admin', 'editor', 'viewer')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- APIキー管理
CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL CHECK(platform IN ('google_ads', 'meta_ads')),
  key_name TEXT NOT NULL,
  encrypted_data TEXT NOT NULL,
  created_by TEXT REFERENCES users(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- クライアント管理
CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  google_ads_account_id TEXT,
  meta_ads_account_id TEXT,
  monthly_budget_google INTEGER DEFAULT 0,
  monthly_budget_meta INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'paused', 'archived')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 広告データ（日次）
CREATE TABLE IF NOT EXISTS ad_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  client_id TEXT REFERENCES clients(id),
  platform TEXT NOT NULL CHECK(platform IN ('google', 'meta')),
  level TEXT NOT NULL CHECK(level IN ('account', 'campaign', 'adset', 'ad')),
  campaign_id TEXT,
  campaign_name TEXT,
  adset_id TEXT,
  adset_name TEXT,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  cost INTEGER DEFAULT 0,
  conversions REAL DEFAULT 0,
  conversion_value INTEGER DEFAULT 0,
  ctr REAL DEFAULT 0,
  cpc REAL DEFAULT 0,
  cpa REAL DEFAULT 0,
  roas REAL DEFAULT 0,
  cvr REAL DEFAULT 0,
  reach INTEGER DEFAULT 0,
  frequency REAL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(date, client_id, platform, level, campaign_id, adset_id)
);

-- アラート履歴
CREATE TABLE IF NOT EXISTS alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id TEXT REFERENCES clients(id),
  platform TEXT,
  metric TEXT NOT NULL,
  severity TEXT NOT NULL CHECK(severity IN ('warning', 'critical')),
  current_value REAL,
  moving_avg REAL,
  deviation_pct REAL,
  message TEXT,
  notified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  resolved_at DATETIME
);

-- レポート生成履歴
CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id TEXT REFERENCES clients(id),
  period TEXT NOT NULL,
  file_path TEXT,
  generated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_ad_metrics_date ON ad_metrics(date);
CREATE INDEX IF NOT EXISTS idx_ad_metrics_client ON ad_metrics(client_id);
CREATE INDEX IF NOT EXISTS idx_ad_metrics_platform ON ad_metrics(platform);
CREATE INDEX IF NOT EXISTS idx_ad_metrics_date_client ON ad_metrics(date, client_id);
CREATE INDEX IF NOT EXISTS idx_alerts_client ON alerts(client_id);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);

-- 初期管理者ユーザー（パスワードは起動時にbcryptで生成）
-- INSERT INTO users (id, email, name, role) VALUES ('admin-001', 'y.chiba@digital-gorilla.co.jp', '千葉勇志', 'admin');
