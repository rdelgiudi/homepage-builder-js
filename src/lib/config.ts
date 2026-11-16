import fs from "fs";
import path from "path";
import { ConfigSchema, CONFIG_VERSION, type HomepageConfig, type EffectsConfig } from "@/lib/schema/config";
import { parseConfig } from "@/lib/schema/parse";

export const CONFIG_PATH = path.join(process.cwd(), "src/config/homepage.json");

const defaultConfig: HomepageConfig = ConfigSchema.parse({ version: CONFIG_VERSION });

let cachedConfig: HomepageConfig | null = null;
let cachedMtimeMs = 0;

function log(level: "warn" | "error", message: string) {
  console[level](`[${new Date().toISOString()}] [Config] ${message}`);
}

/**
 * mtime-cached loader. The file is re-read, migrated (v1 → current) and validated only
 * when its mtime changes; a broken edit keeps serving the last good config.
 */
function loadConfigSync(): HomepageConfig {
  let mtimeMs: number;
  try {
    mtimeMs = fs.statSync(CONFIG_PATH).mtimeMs;
  } catch {
    return cachedConfig ?? defaultConfig;
  }
  if (cachedConfig && mtimeMs === cachedMtimeMs) return cachedConfig;

  const fallback = cachedConfig ?? defaultConfig;
  // Remember this mtime even on failure so a broken file is reported once, not per request.
  cachedMtimeMs = mtimeMs;
  try {
    const { config, errors, warnings } = parseConfig(JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8")));
    for (const w of warnings) log("warn", w);
    if (!config) {
      log("error", `homepage.json is invalid, keeping previous config: ${errors.join("; ")}`);
      cachedConfig = fallback;
    } else {
      cachedConfig = config;
    }
  } catch (err) {
    log("error", `Failed to read homepage.json, keeping previous config: ${err instanceof Error ? err.message : err}`);
    cachedConfig = fallback;
  }
  return cachedConfig;
}

export function getConfig(): HomepageConfig {
  return loadConfigSync();
}

export function getDefaultConfig(): HomepageConfig {
  return defaultConfig;
}

export function getMetadata() {
  const c = loadConfigSync();
  return {
    name: c.name,
    tagline: c.tagline,
    favicon: c.favicon,
    titleGradient: c.titleGradient,
  };
}

export type { HomepageConfig, EffectsConfig };
