-- 0073_seat_listing.sql
--
-- Written by drizzle-kit from functions/db/schema.ts (npm run db:generate),
-- staged as drizzle/0017_seat_listing.sql. The "--> statement-breakpoint" markers are
-- comments. Review it before committing; edit the schema and generate again
-- rather than editing this file.
--
-- Edited by hand after generating (see migrations/README.md): the UPDATE
-- below the generated ALTER is a data statement drizzle-kit cannot write.
--
-- is_listed: whether a board seat is shown publicly. A seat with 0 is left
-- out of every public read (GET /api/board/seats, GET /api/governance/board
-- and the contact form's seat lookup in functions/utils/admin/tickets.ts),
-- while its holder keeps everything the seat gives (my-seats, the Board
-- inbox, the media manager's sending). Every seat starts listed.
--
-- The Media manager seat is not to be shown publicly, so it starts at 0.
-- The UPDATE does not touch is_active: this file reaches the live database
-- a few minutes before the pages that read is_listed, and a seat made
-- active in that gap would be shown by the pages still live. An admin
-- brings the seat back in Admin once the new pages are live. The UPDATE
-- changes nothing when run a second time straight after.

ALTER TABLE `board_members` ADD `is_listed` integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
UPDATE `board_members` SET `is_listed` = 0 WHERE `slug` = 'media-manager' AND `is_listed` <> 0;
