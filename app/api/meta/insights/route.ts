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
  const datePreset = request.nextUrl.searchParams.get("date_preset") || "last_30d";

  if (!accountId) {
    return NextResponse.json({ error: "account_id is required" }, { status: 400 });
  }

  try {
    const endpoint = `${normalizeAccountId(accountId)}/insights`;
    const response = (await metaGet(endpoint, {
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
