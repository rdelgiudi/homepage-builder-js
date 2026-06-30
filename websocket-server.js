const { createServer } = require('http');
const next = require('next');
const { WebSocketServer } = require('ws');
require('dotenv').config();

const dev = process.env.NODE_ENV !== 'production';

const hostname = process.env.HOST || 'localhost';
const port = parseInt(process.env.PORT, 10) || 3000;
const DISCORD_API = 'https://discord.com/api/v10';
const PROFILE_CACHE_TTL = 300000;

const discordConfig = {
  userId: process.env.DISCORD_USER_ID || '',
  botToken: process.env.DISCORD_BOT_TOKEN || '',
};

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// --- Enrichment helpers (ported from API route) ---

const activityStartTimes = new Map();

function getActivityIdentity(activity) {
  return `${activity.name || ''}|${activity.details || ''}|${activity.state || ''}`;
}

function extractOriginalUrlFromMpExternal(url) {
  if (!url.startsWith('mp:external/')) return null;
  const rest = url.slice('mp:external/'.length);
  const firstSlash = rest.indexOf('/');
  if (firstSlash === -1) return null;
  const urlPart = rest.slice(firstSlash + 1);
  const schemeSlash = urlPart.indexOf('/');
  if (schemeSlash === -1) return null;
  const scheme = urlPart.slice(0, schemeSlash);
  const path = urlPart.slice(schemeSlash + 1);
  return `${scheme}://${path}`;
}

function normalize(s) {
  return s.toLowerCase().trim();
}

function containsJapanese(text) {
  return /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(text);
}

