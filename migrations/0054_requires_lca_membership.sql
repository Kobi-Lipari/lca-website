-- 0054_requires_lca_membership.sql
--
-- Written by drizzle-kit from functions/db/schema.ts (npm run db:generate),
-- staged as drizzle/0003_requires_lca_membership.sql. The "--> statement-breakpoint" markers are
-- comments. Review it before committing; edit the schema and generate again
-- rather than editing this file.
--
-- Edited by hand after generating (see migrations/README.md): the UPDATE
-- below the generated ALTER is a data statement drizzle-kit cannot write.
--
-- requires_lca_membership: entering the event needs a current LCA
-- membership (domain/membership/requirement.ts). It is on for LCA-run
-- events. Club-run events (club_id set) start with it off, existing and new,
-- because clubs get tournament creation first, free of charge; the admin
-- create endpoint sets 0 for a new club-run event unless told otherwise.
--
-- The UPDATE changes nothing when run a second time straight after. It sets
-- every club-run event to 0, so it must not be run again by hand once a club
-- has switched the requirement on; wrangler runs each migration once.
-- tournaments.member_discount stays in the table, no longer read or written.

ALTER TABLE `tournaments` ADD `requires_lca_membership` integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
UPDATE `tournaments` SET `requires_lca_membership` = 0 WHERE `club_id` IS NOT NULL AND `requires_lca_membership` <> 0;
