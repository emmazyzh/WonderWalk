-- WonderWalk D1 Database Schema
-- Run with: wrangler d1 execute wonderwalk-db --file=scripts/init-db.sql

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,           -- Clerk user_id
  email TEXT NOT NULL UNIQUE,
  nickname TEXT,
  created_at INTEGER DEFAULT (unixepoch() * 1000),
  updated_at INTEGER DEFAULT (unixepoch() * 1000)
);

CREATE TABLE IF NOT EXISTS checkins (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('china_city', 'world_country')),
  code TEXT NOT NULL,
  name_zh TEXT NOT NULL,
  name_en TEXT,
  created_at INTEGER DEFAULT (unixepoch() * 1000),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_checkins_user_id ON checkins(user_id);
CREATE INDEX IF NOT EXISTS idx_checkins_type ON checkins(type);
CREATE INDEX IF NOT EXISTS idx_checkins_code ON checkins(code);
