/**
 * Row logic for the builder's grid view (pure, unit-tested; no React, no zod).
 *
 * The site lays a grid tab out with CSS grid: 12 columns, items in order, each spanning
 * `span` columns, and an item that doesn't fit in what is left of a row wraps to the next
 * (no `dense` packing). `packRows` reproduces that, so the builder knows which widgets
 * share a row. Every row an operation touches is made to add up to exactly 12, which keeps
 * the rows below it packed the way they were.
 */

export const COLUMNS = 12;
/** Narrowest width a drop gives a widget, so a row holds at most COLUMNS / MIN_SPAN = 4. */
export const MIN_SPAN = 3;
export const MAX_PER_ROW = COLUMNS / MIN_SPAN;

export interface GridItem {
  id: string;
  span?: number;
}

export type DropSide = "left" | "right" | "above" | "below";
export type DropTarget = { id: string; side: DropSide } | { id: null; side: "end" };

export type PlaceResult<T extends GridItem> = { ok: true; items: T[]; row: T[] } | { ok: false; reason: string };

const clampSpan = (span: number) => Math.min(COLUMNS, Math.max(1, Math.round(span)));
export const spanOf = (item: GridItem, defaultSpan: number) => clampSpan(item.span ?? defaultSpan);

/** Rows as CSS grid packs them: indexes into `items`, in order. */
export function packRows(items: GridItem[], defaultSpan: number): number[][] {
  const rows: number[][] = [];
  let used = COLUMNS;
  items.forEach((item, i) => {
    const span = spanOf(item, defaultSpan);
    if (used + span > COLUMNS) {
      rows.push([]);
      used = 0;
    }
    rows[rows.length - 1].push(i);
    used += span;
  });
  return rows;
}

/**
 * Integer spans in proportion to `weights` that add up to exactly 12. The minimum is
 * MIN_SPAN, lowered for rows that already hold more than four (hand-edited configs), so
 * the result always exists. Largest-remainder rounding.
 */
export function fitRow(weights: number[]): number[] {
  const n = weights.length;
  if (!n) return [];
  const min = Math.max(1, Math.min(MIN_SPAN, Math.floor(COLUMNS / n)));
  const w = weights.map((x) => (Number.isFinite(x) && x > 0 ? x : 1));
  const fixed: (number | null)[] = w.map(() => null);
  // Pin anything that would fall under the minimum, then share the rest among the others.
  for (;;) {
    const free = w.map((x, i) => (fixed[i] === null ? x : 0));
    const freeSum = free.reduce((a, b) => a + b, 0);
    const left = COLUMNS - fixed.reduce<number>((a, b) => a + (b ?? 0), 0);
    let pinned = false;
    free.forEach((x, i) => {
      if (fixed[i] === null && (x / freeSum) * left < min) {
        fixed[i] = min;
        pinned = true;
      }
    });
    if (!pinned) break;
    if (fixed.every((f) => f !== null)) break;
  }
  const left = COLUMNS - fixed.reduce<number>((a, b) => a + (b ?? 0), 0);
  const freeSum = w.reduce((a, x, i) => a + (fixed[i] === null ? x : 0), 0);
  const raw = w.map((x, i) => (fixed[i] !== null ? fixed[i]! : (x / freeSum) * left));
  const spans = raw.map(Math.floor);
  let rest = COLUMNS - spans.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => [r - Math.floor(r), i] as const).sort((a, b) => b[0] - a[0]);
  for (let k = 0; rest > 0; k = (k + 1) % n, rest--) spans[order[k][1]]++;
  return spans;
}

/**
 * `span` as stored. A widget that has no `span` and gets the layout's default keeps having
 * none (the width bar's "use the default"). An existing `span` is updated in place — never
 * removed or moved to the end — so changing a width and changing it back gives back exactly
 * the published section, and the draft goes away.
 */
function withSpan<T extends GridItem>(item: T, span: number, defaultSpan: number): T {
  if (span === defaultSpan && !("span" in item)) return item;
  return { ...item, span };
}

function refit<T extends GridItem>(row: T[], weights: number[], defaultSpan: number): T[] {
  const spans = fitRow(weights);
  return row.map((item, i) => withSpan(item, spans[i], defaultSpan));
}

/**
 * Takes an item out of the grid. The rest of its row is widened to fill the 12 columns
 * again (keeping their proportions), so the rows below don't move up into the gap.
 */
export function removeFromGrid<T extends GridItem>(items: T[], id: string, defaultSpan: number): T[] {
  const index = items.findIndex((x) => x.id === id);
  if (index < 0) return items;
  const row = packRows(items, defaultSpan).find((r) => r.includes(index))!;
  const others = row.filter((i) => i !== index);
  const fitted = others.length ? refit(others.map((i) => items[i]), others.map((i) => spanOf(items[i], defaultSpan)), defaultSpan) : [];
  const out: T[] = [];
  items.forEach((item, i) => {
    if (i === index) return;
    const k = others.indexOf(i);
    out.push(k >= 0 ? fitted[k] : item);
  });
  return out;
}

