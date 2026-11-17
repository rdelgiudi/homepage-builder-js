/** Grouping for the game shelf. Pure (no React), so it is unit-tested. */

export type ShelfStatus = "playing" | "finished" | "favourite" | "backlog" | "dropped";

/** Group order and headings. Games without a status go last. */
export const SHELF_GROUPS: { status: ShelfStatus | null; title: string }[] = [
  { status: "favourite", title: "Favourites" },
  { status: "playing", title: "Currently playing" },
  { status: "finished", title: "Finished" },
  { status: "backlog", title: "Backlog" },
  { status: "dropped", title: "Dropped" },
  { status: null, title: "Other" },
];

/** Splits items into the non-empty groups, in `SHELF_GROUPS` order, keeping each item's own order. */
export function groupShelf<T extends { status?: ShelfStatus }>(items: T[]): { status: ShelfStatus | null; title: string; items: T[] }[] {
  return SHELF_GROUPS.map((g) => ({ ...g, items: items.filter((i) => (i.status ?? null) === g.status) })).filter((g) => g.items.length > 0);
}

/**
 * Owner-named groups: `order` first (case-insensitive match; names with no games are skipped),
 * then any other group in the order its first game appears, then games without a group as "Other".
 * A group's heading is the name as first written on a game.
 */
export function groupShelfCustom<T extends { group?: string }>(items: T[], order: string[] = []): { title: string; items: T[] }[] {
  const groups = new Map<string, { title: string; items: T[] }>();
  const other: T[] = [];
  for (const item of items) {
    const name = item.group?.trim();
    if (!name) {
      other.push(item);
      continue;
    }
    const key = name.toLowerCase();
    if (!groups.has(key)) groups.set(key, { title: name, items: [] });
    groups.get(key)!.items.push(item);
  }
  const rank = new Map(order.map((n, i) => [n.trim().toLowerCase(), i] as const));
  const sorted = [...groups.entries()]
    .map(([key, g], firstSeen) => ({ g, r: rank.get(key) ?? order.length + firstSeen }))
    .sort((a, b) => a.r - b.r)
    .map((x) => x.g);
  return other.length ? [...sorted, { title: "Other", items: other }] : sorted;
}
