import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("clientId");
  const severity = searchParams.get("severity");
  const limit = parseInt(searchParams.get("limit") || "50");

  const db = getDb();

  let query = `
    SELECT a.*, c.name as client_name
    FROM alerts a
    LEFT JOIN clients c ON a.client_id = c.id
    WHERE 1=1
  `;
  const params: (string | number)[] = [];

  if (clientId) {
    query += " AND a.client_id = ?";
    params.push(clientId);
  }
  if (severity) {
    query += " AND a.severity = ?";
    params.push(severity);
  }

  query += " ORDER BY a.notified_at DESC LIMIT ?";
  params.push(limit);

  const alerts = db.prepare(query).all(...params);
  return NextResponse.json(alerts);
}

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const role = ((session as any).user?.role as string) || "viewer";
  if (role === "viewer") {
    return NextResponse.json({ error: "Forbidden: viewer cannot resolve alerts" }, { status: 403 });
  }

  const body = await request.json();
  const { id } = body;

  if (!id) {
    return NextResponse.json({ error: "Missing alert id" }, { status: 400 });
  }

  const db = getDb();
  db.prepare("UPDATE alerts SET resolved_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);

  return NextResponse.json({ success: true });
}
