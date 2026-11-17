-- 0070_club_event_approval.sql
--
-- Hand-written migration (npm run db:generate -- <name> --custom), staged as
-- drizzle/0015_club_event_approval.sql. drizzle/meta now records functions/db/schema.ts as it
-- is, so write the SQL that brings the database to match it. Triggers, data
-- changes and table rebuilds belong here; see migrations/README.md.
--
-- Edited by hand (migrations/README.md: a column or table that references
-- another table is written by hand with --custom). WS09 step 16, the wait
-- for an LCA admin's approval, as the brief's data model writes it: four
-- columns on tournaments, needs_lca_approval with a default of 0 and three
-- nullable ones. A regional representative's club event will be marked 1
-- and list only once approved_at is set (mayList in
-- domain/events/approval.ts); nothing writes any of the four yet, so every
-- row reads 0 and three NULLs.
--
-- approved_by references members(id) with no delete action, as the club
-- columns of 0066 do, so the member delete sets it to NULL before the
-- member's row goes; before 0070 has run the column is not there, and the
-- delete goes on with one log line. The two public tournament answers leave
-- the four out for anyone who does not manage the event
-- (MANAGER_ONLY_TOURNAMENT_KEYS in domain/contracts/events.ts). The
-- statements add; no table is rebuilt and no row is changed.
--
-- drizzle-kit's own version, which must not run as it is (it rebuilds tables
-- or switches foreign keys off). Work from it:
--
-- ALTER TABLE `tournaments` ADD `needs_lca_approval` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- ALTER TABLE `tournaments` ADD `approval_requested_at` text;--> statement-breakpoint
-- ALTER TABLE `tournaments` ADD `approved_at` text;--> statement-breakpoint
-- ALTER TABLE `tournaments` ADD `approved_by` text REFERENCES members(id);

ALTER TABLE tournaments ADD COLUMN needs_lca_approval INTEGER NOT NULL DEFAULT 0;
ALTER TABLE tournaments ADD COLUMN approval_requested_at TEXT;
ALTER TABLE tournaments ADD COLUMN approved_at TEXT;
ALTER TABLE tournaments ADD COLUMN approved_by TEXT REFERENCES members(id);
