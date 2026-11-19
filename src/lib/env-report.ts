/**
 * Each instance records, when it starts, which environment variables it has (never their
 * values) in the shared database. In the two-container setup the admin panel compares that
 * with its own environment, so it can check the public container's keys without having them.
 */
import { createHmac, randomBytes } from "node:crypto";
import { adminDb, getState, setState } from "@/lib/admin/store";
import { NTFY_VARS, ntfyEnvSummary } from "@/lib/notify";
import { widgetMetas } from "@/widgets/meta";

export interface EnvReport {
  role: string;
  reportedAt: number;
  vars: Record<string, boolean>;
  /**
   * For the variables both containers should share (sharedEnvNames): a keyed hash of each set
   * value, only to tell whether the two containers use the same one. Never sent to the browser.
   */
  fingerprints: Record<string, string>;
  ntfy: ReturnType<typeof ntfyEnvSummary>;
}

/** "public", "admin", or "all" (single container: APP_ROLE unset or anything else). */
export const instanceRole = (): string => (process.env.APP_ROLE === "public" || process.env.APP_ROLE === "admin" ? process.env.APP_ROLE : "all");

/** Keys the widgets fetch data with: needed by every container that renders the site, the preview included. */
export function widgetEnvNames(): string[] {
  return [...new Set(widgetMetas.flatMap((m) => [...(m.requiresEnv ?? []), ...(m.optionalEnv ?? []).map((e) => e.name)]))];
}

/** Should be identical in both containers: the preview's keys, and the salt (same visitor ids). */
export const sharedEnvNames = () => [...widgetEnvNames(), "VISITOR_SALT"];

const FINGERPRINT_KEY = "env.fingerprintKey";

/**
 * HMAC key for the fingerprints, created once in the shared database. A plain hash of a short
 * value (a Steam id, a battle tag) could be reversed by trying candidates; without the key,
 * a copy of a report alone can't. INSERT OR IGNORE: two containers starting at once agree.
 */
function fingerprintKey(): string {
  adminDb()
    .prepare("INSERT OR IGNORE INTO admin_state (key, value, updated_at) VALUES (?, ?, ?)")
    .run(FINGERPRINT_KEY, JSON.stringify(randomBytes(32).toString("base64url")), Date.now());
  return getState<string>(FINGERPRINT_KEY)!.value;
}

const REPORTED = () => [...widgetEnvNames(), ...NTFY_VARS, "VISITOR_SALT", "ADMIN_PASSWORD_HASH"];

export function currentEnvReport(): EnvReport {
  const key = fingerprintKey();
  const fingerprints: Record<string, string> = {};
  for (const name of sharedEnvNames()) {
    const value = process.env[name]?.trim();
    if (value) fingerprints[name] = createHmac("sha256", key).update(`${name}=${value}`).digest("hex").slice(0, 16);
  }
  return {
    role: instanceRole(),
    reportedAt: Date.now(),
    vars: Object.fromEntries(REPORTED().map((name) => [name, !!process.env[name]?.trim()])),
    fingerprints,
    ntfy: ntfyEnvSummary(process.env),
  };
}

const key = (role: string) => `env.report.${role}`;

/** Called once at startup (instrumentation.ts). */
export function recordEnvReport() {
  try {
    const report = currentEnvReport();
    setState(key(report.role), report);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] [Env] Could not store the environment report:`, err);
  }
}

export function readEnvReport(role: string): EnvReport | null {
  return getState<EnvReport>(key(role))?.value ?? null;
}
