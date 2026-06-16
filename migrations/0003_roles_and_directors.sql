PRAGMA foreign_keys = OFF;
DROP TABLE IF EXISTS tournament_games;
DROP TABLE IF EXISTS tournament_directors;
DROP TABLE IF EXISTS club_officers;
DROP TABLE IF EXISTS club_news;
DROP TABLE IF EXISTS registrations;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS tournaments;
DROP TABLE IF EXISTS members_new;
CREATE TABLE members_new (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  uscf_id TEXT,
  membership_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (membership_status IN ('active', 'expired', 'pending')),
  membership_expiry TEXT,
  role TEXT NOT NULL DEFAULT 'member'
    CHECK (role IN ('member', 'club_rep', 'tournament_director', 'lca_admin')),
  club_id TEXT REFERENCES clubs(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO members_new SELECT id, email, full_name, uscf_id, membership_status, membership_expiry,
  CASE WHEN role = 'admin' THEN 'lca_admin' ELSE role END, club_id, created_at FROM members;
DROP TABLE members;
ALTER TABLE members_new RENAME TO members;
CREATE INDEX IF NOT EXISTS idx_members_email ON members(email);
CREATE INDEX IF NOT EXISTS idx_members_role ON members(role);
CREATE INDEX IF NOT EXISTS idx_members_club_id ON members(club_id);
CREATE TABLE IF NOT EXISTS tournaments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  venue TEXT,
  date TEXT NOT NULL,
  end_date TEXT,
  entry_fee REAL NOT NULL DEFAULT 0,
  sections TEXT NOT NULL DEFAULT '[]',
  rounds INTEGER NOT NULL DEFAULT 4,
  max_players INTEGER,
  status TEXT NOT NULL DEFAULT 'upcoming'
    CHECK (status IN ('upcoming', 'active', 'completed')),
  description TEXT,
  registration_deadline TEXT,
  club_id TEXT REFERENCES clubs(id),
  created_by TEXT REFERENCES members(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_tournaments_status ON tournaments(status);
CREATE INDEX IF NOT EXISTS idx_tournaments_club_id ON tournaments(club_id);
CREATE TABLE IF NOT EXISTS registrations (
  id TEXT PRIMARY KEY,
  tournament_id TEXT NOT NULL REFERENCES tournaments(id),
  member_id TEXT NOT NULL REFERENCES members(id),
  section TEXT NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('pending', 'paid', 'refunded')),
  registered_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_registrations_tournament_id ON registrations(tournament_id);
CREATE INDEX IF NOT EXISTS idx_registrations_member_id ON registrations(member_id);
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
CREATE INDEX IF NOT EXISTS idx_payments_member_id ON payments(member_id);
CREATE TABLE IF NOT EXISTS club_officers (
  id TEXT PRIMARY KEY,
  club_id TEXT NOT NULL REFERENCES clubs(id),
  member_id TEXT NOT NULL REFERENCES members(id),
  role TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_club_officers_club_id ON club_officers(club_id);
CREATE TABLE IF NOT EXISTS club_news (
  id TEXT PRIMARY KEY,
  club_id TEXT NOT NULL REFERENCES clubs(id),
  title TEXT NOT NULL,
  body TEXT,
  news_date TEXT NOT NULL DEFAULT (date('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_club_news_club_id ON club_news(club_id);
CREATE TABLE IF NOT EXISTS tournament_directors (
  tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (tournament_id, member_id)
);
CREATE INDEX IF NOT EXISTS idx_tournament_directors_member_id ON tournament_directors(member_id);
CREATE TABLE IF NOT EXISTS tournament_games (
  id TEXT PRIMARY KEY,
  tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  round INTEGER NOT NULL,
  board INTEGER NOT NULL,
  section TEXT NOT NULL,
  white_member_id TEXT REFERENCES members(id),
  black_member_id TEXT REFERENCES members(id),
  result TEXT NOT NULL DEFAULT 'pending'
    CHECK (result IN ('1-0', '0-1', '1/2-1/2', 'bye', 'pending')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (tournament_id, round, board, section)
);
CREATE INDEX IF NOT EXISTS idx_tournament_games_tournament_id ON tournament_games(tournament_id);
PRAGMA foreign_keys = ON;