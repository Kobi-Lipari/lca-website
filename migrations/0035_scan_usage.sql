-- migrations/0035_scan_usage.sql
--
-- Per-member daily count of scoresheet scans.
--
-- Every scan is a paid call to the vision model on LCA's own API key, so a
-- member (or a stolen session) must not be able to run it in a loop. One row
-- per member per UTC day; the scan endpoint claims a slot with an upsert that
-- returns the new count, and hands the slot back if the model call fails, so
-- an outage does not eat anyone's allowance.
--
-- The images themselves are never stored. This table holds only counts.

CREATE TABLE IF NOT EXISTS scan_usage (
  member_id TEXT NOT NULL REFERENCES members(id),
  -- UTC calendar date, YYYY-MM-DD.
  day TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (member_id, day)
);
