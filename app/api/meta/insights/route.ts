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

  const datePreset = request.nextUrl.searchParams.get("date_preset") || "last_30d";

  try {
    const response = (await metaGet(
      `${accountId}/insights`,
      {
        fields:
          "impressions,clicks,spend,ctr,cpc,cpp,reach,frequency,actions,cost_per_action_type,date_start,date_stop",
        date_preset: datePreset,
        level: "account",
      },
      accessToken,
    )) as { data?: MetaInsights[] };

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
