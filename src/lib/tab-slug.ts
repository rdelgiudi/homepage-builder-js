/** Zod-free, so the site's client code can use it (schema/migrate.ts re-exports `slugify`). */
export function slugify(text: string): string {
  return text.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

/**
 * A tab's `?tab=` address (also its one-page anchor and what the builder and preview exchange):
 * from its original label, so it is the same in every language. `sourceLabel` is set by
 * `localize()` (lib/i18n/texts.ts) on tabs whose label it translated.
 */
export const tabSlug = (tab: { label: string; sourceLabel?: string }): string => slugify(tab.sourceLabel ?? tab.label);
