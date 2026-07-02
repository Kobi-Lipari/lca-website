-- Migration 0014: Add clearinghouse table for Gulf South tournament data
-- and add registration_url, eligibility, organizer columns to tournaments

-- Add columns to existing tournaments table
ALTER TABLE tournaments ADD COLUMN registration_url TEXT DEFAULT NULL;
ALTER TABLE tournaments ADD COLUMN eligibility TEXT DEFAULT NULL;
ALTER TABLE tournaments ADD COLUMN organizer TEXT DEFAULT NULL;

-- Clearinghouse table for external/regional tournaments synced from Google Sheet
CREATE TABLE IF NOT EXISTS clearinghouse (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  start_date    TEXT NOT NULL,
  end_date      TEXT,
  organizer     TEXT,
  city          TEXT,
  state         TEXT,
  venue         TEXT,
  rating_system TEXT,
  eligibility   TEXT,
  contact       TEXT,
  link          TEXT,
  is_lca        INTEGER DEFAULT 0,
  synced_at     TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_clearinghouse_start_date ON clearinghouse(start_date);
CREATE INDEX IF NOT EXISTS idx_clearinghouse_state ON clearinghouse(state);