import { NextResponse } from "next/server";
import { withAdmin } from "@/lib/admin/auth";
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

  publishConfig(result.config, "Replaced by publish");
  clearDraft();
  audit("config.publish", null, `${result.config.tabs.length} tabs`);
  return NextResponse.json({ ok: true, published: result.config });
});