/**
 * Puts `item` (new, or already in `items` — then it is moved) next to a target:
 * - `left` / `right`: into the target's row; the row is re-divided in proportion to the
 *   current widths, the newcomer getting an average share. A full row (4 widgets) refuses.
 * - `above` / `below`: a new full-width row before / after the target's row.
 * - `end`: a new full-width row at the end.
 * Returns the new list and the row the item ended up in, or why it can't go there.
 */
export function placeInGrid<T extends GridItem>(items: T[], item: T, target: DropTarget, defaultSpan: number): PlaceResult<T> {
  if (target.id === item.id) return { ok: false, reason: "" };
  const rest = items.some((x) => x.id === item.id) ? removeFromGrid(items, item.id, defaultSpan) : items;
  const bare = withSpan(item, COLUMNS, defaultSpan);

  if (target.id === null) {
    const out = [...rest, bare];
    return { ok: true, items: out, row: [bare] };
  }
  const tIndex = rest.findIndex((x) => x.id === target.id);
  if (tIndex < 0) return { ok: false, reason: "That widget is no longer here." };
  const rows = packRows(rest, defaultSpan);
  const row = rows.find((r) => r.includes(tIndex))!;

  if (target.side === "above" || target.side === "below") {
    const at = target.side === "above" ? row[0] : row[row.length - 1] + 1;
    const out = [...rest.slice(0, at), bare, ...rest.slice(at)];
    return { ok: true, items: out, row: [bare] };
  }

  if (row.length >= MAX_PER_ROW) return { ok: false, reason: `No room: a row holds at most ${MAX_PER_ROW} widgets.` };
  const members = row.map((i) => rest[i]);
  const weights = members.map((m) => spanOf(m, defaultSpan));
  const share = weights.reduce((a, b) => a + b, 0) / weights.length;
  const pos = row.indexOf(tIndex) + (target.side === "right" ? 1 : 0);
  members.splice(pos, 0, bare);
  weights.splice(pos, 0, share);
  const fitted = refit(members, weights, defaultSpan);
  const out = [...rest.slice(0, row[0]), ...fitted, ...rest.slice(row[row.length - 1] + 1)];
  return { ok: true, items: out, row: fitted };
}

// --- editing a whole row (the builder's row inspector) ---

/** Narrowest width in a row of `n` widgets: MIN_SPAN, or less for hand-made rows of 5+. */
export const minSpanFor = (n: number) => Math.max(1, Math.min(MIN_SPAN, Math.floor(COLUMNS / Math.max(1, n))));

/** Ids of the widgets in the same row as `id` (empty if it isn't there), in order. */
export function rowIds(items: GridItem[], id: string, defaultSpan: number): string[] {
  const index = items.findIndex((x) => x.id === id);
  if (index < 0) return [];
  return packRows(items, defaultSpan).find((r) => r.includes(index))!.map((i) => items[i].id);
}

/**
 * Moves the divider after widget `i` to `boundary` (in columns from the row's start); only
 * widgets `i` and `i + 1` change, each keeping at least the minimum width.
 */
export function moveDivider(spans: number[], i: number, boundary: number): number[] {
  if (i < 0 || i >= spans.length - 1) return spans;
  const min = minSpanFor(spans.length);
  const start = spans.slice(0, i).reduce((a, b) => a + b, 0);
  const end = start + spans[i] + spans[i + 1];
  const at = Math.min(end - min, Math.max(start + min, Math.round(boundary)));
  const out = [...spans];
  out[i] = at - start;
  out[i + 1] = end - at;
  return out;
}

/** Ready-made splits for a row of `n` widgets (each adds up to 12). */
export function rowPresets(n: number): number[][] {
  if (n === 2) return [[6, 6], [8, 4], [4, 8], [9, 3], [3, 9]];
  if (n === 3) return [[4, 4, 4], [6, 3, 3], [3, 6, 3], [3, 3, 6]];
  if (n === 4) return [[3, 3, 3, 3]];
  return n > 4 ? [fitRow(Array(n).fill(1))] : [[COLUMNS]];
}

/**
 * Gives the row's widgets these widths. Refused (items unchanged) unless they are the whole
 * row, in order, and the widths add up to 12 with none under the minimum — anything else
 * would make the rows below re-pack.
 */
export function setRowSpans<T extends GridItem>(items: T[], ids: string[], spans: number[], defaultSpan: number): T[] {
  const row = ids.length ? rowIds(items, ids[0], defaultSpan) : [];
  const min = minSpanFor(spans.length);
  const valid =
    row.length === ids.length && row.every((id, k) => id === ids[k]) && spans.length === ids.length && spans.reduce((a, b) => a + b, 0) === COLUMNS && spans.every((s) => Number.isInteger(s) && s >= min);
  if (!valid) return items;
  return items.map((item) => {
    const k = ids.indexOf(item.id);
    return k < 0 ? item : withSpan(item, spans[k], defaultSpan);
  });
}

/** Puts every widget of the row on a row of its own (full width). */
export function splitRow<T extends GridItem>(items: T[], ids: string[], defaultSpan: number): T[] {
  return items.map((item) => (ids.includes(item.id) ? withSpan(item, COLUMNS, defaultSpan) : item));
}
