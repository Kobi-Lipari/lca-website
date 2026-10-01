-- 0049_state_champions.sql
--
-- State champions: the LCA's honor roll, by year and title (Louisiana
-- State Champion, State Scholastic K-12, ...). Entered by admins; a row can
-- point at the site event it was won at.
--
-- tournaments.is_state_championship marks an event as a state
-- championship, so it's badged and listed on the champions page.

CREATE TABLE IF NOT EXISTS state_champions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  year INTEGER NOT NULL,
  title TEXT NOT NULL,
  champion TEXT NOT NULL,
  notes TEXT,
  tournament_id TEXT REFERENCES tournaments(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_state_champions_year ON state_champions(year DESC, title);

ALTER TABLE tournaments ADD COLUMN is_state_championship INTEGER NOT NULL DEFAULT 0;
