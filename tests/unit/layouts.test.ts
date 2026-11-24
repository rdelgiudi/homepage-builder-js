import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { LAYOUT_FEATURES, arrangeOf, bottomNav, gridOptions, ignoredTabSettings, isGridTab, pinnedTabId } from "@/lib/layouts";
import { bannerOptions, ignoredBannerSettings, splitTabs, withPhoneBanner, type BannerScreens } from "@/lib/banner";
import { BannerSchema, LayoutSchema, SITE_LAYOUTS, type HomepageConfig } from "@/lib/schema/config";

type Site = (typeof SITE_LAYOUTS)[number];
const layout = (site: Site, extra: Partial<HomepageConfig["layout"]> = {}) => LayoutSchema.parse({ site, ...extra });
const tabsOf = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `t${i}`, layout: "stack" as const }));
const cfg = (site: Site, n = 3, extra: Partial<HomepageConfig["layout"]> = {}) => ({ layout: layout(site, extra), tabs: tabsOf(n) }) as unknown as Pick<HomepageConfig, "layout" | "tabs">;
const grid = { id: "g", layout: "grid" as const };
const stack = { id: "s", layout: "stack" as const };

describe("site layouts and tab settings", () => {
  it("every layout has an entry", () => {
    for (const site of SITE_LAYOUTS) assert.ok(LAYOUT_FEATURES[site], site);
  });

  it("the tab's own grid/stack choice applies in tabs, sidebar, one page and profile", () => {
    for (const site of ["tabs", "sidebar", "onepage", "profile"] as const) {
      assert.equal(isGridTab(gridOptions(layout(site)), grid), true, site);
      assert.equal(isGridTab(gridOptions(layout(site)), stack), false, site);
    }
  });

  it("bento is always a grid, link in bio never, masonry is its own arrangement", () => {
    assert.equal(isGridTab(gridOptions(layout("bento")), stack), true);
    assert.equal(isGridTab(gridOptions(layout("linkinbio")), grid), false);
    assert.equal(arrangeOf(gridOptions(layout("masonry")), grid), "masonry");
    assert.equal(isGridTab(gridOptions(layout("masonry")), grid), false, "no widths in masonry");
    assert.equal(gridOptions(layout("masonry", { masonryColumns: 2 })).columns, 2);
  });

  it("bento's default width follows widgets per row", () => {
    assert.equal(gridOptions(layout("bento", { bentoColumns: 2 })).defaultSpan, 6);
    assert.equal(gridOptions(layout("bento", { bentoColumns: 3 })).defaultSpan, 4);
    assert.equal(gridOptions(layout("bento", { bentoColumns: 4 })).defaultSpan, 3);
    assert.equal(gridOptions(layout("tabs", { bentoColumns: 3 })).defaultSpan, 12, "only bento uses it");
  });

  it("the panel hides what the layout ignores and says why", () => {
    const keys = (site: Site, n = 3) => ignoredTabSettings(cfg(site, n)).map((x) => x.key);
    assert.deepEqual(keys("tabs"), []);
    assert.deepEqual(keys("sidebar"), []);
    assert.deepEqual(keys("bento"), ["layout"]);
    assert.deepEqual(keys("linkinbio"), ["layout"]);
    assert.deepEqual(keys("masonry"), ["layout"]);
    assert.deepEqual(keys("onepage"), ["background"]);
    assert.deepEqual(keys("linkinbio", 1), ["layout", null], "one tab: no tab bar, a note without a hidden field");
    assert.deepEqual(keys("onepage", 1), ["background", null]);
    assert.match(ignoredTabSettings(cfg("bento", 2, { bentoColumns: 3 }))[0].note, /3 widgets per row/);
  });
});

describe("profile column (pinned tab)", () => {
  it("only with the layout, a tab that exists, and another tab left", () => {
    assert.equal(pinnedTabId(cfg("profile", 3, { pinnedTab: "t1" })), "t1");
    assert.equal(pinnedTabId(cfg("profile", 3)), null, "not set = no column");
    assert.equal(pinnedTabId(cfg("profile", 3, { pinnedTab: "deleted" })), null, "a deleted tab");
    assert.equal(pinnedTabId(cfg("profile", 1, { pinnedTab: "t0" })), null, "the only tab stays the main area");
    assert.equal(pinnedTabId(cfg("tabs", 3, { pinnedTab: "t1" })), null, "other layouts ignore the setting");
  });

  it("the pinned tab is always a stack, even when the tab says grid", () => {
    const options = gridOptions(layout("profile"));
    assert.equal(isGridTab(options, { id: "t1", layout: "grid" }, "t1"), false);
    assert.equal(isGridTab(options, { id: "t2", layout: "grid" }, "t1"), true, "the other tabs keep their choice");
  });

  it("the panel explains the pinned tab, and prompts for a pin when there is none", () => {
    const pinned = ignoredTabSettings(cfg("profile", 3, { pinnedTab: "t1" }), "t1").map((x) => x.key);
    assert.deepEqual(pinned, ["layout", "background"]);
    assert.deepEqual(ignoredTabSettings(cfg("profile", 3, { pinnedTab: "t1" }), "t2"), []);
    const unpinned = ignoredTabSettings(cfg("profile", 3), "t0");
    assert.equal(unpinned.length, 1);
    assert.match(unpinned[0].note, /No tab is shown in the column/);
  });
});

