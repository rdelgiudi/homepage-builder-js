/**
 * Play history: game sessions recorded from the owner's Discord presence.
 * `play-history.js` (CommonJS, loaded by websocket-server.js) writes `play_sessions`;
 * this module only reads it, for the `play-history` widget.
 */
import { getDb } from "@/lib/db";
import { zoneOffsetMinutes } from "@/widgets/time";

export interface PlaySession {
  game: string;
  started_at: number;
  ended_at: number;
  open: number;
}

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
/** Shorter sessions are presence flicker (a launcher opening, a crash), not play. */
export const MIN_SESSION_MS = 2 * 60 * 1000;
/** An open session whose heartbeat is older than this is not "playing now" (the recorder stopped). */
const LIVE_GRACE_MS = 3 * 60 * 1000;

// Same DDL as play-history.js, so reading works before the recorder has ever run.
const DDL = `
  CREATE TABLE IF NOT EXISTS play_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game TEXT NOT NULL,
    started_at INTEGER NOT NULL,
    ended_at INTEGER NOT NULL,
    open INTEGER NOT NULL DEFAULT 1
  );
  CREATE INDEX IF NOT EXISTS play_sessions_end ON play_sessions (ended_at);
`;

let ready = false;
function playDb() {
  const db = getDb();
  if (!ready) {
    db.exec(DDL);
    ready = true;
  }
  return db;
}

/** Minutes/day thresholds for heatmap levels 1–4. */
export const LEVEL_MINUTES = [1, 60, 120, 240];

export function playLevel(minutes: number): number {
  let level = 0;
  for (let i = 0; i < LEVEL_MINUTES.length; i++) if (minutes >= LEVEL_MINUTES[i]) level = i + 1;
  return level;
}

function safeZone(timeZone: string): string {
  try {
    zoneOffsetMinutes(Date.now(), timeZone);
    return timeZone;
  } catch {
    return "UTC";
  }
}

const isoDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);

function localDate(ms: number, timeZone: string): string {
  return isoDate(ms + zoneOffsetMinutes(ms, timeZone) * 60000);
}

export interface PlaySummary {
  timeZone: string;
  days: { date: string; minutes: number; level: number }[];
  totalMinutes: number;
  games: { name: string; minutes: number }[];
  recent: { game: string; start: string; end: string; minutes: number }[];
  playing: string[];
}

/**
 * Turns sessions into a per-day heatmap (days in `timeZone`, sessions split at local
 * midnight), the most-played games and the latest sessions. Pure, so it is unit-tested.
 * `weeks` whole weeks ending today; the first day is the oldest.
 */
export function summarizePlay(sessions: PlaySession[], opts: { weeks: number; timeZone: string; now: number; hide?: string[] }): PlaySummary {
  const timeZone = safeZone(opts.timeZone);
  const hidden = new Set((opts.hide ?? []).map((g) => g.trim().toLowerCase()).filter(Boolean));
  const today = localDate(opts.now, timeZone);
  const todayMs = Date.parse(`${today}T00:00:00Z`);
  const days = Array.from({ length: opts.weeks * 7 }, (_, i) => isoDate(todayMs - (opts.weeks * 7 - 1 - i) * DAY));
  const first = days[0];
  const perDay = new Map<string, number>();
  const perGame = new Map<string, number>();

  const visible = sessions.filter((s) => !hidden.has(s.game.trim().toLowerCase()) && s.ended_at - s.started_at >= MIN_SESSION_MS);
  for (const s of visible) {
    let t = s.started_at;
    const end = Math.min(s.ended_at, opts.now);
    while (t < end) {
      const offset = zoneOffsetMinutes(t, timeZone) * 60000;
      const local = t + offset;
      let next = Math.min(end, (Math.floor(local / DAY) + 1) * DAY - offset);
      if (next <= t) next = Math.min(end, t + HOUR);
      const date = isoDate(local);
      if (date >= first) {
        const ms = next - t;
        perDay.set(date, (perDay.get(date) ?? 0) + ms);
        perGame.set(s.game, (perGame.get(s.game) ?? 0) + ms);
      }
      t = next;
    }
  }

  const toMin = (ms: number) => Math.round(ms / 60000);
  return {
    timeZone,
    days: days.map((date) => {
      const minutes = toMin(perDay.get(date) ?? 0);
      return { date, minutes, level: playLevel(minutes) };
    }),
    totalMinutes: toMin([...perDay.values()].reduce((a, b) => a + b, 0)),
    games: [...perGame.entries()]
      .map(([name, ms]) => ({ name, minutes: toMin(ms) }))
      .filter((g) => g.minutes > 0)
      .sort((a, b) => b.minutes - a.minutes)
      .slice(0, 5),
    recent: [...visible]
      .sort((a, b) => b.ended_at - a.ended_at)
      .slice(0, 5)
      .map((s) => ({ game: s.game, start: new Date(s.started_at).toISOString(), end: new Date(s.ended_at).toISOString(), minutes: toMin(s.ended_at - s.started_at) })),
    playing: [...new Set(sessions.filter((s) => s.open && opts.now - s.ended_at < LIVE_GRACE_MS && !hidden.has(s.game.trim().toLowerCase())).map((s) => s.game))],
  };
}

export function playSummary(opts: { months: number; timeZone: string; hide: string[] }): PlaySummary {
  const now = Date.now();
  const weeks = Math.max(4, Math.min(53, Math.ceil(opts.months * 4.35)));
  // A day of slack on either side of the range for time-zone offsets.
  const since = now - (weeks * 7 + 1) * DAY;
  const sessions = playDb().prepare("SELECT game, started_at, ended_at, open FROM play_sessions WHERE ended_at >= ? ORDER BY started_at").all(since) as PlaySession[];
  return summarizePlay(sessions, { weeks, timeZone: opts.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone, now, hide: opts.hide });
}
