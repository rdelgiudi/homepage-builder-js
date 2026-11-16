import { NextResponse } from "next/server";
import { readJson, withAdmin } from "@/lib/admin/auth";
import { audit, setBlocked } from "@/lib/admin/store";
import { BODY_MAX, COMMENT_STATUSES, commentsDb, NAME_MAX, sanitize, statusCounts, type CommentRow, type CommentStatus } from "@/lib/comments";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

async function find(ctx: Ctx) {
  const id = parseInt((await ctx.params).id, 10);
  if (!Number.isInteger(id)) return null;
  return (commentsDb().prepare("SELECT * FROM comments WHERE id = ?").get(id) as CommentRow | undefined) ?? null;
}

const notFound = () => NextResponse.json({ error: "That comment no longer exists." }, { status: 404 });

/**
 * Change one comment. Any of: { status }, { name, body } (edit the text),
 * { blockAuthor: boolean } (stop / allow further comments from its author).
 */
export const PATCH = withAdmin<Ctx>(async (request, ctx) => {
  const comment = await find(ctx);
  if (!comment) return notFound();
  const body = (await readJson<{ status?: unknown; name?: unknown; body?: unknown; blockAuthor?: unknown }>(request)) ?? {};
  const db = commentsDb();
  const now = Date.now();

  if (typeof body.status === "string") {
    if (!(COMMENT_STATUSES as string[]).includes(body.status)) return NextResponse.json({ error: "Unknown status." }, { status: 400 });
    db.prepare("UPDATE comments SET status = ?, moderated_at = ? WHERE id = ?").run(body.status as CommentStatus, now, comment.id);
    audit(`comment.${body.status === "approved" ? "approve" : body.status === "rejected" ? "reject" : "hold"}`, comment.id, comment.name);
  }

  if (typeof body.name === "string" || typeof body.body === "string") {
    const name = sanitize((typeof body.name === "string" ? body.name : comment.name).trim(), NAME_MAX);
    const text = sanitize((typeof body.body === "string" ? body.body : comment.body).trim(), BODY_MAX);
    if (!name || !text) return NextResponse.json({ error: "Name and comment can't be empty." }, { status: 400 });
    db.prepare("UPDATE comments SET name = ?, body = ?, edited_at = ? WHERE id = ?").run(name, text, now, comment.id);
    audit("comment.edit", comment.id, name);
  }

  if (typeof body.blockAuthor === "boolean") {
    if (!comment.visitor_hash) return NextResponse.json({ error: "This comment predates author tracking, so its author can't be blocked." }, { status: 400 });
    setBlocked(comment.visitor_hash, body.blockAuthor, `comment ${comment.id}`);
    audit(body.blockAuthor ? "comment.block" : "comment.unblock", comment.id, comment.name);
  }

  return NextResponse.json({ ok: true, counts: statusCounts() });
});

export const DELETE = withAdmin<Ctx>(async (_request, ctx) => {
  const comment = await find(ctx);
  if (!comment) return notFound();
  commentsDb().prepare("DELETE FROM comments WHERE id = ?").run(comment.id);
  audit("comment.delete", comment.id, comment.name);
  return NextResponse.json({ ok: true, counts: statusCounts() });
});
