/**
 * Data source for the `media` widget ("currently watching / reading"): AniList, Letterboxd
 * and Open Library. All three are fixed hosts with no key, so — like chess or bluesky — the
 * request carries a strictly validated username instead of a section id. The mappers are
 * pure and unit-tested.
 */
import { cached, decodeEntities, getJson, getText, httpUrl, postJson, WidgetError } from "@/lib/widget-data";

const MIN = 60 * 1000;
type Params = URLSearchParams;

export interface MediaItem {
  title: string;
  /** Second line: episode progress, author, year… */
  subtitle: string | null;
  image: string | null;
  url: string | null;
  /** 0.5–5, null when not rated. */
  rating: number | null;
  /** YYYY-MM-DD, when known. */
  date: string | null;
}

export interface MediaResult {
  profile: string;
  items: MediaItem[];
}

export type MediaList = "current" | "finished" | "planned";

// --- AniList (GraphQL, no key) ---

const ANILIST_STATUS: Record<MediaList, string> = { current: "CURRENT", finished: "COMPLETED", planned: "PLANNING" };

const ANILIST_QUERY = `query($user: String, $type: MediaType, $status: MediaListStatus) {
  Page(perPage: 20) {
    mediaList(userName: $user, type: $type, status: $status, sort: UPDATED_TIME_DESC) {
      progress
      score(format: POINT_5)
      updatedAt
      media { title { userPreferred } coverImage { large } siteUrl episodes chapters format startDate { year } }
    }
  }
}`;

export interface AniListEntry {
  progress?: number | null;
  score?: number | null;
  updatedAt?: number | null;
  media?: {
    title?: { userPreferred?: string | null } | null;
    coverImage?: { large?: string | null } | null;
    siteUrl?: string | null;
    episodes?: number | null;
    chapters?: number | null;
    format?: string | null;
    startDate?: { year?: number | null } | null;
  } | null;
}

const FORMATS: Record<string, string> = { TV: "TV", TV_SHORT: "TV short", MOVIE: "Movie", SPECIAL: "Special", OVA: "OVA", ONA: "ONA", MUSIC: "Music", MANGA: "Manga", NOVEL: "Light novel", ONE_SHOT: "One-shot" };

export function fromAniList(entries: AniListEntry[], kind: "anime" | "manga", list: MediaList): MediaItem[] {
  return entries.flatMap((e) => {
    const m = e.media;
    const title = m?.title?.userPreferred?.trim();
    if (!m || !title) return [];
    const total = kind === "anime" ? m.episodes : m.chapters;
    const unit = kind === "anime" ? "Ep" : "Ch";
    const subtitle =
      list === "current" && e.progress
        ? `${unit} ${e.progress}${total ? ` / ${total}` : ""}`
        : [m.format ? FORMATS[m.format] ?? m.format : null, m.startDate?.year ?? null].filter(Boolean).join(" · ") || null;
    return [
      {
        title,
        subtitle,
        image: httpUrl(m.coverImage?.large),
        url: httpUrl(m.siteUrl),
        rating: e.score && e.score > 0 ? e.score : null,
        date: e.updatedAt ? new Date(e.updatedAt * 1000).toISOString().slice(0, 10) : null,
      },
    ];
  });
}

async function anilist(user: string, kind: "anime" | "manga", list: MediaList): Promise<MediaResult> {
  const r = await postJson<{ data?: { Page?: { mediaList?: AniListEntry[] } | null }; errors?: { message?: string }[] }>("https://graphql.anilist.co", {
    query: ANILIST_QUERY,
    variables: { user, type: kind === "anime" ? "ANIME" : "MANGA", status: ANILIST_STATUS[list] },
  }).catch((err) => {
    // AniList answers both "no such user" and "private user" with a 404.
    if (err instanceof WidgetError && err.status === 404) throw new WidgetError("AniList user not found, or their list is private.", 404);
    // …and some unknown names with a 500.
    if (err instanceof WidgetError && /\(500\)/.test(err.message)) throw new WidgetError("AniList couldn't load this list. Check the username in this widget's settings.");
    throw err;
  });
  return { profile: `https://anilist.co/user/${user}/${kind}list`, items: fromAniList(r.data?.Page?.mediaList ?? [], kind, list) };
}

// --- Letterboxd (diary RSS) ---

function tag(block: string, name: string): string {
  const m = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i").exec(block);
  return m ? decodeEntities(m[1].replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, "$1").trim()) : "";
}

