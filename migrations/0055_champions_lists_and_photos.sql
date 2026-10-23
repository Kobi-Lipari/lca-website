-- 0055_champions_lists_and_photos.sql
--
-- Written by drizzle-kit from functions/db/schema.ts (npm run db:generate),
-- staged as drizzle/0004_champions_lists_and_photos.sql. The "--> statement-breakpoint" markers are
-- comments. Edited by hand after generating: the UPDATE at the end puts the
-- rows already entered under a scholastic title on the scholastic list, so
-- the public page sorts them right from the first load. Safe to run twice.

ALTER TABLE `state_champions` ADD `kind` text DEFAULT 'state' NOT NULL;--> statement-breakpoint
ALTER TABLE `state_champions` ADD `photo_url` text;--> statement-breakpoint
UPDATE state_champions SET kind = 'scholastic' WHERE kind = 'state' AND lower(title) LIKE '%scholastic%';
