const API_KEYS_KEY = "ad-dashboard-api-keys-data";
const CLIENTS_KEY = "ad-dashboard-clients-data";

export interface StoredApiKey {
  id: string;
  platform: "google" | "meta";
  keyName: string;
  credentials: Record<string, string>;
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
  googleApiKeyId?: string;
  metaApiKeyId?: string;
  createdAt: string;
}

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function obfuscateCredentials(creds: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(creds)) {
    result[k] = btoa(unescape(encodeURIComponent(v)));
  }
  return result;
}

function deobfuscateCredentials(creds: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(creds)) {
    try {
      result[k] = decodeURIComponent(escape(atob(v)));
    } catch {
      try {
        // 旧形式: btoa(encodeURIComponent(value))
        result[k] = decodeURIComponent(atob(v));
      } catch {
        // フォールバック: 平文のデータもそのまま読める
        result[k] = v;
      }
    }
  }
  return result;
}

// --- Public API ---

export function loadApiKeys(): StoredApiKey[] {
  if (!canUseStorage()) return [];
  try {
    const raw = localStorage.getItem(API_KEYS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredApiKey[];
    if (!Array.isArray(parsed)) return [];
    // credentials を復号して返す
    return parsed.map((key) => ({
      ...key,
      credentials: deobfuscateCredentials(key.credentials),
    }));
  } catch {
    return [];
  }
}

export function saveApiKeys(keys: StoredApiKey[]): void {
  if (!canUseStorage()) return;
  // credentials を難読化して保存
  const obfuscated = keys.map((key) => ({
    ...key,
    credentials: obfuscateCredentials(key.credentials),
  }));
  localStorage.setItem(API_KEYS_KEY, JSON.stringify(obfuscated));
}

export function loadClients(): StoredClient[] {
  if (!canUseStorage()) return [];
  try {
    const raw = localStorage.getItem(CLIENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredClient[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveClients(clients: StoredClient[]): void {
  if (!canUseStorage()) return;
  localStorage.setItem(CLIENTS_KEY, JSON.stringify(clients));
}

export function getMetaToken(clientId: string): string | null {
  const clients = loadClients();
  const client = clients.find((c) => c.id === clientId);
  if (!client?.metaApiKeyId) return null;
  const keys = loadApiKeys();
  const key = keys.find((k) => k.id === client.metaApiKeyId);
  return key?.credentials.access_token || null;
}

export function getMetaAccountId(clientId: string): string | null {
  const clients = loadClients();
  const client = clients.find((c) => c.id === clientId);
  return client?.metaAdsAccountId || null;
}

export function getGoogleAdsCredentials(clientId: string): Record<string, string> | null {
  const clients = loadClients();
  const client = clients.find((c) => c.id === clientId);
  if (!client?.googleApiKeyId) return null;
  const keys = loadApiKeys();
  const key = keys.find((k) => k.id === client.googleApiKeyId);
  return key?.credentials || null;
}
