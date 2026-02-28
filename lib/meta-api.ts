const META_API_BASE = "https://graph.facebook.com/v21.0";

function mapMetaError(message: string, code?: number): string {
  if (code === 190 || /access token/i.test(message) || /oauth/i.test(message)) {
    return "Meta APIトークンの有効期限が切れています。設定画面で更新してください。";
  }
  if (code === 10 || code === 200 || /permission/i.test(message)) {
    return "このアカウントへのアクセス権限がありません。Meta Business Suiteで権限を確認してください。";
  }
  return message;
}

export async function metaGet(
  endpoint: string,
  params?: Record<string, string>,
  accessToken?: string,
) {
  const token = accessToken || process.env.META_ACCESS_TOKEN;
  if (!token) {
    throw new Error("Meta APIトークンが設定されていません。設定画面でAPIキーを登録してください。");
  }

  const url = new URL(`${META_API_BASE}/${endpoint}`);
  url.searchParams.set("access_token", token);

  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      url.searchParams.set(k, v);
    });
  }

  const res = await fetch(url.toString(), { next: { revalidate: 300 } });
  if (!res.ok) {
    let message = "Meta API error";
    let code: number | undefined;
    try {
      const error = await res.json();
      message = error?.error?.message || message;
      code = error?.error?.code;
    } catch {
      // keep fallback error message
    }
    throw new Error(mapMetaError(message, code));
  }

  return res.json();
}
