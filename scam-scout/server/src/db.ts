import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export type DB = DatabaseSync;

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE COLLATE NOCASE,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  username_locked INTEGER NOT NULL DEFAULT 0,
  password_hash TEXT,
  google_sub TEXT UNIQUE,
  apple_sub TEXT UNIQUE,
  email_verified INTEGER NOT NULL DEFAULT 0,
  avatar BLOB,
  avatar_type TEXT,
  avatar_version INTEGER NOT NULL DEFAULT 0,
  avatar_color TEXT,
  elo INTEGER NOT NULL DEFAULT 1200,
  placements INTEGER NOT NULL DEFAULT 0,
  is_bot INTEGER NOT NULL DEFAULT 0,
  prefs TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  last_seen INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS tokens (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS matches (
  id TEXT PRIMARY KEY,
  mode TEXT NOT NULL,
  item_ids TEXT NOT NULL,
  deadline INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  result TEXT,
  rematch_of TEXT,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mode TEXT NOT NULL,
  item_ids TEXT NOT NULL,
  match_id TEXT REFERENCES matches(id) ON DELETE CASCADE,
  started_at INTEGER NOT NULL,
  deadline INTEGER,
  finished_at INTEGER,
  score INTEGER NOT NULL DEFAULT 0,
  strikes INTEGER NOT NULL DEFAULT 0,
  run INTEGER NOT NULL DEFAULT 0,
  best_run INTEGER NOT NULL DEFAULT 0,
  forfeit INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS games_user ON games(user_id, finished_at);
CREATE TABLE IF NOT EXISTS answers (
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  idx INTEGER NOT NULL,
  item_id TEXT NOT NULL,
  call TEXT,
  reason TEXT,
  points INTEGER NOT NULL,
  ms INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (game_id, idx)
);
CREATE TABLE IF NOT EXISTS match_players (
  match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  elo_before INTEGER NOT NULL,
  elo_after INTEGER,
  wants_rematch INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (match_id, user_id)
);
CREATE TABLE IF NOT EXISTS queue (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  elo INTEGER NOT NULL,
  joined_at INTEGER NOT NULL,
  match_id TEXT
);
CREATE TABLE IF NOT EXISTS friendships (
  user_a TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  requested_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_a, user_b)
);
CREATE TABLE IF NOT EXISTS challenges (
  id TEXT PRIMARY KEY,
  from_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  match_id TEXT,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  text TEXT NOT NULL,
  data TEXT NOT NULL DEFAULT '{}',
  read INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS notif_user ON notifications(user_id, created_at);
`;

export function openDb(path: string): DB {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(SCHEMA);
  return db;
}

/** Run fn inside a transaction. */
export function tx<T>(db: DB, fn: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try {
    const out = fn();
    db.exec('COMMIT');
    return out;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

export type Row = Record<string, any>;
export const one = (db: DB, sql: string, ...p: any[]) => db.prepare(sql).get(...p) as Row | undefined;
export const all = (db: DB, sql: string, ...p: any[]) => db.prepare(sql).all(...p) as Row[];
export const run = (db: DB, sql: string, ...p: any[]) => db.prepare(sql).run(...p);
