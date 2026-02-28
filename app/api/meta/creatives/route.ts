import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { DEFAULT_META_ACCOUNT_ID } from "@/lib/constants";
import { metaGet } from "@/lib/meta-api";
import { actionValue, numeric } from "@/lib/meta-utils";
import type { MetaAdInsights, MetaCreativeSummary } from "@/types/meta";

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

  const accessToken = request.headers.get("x-meta-token") || process.env.META_ACCESS_TOKEN;
  const accountId = request.headers.get("x-meta-account-id") || DEFAULT_META_ACCOUNT_ID;

  if (!accessToken) {
    return NextResponse.json(
      { error: "Meta APIトークンが未設定です。設定画面でAPIキーを登録してください。" },
      { status: 400 },
    );
  }

  const datePreset = request.nextUrl.searchParams.get("date_preset") || "last_30d";
  const campaignId = request.nextUrl.searchParams.get("campaign_id");

  try {
    const query: Record<string, string> = {
      fields: "ad_id,ad_name,impressions,clicks,spend,ctr,actions,campaign_id,campaign_name,adset_id,adset_name",
      level: "ad",
      date_preset: datePreset,
      limit: "100",
    };

    if (campaignId) {
      query.filtering = JSON.stringify([
        {
          field: "campaign.id",
          operator: "EQUAL",
          value: campaignId,
        },
      ]);
    }

    const insights = (await metaGet(`${accountId}/insights`, query, accessToken)) as { data?: MetaAdInsights[] };

    const ads = insights.data || [];

    const creativeDetails = await Promise.all(
      ads.map(async (ad) => {
        try {
          const res = (await metaGet(
            ad.ad_id,
            {
              fields: "name,creative{name,title,body,image_url,thumbnail_url}",
            },
            accessToken,
          )) as AdCreativeResponse;
          return { adId: ad.ad_id, data: res };
        } catch {
          return { adId: ad.ad_id, data: {} as AdCreativeResponse };
        }
      }),
    );

    const creativeMap = new Map(creativeDetails.map((item) => [item.adId, item.data]));

    const normalized: MetaCreativeSummary[] = ads.map((ad) => {
      const spend = numeric(ad.spend);
      const impressions = numeric(ad.impressions);
      const clicks = numeric(ad.clicks);
      const cv = actionValue(ad.actions, "offsite_conversion.fb_pixel_custom");
      const creativeInfo = creativeMap.get(ad.ad_id);
      const creativeName =
        creativeInfo?.creative?.name || creativeInfo?.creative?.title || creativeInfo?.name || ad.ad_name;

      return {
        ad_id: ad.ad_id,
        ad_name: ad.ad_name,
        creative_name: creativeName,
        thumbnail_url: creativeInfo?.creative?.thumbnail_url || creativeInfo?.creative?.image_url || null,
        spend,
        impressions,
        clicks,
        ctr: Number.parseFloat(ad.ctr || "0") || 0,
        cv,
        cpa: cv > 0 ? spend / cv : 0,
      };
    });

    normalized.sort((a, b) => b.spend - a.spend);

    return NextResponse.json(normalized);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Meta API request failed" },
      { status: 500 },
    );
  }
}
