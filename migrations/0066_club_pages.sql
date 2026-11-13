-- 0066_club_pages.sql
--
-- Hand-written migration (npm run db:generate -- <name> --custom), staged as
-- drizzle/0011_club_pages.sql. drizzle/meta now records functions/db/schema.ts as it
-- is, so write the SQL that brings the database to match it. Triggers, data
-- changes and table rebuilds belong here; see migrations/README.md.
--
-- Edited by hand (migrations/README.md: a column or table that references
-- another table is written by hand with --custom, since drizzle-kit leaves
-- the delete action off a column it adds with ALTER TABLE). WS09 step 4,
-- the club page's tables and columns, as the brief's data model writes them:
-- fifteen columns on clubs, each nullable or with a default, with the unique
-- index idx_clubs_slug; club_slug_history, a club's old addresses;
-- club_places, where it meets; club_reports, suggestions and new clubs, with
-- escalated_at, which the brief does not write and the 14-day reminder sets;
-- and club_rep_requests. Every statement adds; no table is rebuilt and no row
-- is changed.
--
-- The slugs are not filled here: until migration 0067 fills them, slug is
-- NULL for every club that exists, which the unique index allows for any
-- number of rows. A new club made by functions/api/admin/clubs.ts gets its
-- slug in its own insert.
--
-- No reference has a delete action, as the brief writes them (NO ACTION):
-- clubs.told_by, clubs.confirmed_by, club_reports.resolved_by and
-- club_rep_requests.decided_by are set to NULL, and a member's own
-- club_rep_requests deleted, by the member delete; a club's club_places,
-- club_slug_history, club_reports and club_rep_requests are deleted by the
-- club delete. The CHECKs are written here alone, as for every table
-- (functions/db/schema.ts says why).
--
-- drizzle-kit's own version, which must not run as it is (it rebuilds tables
-- or switches foreign keys off). Work from it:
--
-- CREATE TABLE `club_places` (
-- 	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
-- 	`club_id` text NOT NULL,
-- 	`name` text NOT NULL,
-- 	`street` text,
-- 	`note` text,
-- 	`latitude` real,
-- 	`longitude` real,
-- 	`sort` integer DEFAULT 0 NOT NULL,
-- 	FOREIGN KEY (`club_id`) REFERENCES `clubs`(`id`) ON UPDATE no action ON DELETE no action
-- );
-- --> statement-breakpoint
-- CREATE TABLE `club_rep_requests` (
-- 	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
-- 	`club_id` text NOT NULL,
-- 	`member_id` text NOT NULL,
-- 	`connection` text NOT NULL,
-- 	`note` text,
-- 	`status` text DEFAULT 'open' NOT NULL,
-- 	`decided_by` text,
-- 	`decided_at` text,
-- 	`created_at` text DEFAULT (datetime('now')) NOT NULL,
-- 	FOREIGN KEY (`club_id`) REFERENCES `clubs`(`id`) ON UPDATE no action ON DELETE no action,
-- 	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action,
-- 	FOREIGN KEY (`decided_by`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
-- );
-- --> statement-breakpoint
-- CREATE TABLE `club_reports` (
-- 	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
-- 	`club_id` text,
-- 	`kind` text NOT NULL,
-- 	`field` text,
-- 	`message` text NOT NULL,
-- 	`proposed_json` text,
-- 	`region` text,
-- 	`reporter_email` text,
-- 	`status` text DEFAULT 'open' NOT NULL,
-- 	`resolved_by` text,
-- 	`resolved_at` text,
-- 	`created_at` text DEFAULT (datetime('now')) NOT NULL,
-- 	`escalated_at` text,
-- 	FOREIGN KEY (`club_id`) REFERENCES `clubs`(`id`) ON UPDATE no action ON DELETE no action,
-- 	FOREIGN KEY (`resolved_by`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
-- );
-- --> statement-breakpoint
-- CREATE TABLE `club_slug_history` (
-- 	`old_slug` text PRIMARY KEY NOT NULL,
-- 	`club_id` text NOT NULL,
-- 	FOREIGN KEY (`club_id`) REFERENCES `clubs`(`id`) ON UPDATE no action ON DELETE no action
-- );
-- --> statement-breakpoint
-- ALTER TABLE `clubs` ADD `slug` text;--> statement-breakpoint
-- ALTER TABLE `clubs` ADD `about_text` text;--> statement-breakpoint
-- ALTER TABLE `clubs` ADD `how_we_meet_text` text;--> statement-breakpoint
-- ALTER TABLE `clubs` ADD `cost_text` text;--> statement-breakpoint
-- ALTER TABLE `clubs` ADD `welcome_text` text;--> statement-breakpoint
-- ALTER TABLE `clubs` ADD `weekend_play` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- ALTER TABLE `clubs` ADD `scholastic_friendly` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- ALTER TABLE `clubs` ADD `contact_name_public` text;--> statement-breakpoint
-- ALTER TABLE `clubs` ADD `facebook_url` text;--> statement-breakpoint
-- ALTER TABLE `clubs` ADD `website_url` text;--> statement-breakpoint
-- ALTER TABLE `clubs` ADD `other_url` text;--> statement-breakpoint
-- ALTER TABLE `clubs` ADD `told_updated_at` text;--> statement-breakpoint
-- ALTER TABLE `clubs` ADD `told_by` text REFERENCES members(id);--> statement-breakpoint
-- ALTER TABLE `clubs` ADD `last_confirmed_at` text;--> statement-breakpoint
-- ALTER TABLE `clubs` ADD `confirmed_by` text REFERENCES members(id);--> statement-breakpoint
-- CREATE UNIQUE INDEX `idx_clubs_slug` ON `clubs` (`slug`);

ALTER TABLE clubs ADD COLUMN slug TEXT;
CREATE UNIQUE INDEX idx_clubs_slug ON clubs(slug);

CREATE TABLE club_slug_history (
  old_slug TEXT PRIMARY KEY,
  club_id TEXT NOT NULL REFERENCES clubs(id)
);

ALTER TABLE clubs ADD COLUMN about_text TEXT;
ALTER TABLE clubs ADD COLUMN how_we_meet_text TEXT;
ALTER TABLE clubs ADD COLUMN cost_text TEXT;
ALTER TABLE clubs ADD COLUMN welcome_text TEXT;
ALTER TABLE clubs ADD COLUMN weekend_play INTEGER NOT NULL DEFAULT 0;
ALTER TABLE clubs ADD COLUMN scholastic_friendly INTEGER NOT NULL DEFAULT 0;
ALTER TABLE clubs ADD COLUMN contact_name_public TEXT;
ALTER TABLE clubs ADD COLUMN facebook_url TEXT;
ALTER TABLE clubs ADD COLUMN website_url TEXT;
ALTER TABLE clubs ADD COLUMN other_url TEXT;
ALTER TABLE clubs ADD COLUMN told_updated_at TEXT;
ALTER TABLE clubs ADD COLUMN told_by TEXT REFERENCES members(id);
ALTER TABLE clubs ADD COLUMN last_confirmed_at TEXT;
ALTER TABLE clubs ADD COLUMN confirmed_by TEXT REFERENCES members(id);

CREATE TABLE club_places (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  club_id TEXT NOT NULL REFERENCES clubs(id),
  name TEXT NOT NULL,
  street TEXT,
  note TEXT,
  latitude REAL,
  longitude REAL,
  sort INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE club_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  club_id TEXT REFERENCES clubs(id),
  kind TEXT NOT NULL CHECK (kind IN ('suggestion', 'new_club', 'start_club')),
  field TEXT,
  message TEXT NOT NULL,
  proposed_json TEXT,
  region TEXT,
  reporter_email TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'applied', 'answered', 'dismissed')),
  resolved_by TEXT REFERENCES members(id),
  resolved_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  escalated_at TEXT,
  CHECK ((kind = 'suggestion') = (club_id IS NOT NULL))
);

CREATE TABLE club_rep_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  club_id TEXT NOT NULL REFERENCES clubs(id),
  member_id TEXT NOT NULL REFERENCES members(id),
  connection TEXT NOT NULL CHECK (connection IN ('runs_it', 'helps_run_it', 'keeps_page', 'other')),
  note TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'approved', 'declined')),
  decided_by TEXT REFERENCES members(id),
  decided_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
