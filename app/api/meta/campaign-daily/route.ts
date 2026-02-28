import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { DEFAULT_META_ACCOUNT_ID } from "@/lib/constants";
import { metaGet } from "@/lib/meta-api";
import { actionValue } from "@/lib/meta-utils";
import type { MetaInsights } from "@/types/meta";

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
  const since = request.nextUrl.searchParams.get("since");
  const until = request.nextUrl.searchParams.get("until");

  if (!campaignId || !since || !until) {
    return NextResponse.json({ error: "campaign_id, since, until are required" }, { status: 400 });
  }

  try {
    const response = (await metaGet(
      `${accountId}/insights`,
      {
        fields: "impressions,clicks,spend,ctr,cpc,actions,date_start,date_stop",
        time_increment: "1",
        filtering: JSON.stringify([
          {
            field: "campaign.id",
            operator: "EQUAL",
            value: campaignId,
          },
        ]),
        time_range: JSON.stringify({ since, until }),
      },
      accessToken,
    )) as { data?: MetaInsights[] };

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
