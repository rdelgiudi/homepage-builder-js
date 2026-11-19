import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { LAYOUT_FEATURES, gridOptions, ignoredTabSettings, isGridTab } from "@/lib/layouts";
import { SITE_LAYOUTS } from "@/lib/schema/config";

const layout = (site: (typeof SITE_LAYOUTS)[number], bentoColumns = 2) => ({ site, bentoColumns, sectionHeadings: true });

describe("site layouts and tab settings", () => {
  it("every layout has an entry", () => {
    for (const site of SITE_LAYOUTS) assert.ok(LAYOUT_FEATURES[site], site);
  });

  it("the tab's own grid/stack choice applies in tabs, sidebar and one page", () => {
    for (const site of ["tabs", "sidebar", "onepage"] as const) {
      assert.equal(isGridTab(gridOptions(layout(site)), { layout: "grid" }), true, site);
      assert.equal(isGridTab(gridOptions(layout(site)), { layout: "stack" }), false, site);
    }
  });

  it("bento is always a grid, link in bio never", () => {
    assert.equal(isGridTab(gridOptions(layout("bento")), { layout: "stack" }), true);
    assert.equal(isGridTab(gridOptions(layout("linkinbio")), { layout: "grid" }), false);
  });

  it("bento's default width follows widgets per row", () => {
    assert.equal(gridOptions(layout("bento", 2)).defaultSpan, 6);
    assert.equal(gridOptions(layout("bento", 3)).defaultSpan, 4);
    assert.equal(gridOptions(layout("bento", 4)).defaultSpan, 3);
    assert.equal(gridOptions(layout("tabs", 3)).defaultSpan, 12, "only bento uses it");
  });

  it("the panel hides what the layout ignores and says why", () => {
    const keys = (site: (typeof SITE_LAYOUTS)[number], tabs = 3) => ignoredTabSettings(layout(site), tabs).map((x) => x.key);
    assert.deepEqual(keys("tabs"), []);
    assert.deepEqual(keys("sidebar"), []);
    assert.deepEqual(keys("bento"), ["layout"]);
    assert.deepEqual(keys("linkinbio"), ["layout"]);
    assert.deepEqual(keys("onepage"), ["background"]);
    assert.deepEqual(keys("linkinbio", 1), ["layout", null], "one tab: no tab bar, a note without a hidden field");
    assert.deepEqual(keys("onepage", 1), ["background", null]);
    assert.match(ignoredTabSettings(layout("bento", 3), 2)[0].note, /3 widgets per row/);
  });
});
