import { useState } from "react";
import { httpUrl } from "@/lib/url";
import { Card, Notice } from "../common";
import type { WidgetView } from "../types";
import type { GameShelfSection, ShelfItem } from "./meta";
import { groupShelf, groupShelfCustom } from "./groups";

const STATUS: Record<NonNullable<ShelfItem["status"]>, { label: string; className: string }> = {
  playing: { label: "Playing", className: "bg-green-600 text-white" },
  finished: { label: "Finished", className: "bg-blue-600 text-white" },
  favourite: { label: "Favourite", className: "bg-pink-600 text-white" },
  backlog: { label: "Backlog", className: "bg-gray-600 text-white" },
  dropped: { label: "Dropped", className: "bg-gray-400 text-gray-900" },
};

// Full class names so Tailwind generates them.
const COLUMNS: Record<number, string> = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "sm:grid-cols-4", 5: "sm:grid-cols-5", 6: "sm:grid-cols-6" };

// Tile widths for the one-line groups: more columns = narrower tiles. Full class names so Tailwind generates them.
const LINE_WIDTH: Record<number, string> = { 2: "w-36 sm:w-44", 3: "w-32 sm:w-40", 4: "w-28 sm:w-32", 5: "w-24 sm:w-28", 6: "w-24" };

const STEAM_ASSETS = "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps";

/** Image candidates, best first: the owner's own image, Steam's portrait cover, Steam's header. */
function covers(item: ShelfItem, portrait: boolean): string[] {
  const own = item.image && (item.image.startsWith("/api/uploads/") ? item.image : httpUrl(item.image));
  const steam = item.appid ? (portrait ? [`${STEAM_ASSETS}/${item.appid}/library_600x900.jpg`] : []).concat(`${STEAM_ASSETS}/${item.appid}/header.jpg`) : [];
  return [...(own ? [own] : []), ...steam];
}

function link(item: ShelfItem): string | null {
  return httpUrl(item.url) ?? (item.appid ? `https://store.steampowered.com/app/${item.appid}` : null);
}

/** Tries each candidate in turn; falls back to the title on a plain tile. */
function Cover({ item, portrait, className }: { item: ShelfItem; portrait: boolean; className: string }) {
  const sources = covers(item, portrait);
  const [index, setIndex] = useState(0);
  if (index >= sources.length) {
    return (
      <div className={`${className} flex items-center justify-center p-2 bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800`}>
        <span className="text-center text-sm font-semibold text-gray-700 dark:text-gray-200 line-clamp-3">{item.title}</span>
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- Steam CDN / uploads, with a fallback chain next/image can't do
    <img src={sources[index]} alt={item.title} loading="lazy" onError={() => setIndex((i) => i + 1)} className={`${className} object-cover bg-gray-200 dark:bg-gray-700`} />
  );
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="text-amber-500 tracking-tight" aria-label={`${rating} out of 5`} title={`${rating} out of 5`}>
      {"★".repeat(rating)}
      <span className="text-gray-300 dark:text-gray-600">{"★".repeat(5 - rating)}</span>
    </span>
  );
}

function Wrap({ href, className, children }: { href: string | null; className: string; children: React.ReactNode }) {
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
    </a>
  ) : (
    <div className={className}>{children}</div>
  );
}

