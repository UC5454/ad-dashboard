import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const clients = db.prepare("SELECT * FROM clients ORDER BY name").all();
  return NextResponse.json(clients);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as Record<string, unknown>).role;
  if (role !== "admin" && role !== "editor") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { name, google_ads_account_id, meta_ads_account_id, monthly_budget_google, monthly_budget_meta } = body;

  if (!name) {
    return NextResponse.json({ error: "Client name is required" }, { status: 400 });
  }

  const db = getDb();
  const id = uuidv4();
  db.prepare(
    `INSERT INTO clients (id, name, google_ads_account_id, meta_ads_account_id, monthly_budget_google, monthly_budget_meta)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, name, google_ads_account_id || null, meta_ads_account_id || null, monthly_budget_google || 0, monthly_budget_meta || 0);

  const client = db.prepare("SELECT * FROM clients WHERE id = ?").get(id);
  return NextResponse.json(client, { status: 201 });
}
