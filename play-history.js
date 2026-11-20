/**
 * Records the owner's game sessions from Discord presence into SQLite (`play_sessions`,
 * in DATA_DIR/visitors.db) for the `play-history` widget. Loaded in-process by
 * websocket-server.js; the Next.js side only reads the table (src/lib/play-history.ts).
 *
 * Opt-in: nothing is recorded unless the published homepage.json contains a
 * `play-history` section. Writes are local, so recording is not paused while the
 * site has no viewers (unlike the outbound refreshes).
 */
const fs = require('fs');
const path = require('path');

const HEARTBEAT_MS = 60 * 1000;
const RETENTION_MS = 400 * 24 * 60 * 60 * 1000;
/** Discord's own start time is trusted only this far back (older = a stale timestamp). */
const MAX_BACKDATE_MS = 12 * 60 * 60 * 1000;
const PLAYING = 0; // discord.js ActivityType.Playing

const log = (msg) => console.log(`[${new Date().toISOString()}] [Play History] ${msg}`);
const logError = (msg, err) => console.error(`[${new Date().toISOString()}] [Play History] ${msg}`, err?.message || err);

let db = null;
let configFile = null;
let enabledCache = { mtimeMs: -1, value: false };
/** game name → open session row id */
const open = new Map();

function getDb() {
  if (db) return db;
  // Same location as src/lib/db.ts.
  const dataDir = path.resolve(process.env.DATA_DIR || path.join(process.cwd(), 'data'));
  fs.mkdirSync(dataDir, { recursive: true });
  const Database = require('better-sqlite3');
  db = new Database(path.join(dataDir, 'visitors.db'));
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  db.exec(`
    CREATE TABLE IF NOT EXISTS play_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game TEXT NOT NULL,
      started_at INTEGER NOT NULL,
      ended_at INTEGER NOT NULL,
      open INTEGER NOT NULL DEFAULT 1
    );
    CREATE INDEX IF NOT EXISTS play_sessions_end ON play_sessions (ended_at);
  `);
  return db;
}

/** True when the published config has a play-history widget (re-read only when the file changes). */
function enabled() {
  try {
    const { mtimeMs } = fs.statSync(configFile);
    if (mtimeMs !== enabledCache.mtimeMs) {
      const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
      // The homepage's tabs and every page's (config.pages[].tabs).
      const tabs = [...(config.tabs || []), ...(config.pages || []).flatMap((p) => (p && p.tabs) || [])];
      const value = tabs.some((t) => ((t && t.sections) || []).some((s) => s && s.type === 'play-history'));
      if (value !== enabledCache.value) log(value ? 'Widget found in the config; recording game sessions' : 'No play-history widget in the config; not recording');
      enabledCache = { mtimeMs, value };
    }
  } catch {
    // Unreadable or half-written file: keep the last answer.
  }
  return enabledCache.value;
}

function closeAll(now) {
  if (!open.size) return;
  const stmt = getDb().prepare('UPDATE play_sessions SET ended_at = ?, open = 0 WHERE id = ?');
  for (const id of open.values()) stmt.run(now, id);
  open.clear();
}

function onPresence(presence) {
  try {
    const now = Date.now();
    if (!enabled()) return closeAll(now);
    const d = getDb();
    const games = new Map();
    if (presence && presence.status && presence.status !== 'offline') {
      for (const a of presence.activities || []) {
        const name = typeof a.name === 'string' ? a.name.trim().slice(0, 100) : '';
        if (a.type === PLAYING && name) games.set(name, a.timestamps?.start);
      }
    }
    const close = d.prepare('UPDATE play_sessions SET ended_at = ?, open = 0 WHERE id = ?');
    for (const [game, id] of open) {
      if (!games.has(game)) {
        close.run(now, id);
        open.delete(game);
      }
    }
    const lastEnd = d.prepare('SELECT MAX(ended_at) AS t FROM play_sessions WHERE game = ?');
    const insert = d.prepare('INSERT INTO play_sessions (game, started_at, ended_at, open) VALUES (?, ?, ?, 1)');
    for (const [game, discordStart] of games) {
      if (open.has(game)) continue;
      // Back-date to Discord's start time when it is plausible, but never into a session
      // already recorded for the game (after a restart, the old one ends at its last heartbeat).
      let start = now;
      if (Number.isFinite(discordStart) && discordStart < now && now - discordStart < MAX_BACKDATE_MS) {
        start = Math.max(discordStart, lastEnd.get(game)?.t ?? 0);
      }
      open.set(game, insert.run(game, Math.min(start, now), now).lastInsertRowid);
    }
  } catch (err) {
    logError('Could not record presence:', err);
  }
}

function heartbeat() {
  try {
    if (!open.size) return;
    if (!enabled()) return closeAll(Date.now());
    const stmt = getDb().prepare('UPDATE play_sessions SET ended_at = ? WHERE id = ?');
    const now = Date.now();
    for (const id of open.values()) stmt.run(now, id);
  } catch (err) {
    logError('Heartbeat failed:', err);
  }
}

/**
 * Starts recording. `presenceModule` is discord-presence.js; `file` is homepage.json.
 * Sessions left open by a previous run end at their last heartbeat.
 */
function start(presenceModule, file) {
  configFile = file;
  try {
    const d = getDb();
    d.prepare('UPDATE play_sessions SET open = 0 WHERE open = 1').run();
    d.prepare('DELETE FROM play_sessions WHERE ended_at < ?').run(Date.now() - RETENTION_MS);
  } catch (err) {
    logError('Could not open the database:', err);
    return;
  }
  enabled();
  presenceModule.onPresenceUpdate(onPresence);
  setInterval(heartbeat, HEARTBEAT_MS).unref();
}

module.exports = { start };
