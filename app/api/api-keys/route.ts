import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/crypto";
import { v4 as uuidv4 } from "uuid";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as Record<string, unknown>).role;
  if (role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const db = getDb();
  const keys = db
    .prepare("SELECT id, platform, key_name, created_at, updated_at FROM api_keys ORDER BY created_at DESC")
    .all();

  return NextResponse.json(keys);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as Record<string, unknown>).role;
  if (role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { platform, key_name, credentials } = body;

  if (!platform || !key_name || !credentials) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Validate platform-specific fields
  if (platform === "google_ads") {
    const required = ["developer_token", "client_id", "client_secret", "refresh_token"];
    for (const field of required) {
      if (!credentials[field]) {
        return NextResponse.json({ error: `Missing ${field}` }, { status: 400 });
      }
    }
  } else if (platform === "meta_ads") {
    const required = ["app_id", "app_secret", "access_token"];
    for (const field of required) {
      if (!credentials[field]) {
        return NextResponse.json({ error: `Missing ${field}` }, { status: 400 });
      }
    }
  }

  const db = getDb();
  const id = uuidv4();
  const encryptedData = encrypt(JSON.stringify(credentials));

  db.prepare(
    `INSERT INTO api_keys (id, platform, key_name, encrypted_data, created_by)
     VALUES (?, ?, ?, ?, ?)`
  ).run(id, platform, key_name, encryptedData, session.user?.id || null);

  return NextResponse.json({ id, platform, key_name }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as Record<string, unknown>).role;
  if (role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const db = getDb();
  db.prepare("DELETE FROM api_keys WHERE id = ?").run(id);

  return NextResponse.json({ success: true });
}
