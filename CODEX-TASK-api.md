# Meta広告・Google広告 API直接接続化

全て実装してください。確認や質問は不要です。
具体的な提案・修正案・コード例まで自主的に出力してください。
完了後 npm run build で成功することを確認してください。

## 背景

現状、広告データの取得は以下の問題がある:
1. Meta APIのアクセストークンが `.env.local` の `META_ACCESS_TOKEN` にハードコード
2. アカウントIDが `lib/constants.ts` に `act_204493864908978` とハードコード
3. Google Ads APIの接続コードが存在しない
4. 設定画面のAPIキー管理・クライアント管理は登録UIはあるが、`/api/api-keys` や `/api/clients` のAPIルートが存在せず、localStorageフォールバックになっている
5. 保存したAPIキーを使って広告データを取得する仕組みがない

**目標**: ユーザーが設定画面でAPIキーとクライアント情報を登録 → そのキーを使ってMeta/Google広告データを取得する設計にする。

## 技術スタック
- Next.js 16.1.6, React 19, TypeScript strict
- Tailwind CSS 4（navy=#1B2A4A, blue=#2C5282）
- Vercel Serverless（better-sqlite3不可。KVストアまたはVercel Postgres等は使えない前提）
- 日本語UI統一
- `npm run build` が成功すること

## 絶対に変更しないファイル
- app/api/auth/[...nextauth]/route.ts
- lib/auth.ts
- components/settings/SettingsPageContent.tsx
- components/ui/Sidebar.tsx

---

## 1. APIキー・クライアント情報の永続化（localStorage + Encrypted Storage）

Vercel Serverlessでは SQLite が使えない（read-only filesystem）ので、以下の方式で実装する:

### 1-1. `lib/storage.ts` 新規作成

APIキーとクライアント情報を localStorage に保存する統一的なストレージモジュール:

```typescript
const API_KEYS_KEY = "ad-dashboard-api-keys-data";
const CLIENTS_KEY = "ad-dashboard-clients-data";

export interface StoredApiKey {
  id: string;
  platform: "google" | "meta";
  keyName: string;
  credentials: Record<string, string>; // 各プラットフォーム固有のキー情報
  createdAt: string;
}

export interface StoredClient {
  id: string;
  name: string;
  googleAdsAccountId: string;
  metaAdsAccountId: string;
  monthlyBudgetGoogle: number;
  monthlyBudgetMeta: number;
  status: "active" | "paused" | "archived";
  // どのAPIキーを使うか
  googleApiKeyId?: string;
  metaApiKeyId?: string;
  createdAt: string;
}

export function loadApiKeys(): StoredApiKey[] { ... }
export function saveApiKeys(keys: StoredApiKey[]): void { ... }
export function loadClients(): StoredClient[] { ... }
export function saveClients(clients: StoredClient[]): void { ... }

// 特定クライアントのMeta APIトークンを取得
export function getMetaToken(clientId: string): string | null {
  const clients = loadClients();
  const client = clients.find(c => c.id === clientId);
  if (!client?.metaApiKeyId) return null;
  const keys = loadApiKeys();
  const key = keys.find(k => k.id === client.metaApiKeyId);
  return key?.credentials.access_token || null;
}

// 特定クライアントのMeta アカウントIDを取得
export function getMetaAccountId(clientId: string): string | null {
  const clients = loadClients();
  const client = clients.find(c => c.id === clientId);
  return client?.metaAdsAccountId || null;
}

// 特定クライアントのGoogle Ads認証情報を取得
export function getGoogleAdsCredentials(clientId: string): Record<string, string> | null {
  const clients = loadClients();
  const client = clients.find(c => c.id === clientId);
  if (!client?.googleApiKeyId) return null;
  const keys = loadApiKeys();
  const key = keys.find(k => k.id === client.googleApiKeyId);
  return key?.credentials || null;
}
```

### 1-2. APIキー管理画面の改修（`app/settings/api-keys/page.tsx`）

現状の `/api/api-keys` への依存をやめ、`lib/storage.ts` を直接使う:
- **新規登録**: `saveApiKeys()` で localStorage に保存
- **一覧表示**: `loadApiKeys()` で取得
- **削除**: フィルタして `saveApiKeys()` で上書き
- **テスト接続ボタン追加**: 登録時にAPIキーが有効か検証
  - Meta: `/api/meta-test` に `access_token` を送って `/me` エンドポイントで確認
  - Google: `/api/google-test` に認証情報を送ってアカウント一覧取得で確認
