-- migrations/0033_lca_auditor_role.sql
--
-- Add 'lca_auditor' to the members.role CHECK.
--
-- SQLite cannot alter a CHECK constraint, so the table has to be rebuilt.
-- This follows 0019 exactly, including the ordering note that made v1 of it
-- fail on remote: under defer_foreign_keys the deferred-violation counter
-- only decrements when parent keys land in the table with the REFERENCED
-- name, so `members` must exist again under its own name before rows are
-- restored. Copying into members_new and renaming afterwards does not work
-- here, because child rows already reference members.
--
-- The column list is 0019's plus membership_type from 0020, which is the
-- whole of the table today. Getting it wrong silently drops data, so it is
-- spelled out rather than relying on SELECT *.

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
    CHECK (role IN ('member', 'lca_auditor', 'club_rep', 'tournament_director', 'lca_admin', 'guest')),
  club_id TEXT REFERENCES clubs(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  uscf_rating INTEGER,
  uscf_rating_updated_at TEXT,
  membership_type TEXT DEFAULT NULL
);

INSERT INTO members
  SELECT id, email, full_name, uscf_id, membership_status, membership_expiry,
         role, club_id, created_at, uscf_rating, uscf_rating_updated_at,
         membership_type
  FROM members_backup;

DROP TABLE members_backup;

CREATE INDEX IF NOT EXISTS idx_members_email ON members(email);
CREATE INDEX IF NOT EXISTS idx_members_role ON members(role);
CREATE INDEX IF NOT EXISTS idx_members_club_id ON members(club_id);
