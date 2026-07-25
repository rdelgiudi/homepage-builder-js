import path from "path";

const DB_PATH = path.join(process.cwd(), "visitors.db");

let db: import("better-sqlite3").Database | null = null;

export function getDb(): import("better-sqlite3").Database {
  if (!db) {
    const Database = require("better-sqlite3");
    const database = new Database(DB_PATH);
    database.pragma("journal_mode = WAL");
    db = database;
  }
  return db!;
}
