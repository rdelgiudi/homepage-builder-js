/**
 * Sends ntfy notifications and records the last result in the shared database, so the admin
 * panel can show it even when another container (the public one) does the sending.
 * Which NTFY_* variables that container has is in its env report (env-report.ts).
 */
import { getState, setState } from "@/lib/admin/store";
import { buildNtfyRequest, enabledKinds, type Notice } from "@/lib/notify";

export const NOTIFY_STATUS_KEY = "notify.status";

export interface NotifyStatus {
  lastSent?: number;
  lastError?: { at: number; text: string };
}

/** At most this many pushes per window from all kinds together; the comment route has no global cap of its own. */
const PUSH_LIMIT = 30;
const PUSH_WINDOW_MS = 10 * 60 * 1000;

const log = (...args: unknown[]) => console.error(`[${new Date().toISOString()}] [Notify]`, ...args);

export function readNotifyStatus(): NotifyStatus | null {
  return getState<NotifyStatus>(NOTIFY_STATUS_KEY)?.value ?? null;
}

function update(patch: Partial<NotifyStatus>) {
  try {
    const current = readNotifyStatus();
    setState(NOTIFY_STATUS_KEY, { ...current, ...patch });
  } catch (err) {
    log("Could not store the status:", err);
  }
}

let warnedInvalid = false;
let warnedLimit = false;
let sent: number[] = [];

/** Fire and forget: never throws, never delays the caller beyond starting the request. */
export function notifyAdmin(notice: Notice): void {
  try {
    if (!process.env.NTFY_TOPIC?.trim()) return;
    const req = buildNtfyRequest(process.env, notice);
    if (!req) {
      if (!enabledKinds(process.env).has(notice.kind)) return;
      if (!warnedInvalid) {
        warnedInvalid = true;
        log("NTFY_TOPIC or NTFY_URL is invalid; notifications are off.");
      }
      return;
    }
    const now = Date.now();
    sent = sent.filter((t) => now - t < PUSH_WINDOW_MS);
    if (sent.length >= PUSH_LIMIT) {
      if (!warnedLimit) {
        warnedLimit = true;
        log(`More than ${PUSH_LIMIT} notifications in ${PUSH_WINDOW_MS / 60000} minutes; skipping until it calms down.`);
      }
      return;
    }
    warnedLimit = false;
    sent.push(now);
    const fail = (text: string) => {
      log(text);
      update({ lastError: { at: Date.now(), text: text.slice(0, 300) } });
    };
    fetch(req.url, { method: "POST", headers: req.headers, body: req.body, signal: AbortSignal.timeout(5000) })
      .then(async (res) => {
        if (!res.ok) return fail(`ntfy answered ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
        await res.body?.cancel();
        update({ lastSent: Date.now() });
      })
      .catch((err) => fail(`Could not reach ntfy: ${err instanceof Error ? err.message : err}`));
  } catch (err) {
    log("Error:", err);
  }
}
