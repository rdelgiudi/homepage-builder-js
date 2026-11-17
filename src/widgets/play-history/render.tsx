import { useEffect, useRef } from "react";
import { DataCard, Notice, timeAgo, useWidgetData } from "../common";
import type { WidgetView } from "../types";
import type { PlayHistorySection } from "./meta";

interface PlayData {
  timeZone: string;
  days: { date: string; minutes: number; level: number }[];
  totalMinutes: number;
  games: { name: string; minutes: number }[];
  recent: { game: string; start: string; end: string; minutes: number }[];
  playing: string[];
}

// Full class names so Tailwind generates them. Index = level 0–4 (none, <1h, 1–2h, 2–4h, 4h+).
const LEVELS = ["bg-gray-200 dark:bg-gray-700", "bg-violet-200 dark:bg-violet-900", "bg-violet-400 dark:bg-violet-700", "bg-violet-500 dark:bg-violet-500", "bg-violet-700 dark:bg-violet-300"];

export function hours(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h >= 10 || !m ? `${h}h` : `${h}h ${m}m`;
}

function Heatmap({ days }: { days: PlayData["days"] }) {
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scroller.current) scroller.current.scrollLeft = scroller.current.scrollWidth;
  }, [days]);
  // Columns are weeks starting on Sunday; pad the first one so weekdays line up.
  const lead = new Date(`${days[0].date}T12:00:00Z`).getUTCDay();
  return (
    <div ref={scroller} className="overflow-x-auto pb-1">
      <div className="grid grid-rows-7 grid-flow-col gap-[3px] w-max mx-auto" role="img" aria-label="Hours played per day">
        {Array.from({ length: lead }, (_, i) => (
          <span key={`pad-${i}`} className="w-[11px] h-[11px]" />
        ))}
        {days.map((day) => (
          <span key={day.date} className={`w-[11px] h-[11px] rounded-sm ${LEVELS[day.level] ?? LEVELS[0]}`} title={`${day.minutes ? hours(day.minutes) : "No games"} on ${day.date}`} />
        ))}
      </div>
    </div>
  );
}

function PlayHistory({ section }: { section: PlayHistorySection }) {
  // `k` only makes the URL change with the settings that change the result.
  const k = [section.months, section.timezone, ...section.hideGames].join("|");
  const state = useWidgetData<PlayData>(`/api/widgets/play-history?id=${encodeURIComponent(section.id)}&k=${encodeURIComponent(k)}`, 5 * 60 * 1000);
  return (
    <DataCard state={state} lines={4}>
      {(data) => {
        const max = data.games[0]?.minutes ?? 1;
        return (
          <div className="text-left">
            {data.playing.length > 0 && (
              <p className="mb-2 text-sm font-medium text-green-700 dark:text-green-400">
                <span className="inline-block w-2 h-2 mr-1.5 rounded-full bg-green-500 animate-pulse" aria-hidden />
                Playing {data.playing.join(", ")} right now
              </p>
            )}
            <Heatmap days={data.days} />
            <div className="mt-2 flex items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
              <span>
                {data.totalMinutes ? `${hours(data.totalMinutes)} played in the last ${section.months === 1 ? "month" : `${section.months} months`}` : "Nothing recorded yet"}
              </span>
              <span className="flex items-center gap-[3px]" aria-hidden>
                Less
                {LEVELS.map((c) => (
                  <span key={c} className={`w-[9px] h-[9px] rounded-sm ${c}`} />
                ))}
                More
              </span>
            </div>
            {!data.totalMinutes && (
              <div className="mt-2">
                <Notice>Game time from your Discord status is recorded while this widget is on the published site.</Notice>
              </div>
            )}
            {section.showGames && data.games.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {data.games.map((g) => (
                  <li key={g.name} className="text-sm">
                    <div className="flex justify-between gap-2">
                      <span className="truncate text-gray-900 dark:text-white">{g.name}</span>
                      <span className="shrink-0 tabular-nums text-gray-500 dark:text-gray-400">{hours(g.minutes)}</span>
                    </div>
                    <div className="mt-0.5 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                      <div className="h-full rounded-full bg-violet-500" style={{ width: `${Math.max(2, (g.minutes / max) * 100)}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {section.showRecent && data.recent.length > 0 && (
              <ul className="mt-3 space-y-1 text-sm">
                {data.recent.map((s, i) => (
                  <li key={i} className="flex justify-between gap-2">
                    <span className="truncate text-gray-900 dark:text-white">{s.game}</span>
                    <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400">
                      {hours(s.minutes)} · {timeAgo(s.end)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      }}
    </DataCard>
  );
}

export const view: WidgetView<PlayHistorySection> = {
  titled: true,
  frame: "wrap",
  render: (section) => <PlayHistory section={section} />,
};
