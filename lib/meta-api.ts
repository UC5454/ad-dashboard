const META_API_BASE = "https://graph.facebook.com/v21.0";

export async function metaGet(endpoint: string, params?: Record<string, string>) {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) {
    throw new Error("META_ACCESS_TOKEN not configured");
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
    try {
      const error = await res.json();
      message = error?.error?.message || message;
    } catch {
      // keep fallback error message
    }
    throw new Error(message);
  }

  return res.json();
}
