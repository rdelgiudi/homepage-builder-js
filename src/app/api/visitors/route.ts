import { NextResponse } from "next/server";
import path from "path";
import crypto from "crypto";

const DB_PATH = path.join(process.cwd(), "visitors.db");
const COOKIE_NAME = "visitor_id";
const SALT = process.env.VISITOR_SALT || "default-salt";

let db: import("better-sqlite3").Database | null = null;

function getDb(): NonNullable<typeof db> {
  if (!db) {
    const Database = require("better-sqlite3");
    const database = new Database(DB_PATH);
    database.exec(`
      CREATE TABLE IF NOT EXISTS visitors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        visitor_id TEXT UNIQUE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    database.exec(`
      CREATE INDEX IF NOT EXISTS idx_visitor_id ON visitors(visitor_id)
    `);
    db = database;
  }
  return db!;
}

function generateVisitorId(): string {
  return crypto.randomUUID();
}

function hashVisitorId(visitorId: string): string {
  return crypto.createHash("sha256").update(`${visitorId}:${SALT}`).digest("hex").substring(0, 32);
}

function getVisitorIdFromCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(";").map(c => c.trim());
  for (const cookie of cookies) {
    const [name, value] = cookie.split("=");
    if (name === COOKIE_NAME) return value;
  }
  return null;
}

export async function GET(request: Request) {
  try {
    const database = getDb();
    const visitorId = getVisitorIdFromCookie(request.headers.get("cookie"));
    const hashedId = visitorId ? hashVisitorId(visitorId) : null;

    const isNew = hashedId ? !database.prepare("SELECT id FROM visitors WHERE visitor_id = ?").get(hashedId) : null;

    if (isNew === false) {
      const count = database.prepare("SELECT COUNT(*) as count FROM visitors").get() as { count: number };
      return NextResponse.json({ count: count.count, isNew: false });
    }

    if (isNew === true) {
      const count = database.prepare("SELECT COUNT(*) as count FROM visitors").get() as { count: number };
      return NextResponse.json({ count: count.count, isNew: true });
    }

    return NextResponse.json({ count: 0, isNew: null });
  } catch (err) {
    console.error("Visitor count error:", err);
    return NextResponse.json({ count: 0, error: "Database error" });
  }
}

export async function POST(request: Request) {
  try {
    const database = getDb();
    let visitorId = getVisitorIdFromCookie(request.headers.get("cookie"));
    let isNew = false;

    if (!visitorId) {
      visitorId = generateVisitorId();
    }

    const hashedId = hashVisitorId(visitorId);

    const existing = database.prepare("SELECT id FROM visitors WHERE visitor_id = ?").get(hashedId);
    if (!existing) {
      database.prepare("INSERT INTO visitors (visitor_id) VALUES (?)").run(hashedId);
      isNew = true;
    }

    const count = database.prepare("SELECT COUNT(*) as count FROM visitors").get() as { count: number };

    const response = NextResponse.json({ count: count.count, isNew });

    response.cookies.set(COOKIE_NAME, visitorId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    });

    return response;
  } catch (err) {
    console.error("Visitor tracking error:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
