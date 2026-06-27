import { NextResponse } from "next/server";
import discordUserConfig from "@/config/discord-user.json";
import { lastPresenceUpdate } from "@/lib/discord-cache";

const PRESENCE_SERVICE_URL = "http://localhost:3001";
const DISCORD_API = "https://discord.com/api/v10";
const CACHE_TTL = 10000;

interface CacheData {
  data: object;
  cachedAt: number;
  userId: string;
}

let cache: CacheData | null = null;

interface DiscordUser {
  id: string;
  username: string;
  global_name?: string | null;
  avatar: string | null;
  discriminator: string;
  banner?: string | null;
  banner_color?: string | null;
  accent_color?: number | null;
}

interface PresenceData {
  status: string;
  activities: Array<{
    type: number;
    name: string;
    state: string | null;
    details: string | null;
    application_id?: string | null;
    assets?: {
      large_image?: string | null;
      small_image?: string | null;
      large_text?: string | null;
      small_text?: string | null;
    } | null;
    timestamps?: { start?: number; end?: number };
  }>;
  customStatus: { text: string | null; emoji: string | null } | null;
  lastSeen: string | null;
  lastUpdated: string | null;
  nickname: string | null;
}

async function fetchGameIconFromSteam(item: { id: number; name: string }): Promise<string | null> {
  const iconUrl = `https://cdn.akamai.steamstatic.com/steam/apps/${item.id}/icon.jpg`;
  const logoUrl = `https://cdn.akamai.steamstatic.com/steam/apps/${item.id}/logo.png`;

  try {
    const iconRes = await fetch(iconUrl, { signal: AbortSignal.timeout(2000) });
    if (iconRes.ok) {
      return iconUrl;
    }
  } catch {}

  try {
    const logoRes = await fetch(logoUrl, { signal: AbortSignal.timeout(2000) });
    if (logoRes.ok) {
      return logoUrl;
    }
  } catch {}

  return logoUrl;
}

