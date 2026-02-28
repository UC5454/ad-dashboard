export function isValidMetaAccountId(id: string): boolean {
  return /^act_\d{1,20}$/.test(id);
}

export function isValidGoogleAdsAccountId(id: string): boolean {
  return /^\d{3}-\d{3}-\d{4}$/.test(id) || /^\d{10}$/.test(id);
}

export function isValidSlackWebhookUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname === "hooks.slack.com" && parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function isValidToken(token: string): boolean {
  return token.length > 0 && token.length < 1000 && !/[\s\n\r]/.test(token);
}
