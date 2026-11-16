import { NextResponse } from "next/server";
import { readJson, withAdmin } from "@/lib/admin/auth";
import { audit, getRevision, listRevisions, saveDraft } from "@/lib/admin/store";
import { parseConfig } from "@/lib/schema/parse";

export const dynamic = "force-dynamic";

function summarize(content: string) {
  try {
    const raw = JSON.parse(content) as { name?: unknown; tabs?: unknown };
    const tabs = Array.isArray(raw.tabs) ? raw.tabs : [];
    const sections = tabs.reduce((n: number, t) => n + (Array.isArray((t as { sections?: unknown })?.sections) ? (t as { sections: unknown[] }).sections.length : 0), 0);
    return { name: typeof raw.name === "string" ? raw.name : "", tabs: tabs.length, sections };
  } catch {
    return { name: "", tabs: 0, sections: 0 };
  }
}

/** Earlier versions of homepage.json, newest first. Each was live until the next publish. */
export const GET = withAdmin(async () => {
  return NextResponse.json({
    revisions: listRevisions().map((r) => ({ id: r.id, createdAt: r.created_at, note: r.note, bytes: r.content.length, ...summarize(r.content) })),
  });
});

/** Loads a revision into the draft. Nothing goes live until it is published. */
export const POST = withAdmin(async (request) => {
  const body = await readJson<{ id?: unknown }>(request);
  const revision = typeof body?.id === "number" ? getRevision(body.id) : undefined;
  if (!revision) return NextResponse.json({ error: "That version no longer exists." }, { status: 404 });

  let config = null;
  try {
    config = parseConfig(JSON.parse(revision.content)).config;
  } catch {}
  if (!config) return NextResponse.json({ error: "That version can't be read as a config." }, { status: 400 });

  const updatedAt = saveDraft(config);
  audit("config.restore", revision.id);
  return NextResponse.json({ ok: true, draft: config, updatedAt });
});
