-- migrations/0019_widen_checks.sql (v2)
-- Rebuild three tables to widen CHECK constraints.
-- Pattern: backup → drop → recreate under the ORIGINAL name → restore.
-- Order matters under defer_foreign_keys: the deferred-violation counter
-- only decrements when parent keys are inserted into the table with the
-- referenced NAME, so the new table must exist as e.g. `members` before
-- rows are restored. (v1 copied into members_new pre-drop and failed
-- at commit on remote, where child rows exist.)

PRAGMA defer_foreign_keys = true;

-- ── members: role CHECK + 'guest' ────────────────────────────────
CREATE TABLE members_backup AS SELECT * FROM members;
DROP TABLE members;
CREATE TABLE members (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  uscf_id TEXT,
  membership_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (membership_status IN ('active', 'expired', 'pending')),
  membership_expiry TEXT,
  role TEXT NOT NULL DEFAULT 'member'
    CHECK (role IN ('member', 'club_rep', 'tournament_director', 'lca_admin', 'guest')),
  club_id TEXT REFERENCES clubs(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  uscf_rating INTEGER,
  uscf_rating_updated_at TEXT
);
INSERT INTO members
  SELECT id, email, full_name, uscf_id, membership_status, membership_expiry,
         role, club_id, created_at, uscf_rating, uscf_rating_updated_at
  FROM members_backup;
DROP TABLE members_backup;
CREATE INDEX IF NOT EXISTS idx_members_email ON members(email);
CREATE INDEX IF NOT EXISTS idx_members_role ON members(role);
CREATE INDEX IF NOT EXISTS idx_members_club_id ON members(club_id);

-- ── payments: type CHECK + 'donation'; member_id nullable ────────
CREATE TABLE payments_backup AS SELECT * FROM payments;
DROP TABLE payments;
CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  member_id TEXT REFERENCES members(id),
  amount REAL NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('membership', 'tournament', 'donation')),
  reference_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'failed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  stripe_session_id TEXT,
  stripe_payment_intent TEXT
);
INSERT INTO payments
  SELECT id, member_id, amount, type, reference_id, status,
         created_at, stripe_session_id, stripe_payment_intent
  FROM payments_backup;
DROP TABLE payments_backup;
CREATE INDEX IF NOT EXISTS idx_payments_member_id ON payments(member_id);

-- ── tournament_games: result CHECK + forfeit/half-bye codes ──────
CREATE TABLE tournament_games_backup AS SELECT * FROM tournament_games;
DROP TABLE tournament_games;
CREATE TABLE tournament_games (
  id TEXT PRIMARY KEY,
  tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  round INTEGER NOT NULL,
  board INTEGER NOT NULL,
  section TEXT NOT NULL,
  white_member_id TEXT REFERENCES members(id),
  black_member_id TEXT REFERENCES members(id),
  result TEXT NOT NULL DEFAULT 'pending'
    CHECK (result IN ('1-0', '0-1', '1/2-1/2', '1-0 F', '0-1 F', '0-0 F', 'bye', 'bye-half', 'pending')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (tournament_id, round, board, section)
);
INSERT INTO tournament_games
  SELECT id, tournament_id, round, board, section,
         white_member_id, black_member_id, result, created_at
  FROM tournament_games_backup;
DROP TABLE tournament_games_backup;
CREATE INDEX IF NOT EXISTS idx_tournament_games_tournament_id ON tournament_games(tournament_id);