import { test } from "node:test";
import assert from "node:assert/strict";
import { distanceTo, pickTarget, placeInList, sideFor, type PreviewCandidate } from "@/components/admin/preview-drop";

const box = (left: number, top: number, width: number, height: number) => ({ left, top, width, height });
const ids = (xs: { id: string }[]) => xs.map((x) => x.id);

test("sideFor: grids get beside on the outer 30%, one-per-row containers only above/below", () => {
  const b = box(0, 0, 100, 100);
  assert.equal(sideFor({ x: 10, y: 50 }, b, true), "left");
  assert.equal(sideFor({ x: 90, y: 50 }, b, true), "right");
  assert.equal(sideFor({ x: 50, y: 20 }, b, true), "above");
  assert.equal(sideFor({ x: 50, y: 80 }, b, true), "below");
  // Not beside: the horizontal position doesn't matter.
  assert.equal(sideFor({ x: 10, y: 20 }, b, false), "above");
  assert.equal(sideFor({ x: 90, y: 80 }, b, false), "below");
  // Outside the box (the gap under the last widget) still has a side.
  assert.equal(sideFor({ x: 50, y: 140 }, b, true), "below");
});

test("distanceTo is 0 inside and the shortest gap outside", () => {
  const b = box(10, 10, 20, 20);
  assert.equal(distanceTo(b, { x: 15, y: 15 }), 0);
  assert.equal(distanceTo(b, { x: 15, y: 40 }), 10);
  assert.equal(distanceTo(b, { x: 0, y: 0 }), Math.hypot(10, 10));
});

const page: PreviewCandidate[] = [
  { tabId: "home", id: "a", beside: true, box: box(0, 0, 100, 50) },
  { tabId: "home", id: "b", beside: true, box: box(120, 0, 100, 50) },
  { tabId: "side", id: "c", beside: false, box: box(300, 0, 80, 200) },
  { tabId: "empty", id: null, beside: false, box: box(0, 400, 220, 56) },
];

test("pickTarget: the widget under the pointer wins, with its own tab", () => {
  assert.deepEqual(pickTarget({ x: 110 + 100, y: 25 }, page), { tabId: "home", id: "b", side: "right", box: page[1].box });
  const column = pickTarget({ x: 310, y: 20 }, page);
  assert.equal(column?.tabId, "side");
  assert.equal(column?.side, "above"); // no beside in a one-per-row container
});

test("pickTarget: in a gap the nearest widget is used; an empty tab means its end", () => {
  assert.equal(pickTarget({ x: 50, y: 70 }, page)?.id, "a");
  assert.equal(pickTarget({ x: 50, y: 70 }, page)?.side, "below");
  assert.deepEqual(pickTarget({ x: 100, y: 420 }, page), { tabId: "empty", id: null, side: "end", box: page[3].box });
  assert.equal(pickTarget({ x: 0, y: 0 }, []), null);
});

test("placeInList: before / after a widget, at the end, and moves within the list", () => {
  const items = [{ id: "a" }, { id: "b" }, { id: "c" }];
  assert.deepEqual(ids(placeInList(items, { id: "n" }, "b", "above")), ["a", "n", "b", "c"]);
  assert.deepEqual(ids(placeInList(items, { id: "n" }, "b", "below")), ["a", "b", "n", "c"]);
  assert.deepEqual(ids(placeInList(items, { id: "n" }, null, "end")), ["a", "b", "c", "n"]);
  assert.deepEqual(ids(placeInList(items, { id: "n" }, "gone", "above")), ["a", "b", "c", "n"]);
  assert.deepEqual(ids(placeInList(items, { id: "a" }, "c", "below")), ["b", "c", "a"]);
  assert.deepEqual(ids(placeInList(items, { id: "c" }, "a", "above")), ["c", "a", "b"]);
});
