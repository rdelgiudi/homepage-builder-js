import { NextResponse } from "next/server";
import { readJson, withAdmin } from "@/lib/admin/auth";
import { audit } from "@/lib/admin/store";
import { messageCounts, messagesDb, type MessageRow } from "@/lib/messages";

export const dynamic = "force-dynamic";

const PAGE = 100;

/** `?filter=unread|all` (default unread), newest first. `?counts=1` returns only the counts (the nav badge). */
export const GET = withAdmin(async (request) => {
  const params = new URL(request.url).searchParams;
  if (params.get("counts")) return NextResponse.json({ counts: messageCounts() });
  const filter = params.get("filter") === "all" ? "all" : "unread";
  const before = parseInt(params.get("before") ?? "", 10);

  const rows = messagesDb()
    .prepare(
      `SELECT m.*, (b.visitor_hash IS NOT NULL) AS blocked
       FROM messages m LEFT JOIN blocked_visitors b ON b.visitor_hash = m.visitor_hash
       WHERE ${filter === "unread" ? "m.read_at IS NULL AND " : ""}m.id < ? ORDER BY m.id DESC LIMIT ?`
    )
    .all(Number.isFinite(before) ? before : Number.MAX_SAFE_INTEGER, PAGE + 1) as (MessageRow & { blocked: number })[];

  return NextResponse.json({
    filter,
    messages: rows.slice(0, PAGE).map(({ visitor_hash, blocked, ...m }) => ({
      ...m,
      // Same short tag as the comments screen, so one visitor's comments and messages can be matched up.
      author: visitor_hash ? visitor_hash.slice(0, 8) : null,
      blocked: !!blocked,
    })),
    hasMore: rows.length > PAGE,
    counts: messageCounts(),
  });
});

/** Bulk action: { ids, action: "read" | "unread" | "delete" }. */
export const POST = withAdmin(async (request) => {
  const body = await readJson<{ ids?: unknown; action?: unknown }>(request);
  const ids = Array.isArray(body?.ids) ? body.ids.filter((n): n is number => Number.isInteger(n)).slice(0, 500) : [];
  const action = body?.action;
  if (!ids.length || (action !== "read" && action !== "unread" && action !== "delete")) {
    return NextResponse.json({ error: "Choose at least one message and an action." }, { status: 400 });
  }
  const db = messagesDb();
  const stmt =
    action === "delete"
      ? db.prepare("DELETE FROM messages WHERE id = ?")
      : action === "read"
        ? db.prepare(`UPDATE messages SET read_at = ${Date.now()} WHERE id = ? AND read_at IS NULL`)
        : db.prepare("UPDATE messages SET read_at = NULL WHERE id = ?");
  let changed = 0;
  db.transaction(() => {
    for (const id of ids) changed += stmt.run(id).changes;
  })();
  // Reading is routine; only deletions go in the audit log.
  if (action === "delete") audit("message.delete", ids.join(","), `${changed} message${changed === 1 ? "" : "s"}`);
  return NextResponse.json({ ok: true, changed, counts: messageCounts() });
});
