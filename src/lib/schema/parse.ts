import type { z } from "zod";
import { SectionSchema } from "@/widgets/meta";
import { ConfigSchema, TabSchema, type HomepageConfig } from "./config";
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

  if (Array.isArray(migrated.tabs)) {
    migrated.tabs = migrated.tabs.flatMap((tab: unknown, ti: number) => {
      if (typeof tab !== "object" || tab === null) {
        warnings.push(`tabs[${ti}]: not an object — dropped`);
        return [];
      }
      const t = { ...(tab as Record<string, unknown>) };
      if (Array.isArray(t.sections)) {
        t.sections = t.sections.filter((section: unknown, si: number) => {
          const res = SectionSchema.safeParse(section);
          if (res.success) return true;
          const type = (section as { type?: unknown } | null)?.type;
          warnings.push(`tabs[${ti}].sections[${si}] (type ${JSON.stringify(type)}): ${describe(res.error)} — dropped`);
          return false;
        });
      }
      const res = TabSchema.safeParse(t);
      if (!res.success) {
        warnings.push(`tabs[${ti}]: ${describe(res.error)} — dropped`);
        return [];
      }
      return [t];
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
  const res = ConfigSchema.safeParse(migrateConfig(raw));
  if (!res.success) {
    return { config: null, issues: res.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) };
  }
  const issues: ConfigIssue[] = [];
  const seen = new Set<string>();
  res.data.tabs.forEach((tab, ti) => {
    const check = (id: string, path: string) => {
      if (seen.has(id)) issues.push({ path, message: `Duplicate id "${id}"` });
      seen.add(id);
    };
    check(tab.id, `tabs.${ti}.id`);
    tab.sections.forEach((s, si) => check(s.id, `tabs.${ti}.sections.${si}.id`));
  });
  return issues.length ? { config: null, issues } : { config: res.data, issues: [] };
}