function matchScore(resultTrack, resultArtist, targetTrack, targetArtist) {
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

async function fetchAlbumCoverFromItunes(track, artist) {
  try {
    const query = encodeURIComponent(`${track} ${artist}`);
    const res = await fetch(
      `https://itunes.apple.com/search?term=${query}&media=music&limit=5`,
      { signal: AbortSignal.timeout(3000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const results = data?.results || [];

    let best = null;
    let looseFallback = null;

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

async function fetchAlbumCoverFromDeezer(track, artist) {
  try {
    const query = encodeURIComponent(`${track} ${artist}`);
    const res = await fetch(
      `https://api.deezer.com/search?q=${query}&limit=5`,
      { signal: AbortSignal.timeout(3000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const items = data?.data || [];

    let best = null;
    let looseFallback = null;

    for (const item of items) {
      const sizes = [
        { url: item.album?.cover_xl, width: 500 },
        { url: item.album?.cover_big, width: 252 },
        { url: item.album?.cover_medium, width: 126 },
        { url: item.album?.cover_small, width: 56 },
      ].filter(s => !!s.url);
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

async function fetchAlbumCoverFromMusicBrainz(track, artist) {
  try {
    const query = encodeURIComponent(`recording:"${track}" AND artist:"${artist}"`);
    const res = await fetch(
      `https://musicbrainz.org/ws/2/recording?query=${query}&fmt=json&limit=5`,
      {
        signal: AbortSignal.timeout(3000),
        headers: { "User-Agent": "HomepageDiscordWidget/1.0 (personal use)" },
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const recordings = data?.recordings || [];

    let best = null;
    let looseFallback = null;

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

const albumCoverCache = new Map();

async function fetchAlbumCover(track, artist, preferSpotify = true) {
  const cacheKey = `${track}|${artist}|${preferSpotify}`;
  const cached = albumCoverCache.get(cacheKey);
  if (cached) return cached;

  const promise = (async () => {
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
        if (result?.url) return result.url;
      } catch {}
    }

    return null;
  })();

  albumCoverCache.set(cacheKey, promise);
  return promise;
}

async function fetchGameIconFromSteam(item) {
  const iconUrl = `https://cdn.akamai.steamstatic.com/steam/apps/${item.id}/icon.jpg`;
  const logoUrl = `https://cdn.akamai.steamstatic.com/steam/apps/${item.id}/logo.png`;

  try {
    const iconRes = await fetch(iconUrl, { signal: AbortSignal.timeout(2000) });
    if (iconRes.ok) return iconUrl;
  } catch {}

  try {
    const logoRes = await fetch(logoUrl, { signal: AbortSignal.timeout(2000) });
    if (logoRes.ok) return logoUrl;
  } catch {}

  return logoUrl;
}

async function fetchGameIconFromRawg(name) {
  try {
    const res = await fetch(
      `https://api.rawg.io/api/games?search=${encodeURIComponent(name)}&page_size=5`,
      { signal: AbortSignal.timeout(3000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const results = data?.results || [];

    for (const game of results) {
      if (game.background_image) return game.background_image;
      if (game.deleted_at) continue;
      if (game.name.toLowerCase() === name.toLowerCase() && game.background_image) return game.background_image;
    }

    if (results.length > 0 && results[0].background_image) return results[0].background_image;
  } catch {}
  return null;
}

async function fetchGameIcon(name) {
  try {
    const query = encodeURIComponent(name);
    const res = await fetch(
      `https://store.steampowered.com/api/storesearch/?term=${query}&l=english&cc=us`,
      { signal: AbortSignal.timeout(3000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const items = data?.items || [];

    if (items.length === 0) return await fetchGameIconFromRawg(name);

    let scored = items.filter(item => !item.types || item.types.includes("game"));
    if (scored.length === 0) scored = items;

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

// --- Profile caching ---

let profileCache = null;

async function fetchProfile() {
  const { userId, botToken } = discordConfig;
  if (!userId || !botToken || userId === 'YOUR_DISCORD_USER_ID') return null;

  if (profileCache && Date.now() - profileCache.cachedAt < PROFILE_CACHE_TTL) {
    return profileCache.data;
  }

  try {
    const res = await fetch(`${DISCORD_API}/users/${userId}`, {
      headers: { Authorization: `Bot ${botToken}` },
    });
    if (!res.ok) {
      console.error(`[${new Date().toISOString()}] Discord profile fetch failed: ${res.status}`);
      return profileCache?.data || null;
    }
    const data = await res.json();
    profileCache = { data, cachedAt: Date.now() };
    return data;
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Discord profile fetch error:`, err.message);
    return profileCache?.data || null;
  }
}

// --- Enrichment ---

let enrichedData = null;
let wss;

async function enrichPresence(rawPresence) {
  const userData = await fetchProfile();
  if (!userData) return;

  const activities = await Promise.all(
    (rawPresence.activities || []).map(async (activity) => {
      const hasLargeImage = activity.assets?.large_image;
      const hasSmallImage = activity.assets?.small_image;
      let fallbackLarge = null;
      let albumCover = null;

      const isYouTubeMusic = activity.name && (
        activity.name.toLowerCase() === 'youtube music' ||
        activity.name.toLowerCase().includes('youtube music')
      );

      const isMusic = activity.type === 2 || (activity.type === 1 && isYouTubeMusic);
      const isStreamingYouTube = activity.type === 1 && activity.assets?.large_image?.startsWith('youtube:');

      if (activity.name) {
        if (activity.type === 0) {
          if (!hasLargeImage?.startsWith('http')) {
            fallbackLarge = await fetchGameIcon(activity.name);
          }
        } else if (isMusic) {
          const track = activity.details || activity.assets?.large_text || '';
          const artist = activity.state || '';

          if (isYouTubeMusic) {
            for (const field of ['large_image', 'small_image']) {
              const val = activity.assets?.[field];
              if (!val) continue;
              if (val.startsWith('mp:external/')) {
                const extracted = extractOriginalUrlFromMpExternal(val);
                if (extracted) {
                  albumCover = extracted;
                  fallbackLarge = albumCover;
                  break;
                }
              }
              if (val.startsWith('youtube:')) {
                albumCover = `https://img.youtube.com/vi/${val.slice(8)}/default.jpg`;
                fallbackLarge = albumCover;
                break;
              }
            }
          }

          if (!albumCover && track) {
            albumCover = await fetchAlbumCover(track, artist, !isYouTubeMusic);
            fallbackLarge = albumCover || null;
          }
        } else if (isStreamingYouTube) {
          const videoId = activity.assets?.large_image?.slice(8);
          if (videoId) {
            albumCover = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
            fallbackLarge = albumCover;
          }
        }

        if (!albumCover && hasLargeImage) {
          albumCover = hasLargeImage;
        }
      }

      const identity = getActivityIdentity(activity);
      const serverStart = activityStartTimes.get(identity) ?? Date.now();
      const timestamps = activity.timestamps?.start
        ? activity.timestamps
        : { start: serverStart };

      if (!activity.timestamps?.start && !activityStartTimes.has(identity)) {
        activityStartTimes.set(identity, serverStart);
      }

      return {
        ...activity,
        albumCover,
        timestamps,
        assets: {
          ...activity.assets,
          large_image: fallbackLarge || hasLargeImage,
          small_image: hasSmallImage,
        },
      };
    })
  );

  const currentIdentities = new Set(activities.map(a => getActivityIdentity(a)));
  for (const key of activityStartTimes.keys()) {
    if (!currentIdentities.has(key)) activityStartTimes.delete(key);
  }

  const discriminator = userData.discriminator === '0' ? '0' : userData.discriminator;

  enrichedData = {
    id: userData.id,
    username: discriminator === '0'
      ? userData.username
      : `${userData.username}#${discriminator}`,
    globalName: userData.global_name || null,
    avatar: userData.avatar,
    banner: userData.banner || null,
    bannerColor: userData.banner_color || null,
    accentColor: userData.accent_color || null,
    globalNickname: null,
    status: rawPresence.status,
    clientStatus: rawPresence.clientStatus || null,
    activities,
    customStatus: rawPresence.customStatus,
    lastSeen: rawPresence.lastSeen,
    lastUpdated: rawPresence.lastUpdated,
  };
}

function broadcast(data) {
  if (!wss) return;
  const message = JSON.stringify({ type: 'presence', data });
  let count = 0;
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(message);
      count++;
    }
  });
  return count;
}

function broadcastMessage(msg) {
  if (!wss) return;
  const message = JSON.stringify(msg);
  let count = 0;
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(message);
      count++;
    }
  });
  return count;
}

// --- Steam periodic fetch ---

const steamConfig = {
  apiKey: process.env.STEAM_API_KEY || '',
  steamId: process.env.STEAM_ID || '',
};

let steamData = null;
let steamIdentityHash = '';
let steamGamesHash = '';
let steamRefreshPromise = null;
const crypto = require('crypto');

async function fetchSteamData() {
  const { apiKey, steamId } = steamConfig;
  if (!apiKey || !steamId || steamId === 'YOUR_STEAM_ID') return null;

  try {
    const playerRes = await fetch(
      `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${apiKey}&steamids=${steamId}`
    );
    if (!playerRes.ok) return null;
    const playerData = await playerRes.json();
    const player = playerData.response?.players?.[0] || null;

    let recentGames = [];
    try {
      const gamesRes = await fetch(
        `https://api.steampowered.com/IPlayerService/GetRecentlyPlayedGames/v0001/?key=${apiKey}&steamid=${steamId}&format=json&count=100`
      );
      const gamesData = await gamesRes.json();
      recentGames = gamesData.response?.games || [];
    } catch {}

    let ownedGames = [];
    try {
      const ownedRes = await fetch(
        `https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=${apiKey}&steamid=${steamId}&format=json&include_played_free_games=true`
      );
      const ownedData = await ownedRes.json();
      const allOwned = ownedData.response?.games || [];
      const gamesWithPlaytime = allOwned
        .filter(g => g.playtime_forever > 0)
        .sort((a, b) => b.playtime_forever - a.playtime_forever)
        .slice(0, 10);

      ownedGames = await Promise.all(
        gamesWithPlaytime.map(async (g) => {
          const name = await getGameName(g.appid);
          return { appid: g.appid, name, playtime_forever: g.playtime_forever };
        })
      );
    } catch {}

    const playerObj = player ? {
      steamid: player.steamid,
      personaname: player.personaname,
      avatarfull: player.avatarfull,
      personastate: player.personastate,
      gameextrainfo: player.gameextrainfo,
    } : null;

    return { player: playerObj, recentGames, ownedGames };
  } catch {
    return null;
  }
}

async function getGameName(appid) {
  try {
    const res = await fetch(`https://store.steampowered.com/api/appdetails?appids=${appid}&filters=basic`);
    const data = await res.json();
    return data[appid]?.data?.name || `App ${appid}`;
  } catch {
    return `App ${appid}`;
  }
}

function computeSteamHashes(data) {
  const identityHash = crypto.createHash('sha256')
    .update(JSON.stringify(data.player || {}))
    .digest('hex')
    .slice(0, 16);
  const gamesHash = crypto.createHash('sha256')
    .update(JSON.stringify({ recentGames: data.recentGames, ownedGames: data.ownedGames }))
    .digest('hex')
    .slice(0, 16);
  return { identityHash, gamesHash };
}

async function refreshSteam() {
  if (steamRefreshPromise) return steamRefreshPromise;
  steamRefreshPromise = (async () => {
    try {
      const t0 = Date.now();
      const data = await fetchSteamData();
      if (!data) return;
      const { identityHash, gamesHash } = computeSteamHashes(data);
      const identityChanged = identityHash !== steamIdentityHash;
      const gamesChanged = gamesHash !== steamGamesHash;
      if (!identityChanged && !gamesChanged) return;
      steamIdentityHash = identityHash;
      steamGamesHash = gamesHash;
      steamData = data;
      const count = broadcastMessage({ type: 'steam', data, identityHash, gamesHash });
      console.log(`[${new Date().toISOString()}] [Steam] Relayed to ${count} browser client(s) in ${Date.now() - t0}ms`);
    } catch (e) {
      console.error(`[${new Date().toISOString()}] [Steam] Refresh failed:`, e.message);
    } finally {
      steamRefreshPromise = null;
    }
  })();
  return steamRefreshPromise;
}

// --- Overwatch periodic fetch ---

const OVERFAST_API = 'https://overfast-api.tekrop.fr';

const overwatchConfig = {
  battleTag: process.env.OVERWATCH_BATTLE_TAG || '',
};

let overwatchData = null;
let overwatchHash = '';
let overwatchRefreshPromise = null;

async function fetchOverwatchData() {
  const { battleTag } = overwatchConfig;
  if (!battleTag || battleTag === 'YourTag-12345') {
    return { available: false, error: 'Configure your BattleTag via the OVERWATCH_BATTLE_TAG env var or src/config/overwatch.json' };
  }

  try {
    const encodedBattleTag = battleTag.replace('#', '-');
    const profileRes = await fetch(`${OVERFAST_API}/players/${encodeURIComponent(encodedBattleTag)}`);
    if (!profileRes.ok) throw new Error(`Profile fetch failed: ${profileRes.status}`);
    const profileData = await profileRes.json();

    if (profileData.private || !profileData.summary) {
      return { available: false, error: 'Overwatch profile is private', battleTag,
        suggestion: 'Set your Overwatch profile to public to display stats' };
    }

    const [statsRes, heroesListRes] = await Promise.all([
      fetch(`${OVERFAST_API}/players/${encodeURIComponent(encodedBattleTag)}/stats/summary?platform=pc`),
      fetch(`${OVERFAST_API}/heroes`),
    ]);

    const summary = profileData.summary;
    const pcCompetitive = summary.competitive?.pc;
    const ranks = {
      tank: pcCompetitive?.tank || null,
      damage: pcCompetitive?.damage || null,
      support: pcCompetitive?.support || null,
    };

    let heroPortraits = {};
    if (heroesListRes.ok) {
      const heroesList = await heroesListRes.json();
      heroPortraits = (heroesList || []).reduce((acc, h) => {
        acc[h.key] = h.portrait;
        return acc;
      }, {});
    }

    let generalStats = null;
    let mostPlayedHeroes = [];

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

      const heroes = statsData.heroes || {};
      mostPlayedHeroes = Object.entries(heroes)
        .map(([key, h]) => ({
          hero: key.charAt(0).toUpperCase() + key.slice(1).replace(/-/g, ' '),
          key,
          icon: heroPortraits[key] || '',
          playtime: h.time_played || 0,
          winrate: h.winrate || 0,
          games_played: h.games_played || 0,
          kda: h.kda || 0,
          eliminations: h.average?.eliminations || 0,
          deaths: h.average?.deaths || 0,
          healing: h.average?.healing || 0,
          damage: h.average?.damage || 0,
        }))
        .filter(h => h.games_played > 0 || h.playtime > 0)
        .sort((a, b) => b.playtime - a.playtime)
        .slice(0, 12);
    }

    return {
      available: true,
      username: summary.username,
      avatar: summary.avatar,
      title: summary.title || null,
      ranks,
      mostPlayedHeroes,
      generalStats,
      battleTag,
      lastUpdated: summary.last_updated_at * 1000,
    };
  } catch (error) {
    console.error(`[${new Date().toISOString()}] OverFast API error:`, error.message);
    return { available: false, error: 'Failed to fetch Overwatch data', battleTag };
  }
}

function computeOverwatchHash(data) {
  return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex').slice(0, 16);
}

async function refreshOverwatch() {
  if (overwatchRefreshPromise) return overwatchRefreshPromise;
  overwatchRefreshPromise = (async () => {
    try {
      const t0 = Date.now();
      const data = await fetchOverwatchData();
      const hash = computeOverwatchHash(data);
      if (hash === overwatchHash) return;
      overwatchHash = hash;
      overwatchData = data;
      const count = broadcastMessage({ type: 'overwatch', data, hash });
      console.log(`[${new Date().toISOString()}] [Overwatch] Relayed to ${count} browser client(s) in ${Date.now() - t0}ms`);
    } catch (e) {
      console.error(`[${new Date().toISOString()}] [Overwatch] Refresh failed:`, e.message);
    } finally {
      overwatchRefreshPromise = null;
    }
  })();
  return overwatchRefreshPromise;
}

// --- App setup ---

app.prepare().then(() => {
  const server = createServer((req, res) => {
    handle(req, res);
  });

  wss = new WebSocketServer({ noServer: true });

  wss.on('connection', (ws) => {
    console.log(`[${new Date().toISOString()}] [WS] Browser client connected (${wss.clients.size} total)`);
    if (enrichedData) {
      ws.send(JSON.stringify({ type: 'presence', data: enrichedData }));
    }
    if (steamData) {
      ws.send(JSON.stringify({ type: 'steam', data: steamData, identityHash: steamIdentityHash, gamesHash: steamGamesHash }));
    }
    if (overwatchData) {
      ws.send(JSON.stringify({ type: 'overwatch', data: overwatchData, hash: overwatchHash }));
    }
    ws.on('close', () => {
      console.log(`[${new Date().toISOString()}] [WS] Browser client disconnected (${wss.clients.size} total)`);
    });
  });

  const handleUpgrade = app.getUpgradeHandler();

  server.on('upgrade', (req, socket, head) => {
    const { pathname } = new URL(req.url, 'http://localhost');
    if (pathname === '/ws') {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
      });
    } else {
      handleUpgrade(req, socket, head);
    }
  });

  server.listen(port, () => {
    console.log(`[${new Date().toISOString()}] > Ready on http://${hostname}:${port}`);
  });

  let presenceUnsubscribe = null;
  const presenceModule = require('./discord-presence');

  let enrichmentInFlight = false;
  let enrichmentQueued = false;

  async function processRawPresence(raw) {
    if (enrichmentInFlight) {
      enrichmentQueued = true;
      return;
    }
    enrichmentInFlight = true;
    const t0 = Date.now();
    try {
      await enrichPresence(raw);
      const enriched = enrichedData;
      if (enriched) {
        const count = broadcast(enriched);
        console.log(`[${new Date().toISOString()}] [Discord User] Relayed to ${count} browser client(s) in ${Date.now() - t0}ms`);
      }
    } catch (e) {
      console.error(`[${new Date().toISOString()}] [Discord User] Enrichment error:`, e);
    } finally {
      enrichmentInFlight = false;
      if (enrichmentQueued) {
        enrichmentQueued = false;
        const latest = presenceModule.getCurrentPresence();
        if (latest) processRawPresence(latest);
      }
    }
  }

  if (presenceModule && typeof presenceModule.onPresenceUpdate === 'function') {
    presenceUnsubscribe = presenceModule.onPresenceUpdate(processRawPresence);
  }

  if (presenceModule && typeof presenceModule.start === 'function') {
    presenceModule.start().catch((e) => {
      console.error(`[${new Date().toISOString()}] [Discord Presence] Start error:`, e);
    });
  }

  refreshSteam();
  setInterval(refreshSteam, 10000);

  refreshOverwatch();
  setInterval(refreshOverwatch, 30000);
});
