import { NextResponse } from "next/server";
import { COOKIE_NAME, COOKIE_MAX_AGE, generateVisitorId, hashVisitorId, getVisitorIdFromCookie } from "@/lib/visitor";
import { isBlocked } from "@/lib/admin/store";
import { cleanText } from "@/lib/messages";
import { NAME_MAX, NOTE_MAX, steamApp, suggestionsDb, topSuggested } from "@/lib/game-suggestions";
import { findSection, WidgetError } from "@/lib/widget-data";

export const dynamic = "force-dynamic";

/** One suggestion per visitor per 20 s… */
const VISITOR_INTERVAL_MS = 20 * 1000;
/** …and at most this many from everyone together per window, since a new cookie is a new visitor. */
const GLOBAL_LIMIT = 30;
const GLOBAL_WINDOW_MS = 10 * 60 * 1000;

const lastByVisitor = new Map<string, number>();
let recent: number[] = [];

const error = (message: string, status: number) => NextResponse.json({ error: message }, { status });

/** `?id=<section id>` → the public top list, when that widget shows one. */
export async function GET(request: Request) {
  try {
    const section = findSection(new URL(request.url).searchParams.get("id"), "game-suggest");
    if (!section.showList) return NextResponse.json({ games: [] });
    return NextResponse.json({ games: topSuggested(10) });
  } catch (err) {
    if (err instanceof WidgetError) return error(err.message, err.status);
    console.error(`[${new Date().toISOString()}] [Suggestions] List error:`, err);
    return error("The list could not be loaded.", 500);
  }
}

/** Body `{ id, appid, name?, note?, website? }`. `id` is the game-suggest widget's section id. */
export async function POST(request: Request) {
  try {
    const raw = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!raw) return error("Invalid request body.", 400);
    const section = findSection(typeof raw.id === "string" ? raw.id : null, "game-suggest");

    const existing = getVisitorIdFromCookie(request.headers.get("cookie"));
    const visitorId = existing ?? generateVisitorId();
    const hashedId = hashVisitorId(visitorId);
    // Every answer carries a new visitor's cookie, so the per-visitor limit holds for their next try too.
    const withCookie = (response: NextResponse) => {
      if (!existing) response.cookies.set(COOKIE_NAME, visitorId, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: COOKIE_MAX_AGE, path: "/" });
      return response;
    };
    const fail = (message: string, status: number) => withCookie(error(message, status));
    const ok = (again = false) => withCookie(NextResponse.json({ ok: true, again }, { status: again ? 200 : 201 }));

    // Honeypot: a field people never see. A bot that fills it is told it worked, and nothing is stored.
    if (typeof raw.website === "string" && raw.website.trim()) return ok();

    const appid = raw.appid;
    if (typeof appid !== "number" || !Number.isInteger(appid) || appid < 1 || appid > 2 ** 31) return fail("Pick a game from the search results.", 400);

    if (isBlocked(hashedId)) return fail("Sending suggestions is not available.", 403);

    const now = Date.now();
    if (now - (lastByVisitor.get(hashedId) ?? 0) < VISITOR_INTERVAL_MS) return fail("Please wait a little before suggesting another game.", 429);
    recent = recent.filter((t) => now - t < GLOBAL_WINDOW_MS);
    if (recent.length >= GLOBAL_LIMIT) return fail("Lots of suggestions right now. Please try again later.", 429);

    // Count the attempt before asking Steam, so failed lookups can't be used to hammer the store.
    lastByVisitor.set(hashedId, now);
    recent.push(now);
    if (lastByVisitor.size > 5000) for (const [k, t] of lastByVisitor) if (now - t >= VISITOR_INTERVAL_MS) lastByVisitor.delete(k);

    const name = section.askName && typeof raw.name === "string" ? cleanText(raw.name, NAME_MAX + 1) : "";
    const note = typeof raw.note === "string" ? cleanText(raw.note, NOTE_MAX + 1, true) : "";
    if (name.length > NAME_MAX || note.length > NOTE_MAX) return fail(`The name can be up to ${NAME_MAX} characters and the note up to ${NOTE_MAX}.`, 400);

    // The title comes from Steam, never from the request.
    const app = await steamApp(appid).catch(() => undefined);
    if (app === undefined) return fail("Steam could not be reached to check that game. Please try again later.", 502);
    if (!app) return fail("That isn't a game on the Steam store.", 400);

    const db = suggestionsDb();
    let again = false;
    db.transaction(() => {
      again = !!db.prepare("SELECT 1 FROM game_suggestions WHERE appid = ? AND visitor_hash = ?").get(app.appid, hashedId);
      // Suggesting the same game again replaces the visitor's earlier note and marks it unread.
      db.prepare(
        `INSERT INTO game_suggestions (section_id, appid, name, note, created_at, visitor_hash) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (appid, visitor_hash) DO UPDATE SET name = excluded.name, note = excluded.note, created_at = excluded.created_at, read_at = NULL, section_id = excluded.section_id`
      ).run(section.id, app.appid, name || null, note || null, now, hashedId);
      db.prepare("INSERT INTO suggested_games (appid, title, status, updated_at) VALUES (?, ?, 'open', ?) ON CONFLICT (appid) DO UPDATE SET title = excluded.title").run(app.appid, app.title, now);
    })();
    return ok(again);
  } catch (err) {
    if (err instanceof WidgetError) return error(err.message, err.status);
    console.error(`[${new Date().toISOString()}] [Suggestions] Error:`, err);
    return error("Your suggestion could not be saved. Please try again later.", 500);
  }
}
