-- 0071_rate_limits.sql
--
-- Written by drizzle-kit from functions/db/schema.ts (npm run db:generate),
-- staged as drizzle/0016_rate_limits.sql. The "--> statement-breakpoint" markers are
-- comments. Review it before committing; edit the schema and generate again
-- rather than editing this file.
--
-- The paragraph below was added by hand after generating; the statement is
-- drizzle-kit's as it wrote it.
--
-- WS09 step 25, the shared rate limit behind functions/utils/rateLimit.ts,
-- built early under the brief's names (its live-mode section writes the
-- table): one row for each route, place and hour. bucket is a keyed hash of
-- the route, the visitor's network address (or the member's id) and the
-- hour, so no address is stored; hits counts the calls in the hour, and
-- window_start is the hour's start in UTC. No table references it and it
-- references none. The statement adds; no table is rebuilt and no row is
-- changed.

CREATE TABLE `rate_limits` (
	`bucket` text PRIMARY KEY NOT NULL,
	`hits` integer NOT NULL,
	`window_start` text NOT NULL
);
