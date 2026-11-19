import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { sameConfig } from "@/components/admin/same";
import { COLUMNS, fitRow, moveDivider, packRows, placeInGrid, removeFromGrid, rowIds, rowPresets, setRowSpans, spanOf, splitRow, type GridItem } from "@/components/admin/grid-layout";

const items = (...spans: (number | undefined)[]) => spans.map((span, i) => (span === undefined ? { id: String.fromCharCode(97 + i) } : { id: String.fromCharCode(97 + i), span }));
const ids = (list: GridItem[]) => list.map((x) => x.id).join("");
/** Rows as "ab|c" strings with their spans, to compare whole layouts at a glance. */
const layout = (list: GridItem[], def = 12) => packRows(list, def).map((r) => r.map((i) => `${list[i].id}${spanOf(list[i], def)}`).join(" ")).join(" | ");

describe("grid layout: packing", () => {
  it("wraps like CSS grid: an item that doesn't fit what is left starts a new row", () => {
    assert.deepEqual(packRows(items(6, 6, 8, 6, 4), 12), [[0, 1], [2], [3, 4]]);
  });
  it("an unset span uses the layout's default (12 in a grid tab, 6 in bento)", () => {
    assert.deepEqual(packRows(items(undefined, undefined), 12), [[0], [1]]);
    assert.deepEqual(packRows(items(undefined, undefined, undefined), 6), [[0, 1], [2]]);
  });
});

describe("grid layout: fitRow", () => {
  it("always adds up to 12, in proportion, at least 3 wide", () => {
    assert.deepEqual(fitRow([12, 12]), [6, 6]);
    assert.deepEqual(fitRow([6, 6, 6]), [4, 4, 4]);
    assert.deepEqual(fitRow([8, 4]), [8, 4]);
    for (const w of [[8, 4, 6], [1, 1, 30], [5, 5, 5, 5], [11, 1]]) {
      const s = fitRow(w);
      assert.equal(s.reduce((a, b) => a + b, 0), COLUMNS, String(w));
      assert.ok(s.every((x) => x >= 3), String(s));
    }
  });
  it("copes with hand-edited rows of more than four (the minimum drops so it still fits)", () => {
    const s = fitRow([2, 2, 2, 2, 2]);
    assert.equal(s.reduce((a, b) => a + b, 0), COLUMNS);
    assert.ok(s.every((x) => x >= 2));
    assert.equal(fitRow([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]).length, 12);
  });
});

describe("grid layout: placing beside", () => {
  it("splits the row: 12 → 6/6 → 4/4/4 → 3/3/3/3 → no room", () => {
    let list: GridItem[] = [{ id: "a" }];
    for (const [id, want] of [["b", "a6 b6"], ["c", "a4 b4 c4"], ["d", "a3 b3 c3 d3"]] as const) {
      const r = placeInGrid(list, { id }, { id: list[list.length - 1].id, side: "right" }, 12);
      assert.ok(r.ok);
      list = r.items;
      assert.equal(layout(list), want);
    }
    const full = placeInGrid(list, { id: "e" }, { id: "a", side: "left" }, 12);
    assert.equal(full.ok, false);
    assert.match(!full.ok ? full.reason : "", /No room/);
  });

  it("left puts it before the target, keeping the others' proportions", () => {
    const r = placeInGrid(items(8, 4), { id: "x" }, { id: "b", side: "left" }, 12);
    assert.ok(r.ok);
    assert.equal(ids(r.items), "axb");
    assert.equal(r.items.reduce((s, x) => s + spanOf(x, 12), 0), 12);
  });

  it("moving within a full row works, because the widget leaves its place first", () => {
    const r = placeInGrid(items(3, 3, 3, 3), { id: "a", span: 3 }, { id: "d", side: "right" }, 12);
    assert.ok(r.ok);
    assert.equal(layout(r.items), "b3 c3 d3 a3");
  });

  it("only touches the target row; rows below keep their packing", () => {
    const list = items(6, 6, 4, 4, 4);
    const r = placeInGrid(list, { id: "x" }, { id: "a", side: "right" }, 12);
    assert.ok(r.ok);
    assert.equal(layout(r.items), "a4 x4 b4 | c4 d4 e4");
  });
});

