-- drizzle-kit 0.31.11 output, unedited: a new table with a foreign key
-- (tournament_notes.tournament_id -> tournaments.id, onDelete: 'cascade').
CREATE TABLE `tournament_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`tournament_id` text NOT NULL,
	`body` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`tournament_id`) REFERENCES `tournaments`(`id`) ON UPDATE no action ON DELETE cascade
);
