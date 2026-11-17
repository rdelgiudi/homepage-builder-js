/** Pure URL helpers, safe to import from client components and from the server. */

/** Only http(s) links are ever handed to the browser. Returns the normalised URL or null. */
export function httpUrl(value: string | undefined | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}
