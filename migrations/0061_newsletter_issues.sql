-- 0061_newsletter_issues.sql
--
-- Written by drizzle-kit from functions/db/schema.ts (npm run db:generate),
-- staged as drizzle/0010_newsletter_issues.sql. The "--> statement-breakpoint" markers are
-- comments. Review it before committing; edit the schema and generate again
-- rather than editing this file.

CREATE TABLE `newsletter_issues` (
	`id` text PRIMARY KEY NOT NULL,
	`list_id` text NOT NULL,
	`month_label` text DEFAULT '' NOT NULL,
	`subject` text DEFAULT '' NOT NULL,
	`preheader` text DEFAULT '' NOT NULL,
	`body_html` text DEFAULT '' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_by` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_by` text,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	`campaign_id` text,
	`set_aside_at` text,
	`send_at` text,
	`scheduled_by` text,
	`scheduled_at` text,
	`link_check` text,
	`held_reason` text,
	`pinned_at` text,
	`pinned_name` text,
	FOREIGN KEY (`created_by`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`updated_by`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`scheduled_by`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `newsletter_issues_one_open` ON `newsletter_issues` (`list_id`) WHERE campaign_id IS NULL AND set_aside_at IS NULL;
