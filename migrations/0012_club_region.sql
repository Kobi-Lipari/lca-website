-- Migration 0012: Add region column to clubs table
ALTER TABLE clubs ADD COLUMN region TEXT DEFAULT NULL;