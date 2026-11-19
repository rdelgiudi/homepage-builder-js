/**
 * Each instance records, when it starts, which environment variables it has (never their
 * values) in the shared database. In the two-container setup the admin panel compares that
 * with its own environment, so it can check the public container's keys without having them.
 */
import { createHash } from "node:crypto";
import { getState, setState } from "@/lib/admin/store";
import { NTFY_VARS, ntfyEnvSummary } from "@/lib/notify";
import { widgetMetas } from "@/widgets/meta";

export interface EnvReport {
  role: string;
  reportedAt: number;
  vars: Record<string, boolean>;
  /** Short hash of VISITOR_SALT, only to tell whether both containers use the same one. */
  saltCheck: string;
  ntfy: ReturnType<typeof ntfyEnvSummary>;
}

/** "public", "admin", or "all" (single container: APP_ROLE unset or anything else). */
export const instanceRole = (): string => (process.env.APP_ROLE === "public" || process.env.APP_ROLE === "admin" ? process.env.APP_ROLE : "all");

/** Keys the widgets fetch data with: needed by every container that renders the site, the preview included. */
export function widgetEnvNames(): string[] {
  return [...new Set(widgetMetas.flatMap((m) => [...(m.requiresEnv ?? []), ...(m.optionalEnv ?? []).map((e) => e.name)]))];
}

const REPORTED = () => [...widgetEnvNames(), ...NTFY_VARS, "VISITOR_SALT", "ADMIN_PASSWORD_HASH"];

export function currentEnvReport(): EnvReport {
  const salt = process.env.VISITOR_SALT || "default-salt";
  return {
    role: instanceRole(),
    reportedAt: Date.now(),
    vars: Object.fromEntries(REPORTED().map((name) => [name, !!process.env[name]?.trim()])),
    saltCheck: createHash("sha256").update(`salt-check:${salt}`).digest("hex").slice(0, 12),
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
