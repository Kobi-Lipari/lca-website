-- migrations/0007_visibility_byes.sql
ALTER TABLE tournaments ADD COLUMN is_visible INTEGER NOT NULL DEFAULT 1;
ALTER TABLE tournaments ADD COLUMN round_schedule TEXT;
ALTER TABLE tournaments ADD COLUMN registration_closes_at TEXT;
ALTER TABLE tournaments ADD COLUMN custom_details TEXT;
ALTER TABLE registrations ADD COLUMN bye_rounds TEXT;