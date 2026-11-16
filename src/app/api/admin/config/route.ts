import { NextResponse } from "next/server";
import { readJson, withAdmin } from "@/lib/admin/auth";
import { isWritable, readPublishedRaw } from "@/lib/admin/publish";
import { clearDraft, getDraft, saveDraft } from "@/lib/admin/store";
import { CONFIG_PATH, getDefaultConfig } from "@/lib/config";
import { parseConfig, strictParseConfig } from "@/lib/schema/parse";

export const dynamic = "force-dynamic";

/** The live config, the draft (if any), and anything wrong with the file on disk. */
export const GET = withAdmin(async () => {
  const raw = readPublishedRaw();
  let published = getDefaultConfig();
  const problems: string[] = [];
  if (raw === null) {
    problems.push("homepage.json does not exist yet. Publishing creates it.");
  } else {
    try {
      const parsed = parseConfig(JSON.parse(raw));
      problems.push(...parsed.errors, ...parsed.warnings);
      if (parsed.config) published = parsed.config;
    } catch (err) {
      problems.push(`homepage.json is not valid JSON: ${err instanceof Error ? err.message : err}`);
    }
  }

  const stored = getDraft();
  // A draft saved by an older version of the schema is upgraded on the way out.
  const draft = stored ? parseConfig(stored.value).config : null;

  return NextResponse.json({
    published,
    problems,
    draft,
    draftUpdatedAt: draft ? stored!.updatedAt : null,
    writable: isWritable(CONFIG_PATH),
  });
});

/** Saves the draft. The body must be a complete, valid config. */
export const PUT = withAdmin(async (request) => {
  const body = await readJson<{ config?: unknown }>(request);
  const result = strictParseConfig(body?.config);
  if (!result.config) return NextResponse.json({ error: "The config has problems.", issues: result.issues }, { status: 400 });
  const updatedAt = saveDraft(result.config);
  return NextResponse.json({ ok: true, updatedAt });
});

/** Discards the draft. */
export const DELETE = withAdmin(async () => {
  clearDraft();
  return NextResponse.json({ ok: true });
});
