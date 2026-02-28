import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { DEFAULT_META_ACCOUNT_ID } from "@/lib/constants";
import { metaGet } from "@/lib/meta-api";
import { groupCampaignsToProjects } from "@/lib/projects";
import type { MetaCampaignInsights } from "@/types/meta";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
    const res = (await metaGet(
      `${accountId}/insights`,
      {
        fields: "campaign_id,campaign_name,impressions,clicks,spend,ctr,cpc,actions",
        level: "campaign",
        date_preset: datePreset,
        limit: "200",
      },
      accessToken,
    )) as { data?: MetaCampaignInsights[] };

    const projects = groupCampaignsToProjects(res.data || []);
    return NextResponse.json(projects);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Meta API request failed" },
      { status: 500 },
    );
  }
}
