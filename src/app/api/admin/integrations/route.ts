import { NextResponse } from "next/server";
import { withAdmin } from "@/lib/admin/auth";
import { isWritable } from "@/lib/admin/publish";
import { CONFIG_PATH } from "@/lib/config";
import { CONTENT_DIR } from "@/lib/content";
import { DATA_DIR } from "@/lib/db";
import { widgetMetas } from "@/widgets/meta";
import { currentEnvReport, instanceRole, readEnvReport, type EnvReport } from "@/lib/env-report";
import { readNotifyStatus } from "@/lib/notify-admin";

export const dynamic = "force-dynamic";

/** true / false = set or not; null = that container hasn't reported; "na" = not needed there. */
type Cell = boolean | null | "na";

const NTFY_NOTES: Record<string, { note: string; optional?: boolean }> = {
  NTFY_TOPIC: { note: "Unset = no notifications." },
  NTFY_URL: { note: "Unset = https://ntfy.sh.", optional: true },
  NTFY_TOKEN: { note: "Only for a protected topic.", optional: true },
  NTFY_CLICK: { note: "Link opened when a notification is tapped.", optional: true },
  NTFY_EVENTS: { note: "Unset = messages, comments and game suggestions.", optional: true },
};

/**
 * Which environment variables are set. Values are never returned.
 *
 * In the two-container setup (this instance is APP_ROLE=admin) there are two columns: the
 * public container's answers come from the report it stored in the shared database at startup
 * (lib/env-report.ts), the admin column is this process. Keys the preview needs are checked in
 * both and compared by keyed hash (`mismatch` = set in both, different values); NTFY_* only
 * where notifications are sent (public), ADMIN_PASSWORD_HASH only here.
 */
export const GET = withAdmin(async () => {
  const role = instanceRole();
  const split = role === "admin";
  const here = currentEnvReport();
  const pub: EnvReport | null = split ? readEnvReport("public") : null;
  const columns = split ? ["Public", "Admin"] : ["This server"];

  const inPublic = (name: string): Cell => (pub ? !!pub.vars[name] : null);
  const both = (name: string): Cell[] => (split ? [inPublic(name), here.vars[name]] : [here.vars[name]]);
  /** Set in both containers, to different values (compared by keyed hash; reports from older builds have none). */
  const differs = (name: string) => {
    const a = pub?.fingerprints?.[name];
    const b = here.fingerprints[name];
    return split && !!a && !!b && a !== b;
  };

  // Notifications: one check, on whichever instance sends them.
  const sender = split ? pub : here;
  const status = readNotifyStatus();

  return NextResponse.json({
    role,
    columns,
    publicReportedAt: pub?.reportedAt ?? null,
    widgets: widgetMetas
      .filter((m) => m.requiresEnv?.length || m.optionalEnv?.length)
      .map((m) => ({
        type: m.type,
        label: m.label,
        icon: m.icon,
        env: [
          ...(m.requiresEnv ?? []).map((name) => ({ name, cells: both(name), mismatch: differs(name) })),
          ...(m.optionalEnv ?? []).map((e) => ({ name: e.name, optional: true, note: e.note, cells: both(e.name), mismatch: differs(e.name) })),
        ],
      })),
    general: [
      {
        name: "VISITOR_SALT",
        note: "Without it, visitor ids are hashed with a public default salt.",
        cells: both("VISITOR_SALT"),
        // Same comments, votes and blocks only work when both hash visitors the same way.
        mismatch: differs("VISITOR_SALT"),
      },
      {
        name: "ADMIN_PASSWORD_HASH",
        note: "The admin password is stored as plain text in ADMIN_PASSWORD. Run `npm run admin:hash` to replace it with a hash.",
        cells: split ? ["na", here.vars.ADMIN_PASSWORD_HASH] : [here.vars.ADMIN_PASSWORD_HASH],
      },
    ],
    notifications: {
      where: split ? "Public" : "This server",
      reported: !!sender,
      valid: sender?.ntfy.valid ?? false,
      events: sender?.ntfy.events ?? [],
      vars: Object.entries(NTFY_NOTES).map(([name, n]) => ({ name, ...n, cells: [sender ? !!sender.vars[name] : null] as Cell[] })),
      lastSent: status?.lastSent ?? null,
      lastError: status?.lastError ?? null,
    },
    storage: [
      { label: "Site config", path: CONFIG_PATH, writable: isWritable(CONFIG_PATH) },
      { label: "Markdown content", path: CONTENT_DIR, writable: isWritable(CONTENT_DIR) },
      { label: "Runtime data", path: DATA_DIR, writable: isWritable(DATA_DIR) },
    ],
  });
});
