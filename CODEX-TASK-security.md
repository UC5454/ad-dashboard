# セキュリティ強化タスク

全て実装してください。確認や質問は不要です。
完了後 npm run build で成功することを確認してください。

## 絶対に変更しないファイル
- app/api/auth/[...nextauth]/route.ts
- lib/auth.ts
- components/settings/SettingsPageContent.tsx

## 技術スタック
- Next.js 16.1.6, React 19, TypeScript strict
- Tailwind CSS 4
- 日本語UI統一

---

## 1. middleware.ts の新規作成（認証ゲートウェイ）

プロジェクトルートに `middleware.ts` を作成。全APIルート・ダッシュボードページへの未認証アクセスをブロック:

```typescript
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // 認証不要パス
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  // 未認証 → ログインへリダイレクト
  if (!req.auth) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

## 2. APIレート制限（簡易インメモリ）

`lib/rate-limit.ts` を新規作成:

```typescript
const rateMap = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(
  key: string,
  limit: number = 10,
  windowMs: number = 60_000,
): { ok: boolean; remaining: number } {
  const now = Date.now();
  const entry = rateMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateMap.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1 };
  }

  entry.count += 1;
  if (entry.count > limit) {
    return { ok: false, remaining: 0 };
  }
  return { ok: true, remaining: limit - entry.count };
}
```

以下のAPIルートに適用（POST系のみ）:
- `app/api/meta-test/route.ts` → limit: 5, window: 60秒
- `app/api/google-test/route.ts` → limit: 5, window: 60秒
- `app/api/slack-test/route.ts` → limit: 5, window: 60秒

各ルートの先頭（auth()チェックの後）に以下を追加:
```typescript
import { rateLimit } from "@/lib/rate-limit";

// セッションユーザーのIDをキーにする
const rl = rateLimit(`${routeName}:${session.user?.id || "anon"}`, 5, 60_000);
if (!rl.ok) {
  return NextResponse.json(
    { error: "リクエスト回数の上限に達しました。1分後に再試行してください。" },
    { status: 429 },
  );
}
```

## 3. next.config.ts セキュリティヘッダー強化

既存の `next.config.ts` の headers() に以下を**追加**する（既存ヘッダーは維持）:

`source: '/(.*)'` のheaders配列に以下を追加:
```typescript
{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
{ key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://graph.facebook.com https://oauth2.googleapis.com https://hooks.slack.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" },
{ key: 'X-XSS-Protection', value: '1; mode=block' },
```

`source: '/api/:path*'` のheaders配列に以下を追加:
```typescript
{ key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' },
{ key: 'Pragma', value: 'no-cache' },
```

また、CORS の `Access-Control-Allow-Headers` に `x-meta-token, x-meta-account-id` を追加:
```typescript
{ key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization, x-meta-token, x-meta-account-id' },
```

## 4. lib/storage.ts のcredentials暗号化強化

現在のlib/storage.tsに既にBase64難読化がある。これをAES-GCM暗号化に強化する。

`saveApiKeys()` で credentials を保存する前に AES-GCM で暗号化し、`loadApiKeys()` で復号する。

暗号化キーはブラウザの `crypto.subtle` で生成し、`sessionStorage` に保持する（タブを閉じると消える）。

ただし、暗号化は非同期になるため、`loadApiKeys`/`saveApiKeys` を async にすると全体の呼び出し箇所に影響が大きい。

そのため、以下の同期的アプローチを取る:
- credentials の各値を `btoa(unescape(encodeURIComponent(value)))` で保存（UTF-8安全なBase64エンコード）
- 読み出し時に `decodeURIComponent(escape(atob(encoded)))` で復号
- **旧形式（平文）のデータも読めるようフォールバック**を入れる

これは既に実装済みの場合はスキップしてよい。

## 5. 入力バリデーション強化

`lib/validation.ts` を新規作成:

```typescript
// Meta アカウントID検証
export function isValidMetaAccountId(id: string): boolean {
  return /^act_\d{1,20}$/.test(id);
}

// Google Ads アカウントID検証
export function isValidGoogleAdsAccountId(id: string): boolean {
  return /^\d{3}-\d{3}-\d{4}$/.test(id) || /^\d{10}$/.test(id);
}

// Slack Webhook URL検証
export function isValidSlackWebhookUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname === "hooks.slack.com" && parsed.protocol === "https:";
  } catch {
    return false;
  }
}

// アクセストークン形式チェック（空白・改行を含まない）
export function isValidToken(token: string): boolean {
  return token.length > 0 && token.length < 1000 && !/[\s\n\r]/.test(token);
}
```

以下のファイルでバリデーションを適用:
- `app/api/meta-test/route.ts`: accessToken に `isValidToken()` 適用
- `app/api/slack-test/route.ts`: webhookUrl に `isValidSlackWebhookUrl()` 適用
- `app/settings/clients/page.tsx`: metaAdsAccountId に `isValidMetaAccountId()` で入力チェック（保存時に警告表示）

## 6. エラーレスポンスの情報漏洩防止

全APIルートで、catchブロックのエラーメッセージをそのままクライアントに返さない:

現在のパターン:
```typescript
catch (e) {
  return NextResponse.json({ ok: false, error: String(e) });
}
```

修正後:
```typescript
catch (e) {
  console.error("API error:", e);
  return NextResponse.json({ ok: false, error: "サーバーエラーが発生しました" });
}
```

対象ファイル:
- `app/api/meta-test/route.ts`
- `app/api/google-test/route.ts`
- `app/api/slack-test/route.ts`

## 7. セキュリティ情報ページ（設定画面内）

`app/settings/security/page.tsx` を新規作成。設定画面のナビゲーションに「セキュリティ」タブを追加:

内容:
- 現在のセッション情報表示（ログインユーザー名、メールアドレス）
- APIキーの登録数表示
- 最終ログイン情報
- 「全APIキーを削除」ボタン（localStorageのAPIキーデータを全削除）
- セキュリティチェックリスト表示:
  - ✅ Google OAuth認証: 有効
  - ✅ ドメイン制限: digital-gorilla.co.jp のみ
  - ✅ HTTPS強制: 有効
  - ✅ CSRF保護: 有効
  - APIキー登録数: N件
  - クライアント登録数: N件

UIスタイル: 他の設定ページと同じ（rounded-xl bg-white shadow-sm, text-navy）

---

## 実装上の注意

- `npm run build` が成功すること
- 既存の認証フロー（NextAuth + Google OAuth）を壊さないこと
- 全て日本語UI
- middleware.ts は Next.js 16 の `auth()` ラッパー形式で実装
