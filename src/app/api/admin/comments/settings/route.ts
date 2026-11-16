import { NextResponse } from "next/server";
import { readJson, withAdmin } from "@/lib/admin/auth";
import { audit } from "@/lib/admin/store";
import { saveModerationSettings } from "@/lib/comments";

export const dynamic = "force-dynamic";

/** Moderation settings take effect immediately — they are not part of the draft. */
export const PUT = withAdmin(async (request) => {
  const settings = saveModerationSettings(await readJson(request));
  audit("comment.settings", null, `mode=${settings.mode}, ${settings.holdWords.length} held words`);
  return NextResponse.json({ ok: true, settings });
});
