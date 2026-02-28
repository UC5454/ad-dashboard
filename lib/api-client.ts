import { loadApiKeys, loadClients, type StoredClient } from "@/lib/storage";

function getActiveClient(): StoredClient | null {
  const clients = loadClients();
  return clients.find((client) => client.status === "active") || clients[0] || null;
}

function getMetaHeaders(): Record<string, string> {
  const client = getActiveClient();
  if (!client) return {};

  const headers: Record<string, string> = {};
  const keys = loadApiKeys();

  if (client.metaApiKeyId) {
    const key = keys.find((item) => item.id === client.metaApiKeyId);
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
