import { NextResponse } from "next/server";
import { COOKIE_NAME, COOKIE_MAX_AGE, generateVisitorId, hashVisitorId, getVisitorIdFromCookie } from "@/lib/visitor";
import { isBlocked } from "@/lib/admin/store";
import { BODY_MAX, NAME_MAX, commentsDb, initialStatus, sanitize } from "@/lib/comments";

export const dynamic = "force-dynamic";

const RATE_LIMIT_MS = 5000;
const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

const rateLimit = new Map<string, number>();

interface PublicRow {
  id: number;
  name: string;
  body: string;
  created_at: string;
  status: string;
}

/** What a visitor may see of a comment: no author hash, and `pending` only as a flag. */
function toPublic({ status, ...row }: PublicRow) {
  return status === "pending" ? { ...row, pending: true } : row;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawLimit = parseInt(searchParams.get("limit") || "", 10);
    const limit = Number.isFinite(rawLimit)
      ? Math.min(Math.max(rawLimit, 1), MAX_LIMIT)
      : DEFAULT_LIMIT;

    // Approved comments for everyone, plus the visitor's own comments still awaiting approval.
    const visitorId = getVisitorIdFromCookie(request.headers.get("cookie"));
    const hashedId = visitorId ? hashVisitorId(visitorId) : "";

    const rows = commentsDb()
      .prepare(
        `SELECT id, name, body, created_at, status FROM comments
         WHERE status = 'approved' OR (status = 'pending' AND visitor_hash = ?)
         ORDER BY id DESC LIMIT ?`
      )
      .all(hashedId, limit) as PublicRow[];

    return NextResponse.json({ comments: rows.map(toPublic) });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] [Comments] List error:`, err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const database = commentsDb();

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

    if (isBlocked(hashedId)) {
      return NextResponse.json({ error: "Commenting is not available." }, { status: 403 });
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
    const status = initialStatus(cleanName, cleanBody);

    const info = database
      .prepare("INSERT INTO comments (name, body, status, visitor_hash) VALUES (?, ?, ?, ?)")
      .run(cleanName, cleanBody, status, hashedId);

    const row = database
      .prepare("SELECT id, name, body, created_at, status FROM comments WHERE id = ?")
      .get(info.lastInsertRowid) as PublicRow;

    rateLimit.set(hashedId, Date.now());

    const response = NextResponse.json({ comment: toPublic(row) }, { status: 201 });
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
