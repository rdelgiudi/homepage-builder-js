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

interface BattleNetData {
  available: boolean;
  error?: string;
  battleTag?: string;
  username?: string;
  avatar?: string;
  endorsement?: number;
  ranks?: CompetitiveRanks;
  lastUpdated?: string;
  suggestion?: string;
}

const RANK_COLORS: Record<string, string> = {
  bronze: "#cd7f32",
  silver: "#c0c0c0",
  gold: "#ffd700",
  platinum: "#00b4d8",
  diamond: "#b9f2ff",
  master: "#9d4edd",
  grandmaster: "#f72585",
  champion: "#ff6b35",
};

function RankBadge({ role, rank }: { role: string; rank: RankInfo | null }) {
  if (!rank) {
    return (
      <div className="flex flex-col items-center gap-1 p-2 rounded-lg bg-[#2b2d31]/50">
        <span className="text-xs text-gray-500 capitalize">{role}</span>
        <span className="text-xs text-gray-600">Unranked</span>
      </div>
    );
  }

  const color = RANK_COLORS[rank.division] || "#888";

  return (
    <div className="flex flex-col items-center gap-1 p-2 rounded-lg bg-[#2b2d31]/50">
      <Image
        src={rank.role_icon.split("#")[0]}
        alt={role}
        width={20}
        height={20}
        className="opacity-70"
      />
      <span className="text-xs text-gray-400 capitalize">{role}</span>
      <div className="flex items-center gap-1">
        <Image
          src={rank.rank_icon}
          alt={rank.division}
          width={24}
          height={24}
        />
        <span
          className="text-sm font-bold capitalize"
          style={{ color }}
        >
          {rank.division} {rank.tier}
        </span>
      </div>
    </div>
  );
}

export default function BattleStatus() {
  const [data, setData] = useState<BattleNetData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/battle-net");
        const result = await res.json();
        setData(result);
      } catch {
        setData({ available: false, error: "Failed to fetch" });
      } finally {
        setLoading(false);
      }
    }
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 flex items-center gap-4 shadow-sm dark:shadow-none border border-gray-200 dark:border-0">
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
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm dark:shadow-none border border-gray-200 dark:border-0">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 rounded-full bg-[#fa9c1e] flex items-center justify-center">
            <span className="text-2xl">🎮</span>
          </div>
          <div>
            <p className="font-semibold text-lg text-gray-900 dark:text-white">Overwatch 2</p>
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
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm dark:shadow-none border border-gray-200 dark:border-0">
      <div className="flex items-center gap-4 mb-4">
        {data.avatar && (
          <Image
            src={data.avatar}
            alt={data.username || "Overwatch Player"}
            width={48}
            height={48}
            className="rounded-full"
          />
        )}
        <div>
          <p className="font-semibold text-lg text-gray-900 dark:text-white">{data.username || "Unknown"}</p>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">Overwatch 2</span>
            {data.endorsement !== undefined && (
              <>
                <span className="text-gray-300 dark:text-gray-600">•</span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Endorsement {data.endorsement}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {data.ranks && (
          <>
            <RankBadge role="Tank" rank={data.ranks.tank} />
            <RankBadge role="Damage" rank={data.ranks.damage} />
            <RankBadge role="Support" rank={data.ranks.support} />
          </>
        )}
      </div>

      {data.lastUpdated && (
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-3 text-center">
          Updated {data.lastUpdated}
        </p>
      )}
    </div>
  );
}
