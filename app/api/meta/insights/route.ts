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

  try {
    const response = (await metaGet(`${DG_ACCOUNT_ID}/insights`, {
      fields:
        "impressions,clicks,spend,ctr,cpc,cpp,reach,frequency,actions,cost_per_action_type,date_start,date_stop",
      date_preset: datePreset,
      level: "account",
    })) as { data?: MetaInsights[] };

    const data = response.data?.[0] ?? null;
    if (!data) {
      return NextResponse.json(null);
    }

    return NextResponse.json({
      ...data,
      link_click: actionValue(data.actions, "link_click"),
      landing_page_view: actionValue(data.actions, "landing_page_view"),
      cv: actionValue(data.actions, "offsite_conversion.fb_pixel_custom"),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Meta API request failed" },
      { status: 500 },
    );
  }
}
