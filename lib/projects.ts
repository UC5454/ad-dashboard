import type { MetaCampaignInsights } from "@/types/meta";
import { actionValue, numeric } from "@/lib/meta-utils";

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
  const groupMap = new Map<string, MetaCampaignInsights[]>();

  for (const campaign of campaigns) {
    const projectName = extractProjectName(campaign.campaign_name || "");
    if (!projectName) continue;
    const existing = groupMap.get(projectName) || [];
    existing.push(campaign);
    groupMap.set(projectName, existing);
  }

  return Array.from(groupMap.entries())
    .map(([name, matched]) => {
      const id = encodeURIComponent(name);
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
    })
    .filter((project) => project.campaigns.length > 0);
}
