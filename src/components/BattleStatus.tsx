"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

interface RankInfo {
  division: string;
  tier: number;
  role_icon: string;
  rank_icon: string;
  tier_icon: string;
}

interface CompetitiveRanks {
  tank: RankInfo | null;
  damage: RankInfo | null;
  support: RankInfo | null;
}

interface HeroStats {
  hero: string;
  key: string;
  icon: string;
  playtime: number;
  winrate: number;
  games_played: number;
  kda: number;
  eliminations: number;
  deaths: number;
  healing: number;
  damage: number;
}

interface GeneralStats {
  eliminations: number;
  assists: number;
  deaths: number;
  damage: number;
  healing: number;
  kda: number;
  games_played: number;
  games_won: number;
  games_lost: number;
  winrate: number;
  playtime: number;
}

interface BattleNetData {
  available: boolean;
  error?: string;
  battleTag?: string;
  username?: string;
  avatar?: string;
  endorsement?: number;
  title?: string | null;
  ranks?: CompetitiveRanks;
  mostPlayedHeroes?: HeroStats[];
  generalStats?: GeneralStats | null;
  lastUpdated?: number;
  suggestion?: string;
}

const RANK_COLORS: Record<string, { dark: string; light: string }> = {
  bronze: { dark: "#cd7f32", light: "#8b5a2b" },
  silver: { dark: "#c0c0c0", light: "#707070" },
  gold: { dark: "#ffd700", light: "#b8960b" },
  platinum: { dark: "#00b4d8", light: "#0077aa" },
  diamond: { dark: "#b9f2ff", light: "#0096b7" },
  master: { dark: "#9d4edd", light: "#7b2cbf" },
  grandmaster: { dark: "#f72585", light: "#c9184a" },
  champion: { dark: "#ff6b35", light: "#d94e1f" },
};

const ROLE_COLORS: Record<string, string> = {
  tank: "#4785ff",
  damage: "#fa9c1e",
  support: "#2daf3f",
};

const ROLE_ICONS: Record<string, string> = {
  tank: "https://blz-contentstack-images.akamaized.net/v3/assets/blt2477dcaf4ebd440c/bltf0889daa1ef606db/6504cff74d2a764cb7973991/Tank.svg",
  damage: "https://blz-contentstack-images.akamaized.net/v3/assets/blt2477dcaf4ebd440c/blt05d482c88096959a/6504cff7d9caa1285f64b6bd/Damage.svg",
  support: "https://blz-contentstack-images.akamaized.net/v3/assets/blt2477dcaf4ebd440c/blt3ccd5df488163b33/6504cff7fc2ae4d7c50445c4/Support.svg",
};

const HERO_ROLES: Record<string, string> = {
  "ana": "support",
  "anran": "damage",
  "ashe": "damage",
  "baptiste": "support",
  "bastion": "damage",
  "brigitte": "support",
  "cassidy": "damage",
  "domina": "tank",
  "doomfist": "tank",
  "dva": "tank",
  "echo": "damage",
  "emre": "damage",
  "freja": "damage",
  "genji": "damage",
  "hanzo": "damage",
  "hazard": "tank",
  "illari": "support",
  "jetpack-cat": "support",
  "junker-queen": "tank",
  "junkrat": "damage",
  "juno": "support",
  "kiriko": "support",
  "lifeweaver": "support",
  "lucio": "support",
  "mauga": "tank",
  "mei": "damage",
  "mercy": "support",
  "mizuki": "support",
  "moira": "support",
  "orisa": "tank",
  "pharah": "damage",
  "ramattra": "tank",
  "reaper": "damage",
  "reinhardt": "tank",
  "roadhog": "tank",
  "shion": "damage",
  "sierra": "damage",
  "sigma": "tank",
  "sojourn": "damage",
  "soldier-76": "damage",
  "sombra": "damage",
  "symmetra": "damage",
  "torbjorn": "damage",
  "tracer": "damage",
  "vendetta": "damage",
  "venture": "damage",
  "widowmaker": "damage",
  "winston": "tank",
  "wrecking-ball": "tank",
  "wuyang": "support",
  "zarya": "tank",
  "zenyatta": "support",
};

function formatPlaytime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

function formatPlaytimeHours(seconds: number): string {
  const hours = seconds / 3600;
  if (hours < 1) return `${Math.round(seconds / 60)}m`;
  if (hours < 10) return `${hours.toFixed(1)}h`;
  return `${Math.floor(hours)}h`;
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toFixed(0);
}

