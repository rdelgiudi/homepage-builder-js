import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { COOKIE_NAME, COOKIE_MAX_AGE, generateVisitorId, hashVisitorId, getVisitorIdFromCookie } from "@/lib/visitor";

const FLUSH_INTERVAL_MS = 2000;

let pendingWrites = new Set<string>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function getDbWithSchema() {
  const database = getDb();
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
  return database;
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushPending();
  }, FLUSH_INTERVAL_MS);
}

function flushPending() {
  if (pendingWrites.size === 0) return;
  const batch = Array.from(pendingWrites);
  pendingWrites = new Set();
  try {
    const database = getDbWithSchema();
    const insert = database.prepare(
      "INSERT OR IGNORE INTO visitors (visitor_id) VALUES (?)"
    );
    const tx = database.transaction((ids: string[]) => {
      for (const id of ids) insert.run(id);
    });
    tx(batch);
  } catch (err) {
    console.error("Visitor flush error:", err);
  }
}

function enqueueVisitor(hashedId: string) {
  pendingWrites.add(hashedId);
  scheduleFlush();
}

export async function GET(request: Request) {
  try {
    const database = getDbWithSchema();
    const visitorId = getVisitorIdFromCookie(request.headers.get("cookie"));
    const hashedId = visitorId ? hashVisitorId(visitorId) : null;

    const isNew = hashedId ? !database.prepare("SELECT id FROM visitors WHERE visitor_id = ?").get(hashedId) : null;

    if (isNew === false) {
      const count = database.prepare("SELECT COUNT(*) as count FROM visitors").get() as { count: number };
      return NextResponse.json({ count: count.count + pendingWrites.size, isNew: false });
    }

    if (isNew === true) {
      const count = database.prepare("SELECT COUNT(*) as count FROM visitors").get() as { count: number };
      return NextResponse.json({ count: count.count + pendingWrites.size, isNew: true });
    }

    return NextResponse.json({ count: 0, isNew: null });
  } catch (err) {
    console.error("Visitor count error:", err);
    return NextResponse.json({ count: 0, error: "Database error" });
  }
}

export async function POST(request: Request) {
  try {
    const database = getDbWithSchema();
    let visitorId = getVisitorIdFromCookie(request.headers.get("cookie"));
    let isNew = false;

    if (!visitorId) {
      visitorId = generateVisitorId();
    }

    const hashedId = hashVisitorId(visitorId);

    const existing = database.prepare("SELECT id FROM visitors WHERE visitor_id = ?").get(hashedId);
    if (!existing) {
      enqueueVisitor(hashedId);
      isNew = true;
    }

    const count = database.prepare("SELECT COUNT(*) as count FROM visitors").get() as { count: number };

    const response = NextResponse.json({ count: count.count + pendingWrites.size, isNew, visitorId });

    response.cookies.set(COOKIE_NAME, visitorId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: COOKIE_MAX_AGE,
      path: "/",
    });

    return response;
  } catch (err) {
    console.error("Visitor tracking error:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
