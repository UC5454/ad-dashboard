import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { metaGet } from "@/lib/meta-api";
import { actionValue, normalizeAccountId, numeric } from "@/lib/meta-utils";
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

  const accountId = request.nextUrl.searchParams.get("account_id");
  const datePreset = request.nextUrl.searchParams.get("date_preset") || "last_30d";

  if (!accountId) {
    return NextResponse.json({ error: "account_id is required" }, { status: 400 });
  }

  try {
    const insights = (await metaGet(`${normalizeAccountId(accountId)}/insights`, {
      fields: "ad_id,ad_name,impressions,clicks,spend,ctr,actions",
      level: "ad",
      date_preset: datePreset,
      limit: "30",
    })) as { data?: MetaAdInsights[] };

    const ads = insights.data || [];

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