function RankBadge({ role, rank }: { role: string; rank: RankInfo | null }) {
  const roleKey = role.toLowerCase();
  const roleIconSrc = (rank?.role_icon?.split("#")[0]) || ROLE_ICONS[roleKey] || "";

  if (!rank) {
    return (
      <div className="flex flex-col items-center gap-1 p-2 rounded-lg bg-gray-200 dark:bg-gray-700/50">
        {roleIconSrc && (
          <Image
            src={roleIconSrc}
            alt={role}
            width={20}
            height={20}
            className="opacity-90 rounded-sm shadow-sm"
            unoptimized
          />
        )}
        <span className="text-xs text-gray-600 dark:text-gray-300 capitalize">{role}</span>
        <span className="text-xs text-gray-400 dark:text-gray-500">Unranked</span>
      </div>
    );
  }

  const colors = RANK_COLORS[rank.division] || { dark: "#888", light: "#666" };
  const rankIconSrc = rank.rank_icon || "";

  return (
    <div className="flex flex-col items-center gap-1 p-2 rounded-lg bg-gray-200 dark:bg-gray-700/50">
      {roleIconSrc && (
        <Image
          src={roleIconSrc}
          alt={role}
          width={20}
          height={20}
          className="opacity-90 rounded-sm shadow-sm"
          unoptimized
        />
      )}
      <span className="text-xs text-gray-600 dark:text-gray-300 capitalize">{role}</span>
      <div className="flex items-center gap-1">
        {rankIconSrc && (
          <Image
            src={rankIconSrc}
            alt={rank.division}
            width={24}
            height={24}
            className="rounded-sm shadow-sm"
            unoptimized
          />
        )}
        <span className="text-sm font-bold capitalize block dark:hidden" style={{ color: colors.light }}>
          {rank.division} {rank.tier}
        </span>
        <span className="text-sm font-bold capitalize hidden dark:block" style={{ color: colors.dark }}>
          {rank.division} {rank.tier}
        </span>
      </div>
    </div>
  );
}

function StatBar({ label, value, maxValue, color }: { label: string; value: number; maxValue: number; color: string }) {
  const percentage = maxValue > 0 ? Math.min((value / maxValue) * 100, 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500 dark:text-gray-400 w-16">{label}</span>
      <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${percentage}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs text-gray-600 dark:text-gray-300 w-12 text-right">{value.toFixed(0)}</span>
    </div>
  );
}

