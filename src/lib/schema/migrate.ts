/**
 * Upgrades any historical homepage.json shape to the current one (v2).
 * Pure and structural: it never validates — that is `parseConfig`'s job.
 *
 * v1 (no `version` field) → v2:
 *   - `backgroundColor: { light, dark }`        → `background.base`
 *   - `effects.particleBackground/particleEffect` → `background.effect.type`
 *   - tabs and sections gain a stable `id`
 */
import { CONFIG_VERSION } from "./config";

type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function slugify(text: string): string {
  return text.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

function v1ToV2(v1: Obj): Obj {
  const { backgroundColor, effects, ...rest } = v1;
  const { particleBackground, particleEffect, ...restEffects } = isObj(effects) ? effects : {};

  const bg = isObj(backgroundColor) ? backgroundColor : {};
  const base: Obj = { type: "solid" };
  if (typeof bg.light === "string" && bg.light) base.light = bg.light;
  if (typeof bg.dark === "string" && bg.dark) base.dark = bg.dark;

  const effectType = particleBackground === false ? "none" : typeof particleEffect === "string" ? particleEffect : "stars";

  return {
    ...rest,
    version: 2,
    background: { base, effect: { type: effectType } },
    effects: restEffects,
  };
}

/**
 * Gives every tab and section an `id` if it lacks one. Generated ids are derived from
 * the tab label / section type and position, so a hand-written file without ids gets
 * the same ids on every load.
 */
function ensureIds(config: Obj): Obj {
  if (!Array.isArray(config.tabs)) return config;

  const used = new Set<string>();
  // Explicit ids win; reserve them first so generated ones never collide with them.
  for (const tab of config.tabs) {
    if (!isObj(tab)) continue;
    if (typeof tab.id === "string" && tab.id) used.add(tab.id);
    if (Array.isArray(tab.sections)) {
      for (const s of tab.sections) if (isObj(s) && typeof s.id === "string" && s.id) used.add(s.id);
    }
  }
  const unique = (wanted: string): string => {
    let id = wanted;
    for (let n = 2; used.has(id); n++) id = `${wanted}-${n}`;
    used.add(id);
    return id;
  };

  const tabs = config.tabs.map((tab) => {
    if (!isObj(tab)) return tab;
    const tabId = typeof tab.id === "string" && tab.id ? tab.id : unique(slugify(String(tab.label ?? "")) || "tab");
    const sections = Array.isArray(tab.sections)
      ? tab.sections.map((s) => {
          if (!isObj(s) || (typeof s.id === "string" && s.id)) return s;
          return { ...s, id: unique(`${tabId}-${typeof s.type === "string" ? s.type : "section"}`) };
        })
      : tab.sections;
    return { ...tab, id: tabId, sections };
  });

  return { ...config, tabs };
}

export function migrateConfig(raw: unknown): Obj {
  let config: Obj = isObj(raw) ? raw : {};
  if (config.version === undefined) config = v1ToV2(config);
  // Future: if (config.version === 2) config = v2ToV3(config);
  if (config.version !== CONFIG_VERSION) return config; // unknown/newer version — let validation report it
  return ensureIds(config);
}
