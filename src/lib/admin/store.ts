/**
 * Admin-side persistence (SQLite, same DATA_DIR/visitors.db connection as everything else):
 * sessions, the config draft, config revisions, key/value settings, blocked visitors, audit log.
 */
import { getDb } from "@/lib/db";

let ready = false;

export function adminDb() {
  const db = getDb();
  if (!ready) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS admin_sessions (
        token_hash TEXT PRIMARY KEY,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS admin_state (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS config_revisions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT NOT NULL,
        note TEXT,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS blocked_visitors (
        visitor_hash TEXT PRIMARY KEY,
        reason TEXT,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action TEXT NOT NULL,
        target TEXT,
        detail TEXT,
        created_at INTEGER NOT NULL
      );
    `);
    ready = true;
  }
  return db;
}

// --- key/value state ---

export function getState<T>(key: string): { value: T; updatedAt: number } | null {
  const row = adminDb().prepare("SELECT value, updated_at FROM admin_state WHERE key = ?").get(key) as { value: string; updated_at: number } | undefined;
  if (!row) return null;
  try {
    return { value: JSON.parse(row.value) as T, updatedAt: row.updated_at };
  } catch {
    return null;
  }
}

export function setState(key: string, value: unknown): number {
  const now = Date.now();
  adminDb()
    .prepare("INSERT INTO admin_state (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at")
    .run(key, JSON.stringify(value), now);
  return now;
}

export function deleteState(key: string) {
  adminDb().prepare("DELETE FROM admin_state WHERE key = ?").run(key);
}

// --- config draft ---

const DRAFT_KEY = "config.draft";
export const getDraft = () => getState<unknown>(DRAFT_KEY);
export const saveDraft = (config: unknown) => setState(DRAFT_KEY, config);
export const clearDraft = () => deleteState(DRAFT_KEY);

// --- config revisions ---

const MAX_REVISIONS = 50;

export interface RevisionRow {
  id: number;
  content: string;
  note: string | null;
  created_at: number;
}

export function addRevision(content: string, note: string) {
  const db = adminDb();
  db.prepare("INSERT INTO config_revisions (content, note, created_at) VALUES (?, ?, ?)").run(content, note, Date.now());
  db.prepare("DELETE FROM config_revisions WHERE id NOT IN (SELECT id FROM config_revisions ORDER BY id DESC LIMIT ?)").run(MAX_REVISIONS);
}

export function listRevisions(): RevisionRow[] {
  return adminDb().prepare("SELECT id, content, note, created_at FROM config_revisions ORDER BY id DESC").all() as RevisionRow[];
}

export function getRevision(id: number): RevisionRow | undefined {
  return adminDb().prepare("SELECT id, content, note, created_at FROM config_revisions WHERE id = ?").get(id) as RevisionRow | undefined;
}

// --- audit log ---

export interface AuditRow {
  id: number;
  action: string;
  target: string | null;
  detail: string | null;
  created_at: number;
}

export function audit(action: string, target?: string | number | null, detail?: string | null) {
  adminDb()
    .prepare("INSERT INTO audit_log (action, target, detail, created_at) VALUES (?, ?, ?, ?)")
    .run(action, target == null ? null : String(target), detail ?? null, Date.now());
}

export function listAudit(limit = 100, prefix?: string): AuditRow[] {
  if (prefix) {
    return adminDb().prepare("SELECT * FROM audit_log WHERE action LIKE ? ORDER BY id DESC LIMIT ?").all(`${prefix}%`, limit) as AuditRow[];
  }
  return adminDb().prepare("SELECT * FROM audit_log ORDER BY id DESC LIMIT ?").all(limit) as AuditRow[];
}

// --- blocked visitors ---

export function isBlocked(visitorHash: string): boolean {
  return !!adminDb().prepare("SELECT 1 FROM blocked_visitors WHERE visitor_hash = ?").get(visitorHash);
}

export function setBlocked(visitorHash: string, blocked: boolean, reason?: string) {
  if (blocked) {
    adminDb().prepare("INSERT OR IGNORE INTO blocked_visitors (visitor_hash, reason, created_at) VALUES (?, ?, ?)").run(visitorHash, reason ?? null, Date.now());
  } else {
    adminDb().prepare("DELETE FROM blocked_visitors WHERE visitor_hash = ?").run(visitorHash);
  }
}
