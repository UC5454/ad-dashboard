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

  const campaignId = request.nextUrl.searchParams.get("campaign_id");
  const datePreset = request.nextUrl.searchParams.get("date_preset") || "last_30d";

  if (!campaignId) {
    return NextResponse.json({ error: "campaign_id is required" }, { status: 400 });
  }

  try {
    const insights = (await metaGet(
      `${accountId}/insights`,
      {
        fields: "ad_id,ad_name,impressions,clicks,spend,ctr,actions",
        level: "ad",
        date_preset: datePreset,
        filtering: JSON.stringify([
          {
            field: "campaign.id",
            operator: "EQUAL",
            value: campaignId,
          },
        ]),
        limit: "100",
      },
      accessToken,
    )) as { data?: MetaAdInsights[] };

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

    return NextResponse.json(creatives);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Meta API request failed" },
      { status: 500 },
    );
  }
}
