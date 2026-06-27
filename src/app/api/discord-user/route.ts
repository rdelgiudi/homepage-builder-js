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

interface AlbumCoverResult {
  url: string;
  trackName: string;
  artistName: string;
}

function normalize(s: string): string {
  return s.toLowerCase().trim();
}

function containsJapanese(text: string): boolean {
  return /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(text);
}

function matchScore(resultTrack: string, resultArtist: string, targetTrack: string, targetArtist: string): number {
  const normTrack = normalize(targetTrack);
  const normArtist = normalize(targetArtist);
  const normResultTrack = normalize(resultTrack);
  const normResultArtist = normalize(resultArtist);
  let trackScore = 0;
  let artistScore = 0;

  if (normTrack && normResultTrack) {
    if (normResultTrack === normTrack) trackScore = 100;
    else if (normResultTrack.includes(normTrack) || normTrack.includes(normResultTrack)) trackScore = 50;
  }

  if (normArtist && normResultArtist) {
    if (normResultArtist === normArtist) artistScore = 100;
    else if (normResultArtist.includes(normArtist) || normArtist.includes(normResultArtist)) artistScore = 50;
  }

  if (normTrack && normArtist) {
    return trackScore > 0 && artistScore > 0 ? trackScore + artistScore : 0;
  }

  return trackScore + artistScore;
}

