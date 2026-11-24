/**
 * What a site layout makes of the `banner` settings: the one place the site (Banner, SitePage)
 * and the admin panel read it, so the panel never offers an option the layout ignores. Pure
 * and client-safe, unit-tested in tests/unit/layouts.test.ts.
 */
import type { BannerConfig, BannerOptions, LayoutConfig } from "@/lib/schema/config";
import { LAYOUT_FEATURES } from "@/lib/layouts";

/** Where phones end: Tailwind's `md`. Banner's `md:` classes and everything that picks a set in JS agree on it. */
export const PHONE_QUERY = "(max-width: 767.98px)";

/** What a set of settings is for: every screen (phones have none of their own), or only one kind. */
export type BannerScreens = "all" | "desktop" | "phone";

/** The banner settings as the layout applies them: for every screen, or for wide ones when phones have their own. */
export function bannerOptions(layout: LayoutConfig, banner: BannerConfig): { options: BannerOptions; phone?: BannerOptions } {
  const { phone, ...options } = banner;
  const apply = (set: BannerOptions): BannerOptions => (LAYOUT_FEATURES[layout.site].banner === "stacked" ? { ...set, arrangement: "stacked" } : set);
  return phone ? { options: apply(options), phone: apply(phone) } : { options: apply(options) };
}

/**
 * Gives phones their own settings (starting as a copy of the others, so nothing changes yet) or
 * goes back to one set for every screen.
 */
export function withPhoneBanner(banner: BannerConfig, own: boolean): BannerConfig {
  const { phone, ...options } = banner;
  return own ? { ...options, phone: phone ?? { ...options } } : options;
}

/**
 * Centered title in one row with the tabs: the tabs are split around it, the first half before
 * the title and the rest after it.
 */
export function splitTabs<T>(items: T[]): [T[], T[]] {
  const half = Math.ceil(items.length / 2);
  return [items.slice(0, half), items.slice(half)];
}

export interface IgnoredBannerSetting {
  keys: (keyof BannerOptions)[];
  /** The reason, in the panel's voice. "" = nothing worth saying. */
  note: string;
}

/** Settings of one set that do nothing with this layout on those screens. The values stay in the config. */
export function ignoredBannerSettings(layout: LayoutConfig, banner: BannerOptions, screens: BannerScreens): IgnoredBannerSetting[] {
  const features = LAYOUT_FEATURES[layout.site];
  const kind = features.banner;
  const inline = banner.arrangement === "inline" && kind !== "stacked";
  const out: IgnoredBannerSetting[] = [];

  if (kind === "stacked") out.push({ keys: ["arrangement"], note: "The Link in bio column is too narrow for the title and tabs in one row, so the title is always above the tabs." });

  if (screens === "phone") {
    out.push({ keys: ["fullWidth"], note: "" });
    // A row of tabs at the top only in one page and link in bio; the others have the menu button or the bottom bar.
    if (features.tabBar && !features.uniformNav) out.push({ keys: ["tabsPosition"], note: "Phones have the menu button or the bar at the bottom instead of a row of tabs, so there is no tabs position." });
    else if (inline && banner.titlePosition === "center") out.push({ keys: ["tabsPosition"], note: "" });
    if (inline) out.push({ keys: ["showTagline"], note: "In one row there is no room for the tagline on phones." });
    return out;
  }

  if (kind === "column") {
    if (screens === "desktop")
      out.push({
        keys: ["arrangement", "titlePosition", "tabsPosition", "fullWidth", "scroll"],
        note: "In the Sidebar layout the title, tabs and light/dark switch are in the left column on wide screens.",
      });
    else
      out.push({
        keys: ["tabsPosition", "fullWidth"],
        note: "In the Sidebar layout the title, tabs and light/dark switch are in the left column on wide screens. Arrangement, title position and scrolling apply on phones.",
      });
  }
  if (kind === "full" && inline && banner.titlePosition === "center") out.push({ keys: ["tabsPosition"], note: "With the title in the center of the row, the tabs are split to its left and right." });
  return out;
}
