import { safeUrl } from "@/lib/background";
import { httpUrl, linkHref, opens } from "@/lib/url";
import { Notice } from "../common";
import type { WidgetView } from "../types";
import type { ProjectItem, ProjectsSection } from "./meta";

// Full class names so Tailwind generates them.
const COLUMNS: Record<number, string> = { 1: "", 2: "md:grid-cols-2", 3: "md:grid-cols-3" };

const STATUS: Record<NonNullable<ProjectItem["status"]>, { label: string; className: string }> = {
  active: { label: "Active", className: "bg-green-500/15 text-green-700 dark:text-green-400" },
  finished: { label: "Finished", className: "bg-blue-500/15 text-blue-700 dark:text-blue-400" },
  paused: { label: "Paused", className: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  archived: { label: "Archived", className: "bg-gray-500/15 text-gray-600 dark:text-gray-400" },
};

const siteName = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Open";
  }
};

function Meta({ item }: { item: ProjectItem }) {
  if (!item.status && !item.year) return null;
  return (
    <div className="flex items-center gap-2 text-xs">
      {item.status && <span className={`rounded-full px-2 py-0.5 font-medium ${STATUS[item.status].className}`}>{STATUS[item.status].label}</span>}
      {item.year && <span className="text-gray-500 dark:text-gray-400">{item.year}</span>}
    </div>
  );
}

function Body({ item, url, source }: { item: ProjectItem; url: string | null; source: string | null }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2 p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-gray-900 dark:text-white break-words">{item.title}</p>
      </div>
      <Meta item={item} />
      {item.description && <p className="whitespace-pre-wrap break-words text-sm text-gray-600 dark:text-gray-300">{item.description}</p>}
      {item.tags.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {item.tags.map((tag, i) => (
            <li key={i} className="rounded-md bg-gray-200 dark:bg-gray-800 px-2 py-0.5 text-xs text-gray-700 dark:text-gray-300">
              {tag}
            </li>
          ))}
        </ul>
      )}
      {(url || source) && (
        // mt-auto: links line up along the bottom of a row of cards.
        <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1 pt-1 text-sm">
          {url && (
            <a href={url} {...opens(url)} className="font-medium text-blue-600 dark:text-blue-400 hover:underline">
              {/* ↗ = opens another site in a new tab; a page of this site opens in place. */}
              {item.linkLabel || siteName(url)}
              {url.startsWith("/") ? " →" : " ↗"}
            </a>
          )}
          {source && (
            <a href={source} target="_blank" rel="noopener noreferrer" className="text-gray-600 dark:text-gray-400 hover:underline">
              Source ↗
            </a>
          )}
        </div>
      )}
    </div>
  );
}

export const view: WidgetView<ProjectsSection> = {
  titled: true,
  frame: "wrap",
  render: (section, ctx) => {
    const items = section.items.filter((item) => item.title.trim());
    if (!items.length) return <Notice>Add a project in this widget&apos;s settings.</Notice>;
    const list = section.layout === "list";
    return (
      <ul className={list ? "space-y-3" : `grid grid-cols-1 gap-4 ${COLUMNS[section.columns] ?? COLUMNS[2]}`}>
        {items.map((item, i) => {
          const image = safeUrl(item.image);
          const url = linkHref(item.url);
          const source = httpUrl(item.source);
          return (
            <li
              key={i}
              className={`flex overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#2b2d31] text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md${
                ctx.gradientBorders ? " gradient-border-card before:z-10" : ""
              } ${list ? "flex-col sm:flex-row" : "flex-col"}`}
            >
              {image && (
                <a href={url ?? image} {...opens(url ?? image)} className={`block shrink-0 overflow-hidden bg-gray-100 dark:bg-gray-800 ${list ? "sm:w-56" : ""}`} tabIndex={-1}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- uploads or any http(s) host */}
                  <img src={image} alt="" loading="lazy" className="aspect-video h-full w-full object-cover transition-transform duration-300 hover:scale-105" />
                </a>
              )}
              <Body item={item} url={url} source={source} />
            </li>
          );
        })}
      </ul>
    );
  },
};
