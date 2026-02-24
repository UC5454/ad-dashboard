import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { metaGet } from "@/lib/meta-api";
import { actionValue, normalizeAccountId, numeric } from "@/lib/meta-utils";
import type { MetaAdInsights } from "@/types/meta";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accountId = request.nextUrl.searchParams.get("account_id");
  const datePreset = request.nextUrl.searchParams.get("date_preset") || "last_30d";
  const limit = request.nextUrl.searchParams.get("limit") || "100";

  if (!accountId) {
    return NextResponse.json({ error: "account_id is required" }, { status: 400 });
  }

  try {
    const response = (await metaGet(`${normalizeAccountId(accountId)}/insights`, {
      fields:
        "campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,impressions,clicks,spend,ctr,cpc,actions,date_start,date_stop",
      level: "ad",
      date_preset: datePreset,
      limit,
    })) as { data?: MetaAdInsights[] };

    const normalized = (response.data || []).map((row) => {
      const spend = numeric(row.spend);
      const cv = actionValue(row.actions, "offsite_conversion.fb_pixel_custom");
      return {
        ...row,
        cv,
        lp_views: actionValue(row.actions, "landing_page_view"),
        cpa: cv > 0 ? spend / cv : 0,
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
