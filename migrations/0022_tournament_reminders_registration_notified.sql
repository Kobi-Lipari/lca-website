-- migrations/0022_tournament_reminders_registration_notified.sql
--

ALTER TABLE tournament_reminders ADD COLUMN registration_opened_notified_at TEXT;