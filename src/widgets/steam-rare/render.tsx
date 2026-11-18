import { useState, type ReactNode } from "react";
import { Skeleton, useWidgetData } from "../common";
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
  hidden: boolean;
}

interface RareData {
  profile: string;
  /** Only when the header is "profile"; null if Steam didn't answer. */
  player: { name: string; avatar: string | null } | null;
  scanned: number;
  achievements: Achievement[];
}

// Full class names so Tailwind generates them.
const COLUMNS: Record<number, string> = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "sm:grid-cols-4", 5: "sm:grid-cols-5", 6: "sm:grid-cols-6" };

/** Steam calls an achievement rare below 10%. */
const RARE_BELOW = 10;

/** Steam's own rarity tiers, by global unlock rate. */
function tier(percent: number): { label: string; className: string } {
  if (percent < 5) return { label: "Ultra rare", className: "text-amber-600 dark:text-amber-400" };
  if (percent < 10) return { label: "Very rare", className: "text-purple-600 dark:text-purple-400" };
  if (percent < 20) return { label: "Rare", className: "text-blue-600 dark:text-blue-400" };
  return { label: "Uncommon", className: "text-gray-500 dark:text-gray-400" };
}

const pct = (n: number) => (n < 10 ? n.toFixed(1) : Math.round(n).toString());

/** The same card surface as the Steam widget. */
function SteamCard({ children }: { children: ReactNode }) {
  return <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm dark:shadow-none border border-gray-200 dark:border-0 text-left">{children}</div>;
}

function Badge() {
  return (
    <div className="w-12 h-12 shrink-0 rounded-full bg-[#1B2838] flex items-center justify-center">
      <span className="text-2xl">🏆</span>
    </div>
  );
}

/** Icon with the gold ring when rare; a covered spoiler shows a lock instead of the real icon. */
function AchievementIcon({ a, covered, rareBorder, size }: { a: Achievement; covered: boolean; rareBorder: boolean; size: string }) {
  const inner = covered ? (
    <span className={`${size} rounded-md bg-[#1B2838] flex items-center justify-center text-lg text-gray-300`} aria-hidden>
      🔒
    </span>
  ) : a.icon ? (
    // eslint-disable-next-line @next/next/no-img-element -- small Steam achievement icons
    <img src={a.icon} alt="" loading="lazy" className={`${size} rounded-md`} />
  ) : (
    <span className={`${size} rounded-md bg-gray-200 dark:bg-gray-700 flex items-center justify-center`}>🏆</span>
  );
  return <div className={`shrink-0 ${rareBorder && a.percent < RARE_BELOW ? "rare-ring" : "rounded-md"}`}>{inner}</div>;
}

function Uncover({ onClick, short = false }: { onClick: () => void; short?: boolean }) {
  return (
    <button type="button" onClick={onClick} className="text-xs text-blue-600 dark:text-blue-400 hover:underline" aria-label="Show hidden achievement">
      {short ? "Reveal" : "Show hidden achievement"}
    </button>
  );
}

