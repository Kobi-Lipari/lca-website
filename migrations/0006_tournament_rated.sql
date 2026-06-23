-- migrations/0006_tournament_rated.sql
ALTER TABLE tournaments ADD COLUMN is_rated INTEGER NOT NULL DEFAULT 1;