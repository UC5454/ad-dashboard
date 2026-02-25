import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { DG_ACCOUNT_ID } from "@/lib/constants";
import { metaGet } from "@/lib/meta-api";
import { actionValue } from "@/lib/meta-utils";
import type { MetaInsights } from "@/types/meta";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const datePreset = request.nextUrl.searchParams.get("date_preset") || "last_30d";
  const since = request.nextUrl.searchParams.get("since");
  const until = request.nextUrl.searchParams.get("until");

  try {
    const query: Record<string, string> = {
      fields: "impressions,clicks,spend,ctr,cpc,reach,frequency,actions,date_start,date_stop",
      level: "account",
      time_increment: "1",
    };

    if (since && until) {
      query.time_range = JSON.stringify({ since, until });
    } else {
      query.date_preset = datePreset;
    }

    const response = (await metaGet(`${DG_ACCOUNT_ID}/insights`, query)) as {
      data?: MetaInsights[];
    };

    const normalized = (response.data || []).map((row) => ({
      ...row,
      lp_views: actionValue(row.actions, "landing_page_view"),
      cv: actionValue(row.actions, "offsite_conversion.fb_pixel_custom"),
    }));

    return NextResponse.json(normalized);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Meta API request failed" },
      { status: 500 },
    );
  }
}