export default function BattleStatus() {
  const [data, setData] = useState<BattleNetData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log("[BattleStatus] Effect running, data available:", data?.available);

    async function fetchData() {
      console.log("[BattleStatus] Fetching battle-net data...");
      try {
        const res = await fetch("/api/battle-net", { cache: "no-store" });
        console.log("[BattleStatus] Response status:", res.status);
        const result = await res.json();
        console.log("[BattleStatus] Result:", JSON.stringify(result));
        setData(result);
      } catch (err) {
        console.log("[BattleStatus] Fetch error:", err);
        setData({ available: false, error: "Failed to fetch" });
      } finally {
        setLoading(false);
      }
    }
    fetchData();

    const pollInterval = data?.available ? 24 * 60 * 60 * 1000 : 30000;
    console.log("[BattleStatus] Poll interval:", pollInterval);
    const interval = setInterval(fetchData, pollInterval);
    return () => clearInterval(interval);
  }, [data?.available]);

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 flex items-center gap-4 shadow-sm border border-gray-200 dark:border-0">
        <div className="w-12 h-12 rounded-full bg-[#fa9c1e] flex items-center justify-center animate-pulse">
          <span className="text-2xl">🎮</span>
        </div>
        <div>
          <p className="text-gray-500 dark:text-gray-400">Loading Overwatch...</p>
        </div>
      </div>
    );
  }

  if (!data?.available) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-0">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 rounded-full bg-[#fa9c1e] flex items-center justify-center">
            <span className="text-2xl">🎮</span>
          </div>
          <div>
            <p className="font-semibold text-lg text-gray-900 dark:text-white">Overwatch</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Stats Unavailable</p>
          </div>
        </div>
        <div className="bg-gray-100 dark:bg-gray-700/50 rounded-lg p-4">
          <p className="text-gray-600 dark:text-gray-300 text-sm mb-2">
            {data?.error || "Failed to load Overwatch data"}
          </p>
          {data?.battleTag && (
            <p className="text-gray-500 dark:text-gray-400 text-xs">
              Configured: {data.battleTag}
            </p>
          )}
          {data?.suggestion && (
            <p className="text-gray-500 dark:text-gray-400 text-xs mt-2">
              {data.suggestion}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-0">
      <div className="flex items-center gap-4 mb-4">
        {data.avatar ? (
          <Image
            src={data.avatar}
            alt={data.username || "Overwatch Player"}
            width={48}
            height={48}
            className="rounded-full"
            unoptimized
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-[#fa9c1e] flex items-center justify-center">
            <span className="text-2xl">🎮</span>
          </div>
        )}
        <div>
          <div className="flex items-center gap-2">
            <p className="font-semibold text-lg text-gray-900 dark:text-white">{data.username || "Unknown"}</p>
            {data.title && (
              <span className="px-2 py-0.5 text-xs font-medium bg-[#fa9c1e]/20 text-[#fa9c1e] dark:bg-[#fa9c1e]/30 rounded">
                {data.title}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        {data.ranks && (
          <>
            <RankBadge role="Tank" rank={data.ranks.tank} />
            <RankBadge role="Damage" rank={data.ranks.damage} />
            <RankBadge role="Support" rank={data.ranks.support} />
          </>
        )}
      </div>

      {data.generalStats && (
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4 mb-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{data.generalStats.games_played}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Games</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{data.generalStats.winrate.toFixed(0)}%</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Winrate</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{data.generalStats.kda.toFixed(2)}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">KDA</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatPlaytimeHours(data.generalStats.playtime)}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Time Played</p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
            <div className="text-center p-2 rounded bg-gray-100 dark:bg-gray-700/50">
              <p className="text-lg font-bold text-gray-900 dark:text-white">{data.generalStats.eliminations.toFixed(1)}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Elim/10m</p>
            </div>
            <div className="text-center p-2 rounded bg-gray-100 dark:bg-gray-700/50">
              <p className="text-lg font-bold text-gray-900 dark:text-white">{data.generalStats.deaths.toFixed(1)}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Death/10m</p>
            </div>
            <div className="text-center p-2 rounded bg-gray-100 dark:bg-gray-700/50">
              <p className="text-lg font-bold text-gray-900 dark:text-white">{data.generalStats.damage > 0 ? formatNumber(data.generalStats.damage) : "0"}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Dmg/10m</p>
            </div>
            <div className="text-center p-2 rounded bg-gray-100 dark:bg-gray-700/50">
              <p className="text-lg font-bold text-gray-900 dark:text-white">{data.generalStats.healing > 0 ? formatNumber(data.generalStats.healing) : "0"}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Heal/10m</p>
            </div>
          </div>
          <div className="space-y-2">
            <StatBar label="Damage" value={data.generalStats.damage} maxValue={10000} color="#fa9c1e" />
            <StatBar label="Healing" value={data.generalStats.healing} maxValue={10000} color="#2daf3f" />
          </div>
        </div>
      )}

      {data.mostPlayedHeroes && data.mostPlayedHeroes.length > 0 && (
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Most Played Heroes</p>
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
            {data.mostPlayedHeroes.map((hero, i) => (
              <div
                key={i}
                className="flex flex-col items-center gap-1 p-2 rounded-lg bg-gray-200 dark:bg-gray-700/50"
              >
                {hero.icon ? (
                  <Image
                    src={hero.icon}
                    alt={hero.hero}
                    width={40}
                    height={40}
                    className="rounded shadow-sm"
                    unoptimized
                  />
                ) : (
                  <div className="w-10 h-10 rounded bg-gray-300 dark:bg-gray-600" />
                )}
                <span className="text-xs text-gray-700 dark:text-gray-300 truncate w-full text-center font-medium">
                  {hero.hero}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">{formatPlaytime(hero.playtime)}</span>
                <span
                  className="text-xs px-1 py-0 rounded capitalize"
                  style={{ color: ROLE_COLORS[HERO_ROLES[hero.key]] || "#888" }}
                >
                  {HERO_ROLES[hero.key] || "hero"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.lastUpdated && (
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-4 text-center">
          Updated {new Date(data.lastUpdated).toLocaleString()}
        </p>
      )}
    </div>
  );
}
