"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";

interface SteamGame {
  appid: number;
  name: string;
  playtime_forever: number;
  playtime_2weeks?: number;
}

interface SteamPlayer {
  steamid: string;
  personaname: string;
  avatarfull: string;
  personastate: number;
  gameextrainfo?: string;
}

interface SteamData {
  player: SteamPlayer | null;
  recentGames: SteamGame[];
  ownedGames: SteamGame[];
  error?: string;
}

function formatPlaytime(minutes: number): string {
  const hours = minutes / 60;
  if (hours < 1) return `${minutes}m`;
  if (hours < 1000) return `${Math.floor(hours)}h`;
  return `${(hours / 1000).toFixed(1)}k hrs`;
}

const dotColors: Record<string, string> = {
  offline: "bg-gray-500",
  online: "bg-blue-500",
  inGame: "bg-green-500",
  away: "bg-yellow-500",
};

function getStatus(player: SteamPlayer): { dotColor: string; textColor: string; text: string } {
  const isAway = player.personastate === 3;
  const isBusy = player.personastate === 2;

  if (player.gameextrainfo) {
    const dotColor = isAway ? "bg-yellow-500" : "bg-green-500";
    const textColor = isAway ? "text-green-300 dark:text-green-300" : "text-green-500 dark:text-green-400";
    return { dotColor, textColor, text: `In Game: ${player.gameextrainfo}` };
  }

  if (isAway) {
    return { dotColor: "bg-yellow-500", textColor: "text-blue-400 dark:text-blue-300", text: "Away" };
  }

  if (isBusy) {
    return { dotColor: "bg-red-500", textColor: "text-blue-500 dark:text-blue-400", text: "Busy" };
  }

  switch (player.personastate) {
    case 0:
      return { dotColor: "bg-gray-500", textColor: "text-gray-500", text: "Offline" };
    default:
      return { dotColor: "bg-blue-500", textColor: "text-blue-500 dark:text-blue-400", text: "Online" };
  }
}

const GAME_CARD_WIDTH = 96;
const GAME_GAP = 12;

function GameCard({ game }: { game: SteamGame }) {
  return (
    <a
      href={`https://store.steampowered.com/app/${game.appid}`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex-shrink-0 w-24 group"
      title={game.name}
    >
      <div className="relative rounded-lg overflow-hidden bg-gray-300 dark:bg-gray-700 aspect-[3/4]">
        <Image
          src={`https://steamcdn-a.akamaihd.net/steam/apps/${game.appid}/library_600x900.jpg`}
          alt={game.name}
          fill
          className="object-cover group-hover:opacity-80 transition-opacity"
          sizes="96px"
        />
      </div>
      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 truncate pr-1">{game.name}</p>
      <p className="text-xs text-gray-500 dark:text-gray-500">{formatPlaytime(game.playtime_forever)}</p>
      {game.playtime_2weeks !== undefined && game.playtime_2weeks > 0 && (
        <p className="text-xs text-gray-400 dark:text-gray-500">2w: {formatPlaytime(game.playtime_2weeks)}</p>
      )}
    </a>
  );
}

function GameSection({ title, games }: { title: string; games: SteamGame[] }) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [maxGames, setMaxGames] = useState(6);

  useEffect(() => {
    function calculateMax() {
      if (sectionRef.current) {
        const width = sectionRef.current.offsetWidth;
        setMaxGames(Math.max(1, Math.floor(width / (GAME_CARD_WIDTH + GAME_GAP))));
      }
    }

    calculateMax();
    window.addEventListener("resize", calculateMax);
    return () => window.removeEventListener("resize", calculateMax);
  }, []);

  return (
    <div ref={sectionRef} className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">{title}</p>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {games.slice(0, maxGames).map((game) => (
          <GameCard key={game.appid} game={game} />
        ))}
      </div>
    </div>
  );
}

export default function SteamStatus() {
  const [data, setData] = useState<SteamData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/steam");
        const result = await res.json();
        setData(result);
      } catch {
        setData({ player: null, recentGames: [], ownedGames: [], error: "Failed to fetch" });
      } finally {
        setLoading(false);
      }
    }
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 flex items-center gap-4 shadow-sm dark:shadow-none border border-gray-200 dark:border-0">
        <div className="w-12 h-12 rounded-full bg-[#1B2838] flex items-center justify-center animate-pulse">
          <span className="text-2xl">🎮</span>
        </div>
        <div>
          <p className="text-gray-500 dark:text-gray-400">Loading Steam...</p>
        </div>
      </div>
    );
  }

  if (!data || !data.player) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 flex items-center gap-4 shadow-sm dark:shadow-none border border-gray-200 dark:border-0">
        <div className="w-12 h-12 rounded-full bg-[#1B2838] flex items-center justify-center">
          <span className="text-2xl">🎮</span>
        </div>
        <div>
          <p className="text-gray-500 dark:text-gray-400">Steam unavailable</p>
          <p className="text-sm text-gray-400 dark:text-gray-500">
            {data?.error || "Check your API key or Steam ID"}
          </p>
        </div>
      </div>
    );
  }

  const { player, recentGames, ownedGames } = data;
  const status = getStatus(player);

  const avatarUrl = player.avatarfull;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm dark:shadow-none border border-gray-200 dark:border-0">
      <div className="flex items-center gap-4 mb-4">
        <div className="relative">
          <Image
            src={avatarUrl}
            alt={player.personaname}
            width={64}
            height={64}
            className="rounded-full"
            unoptimized={true}
          />
          <div
            className={`absolute bottom-0 right-0 w-5 h-5 rounded-full border-2 border-white dark:border-gray-800 ${status.dotColor}`}
          />
        </div>
        <div className="text-left">
          <p className={`font-semibold text-lg ${status.textColor}`}>{player.personaname}</p>
          <p className={`text-sm ${status.textColor}`}>{status.text}</p>
        </div>
        <a
          href={`https://steamcommunity.com/profiles/${player.steamid}`}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
        >
          View Profile
        </a>
      </div>

      {recentGames.length > 0 && (
        <GameSection title="Recently Played" games={recentGames} />
      )}

      {ownedGames.length > 0 && (
        <GameSection title="Top Games" games={ownedGames} />
      )}
    </div>
  );
}
