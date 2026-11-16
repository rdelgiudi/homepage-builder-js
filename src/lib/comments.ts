/**
 * Comment storage + moderation rules, shared by the public /api/comments route and the
 * admin moderation routes.
 */
import { adminDb, getState, setState } from "@/lib/admin/store";

export const NAME_MAX = 40;
export const BODY_MAX = 500;

export type CommentStatus = "pending" | "approved" | "rejected";
export const COMMENT_STATUSES: CommentStatus[] = ["pending", "approved", "rejected"];

export interface CommentRow {
  id: number;
  name: string;
  body: string;
  created_at: string;
  status: CommentStatus;
  visitor_hash: string | null;
  edited_at: number | null;
  moderated_at: number | null;
}

let ready = false;

export function commentsDb() {
  const db = adminDb();
  if (!ready) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        body TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    // Columns added for moderation. Rows that predate them count as approved.
    const existing = new Set((db.prepare("PRAGMA table_info(comments)").all() as { name: string }[]).map((c) => c.name));
    const add = (name: string, ddl: string) => {
      if (!existing.has(name)) db.exec(`ALTER TABLE comments ADD COLUMN ${name} ${ddl}`);
    };
    add("status", "TEXT NOT NULL DEFAULT 'approved'");
    add("visitor_hash", "TEXT");
    add("edited_at", "INTEGER");
    add("moderated_at", "INTEGER");
    db.exec("CREATE INDEX IF NOT EXISTS comments_status ON comments (status, id)");
    ready = true;
  }
  return db;
}

const CONTROL_CHARS = new RegExp("[\\u0000-\\u001f\\u007f]", "g");

export function sanitize(input: string, max: number): string {
  return input.replace(CONTROL_CHARS, "").slice(0, max);
}

// --- moderation settings (stored in the database so they apply immediately) ---

export interface ModerationSettings {
  /** `off` — comments appear immediately. `pre` — every comment waits for approval. */
  mode: "off" | "pre";
  /** Comments containing any of these words wait for approval even when mode is `off`. */
  holdWords: string[];
}

const SETTINGS_KEY = "comments.moderation";

export function getModerationSettings(): ModerationSettings {
  const stored = getState<Partial<ModerationSettings>>(SETTINGS_KEY)?.value;
  return {
    mode: stored?.mode === "pre" ? "pre" : "off",
    holdWords: Array.isArray(stored?.holdWords) ? stored.holdWords.filter((w): w is string => typeof w === "string") : [],
  };
}

export function saveModerationSettings(input: unknown): ModerationSettings {
  const raw = (input ?? {}) as Record<string, unknown>;
  const settings: ModerationSettings = {
    mode: raw.mode === "pre" ? "pre" : "off",
    holdWords: Array.isArray(raw.holdWords)
      ? [...new Set(raw.holdWords.filter((w): w is string => typeof w === "string").map((w) => w.trim().toLowerCase()).filter(Boolean))].slice(0, 200)
      : [],
  };
  setState(SETTINGS_KEY, settings);
  return settings;
}

/** Status a new comment starts with. */
export function initialStatus(name: string, body: string, settings = getModerationSettings()): CommentStatus {
  if (settings.mode === "pre") return "pending";
  const text = `${name} ${body}`.toLowerCase();
  return settings.holdWords.some((w) => text.includes(w)) ? "pending" : "approved";
}

export function statusCounts(): Record<CommentStatus, number> {
  const counts: Record<CommentStatus, number> = { pending: 0, approved: 0, rejected: 0 };
  const rows = commentsDb().prepare("SELECT status, COUNT(*) AS n FROM comments GROUP BY status").all() as { status: CommentStatus; n: number }[];
  for (const r of rows) if (r.status in counts) counts[r.status] = r.n;
  return counts;
}
