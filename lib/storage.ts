const API_KEYS_KEY = "ad-dashboard-api-keys-data";
const CLIENTS_KEY = "ad-dashboard-clients-data";
const COMPANIES_KEY = "ad-dashboard-companies-data";

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

export interface StoredCompany {
  id: string;
  companyName: string;
  campaignKeywords: string[];
  monthlyBudget: number;
  feeRate: number;
  status: "active" | "paused" | "archived";
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

export function loadCompanies(): StoredCompany[] {
  if (!canUseStorage()) return [];
  try {
    const raw = localStorage.getItem(COMPANIES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StoredCompany[];
      return Array.isArray(parsed) ? parsed : [];
    }

    // Migrate existing client records into company records when no company data exists yet.
    const legacyRaw = localStorage.getItem(CLIENTS_KEY);
    if (!legacyRaw) return [];
    const legacy = JSON.parse(legacyRaw) as Array<Record<string, unknown>>;
    if (!Array.isArray(legacy)) return [];

    const migrated = legacy
      .map((client) => {
        const name = typeof client.name === "string" ? client.name.trim() : "";
        const status = client.status;
        const monthlyBudgetMeta = Number(
          (client.monthlyBudgetMeta as number | string | undefined) ??
            (client.monthly_budget_meta as number | string | undefined) ??
            0,
        );
        return {
          id:
            typeof client.id === "string" && client.id
              ? client.id
              : `company-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          companyName: name || "未設定案件",
          campaignKeywords: name ? [name] : [],
          monthlyBudget: Number.isFinite(monthlyBudgetMeta) ? monthlyBudgetMeta : 0,
          feeRate: 0.2,
          status: status === "paused" || status === "archived" ? status : "active",
          createdAt:
            typeof client.createdAt === "string" && client.createdAt ? client.createdAt : new Date().toISOString(),
        } satisfies StoredCompany;
      })
      .filter((company) => company.companyName.length > 0);

    if (migrated.length > 0) {
      saveCompanies(migrated);
    }
    return migrated;
  } catch {
    return [];
  }
}

export function saveCompanies(companies: StoredCompany[]): void {
  if (!canUseStorage()) return;
  localStorage.setItem(COMPANIES_KEY, JSON.stringify(companies));
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
