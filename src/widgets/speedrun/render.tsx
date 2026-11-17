import { useState } from "react";
import { DataCard, Notice, timeAgo, useWidgetData } from "../common";
import type { WidgetView } from "../types";
import type { SpeedrunSection } from "./meta";

interface Run {
  game: string;
  category: string;
  level: boolean;
  place: number;
  seconds: number;
  date: string | null;
  url: string | null;
  cover: string | null;
}

interface SpeedrunData {
  name: string;
  url: string;
  runs: Run[];
}

/** 1:02:03.456 / 2:03.456 / 3.456 — milliseconds only when the run has them. */
export function formatRunTime(seconds: number): string {
  const ms = Math.round((seconds % 1) * 1000);
  const whole = Math.floor(seconds);
  const h = Math.floor(whole / 3600);
  const m = Math.floor((whole % 3600) / 60);
  const s = whole % 60;
  const tail = ms ? `.${String(ms).padStart(3, "0")}` : "";
  if (h) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}${tail}`;
  if (m) return `${m}:${String(s).padStart(2, "0")}${tail}`;
  return `${s}${tail}s`;
}

/** speedrun.com serves covers behind a Cloudflare check that some visitors fail; show the initial then. */
function Cover({ src, game }: { src: string | null; game: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return <span className="w-9 h-12 shrink-0 rounded bg-gray-200 dark:bg-gray-700 flex items-center justify-center font-bold text-gray-500 dark:text-gray-400">{game.trim().charAt(0).toUpperCase()}</span>;
  }
  // eslint-disable-next-line @next/next/no-img-element -- speedrun.com covers; host not in next.config
  return <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} className="w-9 h-12 shrink-0 rounded object-cover bg-gray-200 dark:bg-gray-700" />;
}

const MEDALS: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

function ordinal(n: number): string {
  const rest = n % 100;
  if (rest >= 11 && rest <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}

function Speedrun({ section }: { section: SpeedrunSection }) {
  const user = section.username.trim();
  const state = useWidgetData<SpeedrunData>(user ? `/api/widgets/speedrun?user=${encodeURIComponent(user)}` : null);
  return (
    <DataCard state={state} setup={!user && "Set a Speedrun.com username in this widget's settings."} lines={section.limit}>
      {(data) => {
        const runs = data.runs
          .filter((r) => section.levels || !r.level)
          .sort((a, b) => (section.sort === "recent" ? (b.date ?? "").localeCompare(a.date ?? "") : a.place - b.place || (b.date ?? "").localeCompare(a.date ?? "")))
          .slice(0, section.limit);
        return (
          <div className="text-left">
            {runs.length === 0 ? (
              <Notice>No verified runs yet.</Notice>
            ) : (
              <ul className="space-y-2">
                {runs.map((run, i) => (
                  <li key={i}>
                    <a
                      href={run.url ?? data.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 rounded-lg p-1.5 -m-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                      <Cover src={run.cover} game={run.game} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-gray-900 dark:text-white">{run.game}</span>
                        <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
                          {run.category}
                          {run.date && ` · ${timeAgo(`${run.date}T12:00:00Z`)}`}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block font-mono tabular-nums text-sm font-semibold text-gray-900 dark:text-white">{formatRunTime(run.seconds)}</span>
                        <span className="block text-xs text-gray-500 dark:text-gray-400">
                          {MEDALS[run.place] ?? ""} {ordinal(run.place)}
                        </span>
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
              <a href={data.url} target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-700 dark:hover:text-gray-200">
                {data.name}
              </a>{" "}
              on Speedrun.com
            </p>
          </div>
        );
      }}
    </DataCard>
  );
}

export const view: WidgetView<SpeedrunSection> = {
  titled: true,
  frame: "wrap",
  render: (section) => <Speedrun section={section} />,
};
