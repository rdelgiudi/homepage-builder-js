import { NextResponse } from "next/server";
import { withAdmin } from "@/lib/admin/auth";
import { getConfig } from "@/lib/config";
import { organizeContent } from "@/lib/i18n/organize";
import { publishConfig } from "@/lib/admin/publish";
import { audit, clearDraft, getDraft } from "@/lib/admin/store";
import { strictParseConfig } from "@/lib/schema/parse";

export const dynamic = "force-dynamic";

/** Makes the saved draft the live site. */
export const POST = withAdmin(async () => {
  const stored = getDraft();
  if (!stored) return NextResponse.json({ error: "There is no draft to publish." }, { status: 400 });

  const result = strictParseConfig(stored.value);
  if (!result.config) return NextResponse.json({ error: "The draft has problems.", issues: result.issues }, { status: 400 });

  const previous = getConfig().languages;
  publishConfig(result.config, "Replaced by publish");
  clearDraft();
  audit("config.publish", null, `${result.config.pages.length + 1} page${result.config.pages.length ? "s" : ""}, ${result.config.tabs.length} tabs on the homepage`);

  // A site in several languages keeps its markdown files in one folder per language. The site
  // finds them either way, so a failure here only leaves them where they are.
  let warning: string | undefined;
  try {
    const moved = organizeContent(result.config.languages, previous);
    if (moved.length) audit("content.organize", `${result.config.languages.original}/`, `${moved.length} file${moved.length === 1 ? "" : "s"}`);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] [Content] Could not move files into ${result.config.languages.original}/:`, err instanceof Error ? err.message : err);
    warning = `Published. The markdown files could not be moved into the ${result.config.languages.original} folder (is src/content writable?); they keep working where they are.`;
  }
  return NextResponse.json({ ok: true, published: result.config, warning });
});
