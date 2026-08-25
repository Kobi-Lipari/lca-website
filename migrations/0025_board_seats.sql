-- migrations/0025_board_seats.sql
--
-- Separates the SEAT (a permanent office: President, Scholastic Director,
-- New Orleans Metro Representative) from the PERSON currently holding it.
--
-- board_members was already a seats table in everything but name: `role` and
-- `sort_order` are permanent, only `name`/`email` describe an occupant. So this
-- is an ALTER, not a rebuild — /api/governance/board keeps working untouched.
--
-- Why an assignment table instead of a 'board_member' value on members.role:
-- members.role carries a CHECK constraint, and SQLite cannot alter a CHECK
-- without rebuilding the table and every FK into it. It would also collide
-- with club_rep / tournament_director — promoting someone to the board would
-- clobber their club permissions, and demoting them would strip their account.
--
-- NOTE: if this database has already been migrated, do not rerun this file.
-- ALTER TABLE ADD COLUMN has no IF NOT EXISTS and will fail on the second
-- attempt. Data repairs for already-migrated databases live in 0028.

PRAGMA foreign_keys = OFF;

-- ── Seats ────────────────────────────────────────────────────────────────────

ALTER TABLE board_members ADD COLUMN slug TEXT;
ALTER TABLE board_members ADD COLUMN category TEXT NOT NULL DEFAULT 'officer';
ALTER TABLE board_members ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1;

-- Stable routing keys derived from the existing role names. SQLite has no
-- regex, so this is a chain of replaces, read inside out:
--   lowercase -> drop . , ' & ( ) -> '/' becomes '-' -> spaces become '-'
--   -> collapse runs of hyphens (twice, which covers up to four in a row)
--   -> trim any leading/trailing hyphen
-- 'Baton Rouge / East Central Representative'
--   -> 'baton-rouge-east-central-representative'
-- 'Secretary - Treasurer' -> 'secretary-treasurer'
UPDATE board_members
   SET slug = trim(
         replace(
           replace(
             replace(
               replace(
                 replace(
                   replace(
                     replace(
                       replace(
                         replace(lower(role), '.', ''),
                       ',', ''),
                     '''', ''),
                   '&', ''),
                 '(', ''),
               ')', ''),
             '/', '-'),
           ' ', '-'),
         '--', '-')
       , '-')
 WHERE slug IS NULL OR slug = '';

-- Second collapse pass: '/' surrounded by spaces produces three hyphens, and
-- one replace() call only reduces that to two.
UPDATE board_members
   SET slug = trim(replace(slug, '--', '-'), '-')
 WHERE slug LIKE '%--%' OR slug LIKE '-%' OR slug LIKE '%-';

-- The officer / regional-rep split becomes a column instead of a pattern match
-- on a display string. LCA's role names say "Representative", never "Region" —
-- this must stay in step with isRegionalRole() in src/pages/BoardPage.tsx.
UPDATE board_members
   SET category = 'regional_rep'
 WHERE role LIKE '%Representative%';

-- Slugs are public URLs (/contact?to=scholastic-director), so they must be
-- unique. If this index fails, two seats share a role name — rename one first.
CREATE UNIQUE INDEX IF NOT EXISTS idx_board_members_slug
  ON board_members(slug);

-- ── Assignments ──────────────────────────────────────────────────────────────

-- Never deleted. Ending a term is UPDATE ... SET ended_at = datetime('now'),
-- which leaves a permanent officer history behind.
CREATE TABLE IF NOT EXISTS board_seat_assignments (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  seat_id TEXT NOT NULL REFERENCES board_members(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  ended_at TEXT,
  appointed_by TEXT REFERENCES members(id),
  note TEXT
);

-- One current holder per seat. 0027 replaces this to allow shared seats —
-- kept here so a database built from scratch follows the same history.
CREATE UNIQUE INDEX IF NOT EXISTS idx_seat_current
  ON board_seat_assignments(seat_id) WHERE ended_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_seat_assignments_member
  ON board_seat_assignments(member_id, ended_at);

-- ── Tickets route to seats ───────────────────────────────────────────────────

-- NULL = general inquiry / site support, exactly as today.
ALTER TABLE support_tickets ADD COLUMN seat_id TEXT REFERENCES board_members(id);

CREATE INDEX IF NOT EXISTS idx_support_tickets_seat_id
  ON support_tickets(seat_id);

PRAGMA foreign_keys = ON;