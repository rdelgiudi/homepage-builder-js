/**
 * Server-side helpers for widgets that show data from other sites.
 * Nothing here runs on a timer: data is fetched when a visitor's widget asks for it
 * and cached in memory, so with no visitors there are no outbound requests.
 */
import { getConfig } from "@/lib/config";
import { getDraftConfig } from "@/lib/admin/publish";
import type { Section } from "@/widgets/meta";

/** An error whose message is safe and useful to show in the widget. */
export class WidgetError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.status = status;
  }
}

const ERROR_TTL_MS = 5 * 60 * 1000;
const MAX_ENTRIES = 500;
const cache = new Map<string, { expiry: number; value?: unknown; error?: WidgetError }>();
const inFlight = new Map<string, Promise<unknown>>();

/**
 * Returns `fn()`'s result, cached for `ttlMs`. Failures are cached too (5 minutes) so a
 * broken source isn't hammered, and concurrent requests for one key share one fetch.
 */
export async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && hit.expiry > Date.now()) {
    if (hit.error) throw hit.error;
    return hit.value as T;
  }
  const running = inFlight.get(key);
  if (running) return running as Promise<T>;

  const promise = (async () => {
    try {
      const value = await fn();
      cache.set(key, { expiry: Date.now() + ttlMs, value });
      return value;
    } catch (err) {
      const error = err instanceof WidgetError ? err : new WidgetError("The source could not be reached.");
      if (!(err instanceof WidgetError)) console.error(`[${new Date().toISOString()}] [Widgets] ${key}:`, err instanceof Error ? err.message : err);
      cache.set(key, { expiry: Date.now() + ERROR_TTL_MS, error });
      throw error;
    } finally {
      inFlight.delete(key);
      if (cache.size > MAX_ENTRIES) {
        const now = Date.now();
        for (const [k, v] of cache) if (v.expiry <= now) cache.delete(k);
      }
    }
  })();
  inFlight.set(key, promise);
  return promise;
}

export const USER_AGENT = "homepage-widget/1.0";
const TIMEOUT_MS = 10000;
const MAX_TEXT_BYTES = 3 * 1024 * 1024;

type ExtraHeaders = Record<string, string>;

async function request(url: string, accept: string, headers: ExtraHeaders = {}, method = "GET"): Promise<Response> {
  const res = await fetch(url, { method, headers: { "User-Agent": USER_AGENT, Accept: accept, ...headers }, signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
  if (res.status === 404) throw new WidgetError("Not found. Check the name or address in this widget's settings.", 404);
  if (!res.ok) throw new WidgetError(`The source answered with an error (${res.status}).`);
  return res;
}

export async function getJson<T = unknown>(url: string, headers?: ExtraHeaders, method?: "GET" | "POST"): Promise<T> {
  return (await request(url, "application/json", headers, method)).json() as Promise<T>;
}

export async function getText(url: string, accept = "*/*", headers?: ExtraHeaders): Promise<string> {
  const text = await (await request(url, accept, headers)).text();
  if (text.length > MAX_TEXT_BYTES) throw new WidgetError("The source is too large to read.");
  return text;
}

/**
 * Looks a section up by id — in the live config first, then in the admin draft so the
 * panel's preview works before publishing. Widgets that fetch from an address the site
 * owner typed (a feed URL, a Mastodon server) are resolved this way instead of taking
 * the address from the request, so the endpoint can't be used to fetch arbitrary URLs.
 */
export function findSection<T extends Section["type"]>(id: string | null, type: T): Extract<Section, { type: T }> {
  if (id) {
    for (const config of [getConfig(), getDraftConfig()]) {
      for (const tab of config?.tabs ?? []) {
        const section = tab.sections.find((s) => s.id === id && s.type === type);
        if (section) return section as Extract<Section, { type: T }>;
      }
    }
  }
  throw new WidgetError("This widget is not on the site.", 404);
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

export function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m);
}

/** HTML → plain text: paragraphs and line breaks become newlines, every tag is dropped. */
export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>\s*<p[^>]*>/gi, "\n\n")
      .replace(/<[^>]+>/g, "")
  ).trim();
}

export { httpUrl } from "@/lib/url";
