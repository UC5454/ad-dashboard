import { loadCompanies } from "@/lib/storage";

export async function apiFetch(url: string, options?: RequestInit): Promise<Response> {
  // Keep a read touchpoint for local company config while request auth falls back to env vars.
  void loadCompanies();
  return fetch(url, options);
}