function SteamRare({ section, gradientBorders }: { section: SteamRareSection; gradientBorders: boolean }) {
  // `n` only changes the URL when the scan size changes, so the widget refetches.
  const state = useWidgetData<RareData>(`/api/widgets/steam-rare?id=${encodeURIComponent(section.id)}&n=${section.scanGames}`);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const reveal = (i: number) => setRevealed((r) => new Set(r).add(i));

  if (state.loading && !state.data) {
    return (
      <SteamCard>
        <div className="flex items-center gap-4">
          <Badge />
          <p className="text-gray-500 dark:text-gray-400">Loading achievements…</p>
        </div>
        <div className="mt-4">
          <Skeleton lines={Math.min(section.limit, 4)} />
        </div>
      </SteamCard>
    );
  }
  if (state.error || !state.data) {
    return (
      <SteamCard>
        <div className="flex items-center gap-4">
          <Badge />
          <div>
            <p className="text-gray-500 dark:text-gray-400">Achievements unavailable</p>
            <p className="text-sm text-gray-400 dark:text-gray-500">{state.error ?? "Nothing to show."}</p>
          </div>
        </div>
      </SteamCard>
    );
  }

  const data = state.data;
  const list = data.achievements.slice(0, section.limit);
  const isCovered = (a: Achievement, i: number) => a.hidden && !section.showHidden && !revealed.has(i);

  return (
    <SteamCard>
      {section.header === "profile" && (
        <div className="flex items-center gap-4 mb-4">
          {data.player?.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element -- Steam avatar CDN isn't in next.config images
            <img src={data.player.avatar} alt="" width={64} height={64} className="w-16 h-16 shrink-0 rounded-full" />
          ) : (
            <Badge />
          )}
          <div className="min-w-0">
            <p className="truncate font-semibold text-lg text-gray-900 dark:text-white">{data.player?.name ?? "Rarest achievements"}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {data.player ? `Rarest achievements · from my ${data.scanned} most-played games` : `From my ${data.scanned} most-played games`}
            </p>
          </div>
          <a
            href={data.profile}
            target="_blank"
            rel="noopener noreferrer"
            className={`ml-auto shrink-0 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-all hover:scale-105${gradientBorders ? " gradient-border-card" : ""}`}
          >
            View Profile
          </a>
        </div>
      )}

      <div className={section.header === "profile" ? "border-t border-gray-200 dark:border-gray-700 pt-4" : ""}>
        {list.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No unlocked achievements found in these games.</p>
        ) : section.layout === "grid" ? (
          <ul className={`grid grid-cols-2 ${COLUMNS[section.columns] ?? COLUMNS[3]} gap-4`}>
            {list.map((a, i) => {
              const covered = isCovered(a, i);
              const t = tier(a.percent);
              return (
                <li key={i} className="flex flex-col items-center text-center min-w-0">
                  <AchievementIcon a={a} covered={covered} rareBorder={section.rareBorder} size="w-16 h-16" />
                  <p className="mt-2 w-full truncate text-sm font-medium text-gray-900 dark:text-white">{covered ? "Hidden achievement" : a.name}</p>
                  <a href={`https://store.steampowered.com/app/${a.appid}`} target="_blank" rel="noopener noreferrer" className="w-full truncate text-xs text-gray-600 dark:text-gray-400 hover:underline">
                    {a.game}
                  </a>
                  {covered ? (
                    <div className="mt-1">
                      <Uncover short onClick={() => reveal(i)} />
                    </div>
                  ) : (
                    a.description && (
                      <p className="mt-1 w-full text-[11px] leading-snug text-gray-500 dark:text-gray-400 line-clamp-2" title={a.description}>
                        {a.description}
                      </p>
                    )
                  )}
                  {/* mt-auto: the rarity lines up along the bottom of each row, however long the descriptions are. */}
                  <p className={`mt-auto pt-1 text-[11px] font-semibold ${t.className}`}>
                    {pct(a.percent)}% · {t.label}
                  </p>
                </li>
              );
            })}
          </ul>
        ) : (
          <ul className="space-y-3">
            {list.map((a, i) => {
              const covered = isCovered(a, i);
              const t = tier(a.percent);
              return (
                <li key={i} className="flex items-center gap-3">
                  <AchievementIcon a={a} covered={covered} rareBorder={section.rareBorder} size="w-14 h-14" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{covered ? "Hidden achievement" : a.name}</p>
                      <p className={`shrink-0 text-sm font-bold tabular-nums ${t.className}`}>{pct(a.percent)}%</p>
                    </div>
                    <div className="flex items-baseline justify-between gap-2">
                      <a href={`https://store.steampowered.com/app/${a.appid}`} target="_blank" rel="noopener noreferrer" className="truncate text-xs text-gray-600 dark:text-gray-400 hover:underline">
                        {a.game}
                      </a>
                      <p className="shrink-0 text-[11px] text-gray-500 dark:text-gray-400">{t.label}</p>
                    </div>
                    {covered ? (
                      <Uncover onClick={() => reveal(i)} />
                    ) : (
                      <p className="mt-0.5 truncate text-[11px] text-gray-500 dark:text-gray-400" title={a.description ?? undefined}>
                        {a.description ?? (a.hidden ? "Hidden achievement" : "")}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-4 text-[11px] text-gray-400 dark:text-gray-500">
          Percentages are the share of all Steam players who unlocked it.
          {section.header === "none" && ` From my ${data.scanned} most-played games.`}
        </p>
      </div>
    </SteamCard>
  );
}

export const view: WidgetView<SteamRareSection> = {
  titled: true,
  frame: "wrap",
  render: (section, ctx) => <SteamRare section={section} gradientBorders={ctx.gradientBorders} />,
};
