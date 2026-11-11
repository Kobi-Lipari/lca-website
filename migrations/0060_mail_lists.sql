-- 0060_mail_lists.sql
--
-- Written by drizzle-kit from functions/db/schema.ts (npm run db:generate),
-- staged as drizzle/0009_mail_lists.sql. The "--> statement-breakpoint" markers are
-- comments. Review it before committing; edit the schema and generate again
-- rather than editing this file.
--
-- Edited by hand after generating (see migrations/README.md): the INSERT at
-- the end is a data statement drizzle-kit cannot write. It writes LCA's two
-- lists, and it is safe to run twice: INSERT OR IGNORE leaves a list whose
-- id is there already as it is.
--
-- WS16's mail tables (functions/db/schema.ts says what each column holds):
-- mail_lists, the lists people can be on, each marked whether it is one of
-- LCA's main mailers; mail_contacts, one row per address, a member's or not,
-- with the person's own stop-all mark and a spam report's mark kept apart;
-- mail_list_choices, each person's 'in' or 'out' on a list; mail_do_not_send,
-- the dead addresses, to which all mail stops. The four columns on the two
-- campaign tables are for the mail engine's rules (WS16 step 4). No CHECK is
-- written and no table is rebuilt.

CREATE TABLE `mail_contacts` (
	`id` text PRIMARY KEY NOT NULL,
	`address` text NOT NULL,
	`optional_off_at` text,
	`complained_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mail_contacts_address_unique` ON `mail_contacts` (`address`);--> statement-breakpoint
CREATE TABLE `mail_do_not_send` (
	`address` text PRIMARY KEY NOT NULL,
	`reason` text NOT NULL,
	`detail` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `mail_list_choices` (
	`contact_id` text NOT NULL,
	`list_id` text NOT NULL,
	`choice` text NOT NULL,
	`source` text NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	PRIMARY KEY(`contact_id`, `list_id`),
	FOREIGN KEY (`contact_id`) REFERENCES `mail_contacts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`list_id`) REFERENCES `mail_lists`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `mail_list_choices_list` ON `mail_list_choices` (`list_id`,`choice`);--> statement-breakpoint
CREATE TABLE `mail_lists` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`main_mailer` integer DEFAULT 0 NOT NULL,
	`club_id` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`club_id`) REFERENCES `clubs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `email_campaign_recipients` ADD `contact_id` text;--> statement-breakpoint
ALTER TABLE `email_campaign_recipients` ADD `sending_at` text;--> statement-breakpoint
ALTER TABLE `email_campaigns` ADD `list_id` text;--> statement-breakpoint
ALTER TABLE `email_campaigns` ADD `skipped_count` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
INSERT OR IGNORE INTO `mail_lists` (`id`, `kind`, `name`, `main_mailer`) VALUES ('lca-newsletter', 'newsletter', 'LCA newsletter', 1), ('lca-tournaments', 'tournaments', 'LCA tournament email', 1);