- `/api/api-keys` への fetch を全て削除する

### 1-3. クライアント管理画面の改修（`app/settings/clients/page.tsx`）

`lib/storage.ts` を直接使い、さらに以下を追加:
- **APIキー紐付け**: 各クライアントにどのAPIキーを使うか選択するドロップダウン
  - 「Meta APIキー」セレクト: `loadApiKeys()` でplatform=metaのキー一覧を表示
  - 「Google APIキー」セレクト: `loadApiKeys()` でplatform=googleのキー一覧を表示
- `/api/clients` への fetch を全て削除する

---

## 2. Meta Ads API の動的トークン化

### 2-1. `lib/meta-api.ts` の改修

`process.env.META_ACCESS_TOKEN` への依存を削除し、引数でトークンを受け取る:

```typescript
const META_API_BASE = "https://graph.facebook.com/v21.0";

export async function metaGet(
  endpoint: string,
  params?: Record<string, string>,
  accessToken?: string,
) {
  const token = accessToken || process.env.META_ACCESS_TOKEN;
  if (!token) {
    throw new Error("Meta APIトークンが設定されていません。設定画面でAPIキーを登録してください。");
  }
  // ... 以降は既存ロジックと同じ
}
```

### 2-2. `lib/constants.ts` の改修

ハードコードの `DG_ACCOUNT_ID` を削除し、動的に取得する:

```typescript
// デフォルトのアカウントID（フォールバック用）
export const DEFAULT_META_ACCOUNT_ID = "act_204493864908978";
```

### 2-3. 全 `app/api/meta/*/route.ts` の改修

各APIルートで、リクエストパラメータからクライアントIDを受け取り、そのクライアントに紐づくアクセストークンとアカウントIDを使う:

**重要**: サーバーサイドではlocalStorageが使えないので、クライアントから**トークンとアカウントIDをリクエストヘッダーで渡す**方式にする。

```typescript
// 各 route.ts で共通パターン
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // クライアントから渡されるトークンとアカウントID
  const accessToken = request.headers.get("x-meta-token") || process.env.META_ACCESS_TOKEN;
  const accountId = request.headers.get("x-meta-account-id") || DEFAULT_META_ACCOUNT_ID;

  if (!accessToken) {
    return NextResponse.json(
      { error: "Meta APIトークンが未設定です。設定画面でAPIキーを登録してください。" },
      { status: 400 },
    );
  }

  // metaGet に accessToken を渡す
  const res = await metaGet(`${accountId}/insights`, { ... }, accessToken);
  // ...
}
```

### 2-4. フロントエンド側の fetch をラップ

`lib/api-client.ts` を新規作成し、全APIコールで自動的にトークンをヘッダに付与:

```typescript
import { loadApiKeys, loadClients, type StoredClient } from "@/lib/storage";

function getActiveClient(): StoredClient | null {
  // 現在選択中のクライアント or 最初のactiveクライアント
  const clients = loadClients();
  return clients.find(c => c.status === "active") || clients[0] || null;
}

function getMetaHeaders(): Record<string, string> {
  const client = getActiveClient();
  if (!client) return {};
  const headers: Record<string, string> = {};

  if (client.metaApiKeyId) {
    const keys = loadApiKeys();
    const key = keys.find(k => k.id === client.metaApiKeyId);
    if (key?.credentials.access_token) {
      headers["x-meta-token"] = key.credentials.access_token;
    }
  }
  if (client.metaAdsAccountId) {
    headers["x-meta-account-id"] = client.metaAdsAccountId.startsWith("act_")
      ? client.metaAdsAccountId
      : `act_${client.metaAdsAccountId}`;
  }
  return headers;
}

export async function apiFetch(url: string, options?: RequestInit): Promise<Response> {
  const metaHeaders = getMetaHeaders();
  return fetch(url, {
    ...options,
    headers: {
      ...options?.headers,
      ...metaHeaders,
    },
  });
}
```

### 2-5. 全フロントエンドページで `fetch` → `apiFetch` に置換

以下のファイルの `fetch("/api/meta/...")` を全て `apiFetch("/api/meta/...")` に変更:
- `app/dashboard/page.tsx`
- `app/dashboard/projects/[projectId]/page.tsx`
- `app/dashboard/clients/[clientId]/page.tsx`
- `app/dashboard/alerts/page.tsx`
- `app/dashboard/reports/page.tsx`
- `app/dashboard/compare/page.tsx`

