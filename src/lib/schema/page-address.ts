/**
 * Rules for page addresses (pure, no zod: the site's client bundle uses them through
 * lib/pages.ts). Re-exported by schema/config.ts.
 */

/** One level of a page address: lowercase letters, digits and dashes. */
export const PAGE_SEGMENT = /^[a-z0-9][a-z0-9-]{0,47}$/;
/** How many levels an address may have ("about/team/alice"). */
export const MAX_PAGE_DEPTH = 3;
/** A page address: one to MAX_PAGE_DEPTH levels separated by "/" ("about", "about/colophon"). */
export const PAGE_SLUG = new RegExp(`^[a-z0-9][a-z0-9-]{0,47}(?:/[a-z0-9][a-z0-9-]{0,47}){0,${MAX_PAGE_DEPTH - 1}}$`);
/**
 * Addresses a page can't have, judged by the first level. Anything starting with `admin` or
 * `api` because the recommended reverse proxy routes by path *prefix* (`/adminfoo` would reach
 * the admin container), and the site's own top-level routes.
 */
export const isReservedSlug = (slug: string) => {
  const first = slug.split("/")[0];
  return /^(admin|api)/.test(first) || ["posts", "overlay", "ws"].includes(first);
};
