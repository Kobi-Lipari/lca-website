-- migrations/0026_ticket_notes.sql
--
-- Lets a seat holder or admin paste correspondence that happened off-site
-- (usually a Gmail reply) onto the ticket, so the record stays complete for
-- whoever holds the seat next.
--
-- A note is NOT a new sender_type: support_messages carries
-- CHECK (sender_type IN ('member','admin','guest')) and SQLite can't alter a
-- CHECK without rebuilding the table and every index on it. Notes are stored
-- as sender_type 'admin' with is_note = 1, which is a cheap ALTER and reads
-- just as clearly in a query.

PRAGMA foreign_keys = OFF;

-- 1 = logged correspondence (pasted after the fact, no email sent),
-- 0 = a live message that was actually delivered through the site.
ALTER TABLE support_messages ADD COLUMN is_note INTEGER NOT NULL DEFAULT 0;

-- Who pasted it. Distinct from sender_id, which for a note is also the
-- logger — kept separate so the meaning stays obvious at a glance.
ALTER TABLE support_messages ADD COLUMN logged_by TEXT REFERENCES members(id);

-- When the correspondence actually happened, which is usually NOT when it was
-- pasted in. NULL falls back to created_at.
ALTER TABLE support_messages ADD COLUMN occurred_at TEXT;

CREATE INDEX IF NOT EXISTS idx_support_messages_notes
  ON support_messages(ticket_id, is_note);

PRAGMA foreign_keys = ON;