describe("bottom tab bar on phones", () => {
  it("only for layouts with a tab bar, when chosen, and when there is a bar to show", () => {
    assert.equal(bottomNav(layout("tabs", { mobileNav: "bottom" }), 3), true);
    assert.equal(bottomNav(layout("tabs"), 3), false, "default = menu button");
    assert.equal(bottomNav(layout("onepage", { mobileNav: "bottom" }), 3), false, "one page has its own jump bar");
    assert.equal(bottomNav(layout("masonry", { mobileNav: "bottom" }), 2), true);
    assert.equal(bottomNav(layout("linkinbio", { mobileNav: "bottom" }), 3), false, "link in bio looks the same on every screen: its tab row everywhere");
  });
});

describe("banner settings per layout", () => {
  const inline = BannerSchema.parse({ arrangement: "inline" });
  const keys = (site: Site, banner = inline, screens: BannerScreens = "all") => ignoredBannerSettings(layout(site), banner, screens).flatMap((i) => i.keys);

  it("the defaults are the banner as it was before it had settings", () => {
    assert.deepEqual(BannerSchema.parse({}), {
      title: "name",
      logoHeight: 64,
      showTagline: true,
      arrangement: "stacked",
      titlePosition: "center",
      tabsPosition: "center",
      fullWidth: false,
      scroll: "tabs",
      themeSwitch: "floating",
      languagePicker: "banner",
    });
  });

  it("one row applies everywhere but in link in bio, and only there the panel hides it", () => {
    for (const site of SITE_LAYOUTS) {
      const stacked = site === "linkinbio";
      assert.equal(bannerOptions(layout(site), inline).options.arrangement, stacked ? "stacked" : "inline", site);
      assert.equal(keys(site).includes("arrangement"), stacked, site);
    }
  });

  it("the tabs' position is hidden where nothing follows it", () => {
    assert.deepEqual(keys("tabs"), ["tabsPosition"], "centered title in one row: the tabs are split around it");
    assert.deepEqual(keys("tabs", { ...inline, titlePosition: "left" }), []);
    assert.deepEqual(keys("tabs", { ...inline, arrangement: "stacked" }), []);
    assert.deepEqual(keys("sidebar"), ["tabsPosition", "fullWidth"]);
  });

  it("phones follow the same settings unless they have their own set", () => {
    assert.equal(bannerOptions(layout("tabs"), inline).phone, undefined);
    const own = withPhoneBanner(inline, true);
    assert.deepEqual(own.phone, inline, "starts as a copy, so nothing changes yet");
    const split = BannerSchema.parse({ ...own, phone: { scroll: "hide" } });
    const { options, phone } = bannerOptions(layout("tabs"), split);
    assert.equal("phone" in options, false);
    assert.equal(options.scroll, "tabs");
    assert.equal(phone?.scroll, "hide");
    assert.equal(phone?.arrangement, "stacked", "the whole set is the phones' own: what it leaves out is the default, not the other set's");
    assert.equal(bannerOptions(layout("linkinbio"), withPhoneBanner(inline, true)).phone?.arrangement, "stacked");
    assert.deepEqual(withPhoneBanner(split, false), inline, "back to one set");
  });

  it("each set offers only what does something on its screens", () => {
    const stacked = BannerSchema.parse({});
    assert.deepEqual(keys("tabs", stacked, "phone"), ["fullWidth", "tabsPosition"]);
    assert.deepEqual(keys("tabs", inline, "phone"), ["fullWidth", "tabsPosition", "showTagline"]);
    assert.deepEqual(keys("onepage", stacked, "phone"), ["fullWidth"], "its jump links are a row on phones too");
    assert.deepEqual(keys("linkinbio", stacked, "phone"), ["arrangement", "fullWidth"]);
    assert.deepEqual(keys("sidebar", stacked, "desktop"), ["arrangement", "titlePosition", "tabsPosition", "fullWidth", "scroll"]);
    assert.deepEqual(keys("tabs", stacked, "desktop"), []);
  });

  it("a centered title splits the tabs, the first half being the larger", () => {
    assert.deepEqual(splitTabs([1, 2, 3, 4, 5]), [[1, 2, 3], [4, 5]]);
    assert.deepEqual(splitTabs([1]), [[1], []]);
    assert.deepEqual(splitTabs([]), [[], []]);
  });
});
