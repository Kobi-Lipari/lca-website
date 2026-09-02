-- scripts/bootstrap-d1-migrations.sql
--
-- ONE-OFF REPAIR. Not a migration — deliberately kept out of migrations/ so
-- `wrangler d1 migrations apply` never picks it up.
--
-- Why this exists: migrations 0001-0020 were applied through wrangler's
-- migration system, which records each one in d1_migrations. From 0021
-- onwards they were applied by hand with `d1 execute --file=...`, which
-- records nothing. The schema was correct but the ledger was ten entries
-- short, so wrangler believed 0021-0029 still needed applying and
-- `migrations apply` would have tried to re-run them — erroring on
-- duplicate columns, and re-running 0028's data fixes.
--
-- INSERT OR IGNORE means already-recorded migrations are left alone, so
-- this is safe to run more than once and safe on a database that is already
-- correct. It writes nothing outside d1_migrations.
--
-- Both local and remote have been repaired with this; it is kept for
-- reference and in case another environment drifts the same way. Normal
-- work should use `npm run db:migrate:local` / `db:migrate:remote`, which
-- keep the ledger updated automatically.

CREATE TABLE IF NOT EXISTS d1_migrations(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE,
  applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0001_schema.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0002_seed.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0003_roles_and_directors.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0004_uscf_rating.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0005_email_registration_support.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0006_tournament_rated.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0007_visibility_byes.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0008_time_control.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0009_club_colors.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0010_club_image_url.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0011_governance.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0012_club_region.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0013_real_clubs.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0014_clearinghouse.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0015_governance_content.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0016_stripe_payment_tracking.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0017_registration_withdrawal.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0018_registration_checkin.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0019_widen_checks.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0020_membership_type.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0021_email_campaigns.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0022_site_announcement.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0022_tournament_reminders_registration_notified.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0023_facebook_feed_cache.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0024_impersonation_log.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0025_board_seats.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0026_ticket_notes.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0027_shared_seats.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0028_fix_seat_slugs_categories.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0029_admin_audit_log.sql');
