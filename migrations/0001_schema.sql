-- LCA D1 schema — Sprint 4
-- Run: npx wrangler d1 execute lca-db --local --file=migrations/0001_schema.sql
-- Prod: npx wrangler d1 execute lca-db --remote --file=migrations/0001_schema.sql

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS clubs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  location TEXT,
  description TEXT,
  meeting_schedule TEXT,
  contact_email TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS members (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  uscf_id TEXT,
  membership_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (membership_status IN ('active', 'expired', 'pending')),
  membership_expiry TEXT,
  role TEXT NOT NULL DEFAULT 'member'
    CHECK (role IN ('member', 'admin', 'club_rep', 'tournament_director')),
  club_id TEXT REFERENCES clubs(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tournaments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  venue TEXT,
  date TEXT NOT NULL,
  end_date TEXT,
  entry_fee REAL NOT NULL,
  sections TEXT NOT NULL,
  rounds INTEGER NOT NULL,
  max_players INTEGER,
  status TEXT NOT NULL
    CHECK (status IN ('upcoming', 'active', 'completed')),
  description TEXT,
  registration_deadline TEXT,
  club_id TEXT REFERENCES clubs(id),
  created_by TEXT REFERENCES members(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS registrations (
  id TEXT PRIMARY KEY,
  tournament_id TEXT NOT NULL REFERENCES tournaments(id),
  member_id TEXT NOT NULL REFERENCES members(id),
  section TEXT NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('pending', 'paid', 'refunded')),
  registered_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL REFERENCES members(id),
  amount REAL NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('membership', 'tournament')),
  reference_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'failed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS club_officers (
  id TEXT PRIMARY KEY,
  club_id TEXT NOT NULL REFERENCES clubs(id),
  member_id TEXT NOT NULL REFERENCES members(id),
  role TEXT NOT NULL
    CHECK (role IN ('president', 'secretary', 'treasurer', 'rep')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS club_news (
  id TEXT PRIMARY KEY,
  club_id TEXT NOT NULL REFERENCES clubs(id),
  title TEXT NOT NULL,
  news_date TEXT NOT NULL,
  excerpt TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_members_email ON members(email);
CREATE INDEX IF NOT EXISTS idx_tournaments_status ON tournaments(status);
CREATE INDEX IF NOT EXISTS idx_tournaments_club_id ON tournaments(club_id);
CREATE INDEX IF NOT EXISTS idx_registrations_member_id ON registrations(member_id);
CREATE INDEX IF NOT EXISTS idx_registrations_tournament_id ON registrations(tournament_id);
CREATE INDEX IF NOT EXISTS idx_club_officers_club_id ON club_officers(club_id);
CREATE INDEX IF NOT EXISTS idx_club_news_club_id ON club_news(club_id);
