import { NextResponse } from "next/server";
import steamConfig from "@/config/steam.json";

const RATE_LIMIT = 30;
const RATE_LIMIT_WINDOW = 60000;

const rateLimitMap = new Map<string, { count: number; timestamp: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (!record || now - record.timestamp > RATE_LIMIT_WINDOW) {
    rateLimitMap.set(ip, { count: 1, timestamp: now });
    return false;
  }

  if (record.count >= RATE_LIMIT) {
    return true;
  }

  record.count++;
  return false;
}

async function getGameName(appid: number): Promise<string> {
  try {
    const res = await fetch(`https://store.steampowered.com/api/appdetails?appids=${appid}&filters=basic`);
    const data = await res.json();
    return data[appid]?.data?.name || `App ${appid}`;
  } catch {
    return `App ${appid}`;
  }
}

export async function GET(request: Request) {
  const ip = request.headers.get("x-forwarded-for") || "unknown";

  if (isRateLimited(ip)) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  }

  try {
    const { apiKey, steamId } = steamConfig;

    const playerRes = await fetch(
      `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${apiKey}&steamids=${steamId}`,
      { next: { revalidate: 10 } }
    );

    if (!playerRes.ok) {
      return NextResponse.json({ player: null, recentGames: [], ownedGames: [], error: "Steam API error" }, { status: 200 });
    }

    const playerData = await playerRes.json();
    const player = playerData.response?.players?.[0] || null;

    let recentGames: Array<{ appid: number; name: string; playtime_forever: number; playtime_2weeks: number }> = [];
    let ownedGames: Array<{ appid: number; name: string; playtime_forever: number }> = [];

    try {
      const gamesRes = await fetch(
        `https://api.steampowered.com/IPlayerService/GetRecentlyPlayedGames/v0001/?key=${apiKey}&steamid=${steamId}&format=json&count=100`,
        { next: { revalidate: 10 } }
      );
      const gamesData = await gamesRes.json();
      recentGames = gamesData.response?.games || [];
    } catch {
      recentGames = [];
    }

    try {
      const ownedRes = await fetch(
        `https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=${apiKey}&steamid=${steamId}&format=json&include_played_free_games=true`,
        { next: { revalidate: 3600 } }
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

    return NextResponse.json({
      player: player ? {
        steamid: player.steamid,
        personaname: player.personaname,
        avatarfull: player.avatarfull,
        personastate: player.personastate,
        gameextrainfo: player.gameextrainfo,
      } : null,
      recentGames,
      ownedGames
    });
  } catch {
    return NextResponse.json({ player: null, recentGames: [], ownedGames: [], error: "Server error" }, { status: 500 });
  }
}
