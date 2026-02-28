import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { DEFAULT_META_ACCOUNT_ID } from "@/lib/constants";
import { metaGet } from "@/lib/meta-api";
import { actionValue, numeric } from "@/lib/meta-utils";
import { extractProjectName, groupCampaignsToProjects } from "@/lib/projects";
import {
  generateClientReport,
  generateCreativeAnalysis,
  generateDailyAnalysis,
  generateOverallAnalysis,
} from "@/lib/ai-analysis";
import type { MetaAdInsights, MetaAdsetInsights, MetaCampaignInsights } from "@/types/meta";

interface MetaListResponse<T> {
  data?: T[];
}

interface AdCreativeDetail {
  name?: string;
  creative?: {
    name?: string;
    title?: string;
    body?: string;
    image_url?: string;
    thumbnail_url?: string;
  };
}

interface CampaignOutput {
  campaign_id: string;
  campaign_name: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cv: number;
  cpa: number;
}

interface AdsetOutput {
  adset_id: string;
  adset_name: string;
  campaign_id: string;
  campaign_name: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cv: number;
  cpa: number;
  reach: number;
  frequency: number;
}

interface CreativeOutput {
  ad_id: string;
  ad_name: string;
  creative_name: string;
  campaign_id: string;
  campaign_name: string;
  adset_id: string;
  adset_name: string;
  image_url: string | null;
  thumbnail_url: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cv: number;
  cpa: number;
}

interface DailyOutput {
  date_start: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cv: number;
  cpa: number;
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const accessToken = request.headers.get("x-meta-token") || process.env.META_ACCESS_TOKEN;
  const accountId = request.headers.get("x-meta-account-id") || DEFAULT_META_ACCOUNT_ID;

  if (!accessToken) {
    return NextResponse.json(
      { error: "Meta APIトークンが未設定です。設定画面でAPIキーを登録してください。" },
      { status: 400 },
    );
  }

  const projectId = request.nextUrl.searchParams.get("project_id");
  const datePreset = request.nextUrl.searchParams.get("date_preset") || "last_30d";

  if (!projectId) {
    return NextResponse.json({ error: "project_id is required" }, { status: 400 });
  }

  const projectName = decodeURIComponent(projectId).trim();
  if (!projectName) {
    return NextResponse.json({ error: "project not found" }, { status: 404 });
  }

