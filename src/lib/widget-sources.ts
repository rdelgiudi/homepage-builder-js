/**
 * One function per data widget: fetch from the source, return only what the widget shows.
 * Called by /api/widgets/[type]. Fixed-host sources take validated values from the query;
 * sources whose host the site owner chose (rss, mastodon) take a section id instead.
 */
import { gamingSources } from "@/lib/gaming-sources";
import { cached, decodeEntities, findSection, getJson, getText, htmlToText, httpUrl, USER_AGENT, WidgetError } from "@/lib/widget-data";

const MIN = 60 * 1000;
type Params = URLSearchParams;

function match(value: string | null, pattern: RegExp, what: string): string {
  if (!value || !pattern.test(value)) throw new WidgetError(`Set a valid ${what} in this widget's settings.`, 400);
  return value;
}

// --- weather (open-meteo.com) ---

export async function weather(p: Params) {
  const lat = Number(p.get("lat"));
  const lon = Number(p.get("lon"));
  if (!p.get("lat") || !p.get("lon") || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    throw new WidgetError("Set the latitude and longitude in this widget's settings.", 400);
  }
  const fahrenheit = p.get("units") === "fahrenheit";
  // Round so nearby values share a cache entry (≈1 km).
  const key = `${lat.toFixed(2)},${lon.toFixed(2)},${fahrenheit ? "f" : "c"}`;
  return cached(`weather:${key}`, 15 * MIN, async () => {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(2)}&longitude=${lon.toFixed(2)}` +
      "&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,is_day" +
      "&daily=temperature_2m_max,temperature_2m_min,weather_code&forecast_days=4&timezone=auto" +
      (fahrenheit ? "&temperature_unit=fahrenheit&wind_speed_unit=mph" : "");
    const d = await getJson<{
      current: { temperature_2m: number; apparent_temperature: number; weather_code: number; wind_speed_10m: number; is_day: number };
      daily: { time: string[]; temperature_2m_max: number[]; temperature_2m_min: number[]; weather_code: number[] };
    }>(url);
    return {
      temperature: d.current.temperature_2m,
      feelsLike: d.current.apparent_temperature,
      code: d.current.weather_code,
      wind: d.current.wind_speed_10m,
      isDay: d.current.is_day === 1,
      unit: fahrenheit ? "°F" : "°C",
      windUnit: fahrenheit ? "mph" : "km/h",
      days: d.daily.time.map((date, i) => ({ date, max: d.daily.temperature_2m_max[i], min: d.daily.temperature_2m_min[i], code: d.daily.weather_code[i] })),
    };
  });
}

// --- chess (lichess.org / chess.com) ---

const CHESS_MODES: [key: string, lichess: string, chesscom: string][] = [
  ["Bullet", "bullet", "chess_bullet"],
  ["Blitz", "blitz", "chess_blitz"],
  ["Rapid", "rapid", "chess_rapid"],
  ["Classical", "classical", ""],
  ["Daily", "correspondence", "chess_daily"],
  ["Puzzles", "puzzle", "tactics"],
];

export async function chess(p: Params) {
  const user = match(p.get("user"), /^[A-Za-z0-9_-]{2,30}$/, "username");
  const site = p.get("site") === "chesscom" ? "chesscom" : "lichess";
  return cached(`chess:${site}:${user.toLowerCase()}`, 30 * MIN, async () => {
    if (site === "lichess") {
      const d = await getJson<{ username: string; perfs: Record<string, { rating: number; games: number; prov?: boolean }> }>(`https://lichess.org/api/user/${user}`);
      return {
        name: d.username,
        url: `https://lichess.org/@/${d.username}`,
        ratings: CHESS_MODES.flatMap(([label, key]) => {
          const perf = d.perfs?.[key];
          return perf && perf.games > 0 ? [{ label, rating: perf.rating, games: perf.games, provisional: !!perf.prov }] : [];
        }),
      };
    }
    const d = await getJson<Record<string, { last?: { rating: number }; highest?: { rating: number }; record?: { win: number; loss: number; draw: number } }>>(
      `https://api.chess.com/pub/player/${user.toLowerCase()}/stats`
    );
    return {
      name: user,
      url: `https://www.chess.com/member/${user}`,
      ratings: CHESS_MODES.flatMap(([label, , key]) => {
        const mode = key ? d[key] : undefined;
        const rating = mode?.last?.rating ?? mode?.highest?.rating;
        if (!rating) return [];
        const r = mode?.record;
        return [{ label, rating, games: r ? r.win + r.loss + r.draw : 0, provisional: false }];
      }),
    };
  });
}

