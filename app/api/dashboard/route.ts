import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";

interface KpiRow {
  total_cost: number;
  total_conversions: number;
  avg_cpa: number;
  avg_roas: number;
}

interface ClientRow {
  id: string;
  name: string;
  status: string;
  monthly_budget_google: number;
  monthly_budget_meta: number;
  total_cost: number;
  total_conversions: number;
  avg_cpa: number;
  avg_roas: number;
  avg_ctr: number;
}

interface DailyRow {
  date: string;
  total_cost: number;
  total_conversions: number;
  avg_cpa: number;
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const period = searchParams.get("period") || "current_month";
  const clientId = searchParams.get("clientId");

  const db = getDb();

  // Determine date range
  const now = new Date();
  let startDate: string;
  let endDate: string;
  let prevStartDate: string;
  let prevEndDate: string;

  if (period === "current_month") {
    startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    endDate = now.toISOString().split("T")[0];
    // Previous month
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    prevStartDate = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, "0")}-01`;
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    prevEndDate = prevMonthEnd.toISOString().split("T")[0];
  } else {
    // Default to last 30 days
    const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    startDate = start.toISOString().split("T")[0];
    endDate = now.toISOString().split("T")[0];
    const prevStart = new Date(start.getTime() - 30 * 24 * 60 * 60 * 1000);
    prevStartDate = prevStart.toISOString().split("T")[0];
    prevEndDate = start.toISOString().split("T")[0];
  }

  const clientFilter = clientId ? "AND client_id = ?" : "";
  const clientParams = clientId ? [clientId] : [];

  // BIG 4 KPIs (current period)
  const currentKpi = db
    .prepare(
      `SELECT
        COALESCE(SUM(cost), 0) as total_cost,
        COALESCE(SUM(conversions), 0) as total_conversions,
        CASE WHEN SUM(conversions) > 0 THEN SUM(cost) / SUM(conversions) ELSE 0 END as avg_cpa,
        CASE WHEN SUM(cost) > 0 THEN SUM(conversion_value) * 1.0 / SUM(cost) ELSE 0 END as avg_roas
       FROM ad_metrics
       WHERE level = 'account' AND date >= ? AND date <= ? ${clientFilter}`
    )
    .get(startDate, endDate, ...clientParams) as KpiRow;

  // BIG 4 KPIs (previous period)
  const prevKpi = db
    .prepare(
      `SELECT
        COALESCE(SUM(cost), 0) as total_cost,
        COALESCE(SUM(conversions), 0) as total_conversions,
        CASE WHEN SUM(conversions) > 0 THEN SUM(cost) / SUM(conversions) ELSE 0 END as avg_cpa,
        CASE WHEN SUM(cost) > 0 THEN SUM(conversion_value) * 1.0 / SUM(cost) ELSE 0 END as avg_roas
       FROM ad_metrics
       WHERE level = 'account' AND date >= ? AND date <= ? ${clientFilter}`
    )
    .get(prevStartDate, prevEndDate, ...clientParams) as KpiRow;

  // Client summary
  const clientSummary = db
    .prepare(
      `SELECT
        c.id, c.name, c.status, c.monthly_budget_google, c.monthly_budget_meta,
        COALESCE(SUM(m.cost), 0) as total_cost,
        COALESCE(SUM(m.conversions), 0) as total_conversions,
        CASE WHEN SUM(m.conversions) > 0 THEN SUM(m.cost) / SUM(m.conversions) ELSE 0 END as avg_cpa,
        CASE WHEN SUM(m.cost) > 0 THEN SUM(m.conversion_value) * 1.0 / SUM(m.cost) ELSE 0 END as avg_roas,
        CASE WHEN SUM(m.impressions) > 0 THEN SUM(m.clicks) * 100.0 / SUM(m.impressions) ELSE 0 END as avg_ctr
       FROM clients c
       LEFT JOIN ad_metrics m ON c.id = m.client_id AND m.level = 'account' AND m.date >= ? AND m.date <= ?
       WHERE c.status != 'archived'
       GROUP BY c.id
       ORDER BY total_cost DESC`
    )
    .all(startDate, endDate) as ClientRow[];

  // Daily trend
  const dailyTrend = db
    .prepare(
      `SELECT
        date,
        SUM(cost) as total_cost,
        SUM(conversions) as total_conversions,
        CASE WHEN SUM(conversions) > 0 THEN SUM(cost) / SUM(conversions) ELSE 0 END as avg_cpa
       FROM ad_metrics
       WHERE level = 'account' AND date >= ? AND date <= ? ${clientFilter}
       GROUP BY date
       ORDER BY date`
    )
    .all(startDate, endDate, ...clientParams) as DailyRow[];

  return NextResponse.json({
    kpi: {
      current: currentKpi,
      previous: prevKpi,
    },
    clients: clientSummary,
    dailyTrend,
    period: { startDate, endDate },
  });
}
