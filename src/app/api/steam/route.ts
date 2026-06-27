import { NextResponse } from "next/server";
import steamConfig from "@/config/steam.json";

const CACHE_TTL = 10000;

interface CacheData {
  data: object;
  cachedAt: number;
}

let cache: CacheData | null = null;

async function getGameName(appid: number): Promise<string> {
  try {
    const res = await fetch(`https://store.steampowered.com/api/appdetails?appids=${appid}&filters=basic`);
    const data = await res.json();
    return data[appid]?.data?.name || `App ${appid}`;
  } catch {
    return `App ${appid}`;
  }
}

async function fetchSteamData() {
  try {
    const { apiKey, steamId } = steamConfig;

    const playerRes = await fetch(
      `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${apiKey}&steamids=${steamId}`
    );

    if (!playerRes.ok) {
      return { player: null, recentGames: [], ownedGames: [], error: "Steam API error" };
    }

    const playerData = await playerRes.json();
    const player = playerData.response?.players?.[0] || null;

    let recentGames: Array<{ appid: number; name: string; playtime_forever: number; playtime_2weeks: number }> = [];
    let ownedGames: Array<{ appid: number; name: string; playtime_forever: number }> = [];

    try {
      const gamesRes = await fetch(
        `https://api.steampowered.com/IPlayerService/GetRecentlyPlayedGames/v0001/?key=${apiKey}&steamid=${steamId}&format=json&count=100`
      );
      const gamesData = await gamesRes.json();
      recentGames = gamesData.response?.games || [];
    } catch {
      recentGames = [];
    }

    try {
      const ownedRes = await fetch(
        `https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=${apiKey}&steamid=${steamId}&format=json&include_played_free_games=true`
      );
      const ownedData = await ownedRes.json();
      const allOwned = ownedData.response?.games || [];

      const gamesWithPlaytime = allOwned
        .filter((g: { playtime_forever: number }) => g.playtime_forever > 0)
        .sort((a: { playtime_forever: number }, b: { playtime_forever: number }) => b.playtime_forever - a.playtime_forever)
        .slice(0, 10);

      ownedGames = await Promise.all(
        gamesWithPlaytime.map(async (g: { appid: number; playtime_forever: number }) => ({
          appid: g.appid,
          name: await getGameName(g.appid),
          playtime_forever: g.playtime_forever,
        }))
      );
    } catch {
      ownedGames = [];
    }

    return {
      player: player ? {
        steamid: player.steamid,
        personaname: player.personaname,
        avatarfull: player.avatarfull,
        personastate: player.personastate,
        gameextrainfo: player.gameextrainfo,
      } : null,
      recentGames,
      ownedGames,
    };
  } catch {
    return { player: null, recentGames: [], ownedGames: [], error: "Server error" };
  }
}

export async function GET() {
  const steamId = steamConfig.steamId || "unknown";

  console.log(`[Steam] Request received for ${steamId}`);

  if (cache && Date.now() - cache.cachedAt < CACHE_TTL) {
    console.log(`[Steam] Cache HIT for ${steamId}`);
    return NextResponse.json(cache.data, {
      headers: {
        "X-Cache": "HIT",
        "Cache-Control": "no-store",
      },
    });
  }

  console.log(`[Steam] Cache MISS for ${steamId}, fetching...`);
  const data = await fetchSteamData();
  cache = { data, cachedAt: Date.now() };

  return NextResponse.json(data, {
    headers: {
      "X-Cache": "MISS",
      "Cache-Control": "no-store",
    },
  });
}
