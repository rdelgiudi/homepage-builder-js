import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import {
  COOKIE_NAME,
  COOKIE_MAX_AGE,
  generateVisitorId,
  hashVisitorId,
  getVisitorIdFromCookie,
} from "@/lib/visitor";
import { DEFAULT_EMOJIS } from "@/lib/reactions";
import { broadcastReaction } from "@/lib/reaction-bus";

export const dynamic = "force-dynamic";

const ALLOWED_EMOJIS = DEFAULT_EMOJIS;
const RATE_LIMIT_MS = 250;
const rateLimit = new Map<string, number>();

function getDbWithSchema() {
  const database = getDb();
  database.exec(`
    CREATE TABLE IF NOT EXISTS reactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      emoji TEXT NOT NULL,
      visitor_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(emoji, visitor_hash)
    )
  `);
  return database;
}

function getCounts(database: ReturnType<typeof getDb>): { emoji: string; count: number }[] {
  return database
    .prepare("SELECT emoji, COUNT(*) as count FROM reactions GROUP BY emoji")
    .all() as { emoji: string; count: number }[];
}

function getReacted(database: ReturnType<typeof getDb>, hashedId: string): string[] {
  const rows = database
    .prepare("SELECT emoji FROM reactions WHERE visitor_hash = ?")
    .all(hashedId) as { emoji: string }[];
  return rows.map((r) => r.emoji);
}

function getVisitor(request: Request): { visitorId: string; hashedId: string } {
  let visitorId = getVisitorIdFromCookie(request.headers.get("cookie"));
  if (!visitorId) visitorId = generateVisitorId();
  const hashedId = hashVisitorId(visitorId);
  return { visitorId, hashedId };
}

function setVisitorCookie(response: NextResponse, visitorId: string) {
  response.cookies.set(COOKIE_NAME, visitorId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });
}

export async function GET(request: Request) {
  try {
    const database = getDbWithSchema();
    const { hashedId } = getVisitor(request);
    return NextResponse.json({
      counts: getCounts(database),
      reacted: getReacted(database, hashedId),
    });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] [Reactions] List error:`, err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const database = getDbWithSchema();
    const { visitorId, hashedId } = getVisitor(request);

    const now = Date.now();
    const last = rateLimit.get(hashedId) || 0;
    if (now - last < RATE_LIMIT_MS) {
      return NextResponse.json(
        { error: "Please wait a moment before reacting again." },
        { status: 429 }
      );
    }

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const emoji = (payload as { emoji?: unknown })?.emoji;
    if (typeof emoji !== "string" || !ALLOWED_EMOJIS.includes(emoji)) {
      return NextResponse.json({ error: "Invalid emoji" }, { status: 400 });
    }

    try {
      const info = database
        .prepare("INSERT OR IGNORE INTO reactions (emoji, visitor_hash) VALUES (?, ?)")
        .run(emoji, hashedId);
      // A new row means a genuinely new reaction — broadcast it (with the
      // updated counts) to everyone so all viewers' counters stay in sync.
      if (info.changes > 0) {
        broadcastReaction(emoji, getCounts(database), "add");
      }
    } catch {
      // Unique constraint: visitor already reacted with this emoji — ignore.
    }

    rateLimit.set(hashedId, Date.now());

    const response = NextResponse.json(
      { counts: getCounts(database), reacted: getReacted(database, hashedId) },
      { status: 200 }
    );
    setVisitorCookie(response, visitorId);
    return response;
  } catch (err) {
    console.error(`[${new Date().toISOString()}] [Reactions] Create error:`, err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const database = getDbWithSchema();
    const { visitorId, hashedId } = getVisitor(request);

    const now = Date.now();
    const last = rateLimit.get(hashedId) || 0;
    if (now - last < RATE_LIMIT_MS) {
      return NextResponse.json(
        { error: "Please wait a moment before reacting again." },
        { status: 429 }
      );
    }

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const emoji = (payload as { emoji?: unknown })?.emoji;
    if (typeof emoji !== "string" || !ALLOWED_EMOJIS.includes(emoji)) {
      return NextResponse.json({ error: "Invalid emoji" }, { status: 400 });
    }

    const info = database
      .prepare("DELETE FROM reactions WHERE emoji = ? AND visitor_hash = ?")
      .run(emoji, hashedId);
    // A removed row means the visitor un-reacted — broadcast the updated
    // counts so other viewers' counters decrement too.
    if (info.changes > 0) {
      broadcastReaction(emoji, getCounts(database), "remove");
    }

    rateLimit.set(hashedId, Date.now());

    const response = NextResponse.json(
      { counts: getCounts(database), reacted: getReacted(database, hashedId) },
      { status: 200 }
    );
    setVisitorCookie(response, visitorId);
    return response;
  } catch (err) {
    console.error(`[${new Date().toISOString()}] [Reactions] Delete error:`, err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
