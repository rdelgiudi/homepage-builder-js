import { NextResponse } from "next/server";
import { COOKIE_MAX_AGE, COOKIE_NAME, generateVisitorId, getVisitorIdFromCookie, hashVisitorId } from "@/lib/visitor";
import { isCachedSearch, searchSteam, searchTerm } from "@/lib/game-suggestions";
import { findSection, WidgetError } from "@/lib/widget-data";

export const dynamic = "force-dynamic";

/** Per visitor: this many searches per minute (the widget debounces typing)… */
const VISITOR_LIMIT = 30;
/** …and this many searches that actually reach Steam per minute from everyone together. */
const GLOBAL_LIMIT = 60;
const WINDOW_MS = 60 * 1000;

const byVisitor = new Map<string, number[]>();
let upstream: number[] = [];

const error = (message: string, status: number) => NextResponse.json({ error: message }, { status });

/**
 * `?id=<game-suggest section id>&q=<term>` → up to 10 Steam store matches.
 * Only answers for a game-suggest widget that is on the site, so it isn't an open Steam search.
 */
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    try {
      findSection(params.get("id"), "game-suggest");
    } catch (err) {
      if (err instanceof WidgetError) return error(err.message, err.status);
      throw err;
    }
    const term = searchTerm(params.get("q"));
    if (!term) return error("Type at least 2 characters.", 400);

    const now = Date.now();
    // A first search gets a visitor cookie (like the other visitor routes), so the per-visitor
    // limit applies from the next one; a client that drops cookies is held by the global cap.
    const existing = getVisitorIdFromCookie(request.headers.get("cookie"));
    const visitorId = existing ?? generateVisitorId();
    const key = hashVisitorId(visitorId);
    const recent = (byVisitor.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
    if (recent.length >= VISITOR_LIMIT) return error("Searching too fast. Wait a moment and try again.", 429);
    recent.push(now);
    byVisitor.set(key, recent);
    if (byVisitor.size > 5000) for (const [k, v] of byVisitor) if (!v.some((t) => now - t < WINDOW_MS)) byVisitor.delete(k);

    if (!isCachedSearch(term)) {
      upstream = upstream.filter((t) => now - t < WINDOW_MS);
      if (upstream.length >= GLOBAL_LIMIT) return error("Lots of people are searching right now. Try again in a minute.", 429);
      upstream.push(now);
    }

    const results = await searchSteam(term);
    const response = NextResponse.json({ results });
    if (!existing) response.cookies.set(COOKIE_NAME, visitorId, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: COOKIE_MAX_AGE, path: "/" });
    return response;
  } catch (err) {
    if (err instanceof WidgetError) return error("The Steam store could not be searched right now.", 502);
    console.error(`[${new Date().toISOString()}] [Suggestions] Search error:`, err);
    return error("The Steam store could not be searched right now.", 500);
  }
}
