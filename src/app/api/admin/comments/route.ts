import { NextResponse } from "next/server";
import { readJson, withAdmin } from "@/lib/admin/auth";
import { audit, listAudit } from "@/lib/admin/store";
import { COMMENT_STATUSES, commentsDb, getModerationSettings, statusCounts, type CommentRow, type CommentStatus } from "@/lib/comments";

export const dynamic = "force-dynamic";

const PAGE = 100;

/** Comments in one status (default: pending), newest first, plus counts, settings and recent activity. */
export const GET = withAdmin(async (request) => {
  const params = new URL(request.url).searchParams;
  const status = (COMMENT_STATUSES as string[]).includes(params.get("status") ?? "") ? (params.get("status") as CommentStatus) : "pending";
  const before = parseInt(params.get("before") ?? "", 10);

  const db = commentsDb();
  const rows = db
    .prepare(
      `SELECT c.*, (b.visitor_hash IS NOT NULL) AS blocked
       FROM comments c LEFT JOIN blocked_visitors b ON b.visitor_hash = c.visitor_hash
       WHERE c.status = ? AND c.id < ? ORDER BY c.id DESC LIMIT ?`
    )
    .all(status, Number.isFinite(before) ? before : Number.MAX_SAFE_INTEGER, PAGE + 1) as (CommentRow & { blocked: number })[];

  return NextResponse.json({
    status,
    comments: rows.slice(0, PAGE).map(({ visitor_hash, blocked, ...c }) => ({
      ...c,
      // A short tag is enough to see which comments share an author; the full hash stays server-side.
      author: visitor_hash ? visitor_hash.slice(0, 8) : null,
      blocked: !!blocked,
    })),
    hasMore: rows.length > PAGE,
    counts: statusCounts(),
    settings: getModerationSettings(),
    activity: listAudit(30, "comment."),
  });
});

/** Bulk action: { ids, action: "approve" | "reject" | "delete" }. */
export const POST = withAdmin(async (request) => {
  const body = await readJson<{ ids?: unknown; action?: unknown }>(request);
  const ids = Array.isArray(body?.ids) ? body.ids.filter((n): n is number => Number.isInteger(n)).slice(0, 500) : [];
  const action = body?.action;
  if (!ids.length || (action !== "approve" && action !== "reject" && action !== "delete")) {
    return NextResponse.json({ error: "Choose at least one comment and an action." }, { status: 400 });
  }

  const db = commentsDb();
  const now = Date.now();
  const stmt =
    action === "delete"
      ? db.prepare("DELETE FROM comments WHERE id = ?")
      : db.prepare(`UPDATE comments SET status = '${action === "approve" ? "approved" : "rejected"}', moderated_at = ${now} WHERE id = ?`);
  let changed = 0;
  db.transaction(() => {
    for (const id of ids) changed += stmt.run(id).changes;
  })();
  audit(`comment.${action}`, ids.join(","), `${changed} comment${changed === 1 ? "" : "s"}`);
  return NextResponse.json({ ok: true, changed, counts: statusCounts() });
});
