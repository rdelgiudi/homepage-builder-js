import { useState } from "react";
import { DataCard, useWidgetData } from "../common";
import type { WidgetView } from "../types";
import type { MediaSection } from "./meta";

interface MediaItem {
  title: string;
  subtitle: string | null;
  image: string | null;
  url: string | null;
  rating: number | null;
  date: string | null;
}

interface MediaData {
  profile: string;
  items: MediaItem[];
}

// Full class names so Tailwind generates them.
const COLUMNS: Record<number, string> = {
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-4",
  5: "sm:grid-cols-4 md:grid-cols-5",
  6: "sm:grid-cols-4 md:grid-cols-6",
  7: "sm:grid-cols-5 md:grid-cols-7",
  8: "sm:grid-cols-5 md:grid-cols-8",
};

const SERVICE_NAME: Record<MediaSection["service"], string> = { anilist: "AniList", letterboxd: "Letterboxd", openlibrary: "Open Library" };

/** ★★★½ for 3.5 (ratings are out of 5, in halves). */
function Stars({ rating, className = "" }: { rating: number; className?: string }) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  return (
    <span className={`tracking-tight text-amber-500 ${className}`} role="img" aria-label={`${rating} out of 5`}>
      {"★".repeat(full)}
      {half && "½"}
    </span>
  );
}

function Cover({ item, className }: { item: MediaItem; className: string }) {
  const [failed, setFailed] = useState(false);
  if (!item.image || failed) {
    return (
      <div className={`${className} flex items-center justify-center bg-gray-200 dark:bg-gray-700 p-2 text-center text-xs text-gray-600 dark:text-gray-300`}>
        <span className="line-clamp-4">{item.title}</span>
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element -- covers from AniList / Letterboxd / Open Library CDNs
  return <img src={item.image} alt="" loading="lazy" onError={() => setFailed(true)} className={`${className} object-cover`} />;
}

function Media({ section }: { section: MediaSection }) {
  const user = section.username.trim().replace(/^@/, "");
  const params = new URLSearchParams({ service: section.service, user, kind: section.kind, list: section.list });
  const state = useWidgetData<MediaData>(user ? `/api/widgets/media?${params}` : null);
  return (
    <DataCard state={state} setup={!user && `Set your ${SERVICE_NAME[section.service]} username in this widget's settings.`} lines={3}>
      {(data) => {
        const items = data.items.slice(0, section.limit);
        if (!items.length) return <p className="italic text-sm text-gray-500 dark:text-gray-400">Nothing here right now.</p>;
        return (
          <div className="text-left">
            {section.layout === "covers" ? (
              <ul className={`grid grid-cols-3 gap-3 ${COLUMNS[section.columns] ?? COLUMNS[6]}`}>
                {items.map((item, i) => (
                  <li key={i} className="min-w-0">
                    <a href={item.url ?? data.profile} target="_blank" rel="noopener noreferrer" className="group block" title={item.title}>
                      <div className="overflow-hidden rounded-md shadow-sm">
                        <Cover item={item} className="aspect-[2/3] w-full transition-transform duration-300 group-hover:scale-105" />
                      </div>
                      <p className="mt-1.5 truncate text-xs font-medium text-gray-900 dark:text-white group-hover:underline">{item.title}</p>
                      <p className="flex items-center justify-between gap-1 text-[11px] text-gray-500 dark:text-gray-400">
                        <span className="truncate">{item.subtitle}</span>
                        {section.showRatings && item.rating !== null && <Stars rating={item.rating} className="shrink-0" />}
                      </p>
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <ul className="space-y-3">
                {items.map((item, i) => (
                  <li key={i}>
                    <a href={item.url ?? data.profile} target="_blank" rel="noopener noreferrer" className="group flex items-center gap-3">
                      <Cover item={item} className="h-16 w-11 shrink-0 rounded" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-gray-900 dark:text-white group-hover:underline">{item.title}</p>
                        {item.subtitle && <p className="truncate text-sm text-gray-500 dark:text-gray-400">{item.subtitle}</p>}
                      </div>
                      {section.showRatings && item.rating !== null && <Stars rating={item.rating} className="shrink-0 text-sm" />}
                    </a>
                  </li>
                ))}
              </ul>
            )}
            <a href={data.profile} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-xs text-gray-500 dark:text-gray-400 hover:underline">
              More on {SERVICE_NAME[section.service]} ↗
            </a>
          </div>
        );
      }}
    </DataCard>
  );
}

export const view: WidgetView<MediaSection> = {
  titled: true,
  frame: "wrap",
  render: (section) => <Media section={section} />,
};
