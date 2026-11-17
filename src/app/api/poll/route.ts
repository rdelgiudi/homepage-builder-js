import { NextResponse } from "next/server";
import { adminDb } from "@/lib/admin/store";
import { COOKIE_NAME, COOKIE_MAX_AGE, generateVisitorId, hashVisitorId, getVisitorIdFromCookie } from "@/lib/visitor";
import { findSection, WidgetError } from "@/lib/widget-data";

export const dynamic = "force-dynamic";

const RATE_LIMIT_MS = 1000;
const lastVote = new Map<string, number>();
let ready = false;

function db() {
  const database = adminDb();
  if (!ready) {
    database.exec(`
      CREATE TABLE IF NOT EXISTS poll_votes (
        poll_id TEXT NOT NULL,
        visitor_hash TEXT NOT NULL,
        option TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        PRIMARY KEY (poll_id, visitor_hash)
      )
    `);
    ready = true;
  }
  return database;
}

/** Counts for the poll's current options (votes for options that were since removed are not shown). */
function results(pollId: string, options: string[], hashedId: string | null) {
  const rows = db().prepare("SELECT option, COUNT(*) AS n FROM poll_votes WHERE poll_id = ? GROUP BY option").all(pollId) as { option: string; n: number }[];
  const byOption = new Map(rows.map((r) => [r.option, r.n]));
  const counts = options.map((o) => byOption.get(o) ?? 0);
  const mine = hashedId ? (db().prepare("SELECT option FROM poll_votes WHERE poll_id = ? AND visitor_hash = ?").get(pollId, hashedId) as { option: string } | undefined) : undefined;
  return { counts, total: counts.reduce((a, b) => a + b, 0), voted: mine && options.includes(mine.option) ? mine.option : null };
}

const fail = (err: unknown) => {
  if (err instanceof WidgetError) return NextResponse.json({ error: err.message }, { status: err.status });
  console.error(`[${new Date().toISOString()}] [Poll] Error:`, err);
  return NextResponse.json({ error: "Database error" }, { status: 500 });
};

export async function GET(request: Request) {
  try {
    const section = findSection(new URL(request.url).searchParams.get("id"), "poll");
    const visitorId = getVisitorIdFromCookie(request.headers.get("cookie"));
    return NextResponse.json(results(section.id, section.options, visitorId ? hashVisitorId(visitorId) : null));
  } catch (err) {
    return fail(err);
  }
}

/** Body `{ id, option }`. One vote per visitor per poll; voting again changes it. */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as { id?: unknown; option?: unknown } | null;
    const section = findSection(typeof body?.id === "string" ? body.id : null, "poll");
    if (typeof body?.option !== "string" || !section.options.includes(body.option)) {
      return NextResponse.json({ error: "That is not one of the options." }, { status: 400 });
    }

    let visitorId = getVisitorIdFromCookie(request.headers.get("cookie"));
    if (!visitorId) visitorId = generateVisitorId();
    const hashedId = hashVisitorId(visitorId);

    const now = Date.now();
    if (now - (lastVote.get(hashedId) ?? 0) < RATE_LIMIT_MS) return NextResponse.json({ error: "One moment…" }, { status: 429 });
    lastVote.set(hashedId, now);

    db()
      .prepare("INSERT INTO poll_votes (poll_id, visitor_hash, option, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(poll_id, visitor_hash) DO UPDATE SET option = excluded.option, created_at = excluded.created_at")
      .run(section.id, hashedId, body.option, now);

    const response = NextResponse.json(results(section.id, section.options, hashedId));
    response.cookies.set(COOKIE_NAME, visitorId, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: COOKIE_MAX_AGE, path: "/" });
    return response;
  } catch (err) {
    return fail(err);
  }
}