import文を追加:
```typescript
import { apiFetch } from "@/lib/api-client";
```

---

## 3. テスト接続APIルートの作成

### 3-1. `app/api/meta-test/route.ts` 新規作成

```typescript
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { accessToken } = await req.json();
  if (!accessToken) return NextResponse.json({ ok: false, error: "トークンが未入力です" });

  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/me?access_token=${encodeURIComponent(accessToken)}`,
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return NextResponse.json({ ok: false, error: err?.error?.message || `HTTP ${res.status}` });
    }
    const data = await res.json();
    return NextResponse.json({ ok: true, name: data.name, id: data.id });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) });
  }
}
```

### 3-2. `app/api/google-test/route.ts` 新規作成

```typescript
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { credentials } = await req.json();
  if (!credentials?.refresh_token || !credentials?.client_id || !credentials?.client_secret) {
    return NextResponse.json({ ok: false, error: "認証情報が不足しています" });
  }

  try {
    // まずリフレッシュトークンでアクセストークンを取得
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: credentials.refresh_token,
        client_id: credentials.client_id,
        client_secret: credentials.client_secret,
      }),
    });
    if (!tokenRes.ok) {
      return NextResponse.json({ ok: false, error: "リフレッシュトークンが無効です" });
    }
    const tokenData = await tokenRes.json();
    return NextResponse.json({ ok: true, message: "Google Ads認証成功" });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) });
  }
}
```

---

## 4. APIキー管理UIの改良

### 4-1. `app/settings/api-keys/page.tsx` の改修

- `/api/api-keys` への fetch を全て削除
- `lib/storage.ts` の `loadApiKeys()` / `saveApiKeys()` を直接使用
- 「テスト接続」ボタンを追加:
  - Meta: `POST /api/meta-test` に `{ accessToken }` を送信
  - Google: `POST /api/google-test` に `{ credentials }` を送信
  - 結果を表示: 成功=緑「接続成功」、失敗=赤+エラーメッセージ
- credentials（トークン等）もlocalStorageに保存（`StoredApiKey.credentials`）

### 4-2. `app/settings/clients/page.tsx` の改修

- `/api/clients` への fetch を全て削除
- `lib/storage.ts` の `loadClients()` / `saveClients()` を直接使用
- 新規登録フォームに「APIキー紐付け」のドロップダウン追加:
  - 「Meta APIキー」: `loadApiKeys().filter(k => k.platform === "meta")`
  - 「Google APIキー」: `loadApiKeys().filter(k => k.platform === "google")`
  - 選択値は `StoredClient.metaApiKeyId` / `googleApiKeyId` に保存

---

## 5. 未設定時のエラーハンドリング

### 5-1. ダッシュボードでAPIキー未設定時の表示

APIキーやクライアントが未設定の場合、ダッシュボードに以下を表示:

```tsx
<section className="rounded-xl border-2 border-dashed border-amber-300 bg-amber-50 p-6 text-center">
  <h3 className="text-lg font-semibold text-amber-800">初期設定が必要です</h3>
  <p className="mt-2 text-sm text-amber-700">
    広告データを表示するには、APIキーとクライアントの登録が必要です。
  </p>
  <div className="mt-4 flex justify-center gap-3">
    <Link href="/settings/api-keys" className="rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white hover:bg-blue-light">
      APIキーを登録
    </Link>
    <Link href="/settings/clients" className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-navy hover:bg-gray-50">
      クライアントを登録
    </Link>
  </div>
</section>
```

### 5-2. API呼び出しエラー時のメッセージ改善

Meta APIからエラーが返った場合:
- トークン期限切れ: 「Meta APIトークンの有効期限が切れています。設定画面で更新してください。」
- 権限エラー: 「このアカウントへのアクセス権限がありません。Meta Business Suiteで権限を確認してください。」

---

## 実装上の注意

- `lib/meta-api.ts` は**変更OK**（accessToken引数の追加のみ）
- `lib/constants.ts` は**変更OK**（DEFAULT_META_ACCOUNT_IDへのリネーム）
- サーバーサイド（Route Handler）では localStorage が使えない → トークンはリクエストヘッダ `x-meta-token` / `x-meta-account-id` で受け渡す
- Google Ads APIの実際のレポートデータ取得は今回のスコープ外（テスト接続のみ）。将来 `google-ads-api` パッケージで拡張予定
- 全て日本語UI
- `npm run build` が成功すること
