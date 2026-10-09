-- 0052_sections_schedules.sql
--
-- Written by drizzle-kit from functions/db/schema.ts (npm run db:generate),
-- staged as drizzle/0001_sections_schedules.sql. The "--> statement-breakpoint" markers are
-- comments. Review it before committing; edit the schema and generate again
-- rather than editing this file.

CREATE TABLE `tournament_schedule_rounds` (
	`schedule_id` text NOT NULL,
	`round` integer NOT NULL,
	`date` text,
	`time` text,
	PRIMARY KEY(`schedule_id`, `round`),
	FOREIGN KEY (`schedule_id`) REFERENCES `tournament_schedules`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `tournament_schedules` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))) NOT NULL,
	`tournament_id` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`label` text DEFAULT 'Main schedule' NOT NULL,
	`time_control` text,
	`is_primary` integer DEFAULT 0 NOT NULL,
	`merge_round` integer,
	`archived_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`tournament_id`) REFERENCES `tournaments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_tournament_schedules_tournament_id` ON `tournament_schedules` (`tournament_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_tournament_schedules_primary` ON `tournament_schedules` (`tournament_id`) WHERE is_primary = 1 AND archived_at IS NULL;--> statement-breakpoint
CREATE TABLE `tournament_sections` (
	`id` text PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))) NOT NULL,
	`tournament_id` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`name` text NOT NULL,
	`fee_regular` real,
	`fee_early` real,
	`fee_late` real,
	`cap` integer,
	`prize_fund` text,
	`rating_min` integer,
	`rating_max` integer,
	`unrated_ok` integer,
	`grade_min` integer,
	`grade_max` integer,
	`rules_set` integer DEFAULT 0 NOT NULL,
	`prizes_json` text,
	`extra_json` text,
	`archived_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`tournament_id`) REFERENCES `tournaments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_tournament_sections_tournament_id` ON `tournament_sections` (`tournament_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_tournament_sections_live_name` ON `tournament_sections` (`tournament_id`,`name`) WHERE archived_at IS NULL;--> statement-breakpoint
ALTER TABLE `registrations` ADD `section_id` text REFERENCES tournament_sections(id);--> statement-breakpoint
ALTER TABLE `registrations` ADD `schedule_id` text REFERENCES tournament_schedules(id);--> statement-breakpoint
CREATE INDEX `idx_registrations_section_id` ON `registrations` (`section_id`);--> statement-breakpoint
CREATE INDEX `idx_registrations_schedule_id` ON `registrations` (`schedule_id`);
