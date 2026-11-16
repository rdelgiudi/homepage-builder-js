import fs from "fs";
import path from "path";

/**
 * Everything the app writes at runtime lives under DATA_DIR (default `<cwd>/data`),
 * so a single read-write volume persists it.
 */
export const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(process.cwd(), "data"));

const DB_PATH = path.join(DATA_DIR, "visitors.db");
/** Where the database lived before DATA_DIR existed. */
const LEGACY_DB_PATH = path.join(process.cwd(), "visitors.db");

let db: import("better-sqlite3").Database | null = null;

function log(message: string) {
  console.log(`[${new Date().toISOString()}] [DB] ${message}`);
}

/**
 * One-time copy of a pre-DATA_DIR database into DATA_DIR. Uses `VACUUM INTO`, which
 * writes a consistent snapshot (including un-checkpointed WAL content) and leaves the
 * original file untouched.
 */
function importLegacyDb(Database: typeof import("better-sqlite3")) {
  if (fs.existsSync(DB_PATH)) return;
  let isFile = false;
  try {
    isFile = fs.statSync(LEGACY_DB_PATH).isFile();
  } catch {
    return;
  }
  if (!isFile) return;

  const legacy = new Database(LEGACY_DB_PATH);
  try {
    legacy.prepare("VACUUM INTO ?").run(DB_PATH);
    log(`Copied ${LEGACY_DB_PATH} to ${DB_PATH}. The old file is no longer used and can be deleted.`);
  } finally {
    legacy.close();
  }
}

export function getDb(): import("better-sqlite3").Database {
  if (!db) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Database = require("better-sqlite3") as typeof import("better-sqlite3");
    fs.mkdirSync(DATA_DIR, { recursive: true });
    importLegacyDb(Database);
    const database = new Database(DB_PATH);
    database.pragma("journal_mode = WAL");
    db = database;
  }
  return db!;
}
