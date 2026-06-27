import { NextResponse } from "next/server";
import battleNetConfig from "@/config/battle-net.json";

const OVERFAST_API = "https://overfast-api.tekrop.fr";

interface CacheData {
  data: object;
  cachedAt: number;
}

let cache: CacheData | null = null;

function isCacheValid(): boolean {
  if (!cache) return false;

  const now = Date.now();
  const cacheAge = now - cache.cachedAt;
  const oneDayMs = 24 * 60 * 60 * 1000;

  if (cacheAge > oneDayMs) return false;

  const lastUpdated = (cache.data as { lastUpdated?: number }).lastUpdated;
  if (lastUpdated && (now - lastUpdated) > oneDayMs) return false;

  const cacheTime = new Date(cache.cachedAt);
  const hour = cacheTime.getHours();
  if (hour >= 5 && hour < 7 && cacheAge > 60 * 60 * 1000) return false;

  return true;
}

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

async function fetchPlayerData() {
  const { battleTag } = battleNetConfig;

  if (!battleTag || battleTag === "YourTag-12345") {
    return {
      available: false,
      error: "Configure your BattleTag in src/config/battle-net.json",
    };
  }

  try {
    const searchRes = await fetch(
      `${OVERFAST_API}/players?name=${encodeURIComponent(battleTag)}`
    );

    if (!searchRes.ok) {
      throw new Error(`Search failed: ${searchRes.status}`);
    }

    const searchData = await searchRes.json();

    if (!searchData.results || searchData.results.length === 0) {
      return {
        available: false,
        error: "Player not found",
        battleTag,
      };
    }

    const player = searchData.results[0];
    const playerId = player.player_id;

    const [profileRes, statsRes, heroesListRes] = await Promise.all([
      fetch(`${OVERFAST_API}/players/${playerId}`),
      fetch(`${OVERFAST_API}/players/${playerId}/stats/summary?platform=pc`),
      fetch(`${OVERFAST_API}/heroes`),
    ]);

    if (!profileRes.ok) {
      throw new Error(`Profile fetch failed: ${profileRes.status}`);
    }

    const profileData = await profileRes.json();

    if (profileData.private || !profileData.summary) {
      return {
        available: false,
        error: "Overwatch 2 profile is private",
        battleTag,
        suggestion: "Set your Overwatch 2 profile to public to display stats",
      };
    }

    const summary = profileData.summary;
    const pcCompetitive = summary.competitive?.pc;

    const ranks: CompetitiveRanks = {
      tank: pcCompetitive?.tank || null,
      damage: pcCompetitive?.damage || null,
      support: pcCompetitive?.support || null,
    };

    let generalStats: GeneralStats | null = null;
    let mostPlayedHeroes: HeroStats[] = [];

    let heroPortraits: Record<string, string> = {};
    if (heroesListRes.ok) {
      const heroesList = await heroesListRes.json();
      heroPortraits = (heroesList || []).reduce((acc: Record<string, string>, h: { key: string; portrait: string; name: string }) => {
        acc[h.key] = h.portrait;
        return acc;
      }, {});
    }

    if (statsRes.ok) {
      const statsData = await statsRes.json();
      const general = statsData.general;

      if (general) {
        generalStats = {
          eliminations: general.average?.eliminations || 0,
          assists: general.average?.assists || 0,
          deaths: general.average?.deaths || 0,
          damage: general.average?.damage || 0,
          healing: general.average?.healing || 0,
          kda: general.kda || 0,
          games_played: general.games_played || 0,
          games_won: general.games_won || 0,
          games_lost: general.games_lost || 0,
          winrate: general.winrate || 0,
          playtime: general.time_played || 0,
        };
      }

      type HeroData = {
        games_played: number;
        winrate: number;
        time_played: number;
        kda: number;
        average: { eliminations: number; deaths: number; damage: number; healing: number };
      };

      const heroes = (statsData.heroes || {}) as Record<string, HeroData>;
      mostPlayedHeroes = (Object.entries(heroes) as [string, HeroData][])
        .map(([key, data]) => ({
          hero: key.charAt(0).toUpperCase() + key.slice(1).replace(/-/g, " "),
          key,
          icon: heroPortraits[key] || "",
          playtime: data.time_played || 0,
          winrate: data.winrate || 0,
          games_played: data.games_played || 0,
          kda: data.kda || 0,
          eliminations: data.average?.eliminations || 0,
          deaths: data.average?.deaths || 0,
          healing: data.average?.healing || 0,
          damage: data.average?.damage || 0,
        }))
        .filter(h => h.games_played > 0 || h.playtime > 0)
        .sort((a, b) => b.playtime - a.playtime)
        .slice(0, 12);
    }

    const title = summary.title || null;

    return {
      available: true,
      username: summary.username,
      avatar: summary.avatar,
      title,
      ranks,
      mostPlayedHeroes,
      generalStats,
      battleTag,
      lastUpdated: summary.last_updated_at * 1000,
    };
  } catch (error) {
    console.error("OverFast API error:", error);
    return {
      available: false,
      error: "Failed to fetch Overwatch data",
      battleTag,
    };
  }
}

export async function GET() {
  if (isCacheValid() && cache) {
    return NextResponse.json(cache.data, {
      headers: {
        "X-Cache": "HIT",
        "Cache-Control": "private, max-age=86400",
      },
    });
  }

  const data = await fetchPlayerData();
  cache = { data, cachedAt: Date.now() };

  return NextResponse.json(data, {
    headers: {
      "X-Cache": "MISS",
      "Cache-Control": "private, max-age=86400",
    },
  });
}