// --- bluesky (public.api.bsky.app) ---

export async function bluesky(p: Params) {
  const handle = match(p.get("handle"), /^[A-Za-z0-9.-]{3,253}$/, "handle").toLowerCase();
  return cached(`bluesky:${handle}`, 10 * MIN, async () => {
    interface Post {
      uri: string;
      author: { handle: string; displayName?: string; avatar?: string };
      record: { text?: string; createdAt?: string };
      likeCount?: number;
      repostCount?: number;
      replyCount?: number;
    }
    const d = await getJson<{ feed: { post: Post; reason?: unknown }[] }>(
      `https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=${encodeURIComponent(handle)}&limit=30&filter=posts_no_replies`
    );
    // The author feed also contains reposts of other people's posts; keep the account's own.
    const own = d.feed.filter((f) => !f.reason && f.post.author.handle.toLowerCase() === handle).map((f) => f.post);
    const author = own[0]?.author ?? d.feed[0]?.post.author;
    return {
      author: { name: author?.displayName || handle, handle, avatar: httpUrl(author?.avatar), url: `https://bsky.app/profile/${handle}` },
      posts: own.slice(0, 10).map((post) => ({
        text: post.record.text ?? "",
        url: `https://bsky.app/profile/${handle}/post/${post.uri.split("/").pop()}`,
        date: post.record.createdAt ?? null,
        likes: post.likeCount ?? 0,
        reposts: post.repostCount ?? 0,
        replies: post.replyCount ?? 0,
      })),
    };
  });
}

// --- GitHub activity (the public contributions calendar) ---

export async function githubActivity(p: Params) {
  const user = match(p.get("user"), /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/, "GitHub username");
  return cached(`github-activity:${user.toLowerCase()}`, 180 * MIN, async () => {
    // GitHub has no key-less API for this; the calendar fragment its own profile page loads is public HTML.
    const html = await getText(`https://github.com/users/${user}/contributions`, "text/html");
    const days = parseContributions(html);
    if (!days.length) throw new WidgetError("GitHub's activity calendar could not be read.");
    return { user, url: `https://github.com/${user}`, total: days.reduce((n, d) => n + d.count, 0), days };
  });
}

/**
 * Reads GitHub's contributions calendar HTML: one `<td data-date data-level id>` per day,
 * and the day's count in the `<tool-tip for="<td id>">` that follows. Sorted by date.
 */
export function parseContributions(html: string): { date: string; level: number; count: number }[] {
  const counts = new Map<string, number>();
  for (const m of html.matchAll(/<tool-tip[^>]*\bfor="([^"]+)"[^>]*>\s*(No|\d+) contribution/g)) counts.set(m[1], m[2] === "No" ? 0 : Number(m[2]));
  const days: { date: string; level: number; count: number }[] = [];
  for (const m of html.matchAll(/<td[^>]*\bdata-date="[^"]*"[^>]*>/g)) {
    const tag = m[0];
    const date = /data-date="(\d{4}-\d{2}-\d{2})"/.exec(tag)?.[1];
    const level = Number(/data-level="(\d)"/.exec(tag)?.[1] ?? 0);
    const id = /\bid="([^"]+)"/.exec(tag)?.[1] ?? "";
    if (date) days.push({ date, level, count: counts.get(id) ?? 0 });
  }
  return days.sort((a, b) => a.date.localeCompare(b.date));
}

// --- RSS / Atom ---

function tagText(xml: string, tag: string): string {
  const m = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i").exec(xml);
  if (!m) return "";
  const cdata = /^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/.exec(m[1]);
  return (cdata ? cdata[1] : htmlToText(m[1])).trim();
}

