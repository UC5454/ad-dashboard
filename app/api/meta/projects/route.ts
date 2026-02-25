import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { DG_ACCOUNT_ID } from "@/lib/constants";
import { metaGet } from "@/lib/meta-api";
import { groupCampaignsToProjects } from "@/lib/projects";
import type { MetaCampaignInsights } from "@/types/meta";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const datePreset = request.nextUrl.searchParams.get("date_preset") || "last_30d";

  try {
    const res = (await metaGet(`${DG_ACCOUNT_ID}/insights`, {
      fields: "campaign_id,campaign_name,impressions,clicks,spend,ctr,cpc,actions",
      level: "campaign",
      date_preset: datePreset,
      limit: "200",
    })) as { data?: MetaCampaignInsights[] };

    const projects = groupCampaignsToProjects(res.data || []);
    return NextResponse.json(projects);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Meta API request failed" },
      { status: 500 },
    );
  }
}