describe("grid layout: new rows and removing", () => {
  it("above / below / end make a full-width row, also in bento (stored as span 12)", () => {
    const below = placeInGrid(items(6, 6, 12), { id: "x" }, { id: "a", side: "below" }, 12);
    assert.ok(below.ok);
    assert.equal(layout(below.items), "a6 b6 | x12 | c12");
    assert.equal("span" in below.items[2], false, "12 is the grid tab default, so no span is stored");

    const bento = placeInGrid(items(undefined, undefined), { id: "x" }, { id: "b", side: "above" }, 6);
    assert.ok(bento.ok);
    assert.equal(layout(bento.items, 6), "x12 | a6 b6");
    assert.equal(bento.items[0].span, 12);

    const end = placeInGrid(items(6, 6), { id: "x" }, { id: null, side: "end" }, 12);
    assert.ok(end.ok);
    assert.equal(layout(end.items), "a6 b6 | x12");
  });

  it("removing widens the rest of the row so nothing below moves up", () => {
    assert.equal(layout(removeFromGrid(items(4, 4, 4, 12), "b", 12)), "a6 c6 | d12");
    assert.equal(layout(removeFromGrid(items(6, 6, 6, 6), "a", 12)), "b12 | c6 d6");
    // Bento (default 6): widening a widget that had no span to 12 has to store it.
    const bento = removeFromGrid(items(undefined, undefined, undefined, undefined), "a", 6);
    assert.equal(layout(bento, 6), "b12 | c6 d6");
    assert.equal(bento[0].span, 12, "b, now first");
    assert.equal("span" in bento[1], false, "untouched rows keep no span");
  });

  it("moving to another row fills the row it left", () => {
    const r = placeInGrid(items(6, 6, 12), { id: "a", span: 6 }, { id: "c", side: "right" }, 12);
    assert.ok(r.ok);
    assert.equal(layout(r.items), "b12 | c6 a6");
  });

  it("dropping on itself does nothing", () => {
    const r = placeInGrid(items(6, 6), { id: "a", span: 6 }, { id: "a", side: "right" }, 12);
    assert.equal(r.ok, false);
  });
});

describe("grid layout: editing a row", () => {
  it("finds a widget's row", () => {
    assert.deepEqual(rowIds(items(4, 4, 4, 12), "b", 12), ["a", "b", "c"]);
    assert.deepEqual(rowIds(items(4, 4, 4, 12), "d", 12), ["d"]);
    assert.deepEqual(rowIds(items(4), "zz", 12), []);
  });

  it("a divider moves only its two neighbours and keeps the minimum", () => {
    assert.deepEqual(moveDivider([4, 4, 4], 0, 5), [5, 3, 4]);
    assert.deepEqual(moveDivider([4, 4, 4], 0, 7), [5, 3, 4], "clamped so the middle keeps 3");
    assert.deepEqual(moveDivider([4, 4, 4], 1, 10), [4, 5, 3]);
    assert.deepEqual(moveDivider([6, 6], 0, 1), [3, 9]);
    assert.deepEqual(moveDivider([6, 6], 5, 1), [6, 6], "no such divider");
  });

  it("presets add up to 12 for every row size", () => {
    for (let n = 1; n <= 6; n++) for (const p of rowPresets(n)) assert.equal(p.reduce((a, b) => a + b, 0), COLUMNS, `${n}: ${p}`);
  });

  it("sets a row's widths without touching other rows; refuses widths that would re-pack", () => {
    const list = items(4, 4, 4, 6, 6);
    assert.equal(layout(setRowSpans(list, ["a", "b", "c"], [6, 3, 3], 12)), "a6 b3 c3 | d6 e6");
    assert.equal(setRowSpans(list, ["a", "b", "c"], [6, 3, 4], 12), list, "sum is not 12");
    assert.equal(setRowSpans(list, ["a", "b"], [6, 6], 12), list, "not the whole row");
    assert.equal(setRowSpans(list, ["a", "b", "c"], [10, 1, 1], 12), list, "under the minimum");
  });

  it("split puts each widget on its own full-width row", () => {
    const out = splitRow(items(4, 4, 4, 6, 6), ["a", "b", "c"], 12);
    assert.equal(layout(out), "a12 | b12 | c12 | d6 e6");
    assert.equal(out[0].span, 12, "an existing span is updated, not removed");
    assert.equal("span" in splitRow([{ id: "x" }], ["x"], 12)[0], false, "no span added for the default");
  });
});

describe("draft comparison and key order", () => {
  it("a span that equals the default is kept when it was there (round trip = no draft)", () => {
    const original = [{ id: "a", type: "x", span: 6 }, { id: "b", type: "x", span: 6 }];
    const back = setRowSpans(setRowSpans(original, ["a", "b"], [8, 4], 6), ["a", "b"], [6, 6], 6);
    assert.equal(JSON.stringify(back), JSON.stringify(original));
  });

  it("re-setting a width keeps the key where it was, so a round trip is byte-identical", () => {
    const original = [
      { id: "a", type: "clock", span: 4, timezone: "UTC" },
      { id: "b", type: "clock", span: 4, timezone: "UTC" },
      { id: "c", type: "clock", span: 4, timezone: "UTC" },
    ];
    const changed = setRowSpans(original, ["a", "b", "c"], [6, 3, 3], 12);
    const back = setRowSpans(changed, ["a", "b", "c"], [4, 4, 4], 12);
    assert.equal(JSON.stringify(back), JSON.stringify(original));
  });

  it("sameConfig ignores key order but not values or array order", () => {
    assert.equal(sameConfig({ a: 1, b: { c: 2, d: [1, 2] } }, { b: { d: [1, 2], c: 2 }, a: 1 }), true);
    assert.equal(sameConfig({ a: 1, b: undefined }, { a: 1 }), true, "undefined keys don't count, as in JSON");
    assert.equal(sameConfig({ a: 1 }, { a: 2 }), false);
    assert.equal(sameConfig({ d: [1, 2] }, { d: [2, 1] }), false);
    assert.equal(sameConfig(null, {}), false);
  });
});
