/**
 * Admin authentication: one password, server-side sessions in SQLite.
 *
 * The password is configured as ADMIN_PASSWORD_HASH (scrypt, see password.js; generate
 * it with `npm run admin:hash`) or, for local development, as plain ADMIN_PASSWORD.
 * If both are set the hash wins and the plain value is ignored.
 *
 * The admin panel exists only when one of them is set and APP_ROLE is not "public".
 * Every /api/admin route is wrapped in `withAdmin`, and the /admin pages check
 * `isAdminSession()` themselves — there is deliberately no reliance on middleware.
 */
import crypto from "crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminDb } from "./store";
import { verifyPassword } from "./password";

export const SESSION_COOKIE = "admin_session";
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function log(message: string) {
  console.log(`[${new Date().toISOString()}] [Admin] ${message}`);
}

export function adminEnabled(): boolean {
  return !!(process.env.ADMIN_PASSWORD_HASH || process.env.ADMIN_PASSWORD) && process.env.APP_ROLE !== "public";
}

const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest();

export async function checkPassword(candidate: string): Promise<boolean> {
  const hash = process.env.ADMIN_PASSWORD_HASH;
  // A set-but-malformed hash never falls back to the plain password: it fails closed.
  if (hash) return verifyPassword(candidate, hash);
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  // Hash both sides so the comparison is constant-time regardless of length.
  return crypto.timingSafeEqual(sha256(candidate), sha256(expected));
}

// --- sessions ---

const hashToken = (token: string) => sha256(token).toString("hex");

export function createSession(): string {
  const token = crypto.randomBytes(32).toString("base64url");
  const now = Date.now();
  const db = adminDb();
  db.prepare("DELETE FROM admin_sessions WHERE expires_at < ?").run(now);
  db.prepare("INSERT INTO admin_sessions (token_hash, created_at, expires_at) VALUES (?, ?, ?)").run(hashToken(token), now, now + SESSION_TTL_MS);
  return token;
}

export function destroySession(token: string) {
  adminDb().prepare("DELETE FROM admin_sessions WHERE token_hash = ?").run(hashToken(token));
}

function isValidToken(token: string | null | undefined): boolean {
  if (!token) return false;
  const row = adminDb().prepare("SELECT expires_at FROM admin_sessions WHERE token_hash = ?").get(hashToken(token)) as { expires_at: number } | undefined;
  return !!row && row.expires_at > Date.now();
}

export function getSessionToken(request: Request): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq !== -1 && part.slice(0, eq).trim() === SESSION_COOKIE) return part.slice(eq + 1).trim();
  }
  return null;
}

export function isAdminRequest(request: Request): boolean {
  return adminEnabled() && isValidToken(getSessionToken(request));
}

/** For server components. */
export async function isAdminSession(): Promise<boolean> {
  if (!adminEnabled()) return false;
  return isValidToken((await cookies()).get(SESSION_COOKIE)?.value);
}

/** `Secure` only when the request actually arrived over HTTPS, so plain-HTTP internal access still works. */
export function isHttps(request: Request): boolean {
  const proto = request.headers.get("x-forwarded-proto");
  if (proto) return proto.split(",")[0].trim() === "https";
  return new URL(request.url).protocol === "https:";
}

/**
 * The session cookie is scoped to the admin paths instead of "/", so on a shared
 * hostname the browser never sends it to the public site (which may be a different,
 * internet-facing container). One Set-Cookie per path, since a cookie has only one.
 */
const COOKIE_PATHS = ["/admin", "/api/admin"];

function appendCookies(res: Response, value: string, maxAgeSeconds: number, secure: boolean, paths: string[]) {
  for (const path of paths) {
    res.headers.append("Set-Cookie", `${SESSION_COOKIE}=${value}; Path=${path}; Max-Age=${maxAgeSeconds}; HttpOnly; SameSite=Strict${secure ? "; Secure" : ""}`);
  }
}

export function setSessionCookie(res: Response, request: Request, token: string) {
  appendCookies(res, token, SESSION_TTL_MS / 1000, isHttps(request), COOKIE_PATHS);
}

export function clearSessionCookie(res: Response, request: Request) {
  // "/" as well: sessions created before the cookie was path-scoped used it.
  appendCookies(res, "", 0, isHttps(request), [...COOKIE_PATHS, "/"]);
}

// --- CSRF ---

/** State-changing requests must come from this site's own pages. */
export function isSameOrigin(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site) return site === "same-origin";
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const host = (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "").split(",")[0].trim();
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

// --- login rate limit ---

const MAX_ATTEMPTS = 8;
const WINDOW_MS = 10 * 60 * 1000;
const attempts = new Map<string, { count: number; first: number }>();

export function clientKey(request: Request): string {
  return (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "local";
}

/** Returns seconds to wait, or 0 if another attempt is allowed. */
export function loginThrottle(key: string): number {
  const entry = attempts.get(key);
  if (!entry) return 0;
  const age = Date.now() - entry.first;
  if (age > WINDOW_MS) {
    attempts.delete(key);
    return 0;
  }
  return entry.count >= MAX_ATTEMPTS ? Math.ceil((WINDOW_MS - age) / 1000) : 0;
}

export function recordLoginFailure(key: string) {
  const entry = attempts.get(key);
  if (!entry || Date.now() - entry.first > WINDOW_MS) attempts.set(key, { count: 1, first: Date.now() });
  else entry.count++;
  log(`Failed login from ${key}`);
}

export function clearLoginFailures(key: string) {
  attempts.delete(key);
}

// --- route wrapper ---

const json = (body: unknown, status: number) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

/**
 * Wraps an /api/admin route handler: 404 when the panel is disabled (indistinguishable
 * from a missing route), 403 for cross-site writes, 401 without a valid session.
 */
export function withAdmin<C = unknown>(handler: (request: Request, ctx: C) => Promise<Response> | Response) {
  return async (request: Request, ctx: C): Promise<Response> => {
    if (!adminEnabled()) return json({ error: "Not found" }, 404);
    if (request.method !== "GET" && request.method !== "HEAD" && !isSameOrigin(request)) return json({ error: "Cross-site request refused" }, 403);
    if (!isAdminRequest(request)) return json({ error: "Not signed in" }, 401);
    try {
      const res = await handler(request, ctx);
      if (!res.headers.has("Cache-Control")) res.headers.set("Cache-Control", "no-store");
      return res;
    } catch (err) {
      console.error(`[${new Date().toISOString()}] [Admin] ${request.method} ${new URL(request.url).pathname} failed:`, err);
      return json({ error: err instanceof Error ? err.message : "Server error" }, 500);
    }
  };
}

export async function readJson<T = Record<string, unknown>>(request: Request): Promise<T | null> {
  try {
    const body = await request.json();
    return typeof body === "object" && body !== null ? (body as T) : null;
  } catch {
    return null;
  }
}
