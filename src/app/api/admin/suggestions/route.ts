import { NextResponse } from "next/server";
import { readJson, withAdmin } from "@/lib/admin/auth";
import { audit } from "@/lib/admin/store";
import { GAME_STATUSES, suggestionCounts, suggestionsDb, type GameStatus, type SuggestionRow } from "@/lib/game-suggestions";

export const dynamic = "force-dynamic";

const MAX_ROWS = 2000;

/**
 * Suggestions grouped by game, most-suggested first. `?filter=new` (default) = games with
 * unread suggestions, `all` = every game. `?counts=1` returns only the counts (the nav badge).
 */
export const GET = withAdmin(async (request) => {
  const params = new URL(request.url).searchParams;
  if (params.get("counts")) return NextResponse.json({ counts: suggestionCounts() });
  const filter = params.get("filter") === "all" ? "all" : "new";

  const rows = suggestionsDb()
    .prepare(
      `SELECT s.*, g.title, g.status, (b.visitor_hash IS NOT NULL) AS blocked
       FROM game_suggestions s
       JOIN suggested_games g ON g.appid = s.appid
       LEFT JOIN blocked_visitors b ON b.visitor_hash = s.visitor_hash
       ${filter === "new" ? "WHERE s.appid IN (SELECT appid FROM game_suggestions WHERE read_at IS NULL)" : ""}
       ORDER BY s.id DESC LIMIT ?`
    )
    .all(MAX_ROWS) as (SuggestionRow & { title: string; status: GameStatus; blocked: number })[];

  const games = new Map<number, { appid: number; title: string; status: GameStatus; unread: number; last: number; suggestions: unknown[] }>();
  for (const { visitor_hash, blocked, title, status, ...s } of rows) {
    let game = games.get(s.appid);
    if (!game) games.set(s.appid, (game = { appid: s.appid, title, status, unread: 0, last: s.created_at, suggestions: [] }));
    if (!s.read_at) game.unread++;
    // Same short tag as the comments and inbox screens, so one visitor can be matched up across them.
    game.suggestions.push({ ...s, author: visitor_hash.slice(0, 8), blocked: !!blocked });
  }

  return NextResponse.json({
    filter,
    games: [...games.values()].sort((a, b) => b.suggestions.length - a.suggestions.length || b.last - a.last),
    counts: suggestionCounts(),
  });
});

/** Game-level action: { appids, action: "read" | "unread" | "delete" | "status", status? }. */
export const POST = withAdmin(async (request) => {
  const body = await readJson<{ appids?: unknown; action?: unknown; status?: unknown }>(request);
  const appids = Array.isArray(body?.appids) ? body.appids.filter((n): n is number => Number.isInteger(n)).slice(0, 500) : [];
  const action = body?.action;
  const status = body?.status;
  if (!appids.length || !(action === "read" || action === "unread" || action === "delete" || action === "status")) {
    return NextResponse.json({ error: "Choose at least one game and an action." }, { status: 400 });
  }
  if (action === "status" && !GAME_STATUSES.includes(status as GameStatus)) return NextResponse.json({ error: "Unknown status." }, { status: 400 });

  const db = suggestionsDb();
  const now = Date.now();
  let changed = 0;
  db.transaction(() => {
    for (const appid of appids) {
      if (action === "read") changed += db.prepare("UPDATE game_suggestions SET read_at = ? WHERE appid = ? AND read_at IS NULL").run(now, appid).changes;
      else if (action === "unread") changed += db.prepare("UPDATE game_suggestions SET read_at = NULL WHERE appid = ?").run(appid).changes;
      else if (action === "status") changed += db.prepare("UPDATE suggested_games SET status = ?, updated_at = ? WHERE appid = ?").run(status, now, appid).changes;
      else {
        changed += db.prepare("DELETE FROM game_suggestions WHERE appid = ?").run(appid).changes;
        db.prepare("DELETE FROM suggested_games WHERE appid = ?").run(appid);
      }
    }
  })();
  if (action === "delete") audit("suggestion.delete", appids.join(","), `${changed} suggestion${changed === 1 ? "" : "s"}`);
  return NextResponse.json({ ok: true, changed, counts: suggestionCounts() });
});
