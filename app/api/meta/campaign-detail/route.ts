import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { DG_ACCOUNT_ID } from "@/lib/constants";
import { metaGet } from "@/lib/meta-api";
import { actionValue, numeric } from "@/lib/meta-utils";
import type { MetaAdInsights, MetaAdsetInsights, MetaCampaignInsights, MetaCreativeSummary, MetaInsights } from "@/types/meta";

interface AdCreativeResponse {
  name?: string;
  creative?: {
    name?: string;
    title?: string;
    body?: string;
    image_url?: string;
    thumbnail_url?: string;
  };
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const campaignId = request.nextUrl.searchParams.get("campaign_id");
  const datePreset = request.nextUrl.searchParams.get("date_preset") || "last_30d";
  const since = request.nextUrl.searchParams.get("since");
  const until = request.nextUrl.searchParams.get("until");

  if (!campaignId) {
    return NextResponse.json({ error: "campaign_id is required" }, { status: 400 });
  }

  try {
    const filtering = JSON.stringify([
      {
        field: "campaign.id",
        operator: "EQUAL",
        value: campaignId,
      },
    ]);

    const dailyQuery: Record<string, string> = {
      fields: "impressions,clicks,spend,ctr,cpc,actions,date_start,date_stop",
      time_increment: "1",
      filtering,
    };

    if (since && until) {
      dailyQuery.time_range = JSON.stringify({ since, until });
    } else {
      dailyQuery.date_preset = datePreset;
    }

    const [campaignRes, adsetRes, adRes, dailyRes] = (await Promise.all([
      metaGet(`${DG_ACCOUNT_ID}/insights`, {
        fields: "campaign_id,campaign_name,impressions,clicks,spend,ctr,cpc,actions,date_start,date_stop",
        level: "campaign",
        date_preset: datePreset,
        filtering,
      }),
      metaGet(`${DG_ACCOUNT_ID}/insights`, {
        fields: "adset_id,adset_name,impressions,clicks,spend,ctr,cpc,reach,frequency,actions,date_start,date_stop",
        level: "adset",
        date_preset: datePreset,
        filtering,
        limit: "200",
      }),
      metaGet(`${DG_ACCOUNT_ID}/insights`, {
        fields: "ad_id,ad_name,impressions,clicks,spend,ctr,actions",
        level: "ad",
        date_preset: datePreset,
        filtering,
        limit: "200",
      }),
      metaGet(`${DG_ACCOUNT_ID}/insights`, dailyQuery),
    ])) as [
      { data?: MetaCampaignInsights[] },
      { data?: MetaAdsetInsights[] },
      { data?: MetaAdInsights[] },
      { data?: MetaInsights[] },
    ];

    const campaignRow = (campaignRes.data || [])[0];
    if (!campaignRow) {
      return NextResponse.json({ error: "campaign not found" }, { status: 404 });
    }

    const campaignSpend = numeric(campaignRow.spend);
    const campaignCv = actionValue(campaignRow.actions, "offsite_conversion.fb_pixel_custom");
    const campaign = {
      ...campaignRow,
      cv: campaignCv,
      lp_views: actionValue(campaignRow.actions, "landing_page_view"),
      cpa: campaignCv > 0 ? campaignSpend / campaignCv : 0,
    };

    const adsets = (adsetRes.data || []).map((row) => {
      const spend = numeric(row.spend);
      const cv = actionValue(row.actions, "offsite_conversion.fb_pixel_custom");
      return {
        ...row,
        cv,
        lp_views: actionValue(row.actions, "landing_page_view"),
        cpa: cv > 0 ? spend / cv : 0,
      };
    });

    const ads = adRes.data || [];
    const creativeDetails = await Promise.all(
      ads.map(async (ad) => {
        try {
          const res = (await metaGet(ad.ad_id, {
            fields: "name,creative{name,title,body,image_url,thumbnail_url}",
          })) as AdCreativeResponse;
          return { adId: ad.ad_id, data: res };
        } catch {
          return { adId: ad.ad_id, data: {} as AdCreativeResponse };
        }
      }),
    );

    const creativeMap = new Map(creativeDetails.map((item) => [item.adId, item.data]));

    const creatives: MetaCreativeSummary[] = ads.map((ad) => {
      const spend = numeric(ad.spend);
      const impressions = numeric(ad.impressions);
      const clicks = numeric(ad.clicks);
      const cv = actionValue(ad.actions, "offsite_conversion.fb_pixel_custom");
      const creativeInfo = creativeMap.get(ad.ad_id);
      return {
        ad_id: ad.ad_id,
        ad_name: ad.ad_name,
        creative_name:
          creativeInfo?.creative?.name || creativeInfo?.creative?.title || creativeInfo?.name || ad.ad_name,
        thumbnail_url: creativeInfo?.creative?.thumbnail_url || creativeInfo?.creative?.image_url || null,
        spend,
        impressions,
        clicks,
        ctr: Number.parseFloat(ad.ctr || "0") || 0,
        cv,
        cpa: cv > 0 ? spend / cv : 0,
      };
    });

    creatives.sort((a, b) => b.cv - a.cv);

    const daily = (dailyRes.data || []).map((row) => ({
      ...row,
      cv: actionValue(row.actions, "offsite_conversion.fb_pixel_custom"),
      lp_views: actionValue(row.actions, "landing_page_view"),
    }));

    return NextResponse.json({
      campaign,
      adsets,
      creatives,
      daily,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Meta API request failed" },
      { status: 500 },
    );
  }
}