async function fetchGameIconFromRawg(name: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.rawg.io/api/games?search=${encodeURIComponent(name)}&page_size=5`,
      { signal: AbortSignal.timeout(3000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const results = data?.results || [];

    for (const game of results) {
      if (game.background_image) {
        return game.background_image;
      }
      if (game.deleted_at) continue;
      if (game.name.toLowerCase() === name.toLowerCase() && game.background_image) {
        return game.background_image;
      }
    }

    if (results.length > 0 && results[0].background_image) {
      return results[0].background_image;
    }
  } catch {}
  return null;
}

async function fetchGameIcon(name: string): Promise<string | null> {
  try {
    const query = encodeURIComponent(name);
    const res = await fetch(
      `https://store.steampowered.com/api/storesearch/?term=${query}&l=english&cc=us`,
      { signal: AbortSignal.timeout(3000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const items: Array<{ id: number; name: string; types?: string[] }> = data?.items || [];

    if (items.length === 0) {
      return await fetchGameIconFromRawg(name);
    }

    let scored = items.filter((item) =>
      !item.types || item.types.includes("game")
    );

    if (scored.length === 0) {
      scored = items;
    }

    scored.sort((a, b) => {
      const aExact = a.name.toLowerCase() === name.toLowerCase() ? 1 : 0;
      const bExact = b.name.toLowerCase() === name.toLowerCase() ? 1 : 0;
      return bExact - aExact;
    });

    const best = scored[0];
    if (best) {
      const steamIcon = await fetchGameIconFromSteam(best);
      if (steamIcon) return steamIcon;
    }
  } catch {}

  return await fetchGameIconFromRawg(name);
}

async function fetchAlbumCoverFromItunes(track: string, artist: string): Promise<{ url: string; aspectRatio: number } | null> {
  try {
    const query = encodeURIComponent(`${track} ${artist}`);
    const res = await fetch(
      `https://itunes.apple.com/search?term=${query}&media=music&limit=5`,
      { signal: AbortSignal.timeout(3000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const results = data?.results || [];
    if (results.length === 0) return null;

    const withSizes = results.map((r: { artworkUrl100?: string }) => {
      const base = r.artworkUrl100?.replace("100x100bb", "").replace("200x200bb", "");
      return {
        url: r.artworkUrl100?.replace("100x100bb", "600x600bb") || null,
        aspectRatio: 1,
        width: 600,
      };
    }).filter((r: { url: string }) => r.url);

    if (withSizes.length === 0) return null;

    withSizes.sort((a: { width: number }, b: { width: number }) => b.width - a.width);
    return { url: withSizes[0].url, aspectRatio: 1 };
  } catch {}
  return null;
}

async function fetchAlbumCoverFromDeezer(track: string, artist: string): Promise<{ url: string; aspectRatio: number } | null> {
  try {
    const query = encodeURIComponent(`${track} ${artist}`);
    const res = await fetch(
      `https://api.deezer.com/search?q=${query}&limit=5`,
      { signal: AbortSignal.timeout(3000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const items = data?.data || [];
    if (items.length === 0) return null;

    const withSizes = items.map((item: { album?: { cover_small?: string; cover_medium?: string; cover_big?: string; cover_xl?: string } }) => {
      const sizes = [
        { url: item.album?.cover_xl, width: 500 },
        { url: item.album?.cover_big, width: 252 },
        { url: item.album?.cover_medium, width: 126 },
        { url: item.album?.cover_small, width: 56 },
      ].filter((s): s is { url: string; width: number } => !!s.url);

      if (sizes.length === 0) return null;
      sizes.sort((a, b) => b.width - a.width);
      return { url: sizes[0].url, aspectRatio: 1, width: sizes[0].width };
    }).filter((r: unknown): r is { url: string; aspectRatio: number } => r !== null);

    if (withSizes.length === 0) return null;

    withSizes.sort((a: { width: number }, b: { width: number }) => b.width - a.width);
    return { url: withSizes[0].url, aspectRatio: 1 };
  } catch {}
  return null;
}

async function fetchAlbumCoverFromMusicBrainz(track: string, artist: string): Promise<{ url: string; aspectRatio: number } | null> {
  try {
    const query = encodeURIComponent(`recording:"${track}" AND artist:"${artist}"`);
    const res = await fetch(
      `https://musicbrainz.org/ws/2/recording?query=${query}&fmt=json&limit=5`,
      {
        signal: AbortSignal.timeout(3000),
        headers: {
          "User-Agent": "HomepageDiscordWidget/1.0 (personal use)",
        },
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const recordings = data?.recordings || [];
    if (recordings.length === 0) return null;

    for (const rec of recordings) {
      const releaseId = rec?.releases?.[0]?.id;
      if (releaseId) {
        return { url: `https://coverartarchive.org/release/${releaseId}/front-500`, aspectRatio: 1 };
      }
    }
  } catch {}
  return null;
}

async function fetchAlbumCover(track: string, artist: string): Promise<string | null> {
  const sources = [
    () => fetchAlbumCoverFromItunes(track, artist),
    () => fetchAlbumCoverFromDeezer(track, artist),
    () => fetchAlbumCoverFromMusicBrainz(track, artist),
  ];

  for (const source of sources) {
    try {
      const result = await source();
      if (result) return result.url;
    } catch {}
  }

  return null;
}

async function fetchDiscordData() {
  const { userId, botToken } = discordUserConfig;

  if (!userId || !botToken || userId === "YOUR_DISCORD_USER_ID") {
    return { error: "Not configured" };
  }

  try {
    const userRes = await fetch(`${DISCORD_API}/users/${userId}`, {
      headers: {
        Authorization: `Bot ${botToken}`,
      },
    });

    if (!userRes.ok) {
      let errorMsg = `HTTP ${userRes.status}`;
      try {
        const errData = await userRes.json();
        errorMsg = errData.message || errorMsg;
      } catch {}

      return {
        error: `Discord API error: ${errorMsg}`,
        status: userRes.status,
      };
    }

    const userData: DiscordUser = await userRes.json();

    let presence: PresenceData = {
      status: "offline",
      activities: [],
      customStatus: null,
      lastSeen: null,
      lastUpdated: null,
      nickname: null,
    };
    try {
      const presenceRes = await fetch(`${PRESENCE_SERVICE_URL}/presence`, {
        signal: AbortSignal.timeout(5000),
      });
      if (presenceRes.ok) {
        presence = await presenceRes.json();
      }
    } catch {
      // Presence service not running or timed out
    }

    const activitiesWithImages = await Promise.all(
      (presence.activities || []).map(async (activity) => {
        const hasLargeImage = activity.assets?.large_image;
        const hasSmallImage = activity.assets?.small_image;
        let fallbackLarge: string | null = null;
        let fallbackSmall: string | null = null;

        const isYouTubeMusic = activity.name && (
          activity.name.toLowerCase() === "youtube music" ||
          activity.name.toLowerCase().includes("youtube music")
        );

        const isSpotify = activity.name?.toLowerCase().includes("spotify");
        const isMusic = activity.type === 2 || (activity.type === 1 && isYouTubeMusic);
        const isStreamingYouTube = activity.type === 1 && activity.assets?.large_image?.startsWith("youtube:");
        const isExternalAvatar = activity.assets?.large_image?.startsWith("mp:external/");

        if (activity.name) {
          if (activity.type === 0) {
            fallbackLarge = await fetchGameIcon(activity.name);
          } else if (isMusic) {
            const track = activity.details || activity.assets?.large_text || "";
            const artist = activity.state || "";

            if (track) {
              fallbackLarge = await fetchAlbumCover(track, artist);
            }
            if (!fallbackLarge && isYouTubeMusic && isExternalAvatar) {
              const videoIdMatch = activity.assets?.large_image?.match(/\/vi\/([^/]+)\//);
              if (videoIdMatch) {
                fallbackLarge = `https://i.ytimg.com/vi/${videoIdMatch[1]}/hqdefault.jpg`;
              }
            }
          } else if (isStreamingYouTube) {
            const videoId = activity.assets?.large_image?.slice(8);
            if (videoId) {
              fallbackLarge = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
            }
          }
        }

        return {
          ...activity,
          assets: {
            ...activity.assets,
            large_image: fallbackLarge || hasLargeImage,
            small_image: hasSmallImage,
          },
        };
      })
    );

    const discriminator = userData.discriminator === "0" ? "0" : userData.discriminator;

    return {
      id: userData.id,
      username: discriminator === "0"
        ? userData.username
        : `${userData.username}#${discriminator}`,
      globalName: userData.global_name || null,
      avatar: userData.avatar,
      banner: userData.banner || null,
      bannerColor: userData.banner_color || null,
      accentColor: userData.accent_color || null,
      globalNickname: null,
      status: presence.status,
      activities: activitiesWithImages,
      customStatus: presence.customStatus,
      lastSeen: presence.lastSeen,
      lastUpdated: presence.lastUpdated,
    };
  } catch (err) {
    console.error("Discord user fetch error:", err);
    return { error: "Server error", details: String(err) };
  }
}

export async function GET() {
  const currentUserId = discordUserConfig.userId;

  console.log(`[Discord] Request received for user ${currentUserId}`);

  if (cache && cache.userId !== currentUserId) {
    cache = null;
  }

  if (cache && Date.now() - cache.cachedAt < CACHE_TTL && lastPresenceUpdate < cache.cachedAt) {
    console.log(`[Discord] Cache HIT for user ${currentUserId}`);
    return NextResponse.json(cache.data, {
      headers: {
        "X-Cache": "HIT",
        "Cache-Control": "no-store",
      },
    });
  }

  console.log(`[Discord] Cache MISS for user ${currentUserId}, fetching...`);
  const data = await fetchDiscordData();
  cache = { data, cachedAt: Date.now(), userId: currentUserId };

  return NextResponse.json(data, {
    headers: {
      "X-Cache": "MISS",
      "Cache-Control": "no-store",
    },
  });
}