export async function rss(p: Params) {
  const section = findSection(p.get("id"), "rss");
  const feedUrl = httpUrl(section.url);
  if (!feedUrl) throw new WidgetError("Set the feed's address in this widget's settings.", 400);
  return cached(`rss:${feedUrl}`, 30 * MIN, async () => {
    const feed = parseFeed(await getText(feedUrl, "application/rss+xml, application/atom+xml, application/xml, text/xml"));
    if (!feed) throw new WidgetError("That address is not an RSS or Atom feed, or the feed is empty.");
    return feed;
  });
}

/**
 * RSS 2.0 (`<item>`) or Atom (`<entry>`) → the feed title and up to 15 items with a
 * title and an http(s) link. `null` when the text has no items at all.
 */
export function parseFeed(xml: string): { title: string; items: { title: string; url: string; date: string | null }[] } | null {
  const atom = !/<item[\s>]/i.test(xml) && /<entry[\s>]/i.test(xml);
  const blocks = xml.match(atom ? /<entry[\s>][\s\S]*?<\/entry>/gi : /<item[\s>][\s\S]*?<\/item>/gi) ?? [];
  if (!blocks.length) return null;
  const items = blocks.slice(0, 15).flatMap((block) => {
    const link = atom
      ? (/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i.exec(block) ?? /<link[^>]*href=["']([^"']+)["']/i.exec(block))?.[1]
      : tagText(block, "link");
    const url = httpUrl(link ? decodeEntities(link) : null);
    const title = tagText(block, "title");
    const date = new Date(tagText(block, atom ? "updated" : "pubDate") || tagText(block, "published") || tagText(block, "dc:date"));
    return url && title ? [{ title, url, date: Number.isNaN(date.getTime()) ? null : date.toISOString() }] : [];
  });
  // The feed's own title is the first <title> outside any item.
  const head = xml.slice(0, xml.search(atom ? /<entry[\s>]/i : /<item[\s>]/i));
  return { title: tagText(head, "title"), items };
}

// --- Mastodon ---

export async function mastodon(p: Params) {
  const section = findSection(p.get("id"), "mastodon");
  const instance = (section.instance ?? "").trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "").toLowerCase();
  const account = (section.account ?? "").trim().replace(/^@/, "").replace(/@.*$/, "");
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(instance) || !/^[A-Za-z0-9_]{1,30}$/.test(account)) {
    throw new WidgetError("Set the server and the account name in this widget's settings.", 400);
  }
  return cached(`mastodon:${instance}:${account.toLowerCase()}`, 10 * MIN, async () => {
    const who = await getJson<{ id: string; display_name: string; username: string; avatar: string; url: string }>(`https://${instance}/api/v1/accounts/lookup?acct=${account}`);
    const statuses = await getJson<{ url: string; created_at: string; content: string; spoiler_text: string; favourites_count: number; reblogs_count: number; replies_count: number }[]>(
      `https://${instance}/api/v1/accounts/${encodeURIComponent(who.id)}/statuses?limit=10&exclude_replies=true&exclude_reblogs=true`
    );
    return {
      author: { name: who.display_name || who.username, handle: `@${who.username}@${instance}`, avatar: httpUrl(who.avatar), url: httpUrl(who.url) },
      posts: statuses.map((s) => ({
        // A content warning replaces the text, as it would on Mastodon itself.
        text: s.spoiler_text ? `CW: ${s.spoiler_text}` : htmlToText(s.content),
        url: httpUrl(s.url),
        date: s.created_at,
        likes: s.favourites_count,
        reposts: s.reblogs_count,
        replies: s.replies_count,
      })),
    };
  });
}

// --- YouTube (the channel's public RSS feed; no key) ---

const YT_CHANNEL = /^UC[\w-]{22}$/;
const YT_HANDLE = /^@?[\w.-]{3,30}$/;

