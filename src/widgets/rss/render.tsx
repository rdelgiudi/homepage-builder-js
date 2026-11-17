import { DataCard, timeAgo, useWidgetData } from "../common";
import type { WidgetView } from "../types";
import type { RssSection } from "./meta";

interface FeedData {
  title: string;
  items: { title: string; url: string; date: string | null }[];
}

function Feed({ section }: { section: RssSection }) {
  // The feed address is looked up on the server from this section's id (see widget-data.ts).
  const state = useWidgetData<FeedData>(section.url.trim() ? `/api/widgets/rss?id=${encodeURIComponent(section.id)}&u=${encodeURIComponent(section.url)}` : null);
  return (
    <DataCard state={state} setup={!section.url.trim() && "Set the feed's address in this widget's settings."} lines={section.limit}>
      {(feed) => (
        <div className="text-left">
          {feed.title && <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 truncate">{feed.title}</p>}
          <ul className="space-y-2.5">
            {feed.items.slice(0, section.limit).map((item) => (
              <li key={item.url}>
                <a href={item.url} target="_blank" rel="noopener noreferrer" className="block group">
                  <span className="text-sm font-medium text-gray-900 dark:text-white group-hover:underline">{item.title}</span>
                  {section.showDates && item.date && <span className="block text-xs text-gray-500 dark:text-gray-400">{timeAgo(item.date)}</span>}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </DataCard>
  );
}

export const view: WidgetView<RssSection> = {
  titled: true,
  frame: "wrap",
  render: (section) => <Feed section={section} />,
};
