import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  role: "admin" | "editor" | "viewer";
  created_at: string;
}

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = (session.user as Record<string, string>).role;
  if (role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const db = getDb();
  const users = db
    .prepare(
      "SELECT id, email, name, role, created_at FROM users ORDER BY created_at DESC"
    )
    .all() as UserRow[];

  return NextResponse.json(users);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = (session.user as Record<string, string>).role;
  if (role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as {
    name?: string;
    email?: string;
    password?: string;
    role?: "admin" | "editor" | "viewer";
  };

  if (!body.name || !body.email || !body.password || !body.role) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const db = getDb();
  const exists = db
    .prepare("SELECT id FROM users WHERE email = ?")
    .get(body.email) as { id: string } | undefined;
  if (exists) {
    return NextResponse.json({ error: "Email already exists" }, { status: 409 });
  }

  const id = uuidv4();
  const passwordHash = bcrypt.hashSync(body.password, 10);

  db.prepare(
    "INSERT INTO users (id, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)"
  ).run(id, body.email, passwordHash, body.name, body.role);

  const user = db
    .prepare("SELECT id, email, name, role, created_at FROM users WHERE id = ?")
    .get(id) as UserRow;

  return NextResponse.json(user, { status: 201 });
}
