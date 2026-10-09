-- drizzle-kit 0.31.11 output for a column added with a foreign key
-- (clubs.featured_tournament_id -> tournaments.id, onDelete: 'cascade').
-- drizzle-kit leaves out the ON DELETE clause here although its snapshot
-- records it (db:generate refuses that); ' ON DELETE cascade' is what a
-- person writes back by hand. Everything else is as generated.
ALTER TABLE `clubs` ADD `featured_tournament_id` text REFERENCES tournaments(id) ON DELETE cascade;