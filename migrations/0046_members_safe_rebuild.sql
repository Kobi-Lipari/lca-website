-- migrations/0046_members_safe_rebuild.sql
--
-- Why this exists: 0019, 0033 and 0040 rebuilt `members` (DROP + CREATE)
-- to change the role CHECK constraint. DROP TABLE deletes every row first,
-- and with foreign keys on that fires ON DELETE CASCADE / SET NULL in the
-- tables pointing at members. PRAGMA defer_foreign_keys only delays the
-- checks; it does not stop those actions. So each of those migrations
-- silently emptied board_seat_assignments, tournament_directors and the
-- tournament reminder tables, and unlinked support tickets from accounts.
--
-- This is the last rebuild of members. It:
--   1. backs up every table that cascades from members,
--   2. rebuilds members WITHOUT the role / membership_status CHECKs,
--   3. puts the backed-up rows straight back,
--   4. enforces the same allowed values with triggers instead.
-- Adding a role in future is then DROP TRIGGER + CREATE TRIGGER: no
-- rebuild, nothing at risk. (test/unit/migration-safety.test.ts fails any
-- future migration that drops a parent table without restoring children.)
--
-- Columns: 0040's list plus uscf_expiration (0042); 0043 dropped grade.

PRAGMA defer_foreign_keys = true;

-- 1. Back up everything that DROP TABLE members would take with it.
CREATE TABLE keep_board_seat_assignments AS SELECT * FROM board_seat_assignments;
CREATE TABLE keep_tournament_directors AS SELECT * FROM tournament_directors;
CREATE TABLE keep_tournament_reminders AS SELECT * FROM tournament_reminders;
CREATE TABLE keep_tournament_attendee_reminders AS SELECT * FROM tournament_attendee_reminders;
CREATE TABLE keep_support_ticket_members AS
  SELECT id, member_id FROM support_tickets WHERE member_id IS NOT NULL;

-- 2. Rebuild members without the CHECK constraints.
CREATE TABLE members_backup AS SELECT * FROM members;
DROP TABLE members;

CREATE TABLE members (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  uscf_id TEXT,
  membership_status TEXT NOT NULL DEFAULT 'pending',
  membership_expiry TEXT,
  role TEXT NOT NULL DEFAULT 'member',
  club_id TEXT REFERENCES clubs(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  uscf_rating INTEGER,
  uscf_rating_updated_at TEXT,
  membership_type TEXT DEFAULT NULL,
  guardian_id TEXT REFERENCES members(id) DEFAULT NULL,
  uscf_expiration TEXT
);

INSERT INTO members
  SELECT id, email, full_name, uscf_id, membership_status, membership_expiry,
         role, club_id, created_at, uscf_rating, uscf_rating_updated_at,
         membership_type, guardian_id, uscf_expiration
  FROM members_backup;

DROP TABLE members_backup;

-- 3. Put the cascaded rows back.
DELETE FROM board_seat_assignments;
INSERT INTO board_seat_assignments SELECT * FROM keep_board_seat_assignments;
DELETE FROM tournament_directors;
INSERT INTO tournament_directors SELECT * FROM keep_tournament_directors;
DELETE FROM tournament_reminders;
INSERT INTO tournament_reminders SELECT * FROM keep_tournament_reminders;
DELETE FROM tournament_attendee_reminders;
INSERT INTO tournament_attendee_reminders SELECT * FROM keep_tournament_attendee_reminders;
UPDATE support_tickets
   SET member_id = (SELECT k.member_id FROM keep_support_ticket_members k WHERE k.id = support_tickets.id)
 WHERE id IN (SELECT id FROM keep_support_ticket_members);

DROP TABLE keep_board_seat_assignments;
DROP TABLE keep_tournament_directors;
DROP TABLE keep_tournament_reminders;
DROP TABLE keep_tournament_attendee_reminders;
DROP TABLE keep_support_ticket_members;

CREATE INDEX IF NOT EXISTS idx_members_email ON members(email);
CREATE INDEX IF NOT EXISTS idx_members_role ON members(role);
CREATE INDEX IF NOT EXISTS idx_members_club_id ON members(club_id);
CREATE INDEX IF NOT EXISTS idx_members_guardian_id ON members(guardian_id);

-- 4. The same rules as the old CHECKs, as triggers.
DROP TRIGGER IF EXISTS members_role_insert;
CREATE TRIGGER members_role_insert BEFORE INSERT ON members
WHEN NEW.role NOT IN ('member', 'lca_auditor', 'lca_observer', 'club_rep', 'tournament_director', 'lca_admin', 'guest')
  OR NEW.membership_status NOT IN ('active', 'expired', 'pending')
BEGIN
  SELECT RAISE(ABORT, 'members: role or membership_status not allowed');
END;

DROP TRIGGER IF EXISTS members_role_update;
CREATE TRIGGER members_role_update BEFORE UPDATE OF role, membership_status ON members
WHEN NEW.role NOT IN ('member', 'lca_auditor', 'lca_observer', 'club_rep', 'tournament_director', 'lca_admin', 'guest')
  OR NEW.membership_status NOT IN ('active', 'expired', 'pending')
BEGIN
  SELECT RAISE(ABORT, 'members: role or membership_status not allowed');
END;
