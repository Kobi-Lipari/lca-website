-- 0069_club_check_marks.sql
--
-- Hand-written migration (npm run db:generate -- <name> --custom), staged as
-- drizzle/0014_club_check_marks.sql. drizzle/meta now records functions/db/schema.ts as it
-- is, so write the SQL that brings the database to match it. Triggers, data
-- changes and table rebuilds belong here; see migrations/README.md.
--
-- Edited by hand (migrations/README.md: a table that references another
-- table is written by hand with --custom).
-- WS09 step 14, the monthly check's mark: one row for each person the
-- timed run of the monthly check (functions/utils/clubs/monthlyCheck.ts)
-- has sent this month's check, as today's reminders keep theirs in
-- tournament_attendee_reminders (0005) with its UNIQUE rule. The run claims
-- the mark before the send, with an insert the key refuses the second
-- time, so two runs at once never both send to one person; a send worth
-- another try gives the mark back. month is the first Monday's day in
-- Central time, "2026-12-07". The table holds no address and no name.
--
-- member_id references members(id) ON DELETE CASCADE, so a member's delete
-- takes their marks with it and the member delete needs no change; before
-- 0069 has run there is no table and nothing to take. The statement adds;
-- no table is rebuilt and no row is changed.
--
-- drizzle-kit's own version, which must not run as it is (it rebuilds tables
-- or switches foreign keys off). Work from it:
--
-- CREATE TABLE `club_check_marks` (
-- 	`member_id` text NOT NULL,
-- 	`month` text NOT NULL,
-- 	PRIMARY KEY(`member_id`, `month`),
-- 	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade
-- );

CREATE TABLE club_check_marks (
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  PRIMARY KEY (member_id, month)
);
