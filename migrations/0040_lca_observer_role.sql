-- migrations/0040_lca_observer_role.sql
--
-- Add 'lca_observer' to the members.role CHECK: sees everything an admin
-- sees, can send group email, email entrants and answer support tickets,
-- but cannot change anything else.
--
-- Same rebuild as 0033 (see its notes on defer_foreign_keys and why the
-- table must come back under its own name before rows are restored). The
-- column list is 0033's plus guardian_id from 0036.

PRAGMA defer_foreign_keys = true;

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
    CHECK (role IN ('member', 'lca_auditor', 'lca_observer', 'club_rep', 'tournament_director', 'lca_admin', 'guest')),
  club_id TEXT REFERENCES clubs(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  uscf_rating INTEGER,
  uscf_rating_updated_at TEXT,
  membership_type TEXT DEFAULT NULL,
  guardian_id TEXT REFERENCES members(id) DEFAULT NULL
);

INSERT INTO members
  SELECT id, email, full_name, uscf_id, membership_status, membership_expiry,
         role, club_id, created_at, uscf_rating, uscf_rating_updated_at,
         membership_type, guardian_id
  FROM members_backup;

DROP TABLE members_backup;

CREATE INDEX IF NOT EXISTS idx_members_email ON members(email);
CREATE INDEX IF NOT EXISTS idx_members_role ON members(role);
CREATE INDEX IF NOT EXISTS idx_members_club_id ON members(club_id);
CREATE INDEX IF NOT EXISTS idx_members_guardian_id ON members(guardian_id);
