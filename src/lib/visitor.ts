import crypto from "crypto";

export const COOKIE_NAME = "visitor_id";
export const SALT = process.env.VISITOR_SALT || "default-salt";
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function generateVisitorId(): string {
  return crypto.randomUUID();
}

export function hashVisitorId(visitorId: string): string {
  return crypto.createHash("sha256").update(`${visitorId}:${SALT}`).digest("hex").substring(0, 32);
}

export function getVisitorIdFromCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(";").map((c) => c.trim());
  for (const cookie of cookies) {
    const [name, value] = cookie.split("=");
    if (name === COOKIE_NAME) return value;
  }
  return null;
}
