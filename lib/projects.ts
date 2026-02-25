import type { MetaCampaignInsights } from "@/types/meta";
import { actionValue, numeric } from "@/lib/meta-utils";

export interface ProjectDefinition {
  id: string;
  name: string;
  campaignPatterns: string[];
}

export const PROJECTS: ProjectDefinition[] = [
  { id: "creet", name: "CREETstage ライバー募集", campaignPatterns: ["CREETstage"] },
  { id: "face", name: "フェイス美容外科 来院者増加", campaignPatterns: ["フェイス美容外科"] },
  { id: "trust", name: "Trust株式会社 採用施策", campaignPatterns: ["Trust"] },
];

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

export function groupCampaignsToProjects(campaigns: MetaCampaignInsights[]): ProjectSummary[] {
  return PROJECTS.map((project) => {
    const matched = campaigns.filter((campaign) =>
      project.campaignPatterns.some((pattern) => (campaign.campaign_name || "").includes(pattern)),
    );
    const spend = matched.reduce((sum, campaign) => sum + numeric(campaign.spend), 0);
    const impressions = matched.reduce((sum, campaign) => sum + numeric(campaign.impressions), 0);
    const clicks = matched.reduce((sum, campaign) => sum + numeric(campaign.clicks), 0);
    const cv = matched.reduce(
      (sum, campaign) => sum + actionValue(campaign.actions, "offsite_conversion.fb_pixel_custom"),
      0,
    );
    return {
      id: project.id,
      name: project.name,
      campaigns: matched,
      spend,
      impressions,
      clicks,
      cv,
      cpa: cv > 0 ? spend / cv : 0,
      ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    };
  }).filter((project) => project.campaigns.length > 0);
}
