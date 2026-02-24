import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const isVercel = Boolean(process.env.VERCEL || process.env.VERCEL_ENV);
const DB_PATH = isVercel
  ? path.join("/tmp", "ad-dashboard.db")
  : path.join(process.cwd(), "data", "ad-dashboard.db");

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  // Ensure data directory exists
  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  // Run migrations
  const schemaPath = path.join(process.cwd(), "migrations", "schema.sql");
  if (fs.existsSync(schemaPath)) {
    const schema = fs.readFileSync(schemaPath, "utf-8");
    db.exec(schema);
  }

  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
