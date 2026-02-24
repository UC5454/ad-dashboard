import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { metaGet } from "@/lib/meta-api";
import type { MetaAction, MetaCampaignInsights } from "@/types/meta";

function normalizeAccountId(accountId: string): string {
  return accountId.startsWith("act_") ? accountId : `act_${accountId}`;
}

function actionValue(actions: MetaAction[] | undefined, actionType: string): number {
  const target = actions?.find((action) => action.action_type === actionType);
  return target ? Number.parseFloat(target.value || "0") || 0 : 0;
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
    const endpoint = `${normalizeAccountId(accountId)}/insights`;
    const response = (await metaGet(endpoint, {
      fields:
        "campaign_id,campaign_name,impressions,clicks,spend,ctr,cpc,actions,cost_per_action_type,date_start,date_stop",
      date_preset: datePreset,
      level: "campaign",
      limit: "50",
    })) as { data?: MetaCampaignInsights[] };

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
