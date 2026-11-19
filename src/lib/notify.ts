/**
 * Optional push notifications to the site owner via ntfy (https://ntfy.sh or a self-hosted server)
 * for new contact messages, guestbook comments and game suggestions.
 * Off unless NTFY_TOPIC is set. Sent by whichever process handles the visitor's request — in the
 * two-container setup that is the public one, so the NTFY_* variables belong there.
 */

/** NTFY_URL (default https://ntfy.sh), NTFY_TOPIC (unset = off), NTFY_TOKEN, NTFY_CLICK, NTFY_EVENTS — all optional. */
export type NtfyEnv = Record<string, string | undefined>;

export const NOTIFY_KINDS = ["message", "comment", "suggestion"] as const;
export type NotifyKind = (typeof NOTIFY_KINDS)[number];

export interface Notice {
  kind: NotifyKind;
  title: string;
  message: string;
  tags: string[];
}

export interface NtfyRequest {
  url: string;
  headers: Record<string, string>;
  body: string;
}

const PREVIEW_MAX = 400;
const TOPIC = /^[A-Za-z0-9_-]{1,64}$/;
/** At most this many pushes per window from all kinds together; the comment route has no global cap of its own. */
const PUSH_LIMIT = 30;
const PUSH_WINDOW_MS = 10 * 60 * 1000;

const log = (...args: unknown[]) => console.error(`[${new Date().toISOString()}] [Notify]`, ...args);

const preview = (text: string) => (text.length > PREVIEW_MAX ? `${text.slice(0, PREVIEW_MAX).trimEnd()}…` : text);

export function messageNotice(m: { name: string; email: string | null; body: string }): Notice {
  return {
    kind: "message",
    title: `New message from ${m.name}`,
    message: m.email ? `${preview(m.body)}\n\n— ${m.email}` : preview(m.body),
    tags: ["envelope"],
  };
}

export function commentNotice(c: { name: string; body: string; pending: boolean }): Notice {
  return {
    kind: "comment",
    title: c.pending ? `Comment from ${c.name} awaits approval` : `New comment from ${c.name}`,
    message: preview(c.body),
    tags: c.pending ? ["speech_balloon", "hourglass"] : ["speech_balloon"],
  };
}

export function suggestionNotice(s: { title: string; name: string | null; note: string | null; again: boolean }): Notice {
  const by = s.name ? `${s.name} ${s.again ? "suggested it again" : "suggested it"}` : s.again ? "Suggested again" : "Suggested by a visitor";
  return {
    kind: "suggestion",
    title: `Game suggestion: ${s.title}`,
    message: s.note ? `${by}:\n${preview(s.note)}` : `${by}.`,
    tags: ["video_game"],
  };
}

/**
 * Which kinds are on. NTFY_EVENTS is a comma list of `message`, `comment`, `suggestion`;
 * unset or empty = all of them.
 */
export function enabledKinds(env: NtfyEnv): Set<NotifyKind> {
  const listed = (env.NTFY_EVENTS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (!listed.length) return new Set(NOTIFY_KINDS);
  return new Set(NOTIFY_KINDS.filter((k) => listed.includes(k)));
}

/**
 * Builds ntfy's JSON publish request (POST to the server root, topic in the body). JSON rather than
 * the `Title:` header style because header values must be ASCII, and visitor names often aren't.
 * Returns null when notifications are off, this kind is switched off, or the setup is invalid.
 */
export function buildNtfyRequest(env: NtfyEnv, notice: Notice): NtfyRequest | null {
  const topic = env.NTFY_TOPIC?.trim();
  if (!topic || !TOPIC.test(topic)) return null;
  if (!enabledKinds(env).has(notice.kind)) return null;
  let base: URL;
  try {
    base = new URL(env.NTFY_URL?.trim() || "https://ntfy.sh");
  } catch {
    return null;
  }
  if (base.protocol !== "https:" && base.protocol !== "http:") return null;
  // Keep a sub-path (ntfy behind a path prefix), always end with "/".
  base.pathname = base.pathname.replace(/\/*$/, "/");

  const payload: Record<string, unknown> = { topic, title: notice.title, message: notice.message, tags: notice.tags };
  const click = env.NTFY_CLICK?.trim();
  if (click && /^https?:\/\//i.test(click)) payload.click = click;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = env.NTFY_TOKEN?.trim();
  if (token) headers.Authorization = `Bearer ${token}`;
  return { url: base.toString(), headers, body: JSON.stringify(payload) };
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
    fetch(req.url, { method: "POST", headers: req.headers, body: req.body, signal: AbortSignal.timeout(5000) })
      .then(async (res) => {
        if (!res.ok) log(`ntfy answered ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
        else await res.body?.cancel();
      })
      .catch((err) => log("Could not reach ntfy:", err instanceof Error ? err.message : err));
  } catch (err) {
    log("Error:", err);
  }
}