  try {
    const campaignRes = (await metaGet(
      `${accountId}/insights`,
      {
        fields: "campaign_id,campaign_name,impressions,clicks,spend,ctr,cpc,actions",
        level: "campaign",
        date_preset: datePreset,
        limit: "500",
      },
      accessToken,
    )) as MetaListResponse<MetaCampaignInsights>;

    const allCampaigns = campaignRes.data || [];
    const matchedCampaigns = allCampaigns.filter(
      (campaign) => extractProjectName(campaign.campaign_name || "") === projectName,
    );

    const matchedCampaignIds = Array.from(new Set(matchedCampaigns.map((campaign) => campaign.campaign_id)));

    if (matchedCampaignIds.length === 0) {
      return NextResponse.json({
        project: {
          id: projectId,
          name: projectName,
          spend: 0,
          cv: 0,
          cpa: 0,
          ctr: 0,
          impressions: 0,
          clicks: 0,
        },
        campaigns: [],
        adsets: [],
        creatives: [],
        daily: [],
        analysis: {
          overall: generateOverallAnalysis([]),
          daily: generateDailyAnalysis([]),
          creative: generateCreativeAnalysis([]),
          clientReport: generateClientReport(
            {
              id: projectId,
              name: projectName,
              spend: 0,
              cv: 0,
              cpa: 0,
              ctr: 0,
              impressions: 0,
              clicks: 0,
            },
            [],
            [],
          ),
        },
      });
    }

    const filtering = JSON.stringify([
      {
        field: "campaign.id",
        operator: "IN",
        value: matchedCampaignIds,
      },
    ]);

    const [projectCampaignRes, adsetRes, adRes, dailyRes] = (await Promise.all([
      metaGet(
        `${accountId}/insights`,
        {
          fields: "campaign_id,campaign_name,impressions,clicks,spend,ctr,cpc,actions",
          level: "campaign",
          date_preset: datePreset,
          filtering,
          limit: "500",
        },
        accessToken,
      ),
      metaGet(
        `${accountId}/insights`,
        {
          fields: "campaign_id,campaign_name,adset_id,adset_name,impressions,clicks,spend,ctr,cpc,reach,frequency,actions",
          level: "adset",
          date_preset: datePreset,
          filtering,
          limit: "500",
        },
        accessToken,
      ),
      metaGet(
        `${accountId}/insights`,
        {
          fields: "campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,impressions,clicks,spend,ctr,actions",
          level: "ad",
          date_preset: datePreset,
          filtering,
          limit: "500",
        },
        accessToken,
      ),
      metaGet(
        `${accountId}/insights`,
        {
          fields: "campaign_id,campaign_name,impressions,clicks,spend,ctr,cpc,actions,date_start,date_stop",
          level: "campaign",
          date_preset: datePreset,
          filtering,
          time_increment: "1",
          limit: "500",
        },
        accessToken,
      ),
    ])) as [
      MetaListResponse<MetaCampaignInsights>,
      MetaListResponse<MetaAdsetInsights>,
      MetaListResponse<MetaAdInsights>,
      MetaListResponse<MetaCampaignInsights>,
    ];

    const campaigns: CampaignOutput[] = (projectCampaignRes.data || [])
      .map((campaign) => {
        const spend = numeric(campaign.spend);
        const impressions = numeric(campaign.impressions);
        const clicks = numeric(campaign.clicks);
        const cv = actionValue(campaign.actions, "offsite_conversion.fb_pixel_custom");
        return {
          campaign_id: campaign.campaign_id,
          campaign_name: campaign.campaign_name,
          spend,
          impressions,
          clicks,
          ctr: impressions > 0 ? (clicks / impressions) * 100 : numeric(campaign.ctr),
          cv,
          cpa: cv > 0 ? spend / cv : 0,
        };
      })
      .sort((a, b) => b.spend - a.spend);

    const adsets: AdsetOutput[] = (adsetRes.data || [])
      .map((adset) => {
        const spend = numeric(adset.spend);
        const impressions = numeric(adset.impressions);
        const clicks = numeric(adset.clicks);
        const cv = actionValue(adset.actions, "offsite_conversion.fb_pixel_custom");
        return {
          adset_id: adset.adset_id,
          adset_name: adset.adset_name,
          campaign_id: adset.campaign_id,
          campaign_name: adset.campaign_name,
          spend,
          impressions,
          clicks,
          ctr: impressions > 0 ? (clicks / impressions) * 100 : numeric(adset.ctr),
          cv,
          cpa: cv > 0 ? spend / cv : 0,
          reach: numeric(adset.reach),
          frequency: numeric(adset.frequency),
        };
      })
      .sort((a, b) => b.spend - a.spend);

    const adRows = adRes.data || [];
    const creativeDetails = await Promise.all(
      adRows.map(async (ad) => {
        try {
          const detail = (await metaGet(
            ad.ad_id,
            {
              fields: "name,creative{name,title,body,image_url,thumbnail_url}",
            },
            accessToken,
          )) as AdCreativeDetail;
          return { adId: ad.ad_id, detail };
        } catch {
          return { adId: ad.ad_id, detail: {} as AdCreativeDetail };
        }
      }),
    );

    const creativeMap = new Map(creativeDetails.map((item) => [item.adId, item.detail]));

    const creatives: CreativeOutput[] = adRows
      .map((ad) => {
        const spend = numeric(ad.spend);
        const impressions = numeric(ad.impressions);
        const clicks = numeric(ad.clicks);
        const cv = actionValue(ad.actions, "offsite_conversion.fb_pixel_custom");
        const detail = creativeMap.get(ad.ad_id);
        const imageUrl = detail?.creative?.image_url || detail?.creative?.thumbnail_url || null;
        return {
          ad_id: ad.ad_id,
          ad_name: ad.ad_name,
          creative_name: detail?.creative?.name || detail?.creative?.title || detail?.name || ad.ad_name,
          campaign_id: ad.campaign_id || "",
          campaign_name: ad.campaign_name || "",
          adset_id: ad.adset_id || "",
          adset_name: ad.adset_name || "",
          image_url: imageUrl,
          thumbnail_url: detail?.creative?.thumbnail_url || null,
          spend,
          impressions,
          clicks,
          ctr: impressions > 0 ? (clicks / impressions) * 100 : numeric(ad.ctr),
          cv,
          cpa: cv > 0 ? spend / cv : 0,
        };
      })
      .sort((a, b) => {
        if (b.cv !== a.cv) return b.cv - a.cv;
        return a.cpa - b.cpa;
      });

    const dailyMap = new Map<string, { spend: number; impressions: number; clicks: number; cv: number }>();
    (dailyRes.data || []).forEach((row) => {
      const current = dailyMap.get(row.date_start) || { spend: 0, impressions: 0, clicks: 0, cv: 0 };
      dailyMap.set(row.date_start, {
        spend: current.spend + numeric(row.spend),
        impressions: current.impressions + numeric(row.impressions),
        clicks: current.clicks + numeric(row.clicks),
        cv: current.cv + actionValue(row.actions, "offsite_conversion.fb_pixel_custom"),
      });
    });

    const daily: DailyOutput[] = Array.from(dailyMap.entries())
      .map(([date_start, row]) => ({
        date_start,
        spend: row.spend,
        impressions: row.impressions,
        clicks: row.clicks,
        ctr: row.impressions > 0 ? (row.clicks / row.impressions) * 100 : 0,
        cv: row.cv,
        cpa: row.cv > 0 ? row.spend / row.cv : 0,
      }))
      .sort((a, b) => a.date_start.localeCompare(b.date_start));

    const project = campaigns.reduce(
      (acc, campaign) => {
        acc.spend += campaign.spend;
        acc.impressions += campaign.impressions;
        acc.clicks += campaign.clicks;
        acc.cv += campaign.cv;
        return acc;
      },
      {
        id: projectId,
        name: projectName,
        spend: 0,
        cv: 0,
        cpa: 0,
        ctr: 0,
        impressions: 0,
        clicks: 0,
      },
    );

    project.cpa = project.cv > 0 ? project.spend / project.cv : 0;
    project.ctr = project.impressions > 0 ? (project.clicks / project.impressions) * 100 : 0;

    const allProjects = groupCampaignsToProjects(allCampaigns).map((row) => ({
      name: row.name,
      spend: row.spend,
      cv: row.cv,
      cpa: row.cpa,
      ctr: row.ctr,
      impressions: row.impressions,
      clicks: row.clicks,
    }));

    return NextResponse.json({
      project,
      campaigns,
      adsets,
      creatives,
      daily,
      analysis: {
        overall: generateOverallAnalysis(allProjects),
        daily: generateDailyAnalysis(
          daily.map((row) => ({
            date_start: row.date_start,
            spend: String(row.spend),
            impressions: String(row.impressions),
            clicks: String(row.clicks),
            ctr: String(row.ctr),
            cv: row.cv,
          })),
        ),
        creative: generateCreativeAnalysis(
          creatives.map((row) => ({
            ad_name: row.ad_name,
            creative_name: row.creative_name,
            spend: row.spend,
            impressions: row.impressions,
            clicks: row.clicks,
            ctr: row.ctr,
            cv: row.cv,
            cpa: row.cpa,
          })),
        ),
        clientReport: generateClientReport(project, daily, creatives),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Meta API request failed" },
      { status: 500 },
    );
  }
}
