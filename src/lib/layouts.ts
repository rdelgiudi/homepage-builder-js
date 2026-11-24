/**
 * What each site layout does with the per-tab settings — the one place both the site
 * (SitePage / Tabs / TabSections / OnePage) and the admin panel (builder, tab inspector)
 * read it, so the panel never offers an option the layout ignores. Pure and client-safe
 * (type-only imports), unit-tested in tests/unit/layouts.test.ts.
 */
import type { HomepageConfig, SiteLayout, Tab } from "@/lib/schema/config";

type Layout = HomepageConfig["layout"];

export interface LayoutFeatures {
  /**
   * How a tab's widgets are arranged: the tab's own "Arrange widgets" setting, or fixed by
   * the layout (bento = always a grid; link in bio = always one per row, the column is too
   * narrow for widgets side by side; masonry = staggered columns, no widths).
   */
  arrange: "choice" | "grid" | "stack" | "masonry";
  /** Whether a tab's own background is shown (not in one page: every tab is on screen at once). */
  tabBackground: boolean;
  /** When tab labels and icons are shown: always, or only with more than one tab (no tab bar for one). */
  tabNav: "always" | "multiple";
  /** Built on the tab bar (`Tabs`), so `layout.mobileNav` applies. One page has its own jump bar. */
  tabBar: boolean;
  /** One tab can be shown as a column beside the others (`layout.pinnedTab`). */
  pinnedColumn: boolean;
  /**
   * The same tab navigation at every screen width (link in bio, a phone-sized column anyway):
   * one scrolling row of small tabs, instead of the menu button / bottom bar on phones and the
   * tab bar on desktop. So `mobileNav` doesn't apply.
   */
  uniformNav?: boolean;
  /**
   * What the layout leaves of the `banner` settings (lib/banner.ts): all of them, no "one row"
   * (the page is too narrow for it), or `column`: from md up the title and tabs are the left
   * column, so the banner is only shown on phones.
   */
  banner: "full" | "stacked" | "column";
}

export const LAYOUT_FEATURES: Record<SiteLayout, LayoutFeatures> = {
  tabs: { arrange: "choice", tabBackground: true, tabNav: "always", tabBar: true, pinnedColumn: false, banner: "full" },
  sidebar: { arrange: "choice", tabBackground: true, tabNav: "always", tabBar: true, pinnedColumn: false, banner: "column" },
  onepage: { arrange: "choice", tabBackground: false, tabNav: "multiple", tabBar: false, pinnedColumn: false, banner: "full" },
  bento: { arrange: "grid", tabBackground: true, tabNav: "always", tabBar: true, pinnedColumn: false, banner: "full" },
  linkinbio: { arrange: "stack", tabBackground: true, tabNav: "multiple", tabBar: true, pinnedColumn: false, uniformNav: true, banner: "stacked" },
  masonry: { arrange: "masonry", tabBackground: true, tabNav: "always", tabBar: true, pinnedColumn: false, banner: "full" },
  profile: { arrange: "choice", tabBackground: true, tabNav: "always", tabBar: true, pinnedColumn: true, banner: "full" },
};

/** How TabSections lays tabs out under a site layout. */
export interface GridOptions {
  arrange: LayoutFeatures["arrange"];
  /** Width (of 12) of a widget without its own `span`: full width, or 12 / widgets per row in bento. */
  defaultSpan: number;
  /** Masonry: columns on wide screens. */
  columns?: number;
}

export function gridOptions(layout: Layout): GridOptions {
  const { arrange } = LAYOUT_FEATURES[layout.site];
  return {
    arrange,
    defaultSpan: layout.site === "bento" ? 12 / layout.bentoColumns : 12,
    ...(arrange === "masonry" ? { columns: layout.masonryColumns } : null),
  };
}

/** A pinned tab (the profile column) is always one widget per row: the column is narrow. */
export const COLUMN_GRID: GridOptions = { arrange: "stack", defaultSpan: 12 };

