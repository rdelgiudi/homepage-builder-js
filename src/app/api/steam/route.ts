import { NextRequest, NextResponse } from "next/server";
import steamConfig from "@/config/steam.json";
import crypto from "crypto";

const REFRESH_INTERVAL = 10000;

interface SteamCache {
  player: object | null;
  recentGames: object[];
  ownedGames: object[];
  identityHash: string;
  gamesHash: string;
}

let cache: SteamCache | null = null;
let refreshPromise: Promise<void> | null = null;

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

    const playerObj = player ? {
      steamid: player.steamid,
      personaname: player.personaname,
      avatarfull: player.avatarfull,
      personastate: player.personastate,
      gameextrainfo: player.gameextrainfo,
    } : null;

    return {
      player: playerObj,
      recentGames,
      ownedGames,
    };
  } catch {
    return { player: null, recentGames: [], ownedGames: [], error: "Server error" };
  }
}

function computeHashes(data: { player: object | null; recentGames: object[]; ownedGames: object[] }) {
  const identityHash = crypto.createHash("sha256")
    .update(JSON.stringify(data.player || {}))
    .digest("hex")
    .slice(0, 16);
  const gamesHash = crypto.createHash("sha256")
    .update(JSON.stringify({ recentGames: data.recentGames, ownedGames: data.ownedGames }))
    .digest("hex")
    .slice(0, 16);
  return { identityHash, gamesHash };
}

async function refreshCache() {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const data = await fetchSteamData();
      const { identityHash, gamesHash } = computeHashes(data);
      cache = { ...data, identityHash, gamesHash };
      console.log(`[${new Date().toISOString()}] [Steam] Background refresh complete`);
    } catch (e) {
      console.error(`[${new Date().toISOString()}] [Steam] Background refresh failed:`, e);
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

if (!(global as any).__steamRefreshInitialized) {
  (global as any).__steamRefreshInitialized = true;
  refreshCache();
  setInterval(refreshCache, REFRESH_INTERVAL);
}

export async function GET(request: NextRequest) {
  const steamId = steamConfig.steamId || "unknown";

  if (!cache) {
    console.log(`[${new Date().toISOString()}] [Steam] No cache yet for ${steamId}, fetching...`);
    await refreshCache();
  }

  const clientIdentityHash = request.nextUrl.searchParams.get("identityHash");
  const clientGamesHash = request.nextUrl.searchParams.get("gamesHash");

  const identityChanged = !clientIdentityHash || clientIdentityHash !== cache!.identityHash;
  const gamesChanged = !clientGamesHash || clientGamesHash !== cache!.gamesHash;
  const changed = identityChanged || gamesChanged;

  if (!changed) {
    return NextResponse.json({
      changed: false,
      identityHash: cache!.identityHash,
      gamesHash: cache!.gamesHash,
    }, { headers: { "Cache-Control": "no-store" } });
  }

  const response: Record<string, unknown> = {
    changed: true,
    identityHash: cache!.identityHash,
    gamesHash: cache!.gamesHash,
  };

  if (identityChanged) {
    response.player = cache!.player;
  }
  if (gamesChanged) {
    response.recentGames = cache!.recentGames;
    response.ownedGames = cache!.ownedGames;
  }

  return NextResponse.json(response, { headers: { "Cache-Control": "no-store" } });
}
