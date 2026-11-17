import { NextResponse } from "next/server";
import { readJson, withAdmin } from "@/lib/admin/auth";
import { audit, setBlocked } from "@/lib/admin/store";
import { suggestionCounts, suggestionsDb, type SuggestionRow } from "@/lib/game-suggestions";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

async function find(ctx: Ctx) {
  const id = parseInt((await ctx.params).id, 10);
  if (!Number.isInteger(id)) return null;
  return (suggestionsDb().prepare("SELECT * FROM game_suggestions WHERE id = ?").get(id) as SuggestionRow | undefined) ?? null;
}

const notFound = () => NextResponse.json({ error: "That suggestion no longer exists." }, { status: 404 });

/** { blockAuthor: boolean } — blocks suggestions, messages and comments from that visitor. */
export const PATCH = withAdmin<Ctx>(async (request, ctx) => {
  const row = await find(ctx);
  if (!row) return notFound();
  const body = (await readJson<{ blockAuthor?: unknown }>(request)) ?? {};
  if (typeof body.blockAuthor !== "boolean") return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
  setBlocked(row.visitor_hash, body.blockAuthor, `suggestion ${row.id}`);
  audit(body.blockAuthor ? "suggestion.block" : "suggestion.unblock", row.id, row.name ?? row.visitor_hash.slice(0, 8));
  return NextResponse.json({ ok: true, counts: suggestionCounts() });
});

/** Deletes one visitor's suggestion; the game goes too when it was the last one. */
export const DELETE = withAdmin<Ctx>(async (_request, ctx) => {
  const row = await find(ctx);
  if (!row) return notFound();
  const db = suggestionsDb();
  db.transaction(() => {
    db.prepare("DELETE FROM game_suggestions WHERE id = ?").run(row.id);
    db.prepare("DELETE FROM suggested_games WHERE appid = ? AND NOT EXISTS (SELECT 1 FROM game_suggestions WHERE appid = ?)").run(row.appid, row.appid);
  })();
  audit("suggestion.delete", row.id, row.name ?? row.visitor_hash.slice(0, 8));
  return NextResponse.json({ ok: true, counts: suggestionCounts() });
});
