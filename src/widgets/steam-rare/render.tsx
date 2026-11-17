import { DataCard, Notice, useWidgetData } from "../common";
import type { WidgetView } from "../types";
import type { SteamRareSection } from "./meta";

interface Achievement {
  appid: number;
  game: string;
  name: string;
  description: string | null;
  icon: string | null;
  percent: number;
  unlockedAt: string | null;
}

interface RareData {
  profile: string;
  scanned: number;
  achievements: Achievement[];
}

/** Steam's own rarity tiers, by global unlock rate. */
function tier(percent: number): { label: string; className: string } {
  if (percent < 5) return { label: "Ultra rare", className: "text-amber-600 dark:text-amber-400" };
  if (percent < 10) return { label: "Very rare", className: "text-purple-600 dark:text-purple-400" };
  if (percent < 20) return { label: "Rare", className: "text-blue-600 dark:text-blue-400" };
  return { label: "Uncommon", className: "text-gray-500 dark:text-gray-400" };
}

const pct = (n: number) => (n < 10 ? n.toFixed(1) : Math.round(n).toString());

function AchievementIcon({ a, size }: { a: Achievement; size: string }) {
  return a.icon ? (
    // eslint-disable-next-line @next/next/no-img-element -- small Steam achievement icons
    <img src={a.icon} alt="" loading="lazy" className={`${size} shrink-0 rounded`} />
  ) : (
    <span className={`${size} shrink-0 rounded bg-gray-200 dark:bg-gray-700 flex items-center justify-center`}>🏆</span>
  );
}

function SteamRare({ section }: { section: SteamRareSection }) {
  // `n` only changes the URL when the scan size changes, so the widget refetches.
  const state = useWidgetData<RareData>(`/api/widgets/steam-rare?id=${encodeURIComponent(section.id)}&n=${section.scanGames}`);
  return (
    <DataCard state={state} lines={section.limit}>
      {(data) => {
        const list = data.achievements.slice(0, section.limit);
        if (!list.length) return <Notice>No unlocked achievements found in the {data.scanned} most-played games.</Notice>;
        return (
          <div className="text-left">
            {section.layout === "grid" ? (
              <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {list.map((a, i) => {
                  const t = tier(a.percent);
                  return (
                    <li key={i} className="rounded-lg bg-gray-100 dark:bg-gray-800 p-2 flex flex-col items-center text-center" title={a.description ?? undefined}>
                      <AchievementIcon a={a} size="w-14 h-14" />
                      <span className="mt-1.5 w-full truncate text-sm font-medium text-gray-900 dark:text-white">{a.name}</span>
                      <span className="w-full truncate text-xs text-gray-500 dark:text-gray-400">{a.game}</span>
                      <span className={`text-xs font-semibold ${t.className}`}>{pct(a.percent)}% of players</span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <ul className="space-y-2.5">
                {list.map((a, i) => {
                  const t = tier(a.percent);
                  return (
                    <li key={i} className="flex items-center gap-3">
                      <AchievementIcon a={a} size="w-11 h-11" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{a.name}</p>
                        <p className="truncate text-xs text-gray-500 dark:text-gray-400" title={a.description ?? undefined}>
                          <a href={`https://store.steampowered.com/app/${a.appid}`} target="_blank" rel="noopener noreferrer" className="hover:underline">
                            {a.game}
                          </a>
                          {a.description && ` · ${a.description}`}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className={`text-sm font-bold tabular-nums ${t.className}`}>{pct(a.percent)}%</p>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400">{t.label}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
              Share of all Steam players who unlocked it.{" "}
              <a href={data.profile} target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-700 dark:hover:text-gray-200">
                Steam profile
              </a>
            </p>
          </div>
        );
      }}
    </DataCard>
  );
}

export const view: WidgetView<SteamRareSection> = {
  titled: true,
  frame: "wrap",
  render: (section) => <SteamRare section={section} />,
};
