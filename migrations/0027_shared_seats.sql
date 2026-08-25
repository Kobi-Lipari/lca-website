-- migrations/0027_shared_seats.sql
--
-- Some offices are genuinely held by more than one person at a time. LCA sends
-- two USCF Delegates who do the same job, are not ranked, and should both see
-- every message sent to the office — including messages received before either
-- of them took it.
--
-- Modelling that as two seats would split the history in half and force a
-- visitor to guess which delegate to write to. So: one seat, several
-- concurrent holders.

PRAGMA foreign_keys = OFF;

-- 1 = the seat may be held by several people at once. Governs how the admin
-- panel behaves (add a holder vs replace the holder) and how many people get
-- notified when a message arrives.
ALTER TABLE board_members ADD COLUMN is_shared INTEGER NOT NULL DEFAULT 0;

UPDATE board_members SET is_shared = 1 WHERE slug = 'uscf-delegate';

-- The old index guaranteed one live holder per seat, which a shared seat must
-- be allowed to break. SQLite partial indexes can't reference another table,
-- so this can't be conditioned on is_shared — the constraint moves up a layer:
-- the assign endpoint closes the sitting term before opening a new one on any
-- seat where is_shared = 0.
DROP INDEX IF EXISTS idx_seat_current;

-- What the database still guarantees: the same person can't hold the same seat
-- twice concurrently, so a double-click on Assign can't create a duplicate.
CREATE UNIQUE INDEX IF NOT EXISTS idx_seat_member_current
  ON board_seat_assignments(seat_id, member_id) WHERE ended_at IS NULL;

PRAGMA foreign_keys = ON;