export async function youtube(p: Params) {
  const channel = (p.get("channel") ?? "").trim();
  if (!YT_CHANNEL.test(channel) && !YT_HANDLE.test(channel)) throw new WidgetError("Set the channel (an @handle or a channel id starting with UC) in this widget's settings.", 400);
  const channelId = YT_CHANNEL.test(channel) ? channel : await youtubeChannelId(channel.replace(/^@/, ""));
  return cached(`youtube:${channelId}`, 30 * MIN, async () => {
    const feed = parseYouTubeFeed(await getText(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`, "application/atom+xml, application/xml"));
    if (!feed) throw new WidgetError("That channel's video feed could not be read.");
    return feed;
  });
}

/** @handle → channel id, read from the channel page (cached for a day; ids never change). */
function youtubeChannelId(handle: string): Promise<string> {
  return cached(`youtube-handle:${handle.toLowerCase()}`, 24 * 60 * MIN, async () => {
    // The SOCS cookie skips the EU cookie-consent interstitial, which has no channel id in it.
    const html = await getText(`https://www.youtube.com/@${encodeURIComponent(handle)}`, "text/html", { Cookie: "SOCS=CAI", "Accept-Language": "en" });
    const id = /<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[\w-]{22})"/.exec(html)?.[1] ?? /"(?:externalId|channelId)":"(UC[\w-]{22})"/.exec(html)?.[1];
    if (!id) throw new WidgetError("No YouTube channel with that handle was found.", 404);
    return id;
  });
}

export interface YouTubeVideo {
  id: string;
  title: string;
  url: string;
  thumbnail: string;
  date: string | null;
  views: number | null;
  short: boolean;
}

/** A channel's Atom feed → its name and up to 15 videos. `null` when it isn't such a feed. */
export function parseYouTubeFeed(xml: string): { channel: string; url: string | null; videos: YouTubeVideo[] } | null {
  if (!/<feed[\s>]/i.test(xml)) return null;
  const entries = xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) ?? [];
  const first = entries[0];
  const head = first ? xml.slice(0, xml.indexOf(first)) : xml;
  const videos = entries.slice(0, 15).flatMap((entry) => {
    const id = /<yt:videoId>([\w-]{11})<\/yt:videoId>/.exec(entry)?.[1];
    if (!id) return [];
    const link = /<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i.exec(entry)?.[1] ?? "";
    const date = new Date(tagText(entry, "published"));
    const views = /<media:statistics[^>]*views=["'](\d+)["']/.exec(entry)?.[1];
    return [
      {
        id,
        title: tagText(entry, "title"),
        url: `https://www.youtube.com/watch?v=${id}`,
        // 16:9 without the letterbox bars of the feed's own 4:3 thumbnail.
        thumbnail: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
        date: Number.isNaN(date.getTime()) ? null : date.toISOString(),
        views: views ? Number(views) : null,
        short: /\/shorts\//.test(link),
      },
    ];
  });
  const authorUrl = /<author>[\s\S]*?<uri>([^<]+)<\/uri>/.exec(head)?.[1];
  return { channel: tagText(/<author>[\s\S]*?<\/author>/.exec(head)?.[0] ?? "", "name") || tagText(head, "title"), url: httpUrl(authorUrl), videos };
}

// --- Twitch (Helix API, app access token) ---

let twitchToken: { value: string; expiry: number } | null = null;

async function twitchHeaders(): Promise<Record<string, string>> {
  const id = process.env.TWITCH_CLIENT_ID;
  const secret = process.env.TWITCH_CLIENT_SECRET;
  if (!id || !secret) throw new WidgetError("Set TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET on the server to show Twitch.", 503);
  if (!twitchToken || twitchToken.expiry < Date.now()) {
    const t = await getJson<{ access_token: string; expires_in: number }>(
      `https://id.twitch.tv/oauth2/token?client_id=${encodeURIComponent(id)}&client_secret=${encodeURIComponent(secret)}&grant_type=client_credentials`,
      {},
      "POST"
    ).catch((err) => {
      // An HTTP error here means bad credentials; anything else (network) is reported generically by cached().
      throw err instanceof WidgetError ? new WidgetError("Twitch refused TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET.") : err;
    });
    // Renew a minute early.
    twitchToken = { value: t.access_token, expiry: Date.now() + Math.max(60, t.expires_in - 60) * 1000 };
  }
  return { "Client-Id": id, Authorization: `Bearer ${twitchToken.value}` };
}

// Twitch and Last.fm spend the site owner's API quota, so the username comes from the config
// (by section id), never from the request — otherwise anyone could look up any account through it.

export async function twitch(p: Params) {
  const section = findSection(p.get("id"), "twitch");
  const login = match(section.username.trim().replace(/^@/, ""), /^[A-Za-z0-9_]{3,25}$/, "Twitch username").toLowerCase();
  return cached(`twitch:${login}`, 2 * MIN, async () => {
    const headers = await twitchHeaders();
    const [users, streams] = await Promise.all([
      getJson<{ data: { login: string; display_name: string; profile_image_url: string; description: string }[] }>(`https://api.twitch.tv/helix/users?login=${login}`, headers),
      getJson<{ data: { title: string; game_name: string; viewer_count: number; started_at: string; thumbnail_url: string }[] }>(`https://api.twitch.tv/helix/streams?user_login=${login}`, headers),
    ]).catch((err) => {
      // An expired or revoked token: drop it so the next request gets a new one.
      if (err instanceof WidgetError && err.message.includes("(401)")) twitchToken = null;
      throw err;
    });
    const user = users.data[0];
    if (!user) throw new WidgetError("No Twitch channel with that name.", 404);
    const live = streams.data[0];
    return {
      name: user.display_name || user.login,
      url: `https://www.twitch.tv/${user.login}`,
      avatar: httpUrl(user.profile_image_url),
      description: user.description,
      live: live
        ? {
            title: live.title,
            game: live.game_name,
            viewers: live.viewer_count,
            startedAt: live.started_at,
            // The template has {width}x{height}; a timestamp defeats Twitch's image cache so it stays current.
            thumbnail: httpUrl(live.thumbnail_url.replace("{width}", "640").replace("{height}", "360") + `?t=${Math.floor(Date.now() / (2 * MIN))}`),
          }
        : null,
    };
  });
}

// --- Music history (ListenBrainz, no key / Last.fm, LASTFM_API_KEY) ---

export interface Track {
  title: string;
  artist: string;
  album: string;
  cover: string | null;
  url: string | null;
  date: string | null;
  nowPlaying: boolean;
}

const MBID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

interface ListenBrainzListen {
  listened_at?: number;
  track_metadata: {
    artist_name: string;
    track_name: string;
    release_name?: string;
    additional_info?: { release_mbid?: string; recording_mbid?: string; origin_url?: string };
    mbid_mapping?: { caa_release_mbid?: string; release_mbid?: string; recording_mbid?: string };
  };
}

export function listenBrainzTrack(listen: ListenBrainzListen, nowPlaying = false): Track {
  const m = listen.track_metadata;
  const release = [m.mbid_mapping?.caa_release_mbid, m.mbid_mapping?.release_mbid, m.additional_info?.release_mbid].find((id) => id && MBID.test(id));
  const recording = [m.mbid_mapping?.recording_mbid, m.additional_info?.recording_mbid].find((id) => id && MBID.test(id));
  return {
    title: m.track_name,
    artist: m.artist_name,
    album: m.release_name ?? "",
    cover: release ? `https://coverartarchive.org/release/${release}/front-250` : null,
    url: recording ? `https://musicbrainz.org/recording/${recording}` : httpUrl(m.additional_info?.origin_url),
    date: listen.listened_at ? new Date(listen.listened_at * 1000).toISOString() : null,
    nowPlaying,
  };
}

interface LastFmTrack {
  name: string;
  url: string;
  artist: { "#text": string };
  album: { "#text": string };
  image?: { size: string; "#text": string }[];
  date?: { uts: string };
  "@attr"?: { nowplaying?: string };
}

// Last.fm's grey star placeholder, served when a track has no artwork.
const LASTFM_PLACEHOLDER = "2a96cbd8b46e442fc41c2b86b821562f";

export function lastFmTrack(t: LastFmTrack): Track {
  const image = t.image?.find((i) => i.size === "extralarge")?.["#text"] || t.image?.find((i) => i.size === "large")?.["#text"];
  return {
    title: t.name,
    artist: t.artist["#text"],
    album: t.album["#text"],
    cover: image && !image.includes(LASTFM_PLACEHOLDER) ? httpUrl(image) : null,
    url: httpUrl(t.url),
    date: t.date?.uts ? new Date(Number(t.date.uts) * 1000).toISOString() : null,
    nowPlaying: t["@attr"]?.nowplaying === "true",
  };
}

export async function music(p: Params) {
  const section = findSection(p.get("id"), "music");
  const service = section.service;
  const user = match(section.username.trim(), service === "lastfm" ? /^[A-Za-z][A-Za-z0-9_-]{1,14}$/ : /^[A-Za-z0-9_.-]{1,64}$/, `${service === "lastfm" ? "Last.fm" : "ListenBrainz"} username`);
  return cached(`music:${service}:${user.toLowerCase()}`, 2 * MIN, async () => {
    if (service === "lastfm") {
      const key = process.env.LASTFM_API_KEY;
      if (!key) throw new WidgetError("Set LASTFM_API_KEY on the server to show Last.fm, or use ListenBrainz (no key needed).", 503);
      const d = await getJson<{ recenttracks?: { track: LastFmTrack[] }; error?: number; message?: string }>(
        `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${encodeURIComponent(user)}&api_key=${encodeURIComponent(key)}&format=json&limit=15`
      );
      if (!d.recenttracks) throw new WidgetError(d.error === 6 ? "No Last.fm user with that name." : "Last.fm did not answer as expected.");
      return { user, profile: `https://www.last.fm/user/${user}`, tracks: d.recenttracks.track.slice(0, 15).map(lastFmTrack) };
    }
    const base = `https://api.listenbrainz.org/1/user/${encodeURIComponent(user)}`;
    const [now, recent] = await Promise.all([
      getJson<{ payload: { listens: ListenBrainzListen[] } }>(`${base}/playing-now`).catch(() => null),
      getJson<{ payload: { listens: ListenBrainzListen[] } }>(`${base}/listens?count=15`),
    ]);
    const playing = now?.payload.listens[0];
    return {
      user,
      profile: `https://listenbrainz.org/user/${encodeURIComponent(user)}/`,
      tracks: [...(playing ? [listenBrainzTrack(playing, true)] : []), ...recent.payload.listens.map((l) => listenBrainzTrack(l))].slice(0, 15),
    };
  });
}

// --- Service status (addresses come from the config, never from the request) ---

export type ServiceState = "up" | "degraded" | "down";

/** HTTP status → state. A login wall (401/403) still means the service is running. */
export function serviceState(code: number | null): ServiceState {
  if (code === null || code >= 500) return "down";
  if (code < 400 || code === 401 || code === 403) return "up";
  return "degraded";
}

const STATUS_TIMEOUT_MS = 8000;
export const MAX_SERVICES = 20;

async function checkService(url: string | null): Promise<{ state: ServiceState; code: number | null; ms: number | null }> {
  if (!url) return { state: "down", code: null, ms: null };
  const start = performance.now();
  try {
    // `manual`: measure the service itself, not wherever it redirects to. Only the status is read.
    const res = await fetch(url, { redirect: "manual", headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(STATUS_TIMEOUT_MS), cache: "no-store" });
    const ms = Math.round(performance.now() - start);
    await res.body?.cancel().catch(() => {});
    return { state: serviceState(res.status), code: res.status, ms };
  } catch {
    return { state: "down", code: null, ms: null };
  }
}

export async function status(p: Params) {
  const section = findSection(p.get("id"), "status");
  const services = section.services.slice(0, MAX_SERVICES);
  if (!services.length) throw new WidgetError("Add a service in this widget's settings.", 400);
  const urls = services.map((s) => httpUrl(s.url));
  // Never throws: a service that is down is a result, not an error.
  return cached(`status:${section.id}:${urls.join(" ")}`, MIN, async () => ({
    checkedAt: new Date().toISOString(),
    services: await Promise.all(urls.map(checkService)),
  }));
}

export const widgetSources: Record<string, (params: Params) => Promise<unknown>> = {
  weather,
  chess,
  bluesky,
  "github-activity": githubActivity,
  rss,
  mastodon,
  youtube,
  twitch,
  music,
  status,
  ...gamingSources,
};