/** Diary entries from a Letterboxd RSS feed (lists and other entries without a film are skipped). */
export function parseLetterboxd(xml: string): MediaItem[] {
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? [];
  return blocks.flatMap((block) => {
    const title = tag(block, "letterboxd:filmTitle");
    if (!title) return [];
    const year = tag(block, "letterboxd:filmYear");
    const rating = Number(tag(block, "letterboxd:memberRating"));
    const rewatch = tag(block, "letterboxd:rewatch") === "Yes";
    const description = /<description>([\s\S]*?)<\/description>/i.exec(block)?.[1] ?? "";
    const poster = /<img[^>]+src=["']([^"']+)["']/i.exec(description)?.[1];
    const date = tag(block, "letterboxd:watchedDate");
    return [
      {
        title,
        subtitle: [year || null, rewatch ? "Rewatch" : null].filter(Boolean).join(" · ") || null,
        image: httpUrl(poster ? decodeEntities(poster) : null),
        url: httpUrl(tag(block, "link")),
        rating: Number.isFinite(rating) && rating > 0 ? rating : null,
        date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
      },
    ];
  });
}

// --- Open Library (public reading log) ---

const OPENLIBRARY_SHELF: Record<MediaList, string> = { current: "currently-reading", finished: "already-read", planned: "want-to-read" };

export interface OpenLibraryEntry {
  work?: { title?: string; key?: string; author_names?: string[]; first_publish_year?: number; cover_id?: number | null } | null;
  logged_date?: string | null;
}

export function fromOpenLibrary(entries: OpenLibraryEntry[]): MediaItem[] {
  return entries.flatMap((e) => {
    const w = e.work;
    const title = w?.title?.trim();
    if (!w || !title) return [];
    const authors = (w.author_names ?? []).slice(0, 2).join(", ");
    const date = /^(\d{4})\/(\d{2})\/(\d{2})/.exec(e.logged_date ?? "");
    return [
      {
        title,
        subtitle: authors || (w.first_publish_year ? String(w.first_publish_year) : null),
        image: w.cover_id && w.cover_id > 0 ? `https://covers.openlibrary.org/b/id/${w.cover_id}-M.jpg` : null,
        url: w.key && /^\/works\/OL\d+W$/.test(w.key) ? `https://openlibrary.org${w.key}` : null,
        rating: null,
        date: date ? `${date[1]}-${date[2]}-${date[3]}` : null,
      },
    ];
  });
}

async function openLibrary(user: string, list: MediaList): Promise<MediaResult> {
  const shelf = OPENLIBRARY_SHELF[list];
  const r = await getJson<{ reading_log_entries?: OpenLibraryEntry[] }>(`https://openlibrary.org/people/${user}/books/${shelf}.json?limit=20`).catch((err) => {
    if (err instanceof WidgetError && /\(403\)/.test(err.message)) throw new WidgetError("This Open Library reading log is private. Make it public in the account's privacy settings.", 403);
    throw err;
  });
  return { profile: `https://openlibrary.org/people/${user}/books/${shelf}`, items: fromOpenLibrary(r.reading_log_entries ?? []) };
}

// --- Endpoint ---

const SERVICES = {
  anilist: /^[A-Za-z0-9_-]{2,20}$/,
  letterboxd: /^[A-Za-z0-9_]{1,30}$/,
  // Starts with a letter or digit and has no "..", so it can't walk to another path.
  openlibrary: /^(?!.*\.\.)[A-Za-z0-9][A-Za-z0-9_.-]{0,39}$/,
} as const;
type Service = keyof typeof SERVICES;

export async function media(p: Params): Promise<MediaResult> {
  const service = (Object.keys(SERVICES) as Service[]).find((s) => s === p.get("service"));
  if (!service) throw new WidgetError("Choose a service in this widget's settings.", 400);
  const user = (p.get("user") ?? "").trim().replace(/^@/, "");
  if (!SERVICES[service].test(user)) throw new WidgetError("Set a valid username in this widget's settings.", 400);
  const kind = p.get("kind") === "manga" ? "manga" : "anime";
  const listParam = p.get("list");
  const list: MediaList = listParam === "finished" || listParam === "planned" ? listParam : "current";
  return cached(`media:${service}:${user.toLowerCase()}:${kind}:${list}`, 30 * MIN, async () => {
    if (service === "anilist") return anilist(user, kind, list);
    if (service === "openlibrary") return openLibrary(user, list);
    const xml = await getText(`https://letterboxd.com/${user}/rss/`, "application/rss+xml, application/xml");
    return { profile: `https://letterboxd.com/${user}/`, items: parseLetterboxd(xml) };
  });
}
