-- migrations/0036_scan_games.sql
--
-- The scanner's daily limit counts games, not photos.
--
-- A long game runs onto the back of the sheet or a second sheet, and each
-- page is its own read. Counting photos meant a three-page game used three
-- of a member's scans; the limit is meant to be "N games a day". So each
-- game gets an id from the page that scans it, every page of that game
-- carries the id, and a member's allowance is the number of distinct games
-- started that day. Pages per game are capped separately.
--
-- day is the Louisiana (America/Chicago) date the game was started on, so
-- the allowance resets at local midnight. A game whose pages straddle
-- midnight stays counted on the day it began.
--
-- Images are never stored. This table holds only counts.

CREATE TABLE IF NOT EXISTS scan_games (
  member_id TEXT NOT NULL REFERENCES members(id),
  game_id TEXT NOT NULL,
  day TEXT NOT NULL,
  pages INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (member_id, game_id)
);

-- The allowance check: games per member per day.
CREATE INDEX IF NOT EXISTS idx_scan_games_member_day ON scan_games(member_id, day);

-- Replaced by scan_games. It only ever held per-day photo counts.
DROP TABLE IF EXISTS scan_usage;
