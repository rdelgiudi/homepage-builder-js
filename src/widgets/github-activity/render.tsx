import { useEffect, useRef } from "react";
import { DataCard, useWidgetData } from "../common";
import type { WidgetView } from "../types";
import type { GitHubActivitySection } from "./meta";

interface ActivityData {
  user: string;
  url: string;
  total: number;
  days: { date: string; level: number; count: number }[];
}

// Full class names so Tailwind generates them. Index = GitHub's activity level 0–4.
const LEVELS = ["bg-gray-200 dark:bg-gray-700", "bg-emerald-200 dark:bg-emerald-900", "bg-emerald-400 dark:bg-emerald-700", "bg-emerald-500 dark:bg-emerald-500", "bg-emerald-700 dark:bg-emerald-300"];

function Heatmap({ data }: { data: ActivityData }) {
  const scroller = useRef<HTMLDivElement>(null);
  // On narrow screens the year doesn't fit: start scrolled to the most recent weeks.
  useEffect(() => {
    if (scroller.current) scroller.current.scrollLeft = scroller.current.scrollWidth;
  }, [data]);

  // Columns are weeks starting on Sunday; pad the first one so weekdays line up.
  const lead = new Date(`${data.days[0].date}T12:00:00Z`).getUTCDay();
  return (
    <div className="text-left">
      <div ref={scroller} className="overflow-x-auto pb-1">
        <div className="grid grid-rows-7 grid-flow-col gap-[3px] w-max mx-auto" role="img" aria-label={`${data.total} contributions in the last year`}>
          {Array.from({ length: lead }, (_, i) => (
            <span key={`pad-${i}`} className="w-[11px] h-[11px]" />
          ))}
          {data.days.map((day) => (
            <span key={day.date} className={`w-[11px] h-[11px] rounded-sm ${LEVELS[day.level] ?? LEVELS[0]}`} title={`${day.count} on ${day.date}`} />
          ))}
        </div>
      </div>
      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
        {data.total.toLocaleString()} contributions in the last year by{" "}
        <a href={data.url} target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-700 dark:hover:text-gray-200">
          {data.user}
        </a>
      </p>
    </div>
  );
}

function Activity({ section }: { section: GitHubActivitySection }) {
  const user = section.username.trim();
  const state = useWidgetData<ActivityData>(user ? `/api/widgets/github-activity?user=${encodeURIComponent(user)}` : null);
  return (
    <DataCard state={state} setup={!user && "Set a GitHub username in this widget's settings."} lines={4}>
      {(data) => <Heatmap data={data} />}
    </DataCard>
  );
}

export const view: WidgetView<GitHubActivitySection> = {
  titled: true,
  frame: "wrap",
  render: (section) => <Activity section={section} />,
};
