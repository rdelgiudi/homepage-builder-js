/**
 * Private messages from the contact widget. Visitors write them (POST /api/contact);
 * only the admin panel reads them (/api/admin/messages, the Inbox screen).
 */
import { adminDb } from "@/lib/admin/store";

export const NAME_MAX = 60;
export const EMAIL_MAX = 200;
export const BODY_MAX = 4000;

export interface MessageRow {
  id: number;
  section_id: string;
  name: string;
  email: string | null;
  body: string;
  created_at: number;
  read_at: number | null;
  visitor_hash: string | null;
}

let ready = false;

export function messagesDb() {
  const db = adminDb();
  if (!ready) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        section_id TEXT NOT NULL,
        name TEXT NOT NULL,
        email TEXT,
        body TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        read_at INTEGER,
        visitor_hash TEXT
      );
      CREATE INDEX IF NOT EXISTS messages_read ON messages (read_at, id);
    `);
    ready = true;
  }
  return db;
}

// Control characters except tab and newline (the guestbook's sanitize() drops newlines too).
const CONTROL_CHARS = new RegExp("[\\u0000-\\u0008\\u000b-\\u001f\\u007f]", "g");

/** Normalises line endings, drops control characters (keeping newlines), trims, caps the length. */
export function cleanText(input: string, max: number, multiline = false): string {
  let text = input.replace(/\r\n?/g, "\n").replace(CONTROL_CHARS, "");
  if (!multiline) text = text.replace(/[\n\t]+/g, " ");
  return text.trim().slice(0, max);
}

const EMAIL = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]{2,}$/;

export function isEmail(value: string): boolean {
  return value.length <= EMAIL_MAX && EMAIL.test(value);
}

export function messageCounts(): { unread: number; total: number } {
  const row = messagesDb().prepare("SELECT COUNT(*) AS total, COALESCE(SUM(read_at IS NULL), 0) AS unread FROM messages").get() as { total: number; unread: number };
  return { unread: row.unread, total: row.total };
}
