import { useCallback, useEffect, useState } from "react";
import { useWebSocket } from "@/hooks/useWebSocket";
import { Card } from "../common";
import { PLATFORMS } from "../socials/platforms";
import type { WidgetView } from "../types";
import type { PlayWithMeSection } from "./meta";
import { playStatus, type PlayState, type PresenceLike, type SteamLike } from "./status";

const LOOK: Record<PlayState, { dot: string; headline: (game: string | null) => string }> = {
  playing: { dot: "bg-green-500", headline: (game) => `Playing ${game}` },
  open: { dot: "bg-green-500", headline: () => "Up for a game" },
  mobile: { dot: "bg-yellow-500", headline: () => "Probably away, on my phone" },
  away: { dot: "bg-yellow-500", headline: () => "Away, maybe later" },
  busy: { dot: "bg-red-500", headline: () => "Not up for games right now" },
  offline: { dot: "bg-gray-400", headline: () => "Offline" },
  unknown: { dot: "bg-gray-400", headline: () => "Want to play together?" },
};

/** A platform logo in the button's text colour (white on the brand background). */
function Logo({ platform }: { platform: "steam" | "discord" }) {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} fill="currentColor" aria-hidden className="shrink-0">
      <path d={PLATFORMS[platform].path ?? undefined} />
    </svg>
  );
}

const PHONE =
  "M 187 0 L 813 0 C 916.277 0 1000 83.723 1000 187 L 1000 1313 C 1000 1416.277 916.277 1500 813 1500 L 187 1500 C 83.723 1500 0 1416.277 0 1313 L 0 187 C 0 83.723 83.723 0 187 0 Z M 125 1000 L 875 1000 L 875 250 L 125 250 Z M 500 1125 C 430.964 1125 375 1180.964 375 1250 C 375 1319.036 430.964 1375 500 1375 C 569.036 1375 625 1319.036 625 1250 C 625 1180.964 569.036 1125 500 1125 Z";

function duration(since: number, now: number): string {
  const min = Math.max(0, Math.floor((now - since) / 60000));
  if (min < 1) return "just started";
  if (min < 60) return `for ${min}m`;
  return `for ${Math.floor(min / 60)}h ${min % 60}m`;
}

function PlayWithMe({ section, gradientBorders }: { section: PlayWithMeSection; gradientBorders: boolean }) {
  const [presence, setPresence] = useState<PresenceLike | null>(null);
  const [steam, setSteam] = useState<SteamLike | null>(null);
  const [now, setNow] = useState<number | null>(null);

  useWebSocket({
    onMessage: useCallback((msg: unknown) => {
      const m = msg as { type?: string; data?: unknown };
      if (m?.type === "presence" && m.data) setPresence(m.data as PresenceLike);
      if (m?.type === "steam" && m.data) setSteam(m.data as SteamLike);
    }, []),
  });

  // The WebSocket only pushes on change; start from the server's current snapshots.
  useEffect(() => {
    let cancelled = false;
    const load = (url: string, set: (d: never) => void) =>
      fetch(url)
        .then((r) => r.json())
        .then((j: { data?: never }) => !cancelled && j.data && set(j.data))
        .catch(() => {});
    load("/api/presence", setPresence);
    load("/api/steam", setSteam);
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const status = playStatus(presence, steam, section.availability);
  const look = LOOK[status.state];
  const button = `inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-lg px-3 text-sm font-medium transition-all${gradientBorders ? " gradient-border-card" : ""}`;

  return (
    <Card className="text-left">
      <div className="flex items-center gap-2.5">
        {status.state === "mobile" ? (
          // Discord's own phone glyph, in the "away" yellow.
          <svg viewBox="0 0 1000 1500" className="w-3 h-[18px] shrink-0 fill-yellow-500" aria-hidden>
            <path d={PHONE} />
          </svg>
        ) : (
          <span className={`relative w-3 h-3 shrink-0 rounded-full ${look.dot}`} aria-hidden>
            {(status.state === "open" || status.state === "playing") && <span className={`absolute inset-0 rounded-full ${look.dot} animate-ping opacity-40`} />}
          </span>
        )}
        <p className="min-w-0 flex-1 truncate font-semibold text-gray-900 dark:text-white">{look.headline(status.game)}</p>
        {status.state === "playing" && status.since && now && <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400">{duration(status.since, now)}</span>}
      </div>
      {status.state === "playing" && section.availability === "open" && <p className="mt-1 text-sm text-green-700 dark:text-green-400">Ask to join!</p>}
      {section.note && <p className="mt-2 text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{section.note}</p>}
      {section.games.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {section.games.map((g) => (
            <span key={g} className={`rounded-full px-2.5 py-0.5 text-xs ${g === status.game ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"}`}>
              {g}
            </span>
          ))}
        </div>
      )}
      {((section.joinLink && status.join) || (section.showSteam && status.steamId) || (section.showDiscord && status.discordId)) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {section.joinLink && status.join && (
            <a href={status.join} className={`${button} bg-green-600 text-white hover:bg-green-700`}>
              <span aria-hidden className="w-4 text-center leading-none">▶</span>
              Join game
            </a>
          )}
          {section.showSteam && status.steamId && (
            <a href={`https://steamcommunity.com/profiles/${status.steamId}`} target="_blank" rel="noopener noreferrer" className={`${button} bg-[#1b2838] text-white ring-1 ring-inset ring-white/15 hover:bg-[#2a475e]`}>
              <Logo platform="steam" />
              Add on Steam
            </a>
          )}
          {section.showDiscord && status.discordId && (
            <a href={`https://discord.com/users/${status.discordId}`} target="_blank" rel="noopener noreferrer" className={`${button} bg-[#5865F2] text-white hover:bg-[#4752c4]`}>
              <Logo platform="discord" />
              Message on Discord
            </a>
          )}
        </div>
      )}
    </Card>
  );
}

export const view: WidgetView<PlayWithMeSection> = {
  titled: true,
  frame: "wrap",
  render: (section, ctx) => <PlayWithMe section={section} gradientBorders={ctx.gradientBorders} />,
};
