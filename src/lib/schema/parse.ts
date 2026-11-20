import type { z } from "zod";
import { SectionSchema } from "@/widgets/meta";
import { ConfigSchema, PAGE_SETTING_GROUPS, PageSchema, PageSettingsSchema, TabSchema, type HomepageConfig } from "./config";
import { migrateConfig } from "./migrate";

export interface ParseResult {
  /** `null` when the file is unusable as a whole (see `errors`). */
  config: HomepageConfig | null;
  /** Fatal problems: the config could not be used. */
  errors: string[];
  /** Tabs/sections that were dropped because they are invalid. */
  warnings: string[];
}

function describe(error: z.ZodError): string {
  return error.issues.map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message)).join("; ");
}

/**
 * Migrates + validates raw homepage.json content.
 *
 * Lenient by design, because the public site should survive a typo: an invalid
 * section or tab is dropped (and reported in `warnings`) instead of failing the
 * whole config. Callers that must not lose data (the admin save path) should
 * treat any warning as an error.
 */
export function parseConfig(raw: unknown): ParseResult {
  const warnings: string[] = [];
  const migrated = migrateConfig(raw);

  /** Drops invalid sections, then invalid tabs, of one tab list. `at` names it in warnings. */
  const cleanTabs = (tabs: unknown[], at: string) =>
    tabs.flatMap((tab: unknown, ti: number) => {
      if (typeof tab !== "object" || tab === null) {
        warnings.push(`${at}[${ti}]: not an object — dropped`);
        return [];
      }
      const t = { ...(tab as Record<string, unknown>) };
      if (Array.isArray(t.sections)) {
        t.sections = t.sections.filter((section: unknown, si: number) => {
          const res = SectionSchema.safeParse(section);
          if (res.success) return true;
          const type = (section as { type?: unknown } | null)?.type;
          warnings.push(`${at}[${ti}].sections[${si}] (type ${JSON.stringify(type)}): ${describe(res.error)} — dropped`);
          return false;
        });
      }
      const res = TabSchema.safeParse(t);
      if (!res.success) {
        warnings.push(`${at}[${ti}]: ${describe(res.error)} — dropped`);
        return [];
      }
      return [t];
    });

  /** A page's own settings: an invalid group is dropped, so that page uses the site's instead. */
  const cleanSettings = (raw: unknown, at: string): Record<string, unknown> | undefined => {
    if (raw === undefined) return undefined;
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
      warnings.push(`${at}: not an object — the site's settings are used`);
      return undefined;
    }
    const out = { ...(raw as Record<string, unknown>) };
    for (const group of PAGE_SETTING_GROUPS) {
      if (out[group] === undefined) continue;
      const res = PageSettingsSchema.shape[group].safeParse(out[group]);
      if (!res.success) {
        warnings.push(`${at}.${group}: ${describe(res.error)} — the site's ${group} is used`);
        delete out[group];
      }
    }
    return out;
  };

  if (Array.isArray(migrated.tabs)) migrated.tabs = cleanTabs(migrated.tabs, "tabs");
  if ("homeSettings" in migrated) {
    const home = cleanSettings(migrated.homeSettings, "homeSettings");
    if (home) migrated.homeSettings = home;
    else delete migrated.homeSettings;
  }
  // Pages get the same treatment, so one typo on a page doesn't take the whole site down.
  if (Array.isArray(migrated.pages)) {
    const slugs = new Set<string>();
    migrated.pages = migrated.pages.flatMap((page: unknown, pi: number) => {
      if (typeof page !== "object" || page === null) {
        warnings.push(`pages[${pi}]: not an object — dropped`);
        return [];
      }
      const p = { ...(page as Record<string, unknown>) };
      if (Array.isArray(p.tabs)) p.tabs = cleanTabs(p.tabs, `pages[${pi}].tabs`);
      if ("settings" in p) {
        const own = cleanSettings(p.settings, `pages[${pi}].settings`);
        if (own) p.settings = own;
        else delete p.settings;
      }
      const res = PageSchema.safeParse(p);
      if (!res.success) {
        warnings.push(`pages[${pi}]: ${describe(res.error)} — dropped`);
        return [];
      }
      if (slugs.has(res.data.slug)) {
        warnings.push(`pages[${pi}]: the address /${res.data.slug} is used twice — dropped`);
        return [];
      }
      slugs.add(res.data.slug);
      return [p];
    });
  }

  const res = ConfigSchema.safeParse(migrated);
  if (!res.success) return { config: null, errors: [describe(res.error)], warnings };
  return { config: res.data, errors: [], warnings };
}

export interface ConfigIssue {
  path: string;
  message: string;
}

/**
 * Strict counterpart of `parseConfig` for anything that writes a config (admin draft /
 * publish): nothing is dropped — every problem is returned as an issue instead.
 */
export function strictParseConfig(raw: unknown): { config: HomepageConfig; issues: [] } | { config: null; issues: ConfigIssue[] } {
  // Every top-level field has a default, so a missing body (`undefined`, `{}`) would otherwise
  // "parse" into an empty site and be saved as the draft. A real config always lists its tabs.
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { config: null, issues: [{ path: "", message: "Expected a config object" }] };
  if (!Array.isArray((raw as { tabs?: unknown }).tabs)) return { config: null, issues: [{ path: "tabs", message: "Expected a list of tabs" }] };
  const res = ConfigSchema.safeParse(migrateConfig(raw));
  if (!res.success) {
    return { config: null, issues: res.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) };
  }
  const issues: ConfigIssue[] = [];
  // Ids are unique across every page (the overlay, data widgets and polls look sections up by id).
  const seen = new Set<string>();
  const check = (id: string, path: string) => {
    if (seen.has(id)) issues.push({ path, message: `Duplicate id "${id}"` });
    seen.add(id);
  };
  const checkTabs = (tabs: HomepageConfig["tabs"], at: string) =>
    tabs.forEach((tab, ti) => {
      check(tab.id, `${at}.${ti}.id`);
      tab.sections.forEach((s, si) => check(s.id, `${at}.${ti}.sections.${si}.id`));
    });
  checkTabs(res.data.tabs, "tabs");
  const slugs = new Set<string>();
  res.data.pages.forEach((page, pi) => {
    check(page.id, `pages.${pi}.id`);
    if (slugs.has(page.slug)) issues.push({ path: `pages.${pi}.slug`, message: `Another page already uses the address /${page.slug}` });
    slugs.add(page.slug);
    checkTabs(page.tabs, `pages.${pi}.tabs`);
  });
  return issues.length ? { config: null, issues } : { config: res.data, issues: [] };
}
