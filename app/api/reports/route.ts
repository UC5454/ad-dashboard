import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";

interface MetricRow {
  platform: string;
  total_cost: number;
  total_impressions: number;
  total_clicks: number;
  total_conversions: number;
  total_conversion_value: number;
  avg_ctr: number;
  avg_cpc: number;
  avg_cpa: number;
  avg_roas: number;
}

interface DailyRow {
  date: string;
  cost: number;
  conversions: number;
  cpa: number;
}

interface CampaignRow {
  campaign_name: string;
  platform: string;
  cost: number;
  conversions: number;
  cpa: number;
  roas: number;
  ctr: number;
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("clientId");
  const period = searchParams.get("period"); // YYYY-MM

  if (!clientId || !period) {
    return NextResponse.json({ error: "clientId and period required" }, { status: 400 });
  }

  const db = getDb();

  // Client info
  const client = db.prepare("SELECT * FROM clients WHERE id = ?").get(clientId);
  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  // Platform summary
  const platformSummary = db
    .prepare(
      `SELECT
        platform,
        SUM(cost) as total_cost,
        SUM(impressions) as total_impressions,
        SUM(clicks) as total_clicks,
        SUM(conversions) as total_conversions,
        SUM(conversion_value) as total_conversion_value,
        CASE WHEN SUM(impressions) > 0 THEN SUM(clicks) * 100.0 / SUM(impressions) ELSE 0 END as avg_ctr,
        CASE WHEN SUM(clicks) > 0 THEN SUM(cost) * 1.0 / SUM(clicks) ELSE 0 END as avg_cpc,
        CASE WHEN SUM(conversions) > 0 THEN SUM(cost) * 1.0 / SUM(conversions) ELSE 0 END as avg_cpa,
        CASE WHEN SUM(cost) > 0 THEN SUM(conversion_value) * 1.0 / SUM(cost) ELSE 0 END as avg_roas
       FROM ad_metrics
       WHERE client_id = ? AND level = 'account' AND date LIKE ?
       GROUP BY platform`
    )
    .all(clientId, `${period}%`) as MetricRow[];

  // Daily trend
  const dailyTrend = db
    .prepare(
      `SELECT
        date,
        SUM(cost) as cost,
        SUM(conversions) as conversions,
        CASE WHEN SUM(conversions) > 0 THEN SUM(cost) / SUM(conversions) ELSE 0 END as cpa
       FROM ad_metrics
       WHERE client_id = ? AND level = 'account' AND date LIKE ?
       GROUP BY date
       ORDER BY date`
    )
    .all(clientId, `${period}%`) as DailyRow[];

  // Campaign breakdown
  const campaigns = db
    .prepare(
      `SELECT
        campaign_name,
        platform,
        SUM(cost) as cost,
        SUM(conversions) as conversions,
        CASE WHEN SUM(conversions) > 0 THEN SUM(cost) / SUM(conversions) ELSE 0 END as cpa,
        CASE WHEN SUM(cost) > 0 THEN SUM(conversion_value) * 1.0 / SUM(cost) ELSE 0 END as roas,
        CASE WHEN SUM(impressions) > 0 THEN SUM(clicks) * 100.0 / SUM(impressions) ELSE 0 END as ctr
       FROM ad_metrics
       WHERE client_id = ? AND level = 'campaign' AND date LIKE ?
       GROUP BY campaign_name, platform
       ORDER BY cost DESC`
    )
    .all(clientId, `${period}%`) as CampaignRow[];

  return NextResponse.json({
    client,
    period,
    platformSummary,
    dailyTrend,
    campaigns,
  });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const role = ((session as any).user?.role as string) || "viewer";
  if (role === "viewer") {
    return NextResponse.json({ error: "Forbidden: viewer cannot generate reports" }, { status: 403 });
  }

  const body = await request.json();
  const { clientId, period } = body;

  if (!clientId || !period) {
    return NextResponse.json({ error: "clientId and period required" }, { status: 400 });
  }

  const db = getDb();

  // Record report generation
  db.prepare(
    "INSERT INTO reports (client_id, period) VALUES (?, ?)"
  ).run(clientId, period);

  return NextResponse.json({ success: true, message: "Report data ready for PDF generation" });
}
