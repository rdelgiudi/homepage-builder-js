import { useState } from "react";
import { compact, DataCard, Notice, useWidgetData } from "../common";
import type { WidgetView } from "../types";
import type { TetrioSection } from "./meta";

interface TetrioData {
  username: string;
  url: string;
  avatar: string | null;
  country: string | null;
  level: number;
  gamesPlayed: number;
  gamesWon: number;
  hours: number;
  league: {
    rank: string;
    bestRank: string | null;
    tr: number;
    gxe: number | null;
    apm: number | null;
    pps: number | null;
    vs: number | null;
    standing: number | null;
    played: number;
    won: number;
  } | null;
  sprint: number | null;
  blitz: number | null;
  zenith: number | null;
}

const flag = (cc: string) => String.fromCodePoint(...[...cc].map((c) => 0x1f1a5 + c.charCodeAt(0)));

function sprintTime(ms: number): string {
  const s = ms / 1000;
  const m = Math.floor(s / 60);
  return m ? `${m}:${(s % 60).toFixed(3).padStart(6, "0")}` : `${s.toFixed(3)}s`;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-gray-100 dark:bg-gray-800 px-3 py-2">
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-lg font-bold tabular-nums text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}

function RankBadge({ rank }: { rank: string }) {
  if (rank === "z") return <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">Unranked</span>;
  // eslint-disable-next-line @next/next/no-img-element -- TETR.IO's rank icons; tiny, host not in next.config
  return <img src={`https://tetr.io/res/league-ranks/${encodeURIComponent(rank)}.png`} alt={`${rank.toUpperCase()} rank`} title={`${rank.toUpperCase()} rank`} className="h-10 w-auto" />;
}

function Avatar({ src, name }: { src: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return <span className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700 shrink-0 flex items-center justify-center font-bold uppercase text-gray-500 dark:text-gray-400">{name.charAt(0)}</span>;
  }
  // eslint-disable-next-line @next/next/no-img-element -- TETR.IO avatar; host not in next.config
  return <img src={src} alt="" onError={() => setFailed(true)} className="w-12 h-12 rounded-full object-cover shrink-0" />;
}

function Tetrio({ section }: { section: TetrioSection }) {
  const user = section.username.trim();
  const state = useWidgetData<TetrioData>(user ? `/api/widgets/tetrio?user=${encodeURIComponent(user)}` : null);
  return (
    <DataCard state={state} setup={!user && "Set a TETR.IO username in this widget's settings."} lines={4}>
      {(d) => {
        const records = [
          d.sprint !== null && { label: "40 Lines", value: sprintTime(d.sprint) },
          d.blitz !== null && { label: "Blitz", value: d.blitz.toLocaleString() },
          d.zenith !== null && { label: "Quick Play", value: `${d.zenith.toFixed(1)} m` },
        ].filter((r): r is { label: string; value: string } => !!r);
        return (
          <div className="text-left">
            <div className="flex items-center gap-3">
              <Avatar src={d.avatar} name={d.username} />
              <div className="min-w-0 flex-1">
                <a href={d.url} target="_blank" rel="noopener noreferrer" className="font-semibold uppercase text-gray-900 dark:text-white hover:underline">
                  {d.username}
                </a>
                {d.country && <span className="ml-1.5" title={d.country}>{flag(d.country)}</span>}
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Level {d.level} · {compact(d.gamesPlayed)} games{d.hours > 0 && ` · ${compact(d.hours)}h played`}
                </p>
              </div>
              {d.league && <RankBadge rank={d.league.rank} />}
            </div>
            {d.league ? (
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Stat label="Tetra Rating" value={d.league.rank === "z" ? "–" : compact(d.league.tr)} />
                {d.league.standing && <Stat label="Global rank" value={`#${d.league.standing.toLocaleString()}`} />}
                {d.league.apm !== null && <Stat label="APM" value={d.league.apm.toFixed(1)} />}
                {d.league.pps !== null && <Stat label="PPS" value={d.league.pps.toFixed(2)} />}
                {d.league.vs !== null && !d.league.standing && <Stat label="VS" value={d.league.vs.toFixed(1)} />}
              </div>
            ) : (
              <div className="mt-3"><Notice>No Tetra League games this season.</Notice></div>
            )}
            {section.showRecords && records.length > 0 && (
              <div className="mt-2 grid grid-cols-3 gap-2">
                {records.map((r) => (
                  <Stat key={r.label} label={r.label} value={r.value} />
                ))}
              </div>
            )}
          </div>
        );
      }}
    </DataCard>
  );
}

export const view: WidgetView<TetrioSection> = {
  titled: true,
  frame: "wrap",
  render: (section) => <Tetrio section={section} />,
};
