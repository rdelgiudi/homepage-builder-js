/**
 * What each site layout does with the per-tab settings — the one place both the site
 * (SitePage / TabSections / OnePage) and the admin panel (builder, tab inspector) read it,
 * so the panel never offers an option the layout ignores. Pure and client-safe (type-only
 * imports), unit-tested.
 */
import type { HomepageConfig, SiteLayout, Tab } from "@/lib/schema/config";

export interface LayoutFeatures {
  /**
   * How a tab's widgets are arranged: the tab's own "Arrange widgets" setting, or fixed by
   * the layout (bento = always a grid; link in bio = always one per row, the column is too
   * narrow for widgets side by side).
   */
  arrange: "choice" | "grid" | "stack";
  /** Whether a tab's own background is shown (not in one page: every tab is on screen at once). */
  tabBackground: boolean;
  /** When tab labels and icons are shown: always, or only with more than one tab (no tab bar for one). */
  tabNav: "always" | "multiple";
}

export const LAYOUT_FEATURES: Record<SiteLayout, LayoutFeatures> = {
  tabs: { arrange: "choice", tabBackground: true, tabNav: "always" },
  sidebar: { arrange: "choice", tabBackground: true, tabNav: "always" },
  onepage: { arrange: "choice", tabBackground: false, tabNav: "multiple" },
  bento: { arrange: "grid", tabBackground: true, tabNav: "always" },
  linkinbio: { arrange: "stack", tabBackground: true, tabNav: "multiple" },
};

/** How TabSections lays tabs out under a site layout. */
export interface GridOptions {
  arrange: LayoutFeatures["arrange"];
  /** Width (of 12) of a widget without its own `span`: full width, or 12 / widgets per row in bento. */
  defaultSpan: number;
}

export function gridOptions(layout: HomepageConfig["layout"]): GridOptions {
  const { arrange } = LAYOUT_FEATURES[layout.site];
  return { arrange, defaultSpan: layout.site === "bento" ? 12 / layout.bentoColumns : 12 };
}

/** Whether this tab is laid out as a grid (widgets side by side, `span` applies). */
export function isGridTab(options: GridOptions, tab: Pick<Tab, "layout">): boolean {
  return options.arrange === "grid" || (options.arrange === "choice" && tab.layout === "grid");
}

/**
 * Tab settings the current layout ignores, with the reason in the panel's voice. The
 * builder hides these fields and shows the reasons instead; the values stay in the config,
 * so switching back to a layout that uses them restores them.
 */
export function ignoredTabSettings(layout: HomepageConfig["layout"], tabCount: number): { key: "layout" | "background" | null; note: string }[] {
  const f = LAYOUT_FEATURES[layout.site];
  const out: { key: "layout" | "background" | null; note: string }[] = [];
  if (f.arrange === "grid")
    out.push({ key: "layout", note: `In the Bento layout every tab is a grid: ${layout.bentoColumns} widgets per row unless a widget has its own width (Site screen → Layout).` });
  if (f.arrange === "stack") out.push({ key: "layout", note: "The Link in bio column is too narrow for widgets side by side, so every tab shows its widgets one per row." });
  if (!f.tabBackground) out.push({ key: "background", note: "Tab backgrounds don't show in the One page layout (every tab is on screen at once); the site background is used." });
  if (f.tabNav === "multiple" && tabCount === 1)
    out.push({
      key: null,
      note:
        layout.site === "onepage"
          ? "With one tab there is no jump bar or section heading, so this tab's label and icon don't appear on the page."
          : "With one tab the Link in bio layout shows no tab bar, so this tab's label and icon don't appear on the page.",
    });
  return out;
}
