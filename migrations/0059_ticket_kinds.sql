-- 0059_ticket_kinds.sql
--
-- Written by drizzle-kit from functions/db/schema.ts (npm run db:generate),
-- staged as drizzle/0008_ticket_kinds.sql. The "--> statement-breakpoint" markers are
-- comments. Review it before committing; edit the schema and generate again
-- rather than editing this file.
--
-- Comments added by hand; the statements are drizzle-kit's, unedited.
-- kind: NULL for an ordinary ticket, else 'listing_report', 'event_report'
-- or 'payout_request'. about_id: the clearinghouse listing or the
-- tournament the ticket is about. review_notified_at: the D22 notice went
-- at this event's first publish; it is sent only while NULL.

ALTER TABLE `support_tickets` ADD `kind` text;--> statement-breakpoint
ALTER TABLE `support_tickets` ADD `about_id` text;--> statement-breakpoint
ALTER TABLE `tournaments` ADD `review_notified_at` text;
