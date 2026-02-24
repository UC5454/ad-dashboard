import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { metaGet } from "@/lib/meta-api";
import type { MetaAction, MetaInsights } from "@/types/meta";

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
  const campaignId = request.nextUrl.searchParams.get("campaign_id");
  const since = request.nextUrl.searchParams.get("since");
  const until = request.nextUrl.searchParams.get("until");

  if (!accountId || !campaignId || !since || !until) {
    return NextResponse.json(
      { error: "account_id, campaign_id, since, until are required" },
      { status: 400 },
    );
  }

  try {
    const endpoint = `${normalizeAccountId(accountId)}/insights`;
    const filtering = JSON.stringify([
      {
        field: "campaign.id",
        operator: "EQUAL",
        value: campaignId,
      },
    ]);

    const timeRange = JSON.stringify({ since, until });

    const response = (await metaGet(endpoint, {
      fields: "impressions,clicks,spend,ctr,cpc,actions,date_start,date_stop",
      time_increment: "1",
      filtering,
      time_range: timeRange,
    })) as { data?: MetaInsights[] };

    const normalized = (response.data ?? []).map((day) => ({
      ...day,
      landing_page_view: actionValue(day.actions, "landing_page_view"),
      cv: actionValue(day.actions, "offsite_conversion.fb_pixel_custom"),
    }));

    return NextResponse.json(normalized);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Meta API request failed" },
      { status: 500 },
    );
  }
}