async function fetchAlbumCoverFromItunes(track: string, artist: string): Promise<AlbumCoverResult | null> {
  try {
    const query = encodeURIComponent(`${track} ${artist}`);
    const res = await fetch(
      `https://itunes.apple.com/search?term=${query}&media=music&limit=5`,
      { signal: AbortSignal.timeout(3000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const results = data?.results || [];

    let best: { url: string; trackName: string; artistName: string; score: number } | null = null;
    let looseFallback: AlbumCoverResult | null = null;

    for (const r of results) {
      const url = r.artworkUrl100?.replace("100x100bb", "600x600bb");
      if (!url) continue;
      const resultTrack = r.trackName || "";
      const resultArtist = r.artistName || "";
      if (!looseFallback) looseFallback = { url, trackName: resultTrack, artistName: resultArtist };
      const score = matchScore(resultTrack, resultArtist, track, artist);
      if (score === 200) return { url, trackName: resultTrack, artistName: resultArtist };
      if (score > (best?.score || 0)) best = { url, trackName: resultTrack, artistName: resultArtist, score };
    }

    if (best && best.score >= 50) return best;
    if (looseFallback && (containsJapanese(track) || containsJapanese(artist))) return looseFallback;
    return null;
  } catch {}
  return null;
}

async function fetchAlbumCoverFromDeezer(track: string, artist: string): Promise<AlbumCoverResult | null> {
  try {
    const query = encodeURIComponent(`${track} ${artist}`);
    const res = await fetch(
      `https://api.deezer.com/search?q=${query}&limit=5`,
      { signal: AbortSignal.timeout(3000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const items = data?.data || [];

    let best: { url: string; trackName: string; artistName: string; score: number } | null = null;
    let looseFallback: AlbumCoverResult | null = null;

    for (const item of items) {
      const sizes = [
        { url: item.album?.cover_xl, width: 500 },
        { url: item.album?.cover_big, width: 252 },
        { url: item.album?.cover_medium, width: 126 },
        { url: item.album?.cover_small, width: 56 },
      ].filter((s): s is { url: string; width: number } => !!s.url);
      if (sizes.length === 0) continue;
      sizes.sort((a, b) => b.width - a.width);
      const resultTrack = item.title || "";
      const resultArtist = item.artist?.name || "";
      if (!looseFallback) looseFallback = { url: sizes[0].url, trackName: resultTrack, artistName: resultArtist };
      const score = matchScore(resultTrack, resultArtist, track, artist);
      if (score === 200) return { url: sizes[0].url, trackName: resultTrack, artistName: resultArtist };
      if (score > (best?.score || 0)) best = { url: sizes[0].url, trackName: resultTrack, artistName: resultArtist, score };
    }

    if (best && best.score >= 50) return best;
    if (looseFallback && (containsJapanese(track) || containsJapanese(artist))) return looseFallback;
    return null;
  } catch {}
  return null;
}

async function fetchAlbumCoverFromMusicBrainz(track: string, artist: string): Promise<AlbumCoverResult | null> {
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

    let best: { url: string; trackName: string; artistName: string; score: number } | null = null;
    let looseFallback: AlbumCoverResult | null = null;

    for (const rec of recordings) {
      const releaseId = rec?.releases?.[0]?.id;
      if (!releaseId) continue;
      const resultTrack = rec.title || "";
      const artistCredit = rec["artist-credit"];
      const resultArtist = Array.isArray(artistCredit) && artistCredit.length > 0
        ? (artistCredit[0].name || artistCredit[0].artist?.name || "")
        : "";
      const url = `https://coverartarchive.org/release/${releaseId}/front-500`;
      if (!looseFallback) looseFallback = { url, trackName: resultTrack, artistName: resultArtist };
      const score = matchScore(resultTrack, resultArtist, track, artist);
      if (score === 200) return { url, trackName: resultTrack, artistName: resultArtist };
      if (score > (best?.score || 0)) best = { url, trackName: resultTrack, artistName: resultArtist, score };
    }

    if (best && best.score >= 50) return best;
    if (looseFallback && (containsJapanese(track) || containsJapanese(artist))) return looseFallback;
    return null;
  } catch {}
  return null;
}

const albumCoverCache = new Map<string, string[]>();

async function fetchAlbumCover(track: string, artist: string, preferSpotify: boolean = true): Promise<string[]> {
  const cacheKey = `${track}|${artist}|${preferSpotify}`;
  const cached = albumCoverCache.get(cacheKey);
  if (cached) return cached;

  const urls: string[] = [];
  const sources = preferSpotify
    ? [
        () => fetchAlbumCoverFromItunes(track, artist),
        () => fetchAlbumCoverFromDeezer(track, artist),
        () => fetchAlbumCoverFromMusicBrainz(track, artist),
      ]
    : [
        () => fetchAlbumCoverFromDeezer(track, artist),
        () => fetchAlbumCoverFromItunes(track, artist),
        () => fetchAlbumCoverFromMusicBrainz(track, artist),
      ];

  for (const source of sources) {
    try {
      const result = await source();
      if (result?.url && !urls.includes(result.url)) urls.push(result.url);
    } catch {}
  }

  albumCoverCache.set(cacheKey, urls);
  return urls;
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
        const albumCovers: string[] = [];

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
            if (!hasLargeImage?.startsWith("http")) {
              fallbackLarge = await fetchGameIcon(activity.name);
            }
          } else if (isMusic) {
            const track = activity.details || activity.assets?.large_text || "";
            const artist = activity.state || "";

            if (track) {
              const covers = await fetchAlbumCover(track, artist, !isYouTubeMusic);
              albumCovers.push(...covers);
              fallbackLarge = covers[0] || null;
            }
            if (!fallbackLarge && isYouTubeMusic && isExternalAvatar) {
              const videoIdMatch = activity.assets?.large_image?.match(/\/vi\/([^/]+)\//);
              if (videoIdMatch) {
                const ytUrl = `https://i.ytimg.com/vi/${videoIdMatch[1]}/hqdefault.jpg`;
                albumCovers.push(ytUrl);
                fallbackLarge = ytUrl;
              }
            }
          } else if (isStreamingYouTube) {
            const videoId = activity.assets?.large_image?.slice(8);
            if (videoId) {
              const ytUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
              albumCovers.push(ytUrl);
              fallbackLarge = ytUrl;
            }
          }

          if (hasLargeImage && !albumCovers.includes(hasLargeImage)) {
            albumCovers.push(hasLargeImage);
          }
        }

        return {
          ...activity,
          albumCovers,
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
