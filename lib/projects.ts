import type { MetaCampaignInsights } from "@/types/meta";
import { actionValue, numeric } from "@/lib/meta-utils";
import { loadCompanies, type StoredCompany } from "@/lib/storage";

export interface ProjectSummary {
  id: string;
  name: string;
  campaigns: MetaCampaignInsights[];
  spend: number;
  impressions: number;
  clicks: number;
  cv: number;
  cpa: number;
  ctr: number;
}

export function extractProjectName(campaignName: string): string {
  const trimmed = campaignName.replace(/[（(][^）)]*[）)]$/g, "").trim();
  if (!trimmed) return "";
  const tokens = trimmed.split(/[ 　]+/).filter(Boolean);
  if (tokens.length === 0) return "";
  const maxTokens = Math.min(tokens.length, 3);
  return tokens.slice(0, maxTokens).join(" ");
}

export function groupCampaignsToProjects(campaigns: MetaCampaignInsights[]): ProjectSummary[] {
  const summarize = (id: string, name: string, matched: MetaCampaignInsights[]): ProjectSummary => {
    const spend = matched.reduce((sum, campaign) => sum + numeric(campaign.spend), 0);
    const impressions = matched.reduce((sum, campaign) => sum + numeric(campaign.impressions), 0);
    const clicks = matched.reduce((sum, campaign) => sum + numeric(campaign.clicks), 0);
    const cv = matched.reduce(
      (sum, campaign) => sum + actionValue(campaign.actions, "offsite_conversion.fb_pixel_custom"),
      0,
    );
    return {
      id,
      name,
      campaigns: matched,
      spend,
      impressions,
      clicks,
      cv,
      cpa: cv > 0 ? spend / cv : 0,
      ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    };
  };

  const companies: StoredCompany[] = typeof window !== "undefined" ? loadCompanies() : [];

  if (companies.length === 0) {
    const groupMap = new Map<string, MetaCampaignInsights[]>();

    for (const campaign of campaigns) {
      const projectName = extractProjectName(campaign.campaign_name || "");
      if (!projectName) continue;
      const existing = groupMap.get(projectName) || [];
      existing.push(campaign);
      groupMap.set(projectName, existing);
    }

    return Array.from(groupMap.entries())
      .map(([name, matched]) => summarize(encodeURIComponent(name), name, matched))
      .filter((project) => project.campaigns.length > 0);
  }

  const companyMap = new Map<string, { company: StoredCompany; campaigns: MetaCampaignInsights[] }>();
  const unmatched: MetaCampaignInsights[] = [];

  for (const company of companies) {
    companyMap.set(company.id, { company, campaigns: [] });
  }

  for (const campaign of campaigns) {
    const campaignName = campaign.campaign_name || "";
    let matched = false;
    for (const company of companies) {
      if (company.status !== "active") continue;
      if (company.campaignKeywords.some((keyword) => keyword && campaignName.includes(keyword))) {
        companyMap.get(company.id)?.campaigns.push(campaign);
        matched = true;
        break;
      }
    }
    if (!matched) unmatched.push(campaign);
  }

  const results: ProjectSummary[] = [];
  for (const [, entry] of companyMap) {
    if (entry.campaigns.length === 0) continue;
    results.push(summarize(entry.company.id, entry.company.companyName, entry.campaigns));
  }

  if (unmatched.length > 0) {
    results.push(summarize("__unmatched__", "未分類", unmatched));
  }

  return results;
}
