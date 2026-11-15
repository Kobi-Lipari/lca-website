-- 0068_automation_runs.sql
--
-- Hand-written migration (npm run db:generate -- <name> --custom), staged as
-- drizzle/0013_automation_runs.sql. drizzle/meta now records functions/db/schema.ts as it
-- is, so write the SQL that brings the database to match it. Triggers, data
-- changes and table rebuilds belong here; see migrations/README.md.
--
-- Edited by hand (migrations/README.md: a table that references another
-- table is written by hand with --custom, and the CHECK on outcome is
-- written here alone, as for every table; functions/db/schema.ts says why).
-- WS09 step 13, the run record, as the brief's data model writes it: one
-- table, automation_runs, with its index. A scheduled job writes one row
-- for each run through recordRun in functions/utils/admin/automations.ts,
-- opened with the outcome 'failed' and no finished_at and closed with the
-- real outcome and counts, so a run that never closes reads as failed.
-- detail is one plain line for the admin; never a secret, a token or an
-- email address.
--
-- seen_by references members(id) with no delete action, as the brief writes
-- it (NO ACTION): the member delete (functions/api/admin/members/[id].ts)
-- sets it to NULL on that member's rows and keeps the rows. The statement
-- adds; no table is rebuilt and no row is changed.
--
-- drizzle-kit's own version, which must not run as it is (it rebuilds tables
-- or switches foreign keys off). Work from it:
--
-- CREATE TABLE `automation_runs` (
-- 	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
-- 	`job` text NOT NULL,
-- 	`started_at` text DEFAULT (datetime('now')) NOT NULL,
-- 	`finished_at` text,
-- 	`outcome` text NOT NULL,
-- 	`sent_count` integer,
-- 	`failed_count` integer,
-- 	`detail` text,
-- 	`seen_at` text,
-- 	`seen_by` text,
-- 	FOREIGN KEY (`seen_by`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
-- );
-- --> statement-breakpoint
-- CREATE INDEX `idx_automation_runs_job` ON `automation_runs` (`job`,`started_at`);

CREATE TABLE automation_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job TEXT NOT NULL,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at TEXT,
  outcome TEXT NOT NULL CHECK (outcome IN ('ok','partial','failed')),
  sent_count INTEGER, failed_count INTEGER,
  detail TEXT,
  seen_at TEXT, seen_by TEXT REFERENCES members(id)
);
CREATE INDEX idx_automation_runs_job ON automation_runs(job, started_at);
