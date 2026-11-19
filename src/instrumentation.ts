/**
 * Runs once when the server starts (Next.js instrumentation hook).
 * Next also compiles this file for the edge runtime, where `fs` (better-sqlite3) doesn't exist.
 * The Node-only code is removed from that bundle only when the import sits inside exactly this
 * `if` — an early `return` instead breaks every request in `next dev` ("Can't resolve 'fs'").
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { recordEnvReport } = await import("@/lib/env-report");
    recordEnvReport();
  }
}
