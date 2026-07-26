import fs from "fs";
import path from "path";

const CONFIG_PATH = path.join(process.cwd(), "src/config/homepage.json");

interface EffectsConfig {
  particleBackground?: boolean;
  particleEffect?: string;
  gradientBorders?: boolean;
  tabTransitions?: boolean;
  customScrollbar?: boolean;
  progressGradient?: boolean;
  progressGradientColors?: string[];
  widgetFrame?: boolean;
  widgetFrameWidth?: number;
  mouseTrail?: boolean;
  mouseTrailColors?: string[];
  faviconAnimation?: boolean;
}

interface CountersConfig {
  viewers?: boolean;
  visitors?: boolean;
}

interface HomepageConfig {
  name: string;
  tagline: string;
  favicon?: string;
  titleGradient?: string[];
  taglineGradient?: string[];
  backgroundColor?: { light?: string; dark?: string };
  effects?: EffectsConfig;
  counters?: CountersConfig;
  tabs: unknown[];
}

const defaultConfig: HomepageConfig = {
  name: "Homepage",
  tagline: "Welcome",
  favicon: "",
  tabs: [],
};

let cachedConfig: HomepageConfig | null = null;
let cachedMtimeMs = 0;

function loadConfigSync(): HomepageConfig {
  try {
    const stat = fs.statSync(CONFIG_PATH);
    if (cachedConfig && stat.mtimeMs === cachedMtimeMs) {
      return cachedConfig;
    }
    const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
    const parsed = JSON.parse(raw) as HomepageConfig;
    cachedConfig = parsed;
    cachedMtimeMs = stat.mtimeMs;
    return parsed;
  } catch {
    return cachedConfig ?? defaultConfig;
  }
}

export function getConfig(): HomepageConfig {
  return loadConfigSync();
}

export function getMetadata() {
  const c = loadConfigSync();
  return {
    name: c.name,
    tagline: c.tagline,
    favicon: c.favicon || "",
    titleGradient: c.titleGradient || [],
  };
}

export type { HomepageConfig, EffectsConfig };
