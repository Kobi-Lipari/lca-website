-- drizzle-kit 0.31.11 output, unedited: changing tournaments.club_id to
-- onDelete: 'set null' makes drizzle-kit rebuild tournaments (copy into
-- __new_tournaments, DROP TABLE, rename). Every table that cascades from
-- tournaments would lose its rows on D1.
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_tournaments` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`location` text NOT NULL,
	`venue` text,
	`date` text NOT NULL,
	`end_date` text,
	`entry_fee` real DEFAULT 0 NOT NULL,
	`sections` text DEFAULT '[]' NOT NULL,
	`rounds` integer DEFAULT 4 NOT NULL,
	`max_players` integer,
	`status` text DEFAULT 'upcoming' NOT NULL,
	`description` text,
	`registration_deadline` text,
	`club_id` text,
	`created_by` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`registration_status` text DEFAULT 'draft' NOT NULL,
	`registration_opens_at` text,
	`reminder_1_days_before` integer DEFAULT 7,
	`reminder_1_enabled` integer DEFAULT 1,
	`reminder_2_days_before` integer DEFAULT 1,
	`reminder_2_enabled` integer DEFAULT 1,
	`is_rated` integer DEFAULT 1 NOT NULL,
	`is_visible` integer DEFAULT 1 NOT NULL,
	`round_schedule` text,
	`registration_closes_at` text,
	`custom_details` text,
	`time_control` text,
	`registration_url` text DEFAULT (NULL),
	`eligibility` text DEFAULT (NULL),
	`organizer` text DEFAULT (NULL),
	`pairing_system` text DEFAULT 'uscf' NOT NULL,
	`early_deadline` text,
	`early_discount` real DEFAULT 0 NOT NULL,
	`late_after` text,
	`late_fee` real DEFAULT 0 NOT NULL,
	`member_discount` real DEFAULT 0 NOT NULL,
	`accelerated` integer DEFAULT 0 NOT NULL,
	`keep_apart` text DEFAULT 'family' NOT NULL,
	`report_settings` text,
	`is_state_championship` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`club_id`) REFERENCES `clubs`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_tournaments`("id", "name", "location", "venue", "date", "end_date", "entry_fee", "sections", "rounds", "max_players", "status", "description", "registration_deadline", "club_id", "created_by", "created_at", "registration_status", "registration_opens_at", "reminder_1_days_before", "reminder_1_enabled", "reminder_2_days_before", "reminder_2_enabled", "is_rated", "is_visible", "round_schedule", "registration_closes_at", "custom_details", "time_control", "registration_url", "eligibility", "organizer", "pairing_system", "early_deadline", "early_discount", "late_after", "late_fee", "member_discount", "accelerated", "keep_apart", "report_settings", "is_state_championship") SELECT "id", "name", "location", "venue", "date", "end_date", "entry_fee", "sections", "rounds", "max_players", "status", "description", "registration_deadline", "club_id", "created_by", "created_at", "registration_status", "registration_opens_at", "reminder_1_days_before", "reminder_1_enabled", "reminder_2_days_before", "reminder_2_enabled", "is_rated", "is_visible", "round_schedule", "registration_closes_at", "custom_details", "time_control", "registration_url", "eligibility", "organizer", "pairing_system", "early_deadline", "early_discount", "late_after", "late_fee", "member_discount", "accelerated", "keep_apart", "report_settings", "is_state_championship" FROM `tournaments`;--> statement-breakpoint
DROP TABLE `tournaments`;--> statement-breakpoint
ALTER TABLE `__new_tournaments` RENAME TO `tournaments`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_tournaments_club_id` ON `tournaments` (`club_id`);--> statement-breakpoint
CREATE INDEX `idx_tournaments_status` ON `tournaments` (`status`);