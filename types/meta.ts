export interface MetaAccount {
  id: string;
  name: string;
  account_id: string;
  account_status: number;
  currency: string;
  timezone_name: string;
  amount_spent: string;
}

export interface MetaAction {
  action_type: string;
  value: string;
}

export interface MetaInsights {
  impressions: string;
  clicks: string;
  spend: string;
  ctr: string;
  cpc: string;
  cpp?: string;
  reach?: string;
  frequency?: string;
  actions?: MetaAction[];
  cost_per_action_type?: MetaAction[];
  date_start: string;
  date_stop: string;
}

export interface MetaCampaignInsights extends MetaInsights {
  campaign_id: string;
  campaign_name: string;
}

export interface MetaAdsetInsights extends MetaInsights {
  campaign_id: string;
  campaign_name: string;
  adset_id: string;
  adset_name: string;
}

export interface MetaAdInsights extends MetaInsights {
  campaign_id?: string;
  campaign_name?: string;
  adset_id?: string;
  adset_name?: string;
  ad_id: string;
  ad_name: string;
}

export interface MetaBreakdownInsights extends MetaInsights {
  age?: string;
  gender?: string;
  country?: string;
  publisher_platform?: string;
  platform_position?: string;
  impression_device?: string;
  region?: string;
  hourly_stats_aggregated_by_advertiser_time_zone?: string;
}

export interface MetaCreativeSummary {
  ad_id: string;
  ad_name: string;
  creative_name: string;
  thumbnail_url: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cv: number;
  cpa: number;
}