/**
 * Id of the tab shown as the column, or null: only in a layout with a column, only when the
 * chosen tab still exists, and only with at least one other tab left for the main area.
 */
export function pinnedTabId(config: Pick<HomepageConfig, "layout" | "tabs">): string | null {
  const { layout, tabs } = config;
  if (!LAYOUT_FEATURES[layout.site].pinnedColumn || !layout.pinnedTab || tabs.length < 2) return null;
  return tabs.some((t) => t.id === layout.pinnedTab) ? layout.pinnedTab : null;
}

/** How this tab's widgets are actually arranged on the site. */
export function arrangeOf(options: GridOptions, tab: Pick<Tab, "id" | "layout">, pinnedId: string | null = null): "grid" | "stack" | "masonry" {
  if (pinnedId && tab.id === pinnedId) return "stack";
  if (options.arrange === "choice") return tab.layout;
  return options.arrange;
}

/** Whether this tab is laid out as a grid (widgets side by side, `span` applies). */
export function isGridTab(options: GridOptions, tab: Pick<Tab, "id" | "layout">, pinnedId: string | null = null): boolean {
  return arrangeOf(options, tab, pinnedId) === "grid";
}

export interface IgnoredSetting {
  /** The tab field to hide in the panel, or null for a note only. */
  key: "layout" | "background" | null;
  note: string;
}

/**
 * Tab settings the current layout ignores for this tab, with the reason in the panel's
 * voice. The builder hides these fields and shows the reasons instead; the values stay in
 * the config, so switching back to a layout that uses them restores them.
 */
export function ignoredTabSettings(config: Pick<HomepageConfig, "layout" | "tabs">, tabId?: string): IgnoredSetting[] {
  const { layout, tabs } = config;
  const f = LAYOUT_FEATURES[layout.site];
  const out: IgnoredSetting[] = [];
  if (tabId && tabId === pinnedTabId(config)) {
    out.push({ key: "layout", note: "This tab is the column beside the other tabs (Header & layout → Layout), so its widgets are always one per row." });
    out.push({ key: "background", note: "The column has no background of its own; the open tab's background is shown behind it." });
    return out;
  }
  if (f.arrange === "grid")
    out.push({ key: "layout", note: `In the Bento layout every tab is a grid: ${layout.bentoColumns} widgets per row unless a widget has its own width (Header & layout → Layout).` });
  if (f.arrange === "stack") out.push({ key: "layout", note: "The Link in bio column is too narrow for widgets side by side, so every tab shows its widgets one per row." });
  if (f.arrange === "masonry")
    out.push({ key: "layout", note: `In the Masonry layout widgets flow into up to ${layout.masonryColumns} columns, top to bottom, each as tall as it needs. Widths don't apply.` });
  if (!f.tabBackground) out.push({ key: "background", note: "Tab backgrounds don't show in the One page layout (every tab is on screen at once); the site background is used." });
  if (f.tabNav === "multiple" && tabs.length === 1)
    out.push({
      key: null,
      note:
        layout.site === "onepage"
          ? "With one tab there is no jump bar or section heading, so this tab's label and icon don't appear on the page."
          : "With one tab the Link in bio layout shows no tab bar, so this tab's label and icon don't appear on the page.",
    });
  if (f.pinnedColumn && !pinnedTabId(config))
    out.push({ key: null, note: "No tab is shown in the column yet: pick one on Header & layout → Layout (it needs at least one other tab)." });
  return out;
}

/** Whether the phone layout uses the bottom tab bar (a layout with a tab bar, the option on, and a bar to show). */
export function bottomNav(layout: Layout, visibleTabs: number): boolean {
  const f = LAYOUT_FEATURES[layout.site];
  return f.tabBar && !f.uniformNav && layout.mobileNav === "bottom" && (f.tabNav === "always" || visibleTabs > 1) && visibleTabs > 0;
}
