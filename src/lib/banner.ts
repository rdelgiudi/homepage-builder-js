/**
 * What a site layout makes of the `banner` settings: the one place the site (Banner, SitePage)
 * and the admin panel read it, so the panel never offers an option the layout ignores. Pure
 * and client-safe, unit-tested in tests/unit/layouts.test.ts.
 */
import type { BannerConfig, LayoutConfig } from "@/lib/schema/config";
import { LAYOUT_FEATURES } from "@/lib/layouts";

/** The banner settings as the layout applies them. */
export function bannerOptions(layout: LayoutConfig, banner: BannerConfig): BannerConfig {
  return LAYOUT_FEATURES[layout.site].banner === "stacked" ? { ...banner, arrangement: "stacked" } : banner;
}

/**
 * Centered title in one row with the tabs: the tabs are split around it, the first half before
 * the title and the rest after it.
 */
export function splitTabs<T>(items: T[]): [T[], T[]] {
  const half = Math.ceil(items.length / 2);
  return [items.slice(0, half), items.slice(half)];
}

/** Banner settings that do nothing with this layout, with the reason in the panel's voice. The values stay in the config. */
export function ignoredBannerSettings(layout: LayoutConfig, banner: BannerConfig): { keys: (keyof BannerConfig)[]; note: string }[] {
  const kind = LAYOUT_FEATURES[layout.site].banner;
  const out: { keys: (keyof BannerConfig)[]; note: string }[] = [];
  if (kind === "column")
    out.push({
      keys: ["tabsPosition", "fullWidth"],
      note: "In the Sidebar layout the title, tabs and light/dark switch are in the left column on wide screens. Arrangement, title position and scrolling apply on phones.",
    });
  if (kind === "stacked") out.push({ keys: ["arrangement"], note: "The Link in bio column is too narrow for the title and tabs in one row, so the title is always above the tabs." });
  if (kind === "full" && banner.arrangement === "inline" && banner.titlePosition === "center")
    out.push({ keys: ["tabsPosition"], note: "With the title in the center of the row, the tabs are split to its left and right." });
  return out;
}
