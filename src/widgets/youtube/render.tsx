import { compact, DataCard, Notice, timeAgo, useWidgetData } from "../common";
import type { WidgetView } from "../types";
import type { YouTubeSection } from "./meta";

interface Feed {
  channel: string;
  url: string | null;
  videos: { id: string; title: string; url: string; thumbnail: string; date: string | null; views: number | null; short: boolean }[];
}

function Videos({ section }: { section: YouTubeSection }) {
  const channel = section.channel.trim();
  const state = useWidgetData<Feed>(channel ? `/api/widgets/youtube?channel=${encodeURIComponent(channel)}` : null);
  const grid = section.layout === "grid";
  return (
    <DataCard state={state} setup={!channel && "Set your channel's @handle in this widget's settings."} lines={section.limit}>
      {(feed) => {
        const videos = feed.videos.filter((v) => !(section.hideShorts && v.short)).slice(0, section.limit);
        return (
          <div className="text-left">
            {videos.length ? (
              <ul className={grid ? "grid grid-cols-1 sm:grid-cols-2 gap-4" : "space-y-3"}>
                {videos.map((v) => (
                  <li key={v.id}>
                    <a href={v.url} target="_blank" rel="noopener noreferrer" className={`group ${grid ? "block" : "flex gap-3 items-start"}`}>
                      <span className={`block overflow-hidden rounded-md bg-gray-200 dark:bg-gray-700 aspect-video ${grid ? "w-full" : "w-36 shrink-0"}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element -- i.ytimg.com thumbnail; not a next/image host */}
                        <img src={v.thumbnail} alt="" loading="lazy" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                      </span>
                      <span className={`block min-w-0 ${grid ? "mt-2" : ""}`}>
                        <span className="block text-sm font-medium text-gray-900 dark:text-white line-clamp-2 group-hover:underline">{v.title}</span>
                        <span className="block text-xs text-gray-500 dark:text-gray-400">
                          {[v.views !== null && `${compact(v.views)} views`, timeAgo(v.date)].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <Notice>No videos yet.</Notice>
            )}
            {feed.url && (
              <a href={feed.url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-xs text-gray-500 dark:text-gray-400 hover:underline">
                {feed.channel} on YouTube →
              </a>
            )}
          </div>
        );
      }}
    </DataCard>
  );
}

export const view: WidgetView<YouTubeSection> = {
  titled: true,
  frame: "wrap",
  render: (section) => <Videos section={section} />,
};
