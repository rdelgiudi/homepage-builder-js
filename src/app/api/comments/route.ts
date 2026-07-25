import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { COOKIE_NAME, COOKIE_MAX_AGE, generateVisitorId, hashVisitorId, getVisitorIdFromCookie } from "@/lib/visitor";

export const dynamic = "force-dynamic";

const NAME_MAX = 40;
const BODY_MAX = 500;
const RATE_LIMIT_MS = 5000;
const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

const CONTROL_CHARS = new RegExp("[\\u0000-\\u001f\\u007f]", "g");

const rateLimit = new Map<string, number>();

function getDbWithSchema() {
  const database = getDb();
  database.exec(`
    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  return database;
}

function sanitize(input: string, max: number): string {
  return input.replace(CONTROL_CHARS, "").slice(0, max);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawLimit = parseInt(searchParams.get("limit") || "", 10);
    const limit = Number.isFinite(rawLimit)
      ? Math.min(Math.max(rawLimit, 1), MAX_LIMIT)
      : DEFAULT_LIMIT;

    const database = getDbWithSchema();
    const rows = database
      .prepare("SELECT id, name, body, created_at FROM comments ORDER BY id DESC LIMIT ?")
      .all(limit);

    return NextResponse.json({ comments: rows });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] [Comments] List error:`, err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const database = getDbWithSchema();

    let visitorId = getVisitorIdFromCookie(request.headers.get("cookie"));
    if (!visitorId) visitorId = generateVisitorId();
    const hashedId = hashVisitorId(visitorId);

    const now = Date.now();
    const last = rateLimit.get(hashedId) || 0;
    if (now - last < RATE_LIMIT_MS) {
      return NextResponse.json(
        { error: "Please wait a moment before posting again." },
        { status: 429 }
      );
    }

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const raw = (payload ?? {}) as { name?: unknown; body?: unknown };
    const name = typeof raw.name === "string" ? raw.name.trim() : "";
    const body = typeof raw.body === "string" ? raw.body.trim() : "";

    if (!name || !body) {
      return NextResponse.json({ error: "Name and comment are required." }, { status: 400 });
    }
    if (name.length > NAME_MAX || body.length > BODY_MAX) {
      return NextResponse.json(
        { error: `Name must be <= ${NAME_MAX} chars and comment <= ${BODY_MAX} chars.` },
        { status: 400 }
      );
    }

    const cleanName = sanitize(name, NAME_MAX);
    const cleanBody = sanitize(body, BODY_MAX);

    const info = database
      .prepare("INSERT INTO comments (name, body) VALUES (?, ?)")
      .run(cleanName, cleanBody);

    const row = database
      .prepare("SELECT id, name, body, created_at FROM comments WHERE id = ?")
      .get(info.lastInsertRowid);

    rateLimit.set(hashedId, Date.now());

    const response = NextResponse.json({ comment: row }, { status: 201 });
    response.cookies.set(COOKIE_NAME, visitorId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: COOKIE_MAX_AGE,
      path: "/",
    });
    return response;
  } catch (err) {
    console.error(`[${new Date().toISOString()}] [Comments] Create error:`, err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
