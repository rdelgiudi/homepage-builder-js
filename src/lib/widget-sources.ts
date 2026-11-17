/**
 * One function per data widget: fetch from the source, return only what the widget shows.
 * Called by /api/widgets/[type]. Fixed-host sources take validated values from the query;
 * sources whose host the site owner chose (rss, mastodon) take a section id instead.
 */
import { cached, decodeEntities, findSection, getJson, getText, htmlToText, httpUrl, WidgetError } from "@/lib/widget-data";

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
    if (!days.length) throw new WidgetError("GitHub's activity calendar could not be read.");
    days.sort((a, b) => a.date.localeCompare(b.date));
    return { user, url: `https://github.com/${user}`, total: days.reduce((n, d) => n + d.count, 0), days };
  });
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
    const xml = await getText(feedUrl, "application/rss+xml, application/atom+xml, application/xml, text/xml");
    const atom = !/<item[\s>]/i.test(xml) && /<entry[\s>]/i.test(xml);
    const blocks = xml.match(atom ? /<entry[\s>][\s\S]*?<\/entry>/gi : /<item[\s>][\s\S]*?<\/item>/gi) ?? [];
    if (!blocks.length) throw new WidgetError("That address is not an RSS or Atom feed, or the feed is empty.");
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
  });
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

export const widgetSources: Record<string, (params: Params) => Promise<unknown>> = {
  weather,
  chess,
  bluesky,
  "github-activity": githubActivity,
  rss,
  mastodon,
};
