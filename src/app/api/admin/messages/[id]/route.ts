import { NextResponse } from "next/server";
import { readJson, withAdmin } from "@/lib/admin/auth";
import { audit, setBlocked } from "@/lib/admin/store";
import { messageCounts, messagesDb, type MessageRow } from "@/lib/messages";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

async function find(ctx: Ctx) {
  const id = parseInt((await ctx.params).id, 10);
  if (!Number.isInteger(id)) return null;
  return (messagesDb().prepare("SELECT * FROM messages WHERE id = ?").get(id) as MessageRow | undefined) ?? null;
}

const notFound = () => NextResponse.json({ error: "That message no longer exists." }, { status: 404 });

/** Any of: { read: boolean }, { blockAuthor: boolean } (blocks comments and messages from that visitor). */
export const PATCH = withAdmin<Ctx>(async (request, ctx) => {
  const message = await find(ctx);
  if (!message) return notFound();
  const body = (await readJson<{ read?: unknown; blockAuthor?: unknown }>(request)) ?? {};

  if (typeof body.read === "boolean") {
    messagesDb().prepare("UPDATE messages SET read_at = ? WHERE id = ?").run(body.read ? message.read_at ?? Date.now() : null, message.id);
  }
  if (typeof body.blockAuthor === "boolean") {
    if (!message.visitor_hash) return NextResponse.json({ error: "This message has no author id, so its author can't be blocked." }, { status: 400 });
    setBlocked(message.visitor_hash, body.blockAuthor, `message ${message.id}`);
    audit(body.blockAuthor ? "message.block" : "message.unblock", message.id, message.name);
  }
  return NextResponse.json({ ok: true, counts: messageCounts() });
});

export const DELETE = withAdmin<Ctx>(async (_request, ctx) => {
  const message = await find(ctx);
  if (!message) return notFound();
  messagesDb().prepare("DELETE FROM messages WHERE id = ?").run(message.id);
  audit("message.delete", message.id, message.name);
  return NextResponse.json({ ok: true, counts: messageCounts() });
});