function ListRow({ item, showStatus }: { item: ShelfItem; showStatus: boolean }) {
  return (
    <Wrap href={link(item)} className="flex gap-3 rounded-lg p-1.5 -m-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
      <Cover item={item} portrait={false} className="w-28 h-[52px] shrink-0 rounded" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium text-gray-900 dark:text-white">{item.title}</span>
          {showStatus && item.status && <span className={`shrink-0 rounded px-1.5 py-px text-[10px] font-semibold uppercase ${STATUS[item.status].className}`}>{STATUS[item.status].label}</span>}
        </div>
        {item.rating && <Stars rating={item.rating} />}
        {item.note && <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 whitespace-pre-line">{item.note}</p>}
      </div>
    </Wrap>
  );
}

function CoverTile({ item, showStatus, gradientBorders }: { item: ShelfItem; showStatus: boolean; gradientBorders: boolean }) {
  return (
    <Wrap
      href={link(item)}
      className={`group block relative overflow-hidden rounded-lg shadow-sm transition-transform hover:scale-[1.03]${gradientBorders ? " gradient-border-card" : ""}`}
    >
      <Cover item={item} portrait className="w-full aspect-[2/3]" />
      {showStatus && item.status && <span className={`absolute top-1.5 left-1.5 rounded px-1.5 py-px text-[10px] font-semibold uppercase shadow ${STATUS[item.status].className}`}>{STATUS[item.status].label}</span>}
      {(item.rating || item.note) && (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/60 to-transparent p-2 pt-6 text-white">
          {item.rating && <Stars rating={item.rating} />}
          {item.note && <p className="text-xs leading-snug line-clamp-3 opacity-0 max-h-0 group-hover:opacity-100 group-hover:max-h-24 transition-all">{item.note}</p>}
        </div>
      )}
    </Wrap>
  );
}

function List({ items, showStatus }: { items: ShelfItem[]; showStatus: boolean }) {
  return (
    <ul className="space-y-3">
      {items.map((item, i) => (
        <li key={i}>
          <ListRow item={item} showStatus={showStatus} />
        </li>
      ))}
    </ul>
  );
}

function Grid({ items, columns, showStatus, gradientBorders }: { items: ShelfItem[]; columns: number; showStatus: boolean; gradientBorders: boolean }) {
  return (
    <ul className={`grid grid-cols-2 ${COLUMNS[columns] ?? COLUMNS[4]} gap-3 text-left`}>
      {items.map((item, i) => (
        <li key={i}>
          <CoverTile item={item} showStatus={showStatus} gradientBorders={gradientBorders} />
        </li>
      ))}
    </ul>
  );
}

/** One row that scrolls sideways, like the Steam widget's game rows. Tile width follows `columns`. */
function Line({ items, columns, showStatus, gradientBorders }: { items: ShelfItem[]; columns: number; showStatus: boolean; gradientBorders: boolean }) {
  return (
    <ul className="flex gap-3 overflow-x-auto pt-1 pb-2 px-1 -mx-1 snap-x scroll-px-1 text-left">
      {items.map((item, i) => (
        <li key={i} className={`shrink-0 snap-start ${LINE_WIDTH[columns] ?? LINE_WIDTH[4]}`}>
          <CoverTile item={item} showStatus={showStatus} gradientBorders={gradientBorders} />
          <p className="mt-1 truncate text-xs text-gray-600 dark:text-gray-400">{item.title}</p>
        </li>
      ))}
    </ul>
  );
}

function GameShelf({ section, gradientBorders }: { section: GameShelfSection; gradientBorders: boolean }) {
  if (!section.items.length) return <Card><Notice>{"Add a game in this widget's settings."}</Notice></Card>;

  if (section.groupBy !== "none") {
    // Grouped by status, the heading says it, so the per-game badge is left out.
    const byStatus = section.groupBy === "status";
    const groups = byStatus ? groupShelf(section.items) : groupShelfCustom(section.items, section.groupOrder);
    return (
      <Card className="text-left">
        {groups.map((group, i) => (
          <section key={i} className={i ? "border-t border-gray-200 dark:border-gray-700 pt-4 mt-4" : ""}>
            <h3 className="mb-3 text-sm text-gray-500 dark:text-gray-400">
              {group.title} <span className="text-gray-400 dark:text-gray-500">· {group.items.length}</span>
            </h3>
            {section.layout === "list" ? (
              <List items={group.items} showStatus={!byStatus} />
            ) : section.groupStyle === "line" ? (
              <Line items={group.items} columns={section.columns} showStatus={!byStatus} gradientBorders={gradientBorders} />
            ) : (
              <Grid items={group.items} columns={section.columns} showStatus={!byStatus} gradientBorders={gradientBorders} />
            )}
          </section>
        ))}
      </Card>
    );
  }

  if (section.layout === "list") {
    return (
      <Card className="text-left">
        <List items={section.items} showStatus />
      </Card>
    );
  }
  return <Grid items={section.items} columns={section.columns} showStatus gradientBorders={gradientBorders} />;
}

export const view: WidgetView<GameShelfSection> = {
  titled: true,
  frame: "wrap",
  render: (section, ctx) => <GameShelf section={section} gradientBorders={ctx.gradientBorders} />,
};
