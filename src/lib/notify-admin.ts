/**
 * Sends ntfy notifications and records the last result in the shared database, so the admin
 * panel can show it even when another container (the public one) does the sending.
 * Which NTFY_* variables that container has is in its env report (env-report.ts).
 */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { deleteState, getState, setState } from "@/lib/admin/store";
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

type SendResult = { ok: true } | { ok: false; error: string; status: number };

/** Sends one notice and waits for ntfy's answer; records the result. Never throws. */
export async function sendNotice(notice: Notice): Promise<SendResult> {
  try {
    if (!process.env.NTFY_TOPIC?.trim()) return { ok: false, status: 409, error: "Notifications aren't set up on the server that answered: NTFY_TOPIC is not set there." };
    const req = buildNtfyRequest(process.env, notice);
    if (!req) {
      if (notice.kind !== "test" && !enabledKinds(process.env).has(notice.kind)) return { ok: false, status: 409, error: "Switched off by NTFY_EVENTS." };
      if (!warnedInvalid) {
        warnedInvalid = true;
        log("NTFY_TOPIC or NTFY_URL is invalid; notifications are off.");
      }
      return { ok: false, status: 409, error: "NTFY_TOPIC or NTFY_URL is invalid." };
    }
    const now = Date.now();
    sent = sent.filter((t) => now - t < PUSH_WINDOW_MS);
    if (sent.length >= PUSH_LIMIT) {
      if (!warnedLimit) {
        warnedLimit = true;
        log(`More than ${PUSH_LIMIT} notifications in ${PUSH_WINDOW_MS / 60000} minutes; skipping until it calms down.`);
      }
      return { ok: false, status: 429, error: `More than ${PUSH_LIMIT} notifications in the last ${PUSH_WINDOW_MS / 60000} minutes; try again later.` };
    }
    warnedLimit = false;
    sent.push(now);
    let error: string;
    try {
      const res = await fetch(req.url, { method: "POST", headers: req.headers, body: req.body, signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        await res.body?.cancel();
        update({ lastSent: Date.now() });
        return { ok: true };
      }
      error = `ntfy answered ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`;
    } catch (err) {
      error = `Could not reach ntfy: ${err instanceof Error ? err.message : err}`;
    }
    log(error);
    update({ lastError: { at: Date.now(), text: error.slice(0, 300) } });
    return { ok: false, status: 502, error };
  } catch (err) {
    log("Error:", err);
    return { ok: false, status: 500, error: "Could not send the notification." };
  }
}

/** Fire and forget, for visitors' posts: never throws, never delays the response. */
export function notifyAdmin(notice: Notice): void {
  if (!process.env.NTFY_TOPIC?.trim()) return;
  void sendNotice(notice);
}

// --- test notifications from the admin panel ---
//
// The admin container may not have the NTFY_* variables, and the public one can't see the admin
// session (its cookie is scoped to /admin and /api/admin). So the panel gets a single-use ticket
// from /api/admin/notify-test and hands it to the public route /api/notify-test, which the proxy
// sends to the public container. Both see the ticket through the shared database.

const TEST_TICKET_KEY = "notify.testTicket";
const TICKET_TTL_MS = 60 * 1000;
const hashTicket = (ticket: string) => createHash("sha256").update(ticket).digest("hex");

export function createTestTicket(): string {
  const ticket = randomBytes(32).toString("base64url");
  setState(TEST_TICKET_KEY, { hash: hashTicket(ticket), expires: Date.now() + TICKET_TTL_MS });
  return ticket;
}

/** True once per valid ticket; the ticket is gone afterwards either way. */
export function consumeTestTicket(ticket: unknown): boolean {
  if (typeof ticket !== "string" || ticket.length > 100) return false;
  const stored = getState<{ hash: string; expires: number }>(TEST_TICKET_KEY)?.value;
  if (!stored) return false;
  const given = Buffer.from(hashTicket(ticket), "hex");
  const want = Buffer.from(stored.hash, "hex");
  if (given.length !== want.length || !timingSafeEqual(given, want)) return false;
  deleteState(TEST_TICKET_KEY);
  return stored.expires > Date.now();
}
