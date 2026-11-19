import { NextResponse } from "next/server";
import { withAdmin } from "@/lib/admin/auth";
import { isWritable } from "@/lib/admin/publish";
import { CONFIG_PATH } from "@/lib/config";
import { CONTENT_DIR } from "@/lib/content";
import { DATA_DIR } from "@/lib/db";
import { widgetMetas } from "@/widgets/meta";

export const dynamic = "force-dynamic";

/** Which environment variables are set. Values are never returned. */
export const GET = withAdmin(async () => {
  const isSet = (name: string) => !!process.env[name];
  return NextResponse.json({
    widgets: widgetMetas
      .filter((m) => m.requiresEnv?.length)
      .map((m) => ({ type: m.type, label: m.label, icon: m.icon, env: m.requiresEnv!.map((name) => ({ name, set: isSet(name) })) })),
    general: [
      { name: "ADMIN_PASSWORD_HASH", set: isSet("ADMIN_PASSWORD_HASH"), note: "The admin password is stored as plain text in ADMIN_PASSWORD. Run `npm run admin:hash` to replace it with a hash." },
      { name: "NTFY_TOPIC", set: isSet("NTFY_TOPIC"), note: "Optional: set it (plus NTFY_URL / NTFY_TOKEN) to get an ntfy push for new contact messages, comments and game suggestions (NTFY_EVENTS picks which). In the two-container setup it is read by the public container, so this row may say \"not set\" here even when it works." },
      { name: "VISITOR_SALT", set: isSet("VISITOR_SALT"), note: "Without it, visitor ids are hashed with a public default salt." },
    ],
    storage: [
      { label: "Site config", path: CONFIG_PATH, writable: isWritable(CONFIG_PATH) },
      { label: "Markdown content", path: CONTENT_DIR, writable: isWritable(CONTENT_DIR) },
      { label: "Runtime data", path: DATA_DIR, writable: isWritable(DATA_DIR) },
    ],
    role: process.env.APP_ROLE || "all",
  });
});
