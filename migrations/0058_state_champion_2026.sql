-- 0058_state_champion_2026.sql
--
-- Hand-written migration (npm run db:generate -- <name> --custom), staged as
-- drizzle/0007_state_champion_2026.sql. drizzle/meta now records functions/db/schema.ts as it
-- is, so write the SQL that brings the database to match it. Triggers, data
-- changes and table rebuilds belong here; see migrations/README.md.
--
-- The 2026 Louisiana State Champion, Dr. Robert Forney, with the photo the
-- association supplied on Friday, October 23, 2026. Same fixed-id shape as
-- the 0056 import, so a second run adds nothing and an admin's later edit
-- to the row is kept.

INSERT OR IGNORE INTO state_champions (id, year, title, champion, notes, kind, photo_url) VALUES
  ('lca-state-2026-louisiana-state-champion-dr-robert-forney', 2026, 'Louisiana State Champion', 'Dr. Robert Forney', NULL, 'state', '/champions/photos/state-2026-dr-robert-forney.jpg');
