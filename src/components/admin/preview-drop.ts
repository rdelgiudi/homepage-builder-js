/**
 * Dropping widgets onto the admin preview (the site in an iframe). The iframe is same-origin,
 * so the panel reads the preview's layout directly: `TabSections` marks, in the preview only,
 * each tab's widget container with `data-tab-id` and each widget's wrapper with
 * `data-section-id`. The panel turns the pointer position into a drop target from those
 * boxes. The DOM part is `previewCandidates`; everything else is pure and unit-tested.
 */
import type { DropSide, GridItem } from "./grid-layout";

/** Drag id prefix of an existing widget (outline rows and tiles, the preview's move handle). */
export const SECTION_DRAG = "sec:";
/**
 * Drag id prefix of the preview's move handle. Its own prefix because the same widget's outline
 * row is a draggable too, and dnd-kit needs unique ids; the builder treats it like `sec:`.
 */
export const PREVIEW_MOVE = "move:";

export interface Point {
  x: number;
  y: number;
}
export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** A widget (or an empty tab, `id: null`) the pointer could drop onto, in iframe viewport coordinates. */
export interface PreviewCandidate {
  tabId: string;
  id: string | null;
  box: Box;
  /** Its container shows widgets side by side right now (a grid with more than one column). */
  beside: boolean;
}

/** Where a drop on the preview goes: beside / above / below widget `id`, or the end of an empty tab. */
export type PreviewHit = { tabId: string; id: string; side: DropSide; box: Box } | { tabId: string; id: null; side: "end"; box: Box };

/** Height given to an empty tab's (zero-height) container so it can be hit and marked. */
export const EMPTY_TAB_HEIGHT = 56;

const contains = (b: Box, p: Point) => p.x >= b.left && p.x <= b.left + b.width && p.y >= b.top && p.y <= b.top + b.height;

/** Distance from a point to a box (0 inside). */
export function distanceTo(b: Box, p: Point): number {
  const dx = Math.max(b.left - p.x, 0, p.x - (b.left + b.width));
  const dy = Math.max(b.top - p.y, 0, p.y - (b.top + b.height));
  return Math.hypot(dx, dy);
}

/**
 * Which side of a box the point is on. Beside (`beside`, grids only): outer 30% left/right;
 * otherwise the top or bottom half = a new row above / below. Works for points outside the box too.
 */
export function sideFor(p: Point, b: Box, beside: boolean): DropSide {
  if (beside) {
    const rx = (p.x - b.left) / (b.width || 1);
    if (rx < 0.3) return "left";
    if (rx > 0.7) return "right";
  }
  return p.y - b.top < b.height / 2 ? "above" : "below";
}

/** The widget under the point, else the nearest one (gaps between widgets, page margins). */
export function pickTarget(p: Point, candidates: PreviewCandidate[]): PreviewHit | null {
  if (!candidates.length) return null;
  const hit =
    candidates.find((c) => c.id !== null && contains(c.box, p)) ??
    candidates.reduce((best, c) => (distanceTo(c.box, p) < distanceTo(best.box, p) ? c : best));
  if (hit.id === null) return { tabId: hit.tabId, id: null, side: "end", box: hit.box };
  return { tabId: hit.tabId, id: hit.id, side: sideFor(p, hit.box, hit.beside), box: hit.box };
}

/**
 * One-per-row placement (stack, masonry, the profile column): `item` goes before or after
 * `id` (`left`/`above` = before), or at the end when `id` is null or missing. The item is
 * taken out first, so moves within the list work.
 */
export function placeInList<T extends GridItem>(items: T[], item: T, id: string | null, side: DropSide | "end"): T[] {
  const rest = items.filter((x) => x.id !== item.id);
  const at = id === null ? -1 : rest.findIndex((x) => x.id === id);
  const index = at < 0 ? rest.length : side === "left" || side === "above" ? at : at + 1;
  return [...rest.slice(0, index), item, ...rest.slice(index)];
}

/** Every drop candidate in the preview document (DOM; the iframe must be same-origin). */
export function previewCandidates(doc: Document): PreviewCandidate[] {
  const out: PreviewCandidate[] = [];
  doc.querySelectorAll<HTMLElement>("[data-tab-id]").forEach((container) => {
    const tabId = container.dataset.tabId ?? "";
    const own = container.getBoundingClientRect();
    if (!tabId || own.width === 0) return; // hidden (display: none somewhere above)
    const view = doc.defaultView;
    const style = view?.getComputedStyle(container);
    const beside = style?.display === "grid" && style.gridTemplateColumns.trim().split(/\s+/).length > 1;
    let found = 0;
    for (const el of Array.from(container.children) as HTMLElement[]) {
      const id = el.dataset.sectionId;
      const r = el.getBoundingClientRect();
      // A widget that currently renders nothing (an offline Twitch card, an expired notice) can't be aimed at.
      if (!id || r.width === 0 || r.height === 0) continue;
      found++;
      out.push({ tabId, id, beside, box: { left: r.left, top: r.top, width: r.width, height: r.height } });
    }
    if (!found) out.push({ tabId, id: null, beside: false, box: { left: own.left, top: own.top, width: own.width, height: Math.max(own.height, EMPTY_TAB_HEIGHT) } });
  });
  return out;
}
