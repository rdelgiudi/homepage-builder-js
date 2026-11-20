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

/**
 * A link a visitor can click: http(s), or a path on this site ("/page-2", "/?tab=about") so
 * pages can link to each other. Never "//host" or "/\host" (both leave the site). For links
 * only: anything the server fetches stays on the strict `httpUrl`.
 */
export function linkHref(value: string | undefined | null): string | null {
  const v = value?.trim();
  if (!v) return null;
  if (v.startsWith("/")) return v.startsWith("//") || v.includes("\\") || /[\u0000-\u001f\s]/.test(v) ? null : v;
  return httpUrl(v);
}

/** Anchor attributes: other sites (and files like uploads) open in a new tab, this site's own pages in the same one. */
export function opens(href: string | null | undefined): { target?: "_blank"; rel?: string } {
  return href && href.startsWith("/") && !href.startsWith("/api/") ? {} : { target: "_blank", rel: "noopener noreferrer" };
}
