import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { DEFAULT_META_ACCOUNT_ID } from "@/lib/constants";
import { metaGet } from "@/lib/meta-api";
import { actionValue } from "@/lib/meta-utils";
import type { MetaCampaignInsights } from "@/types/meta";

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

  try {
    const response = (await metaGet(
      `${accountId}/insights`,
      {
        fields:
          "campaign_id,campaign_name,impressions,clicks,spend,ctr,cpc,actions,cost_per_action_type,date_start,date_stop",
        date_preset: datePreset,
        level: "campaign",
        limit: "100",
      },
      accessToken,
    )) as { data?: MetaCampaignInsights[] };

    const normalized = (response.data ?? []).map((campaign) => {
      const spend = Number.parseFloat(campaign.spend || "0") || 0;
      const clicks = Number.parseFloat(campaign.clicks || "0") || 0;
      const cv = actionValue(campaign.actions, "offsite_conversion.fb_pixel_custom");
      const lpViews = actionValue(campaign.actions, "landing_page_view");
      return {
        ...campaign,
        lp_views: lpViews,
        cv,
        cpa: cv > 0 ? spend / cv : 0,
        calc_cpc: clicks > 0 ? spend / clicks : 0,
      };
    });

    return NextResponse.json(normalized);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Meta API request failed" },
      { status: 500 },
    );
  }
}
