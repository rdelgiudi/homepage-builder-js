/**
 * Game recommendations from visitors (the `game-suggest` widget). Visitors search the
 * Steam store through /api/game-suggestions/search and send an app id; the server checks
 * it is a game and takes its name from Steam, never from the request. Suggestions are read
 * only in the admin panel (/api/admin/suggestions, the Suggestions screen).
 *
 * Two tables in the shared visitors.db: `game_suggestions` (one row per visitor per game,
 * with their optional name and note) and `suggested_games` (one row per game: its title
 * and the owner's status for it).
 */
import { adminDb } from "@/lib/admin/store";
import { cached, getJson, WidgetError } from "@/lib/widget-data";

export const NAME_MAX = 40;
export const NOTE_MAX = 300;
export const TERM_MIN = 2;
export const TERM_MAX = 60;

export const GAME_STATUSES = ["open", "planned", "playing", "played", "dismissed"] as const;
export type GameStatus = (typeof GAME_STATUSES)[number];

export interface SuggestionRow {
  id: number;
  section_id: string;
  appid: number;
  name: string | null;
  note: string | null;
  created_at: number;
  read_at: number | null;
  visitor_hash: string;
}

let ready = false;

export function suggestionsDb() {
  const db = adminDb();
  if (!ready) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS game_suggestions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        section_id TEXT NOT NULL,
        appid INTEGER NOT NULL,
        name TEXT,
        note TEXT,
        created_at INTEGER NOT NULL,
        read_at INTEGER,
        visitor_hash TEXT NOT NULL,
        UNIQUE (appid, visitor_hash)
      );
      CREATE INDEX IF NOT EXISTS game_suggestions_read ON game_suggestions (read_at, id);
      CREATE TABLE IF NOT EXISTS suggested_games (
        appid INTEGER PRIMARY KEY,
        title TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'open',
        updated_at INTEGER NOT NULL
      );
    `);
    ready = true;
  }
  return db;
}

export function suggestionCounts(): { unread: number; total: number } {
  const row = suggestionsDb().prepare("SELECT COUNT(*) AS total, COALESCE(SUM(read_at IS NULL), 0) AS unread FROM game_suggestions").get() as { total: number; unread: number };
  return { unread: row.unread, total: row.total };
}

/** The public "most suggested" list: dismissed games never appear. */
export function topSuggested(limit = 10): { appid: number; title: string; status: GameStatus; count: number }[] {
  return suggestionsDb()
    .prepare(
      `SELECT g.appid, g.title, g.status, COUNT(s.id) AS count
       FROM suggested_games g JOIN game_suggestions s ON s.appid = g.appid
       WHERE g.status != 'dismissed'
       GROUP BY g.appid ORDER BY count DESC, MAX(s.created_at) DESC LIMIT ?`
    )
    .all(limit) as { appid: number; title: string; status: GameStatus; count: number }[];
}

// --- Steam store lookups (no key) ---

export interface StoreApp {
  appid: number;
  title: string;
}

const CONTROL_CHARS = new RegExp("[\\u0000-\\u001f\\u007f]", "g");

/** Normalises a search term; null when it is too short or too long. */
export function searchTerm(raw: string | null): string | null {
  const term = (raw ?? "").replace(/\s+/g, " ").replace(CONTROL_CHARS, "").trim().toLowerCase();
  return term.length >= TERM_MIN && term.length <= TERM_MAX ? term : null;
}

interface StoreSearch {
  items?: { type: string; name: string; id: number }[];
}

/** The store search also lists soundtracks and artbooks as apps; they're never what a visitor means. */
const EXTRAS = /\b(soundtrack|OST|art ?book)\b/i;

export function storeResults(d: StoreSearch): StoreApp[] {
  return (d.items ?? [])
    .filter((i) => i.type === "app" && Number.isInteger(i.id) && i.id > 0 && typeof i.name === "string" && !EXTRAS.test(i.name))
    .slice(0, 10)
    .map((i) => ({ appid: i.id, title: i.name.slice(0, 200) }));
}

/** Whether `term` is already cached (cache hits don't count toward the global search cap). */
const searchedAt = new Map<string, number>();
const SEARCH_TTL = 60 * 60 * 1000;
export const isCachedSearch = (term: string) => (searchedAt.get(term) ?? 0) > Date.now() - SEARCH_TTL;

export async function searchSteam(term: string): Promise<StoreApp[]> {
  const results = await cached(`steam-search:${term}`, SEARCH_TTL, async () =>
    storeResults(await getJson<StoreSearch>(`https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(term)}&l=english&cc=US`))
  );
  if (searchedAt.size > 2000) searchedAt.clear();
  searchedAt.set(term, Date.now());
  return results;
}

/**
 * The store's name for a game, or null when the id isn't a game on Steam (DLC, tools and
 * soundtracks are "apps" in search results too, so every suggestion is checked here).
 */
export async function steamApp(appid: number): Promise<StoreApp | null> {
  return cached(`steam-app:${appid}`, 24 * 60 * 60 * 1000, async () => {
    const d = await getJson<Record<string, { success: boolean; data?: { type?: string; name?: string } }>>(`https://store.steampowered.com/api/appdetails?appids=${appid}&filters=basic`);
    // Steam doesn't always key the answer by the requested id; there is only one entry.
    const entry = d[String(appid)] ?? Object.values(d)[0];
    if (!entry?.success || !entry.data?.name || entry.data.type !== "game") return null;
    return { appid, title: entry.data.name.slice(0, 200) };
  }).catch((err) => {
    if (err instanceof WidgetError && err.status === 404) return null;
    throw err;
  });
}
