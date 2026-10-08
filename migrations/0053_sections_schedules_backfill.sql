-- 0053_sections_schedules_backfill.sql
--
-- Hand-written migration (npm run db:generate -- <name> --custom), staged as
-- drizzle/0002_sections_schedules_backfill.sql. drizzle/meta now records functions/db/schema.ts as it
-- is, so write the SQL that brings the database to match it. Triggers, data
-- changes and table rebuilds belong here; see migrations/README.md.
--
-- Fills the tables 0052 created from the JSON columns, and keeps them filled
-- while the code still writes only tournaments.sections and
-- tournaments.round_schedule. The JSON columns stay, and stay authoritative.
-- Safe to run again: a second run adds and changes nothing.
--
-- Four triggers, created first so nothing written while this runs is missed:
--
-- - tournaments_sections_sync_update (UPDATE OF sections, round_schedule):
--   1. archives live section rows whose names left a valid array
--   2. brings back the latest archived row of a name that returns, so old
--      entries under that name stay with it
--   3. adds a row for each new name; for a name given twice the first wins
--   4. copies the JSON-shaped columns of every live row from the JSON by
--      name: position, fee_regular (entryFee when it is a number, else null,
--      meaning the tournament's entry_fee), prize_fund, the rating and grade
--      limits, unrated_ok, rules_set, prizes_json, and extra_json for any
--      other key or a known key of an unexpected type. It never touches cap,
--      fee_early, fee_late or any id, so it agrees with the single writer of
--      step 9, which writes the rows first and the JSON last.
--   5. makes sure the tournament has a live primary schedule
--   6. when round_schedule changed and is null (SQL NULL or JSON 'null') or a
--      valid array, replaces the primary schedule's rounds (a round given
--      twice keeps the first);
--      it also fills a primary schedule that has no rounds yet
--   7. gives every entry of the tournament without section_id the section
--      of its name, and every entry without schedule_id the primary schedule
-- - tournaments_sections_sync_insert: a new tournament runs the same sync.
-- - registrations_fill_section_insert: a new entry without section_id gets
--   the section of its name, and one without schedule_id the primary.
-- - registrations_fill_section_update: when an entry's section name changes
--   and section_id does not, section_id follows the name (a writer that sets
--   section_id itself wins).
--
-- "The section of its name" is the live row of that name, else the latest
-- archived one; when there is none an archived row is created, so section_id
-- is never left null. Names are matched exactly as stored, without trimming,
-- because the code matches entries to sections with ===.
--
-- Every json_each reads its column through json_valid and json_type =
-- 'array', so malformed JSON gives no rows instead of an error, and archives
-- or replaces nothing. A plain string element is a section name. No row is
-- deleted, except a primary schedule's rounds when round_schedule changes.
--
-- The backfill then runs the sync once for every tournament (an UPDATE that
-- sets sections to itself), and adds an archived row for each name a game
-- uses that has none. tournament_games keeps its names; a section_id there
-- is a WS07 follow-up.

CREATE TRIGGER IF NOT EXISTS registrations_fill_section_insert
AFTER INSERT ON registrations
WHEN NEW.section_id IS NULL OR NEW.schedule_id IS NULL
BEGIN
  INSERT INTO tournament_sections (tournament_id, name, archived_at)
  SELECT NEW.tournament_id, NEW.section, datetime('now')
  WHERE NEW.section_id IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM tournament_sections s
      WHERE s.tournament_id = NEW.tournament_id AND s.name = NEW.section
    );

  INSERT INTO tournament_schedules (tournament_id, is_primary)
  SELECT NEW.tournament_id, 1
  WHERE NEW.schedule_id IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM tournament_schedules p
      WHERE p.tournament_id = NEW.tournament_id AND p.is_primary = 1 AND p.archived_at IS NULL
    );

  UPDATE registrations
  SET
    section_id = COALESCE(section_id, (
      SELECT s.id FROM tournament_sections s
      WHERE s.tournament_id = NEW.tournament_id AND s.name = NEW.section
      ORDER BY s.archived_at IS NOT NULL, s.archived_at DESC, s.rowid DESC
      LIMIT 1
    )),
    schedule_id = COALESCE(schedule_id, (
      SELECT p.id FROM tournament_schedules p
      WHERE p.tournament_id = NEW.tournament_id AND p.is_primary = 1 AND p.archived_at IS NULL
    ))
  WHERE rowid = NEW.rowid;
END;

CREATE TRIGGER IF NOT EXISTS registrations_fill_section_update
AFTER UPDATE OF section ON registrations
WHEN NEW.section IS NOT OLD.section AND NEW.section_id IS OLD.section_id
BEGIN
  INSERT INTO tournament_sections (tournament_id, name, archived_at)
  SELECT NEW.tournament_id, NEW.section, datetime('now')
  WHERE NOT EXISTS (
    SELECT 1 FROM tournament_sections s
    WHERE s.tournament_id = NEW.tournament_id AND s.name = NEW.section
  );

  UPDATE registrations
  SET section_id = (
    SELECT s.id FROM tournament_sections s
    WHERE s.tournament_id = NEW.tournament_id AND s.name = NEW.section
    ORDER BY s.archived_at IS NOT NULL, s.archived_at DESC, s.rowid DESC
    LIMIT 1
  )
  WHERE rowid = NEW.rowid;
END;

CREATE TRIGGER IF NOT EXISTS tournaments_sections_sync_update
AFTER UPDATE OF sections, round_schedule ON tournaments
BEGIN
  -- 1. Archive live rows whose names left a valid array.
  UPDATE tournament_sections
  SET archived_at = datetime('now')
  WHERE tournament_id = NEW.id
    AND archived_at IS NULL
    AND CASE WHEN json_valid(NEW.sections) THEN json_type(NEW.sections) = 'array' ELSE 0 END
    AND name NOT IN (
      SELECT n FROM (
        SELECT CASE e.type
          WHEN 'text' THEN e.value
          WHEN 'object' THEN CASE WHEN json_type(e.value, '$.name') = 'text' THEN json_extract(e.value, '$.name') END
        END AS n
        FROM json_each(CASE WHEN json_valid(NEW.sections) THEN CASE WHEN json_type(NEW.sections) = 'array' THEN NEW.sections END END) e
      )
      WHERE n IS NOT NULL AND n <> ''
    );

  -- 2. Bring back the latest archived row of a name that returns.
  UPDATE tournament_sections
  SET archived_at = NULL
  WHERE tournament_id = NEW.id
    AND archived_at IS NOT NULL
    AND name IN (
      SELECT n FROM (
        SELECT CASE e.type
          WHEN 'text' THEN e.value
          WHEN 'object' THEN CASE WHEN json_type(e.value, '$.name') = 'text' THEN json_extract(e.value, '$.name') END
        END AS n
        FROM json_each(CASE WHEN json_valid(NEW.sections) THEN CASE WHEN json_type(NEW.sections) = 'array' THEN NEW.sections END END) e
      )
      WHERE n IS NOT NULL AND n <> ''
    )
    AND NOT EXISTS (
      SELECT 1 FROM tournament_sections l
      WHERE l.tournament_id = NEW.id AND l.name = tournament_sections.name AND l.archived_at IS NULL
    )
    AND rowid = (
      SELECT a.rowid FROM tournament_sections a
      WHERE a.tournament_id = NEW.id AND a.name = tournament_sections.name AND a.archived_at IS NOT NULL
      ORDER BY a.archived_at DESC, a.rowid DESC
      LIMIT 1
    );

  -- 3. A row for each new name, at its first position.
  INSERT OR IGNORE INTO tournament_sections (tournament_id, name, position)
  SELECT NEW.id, n, MIN(k)
  FROM (
    SELECT e.key AS k, CASE e.type
      WHEN 'text' THEN e.value
      WHEN 'object' THEN CASE WHEN json_type(e.value, '$.name') = 'text' THEN json_extract(e.value, '$.name') END
    END AS n
    FROM json_each(CASE WHEN json_valid(NEW.sections) THEN CASE WHEN json_type(NEW.sections) = 'array' THEN NEW.sections END END) e
  )
  WHERE n IS NOT NULL AND n <> ''
    AND NOT EXISTS (
      SELECT 1 FROM tournament_sections s
      WHERE s.tournament_id = NEW.id AND s.name = n AND s.archived_at IS NULL
    )
  GROUP BY n;

  -- 4. The JSON-shaped columns of each live row, from the first element of
  --    its name. A key is removed from extra_json when its column took it;
  --    '$.name' stands in for a key that stays (it is removed anyway).
  UPDATE tournament_sections
  SET (position, fee_regular, prize_fund, rating_min, rating_max, unrated_ok, grade_min, grade_max, rules_set, prizes_json, extra_json) = (
    SELECT
      j.k,
      CASE WHEN json_type(j.obj, '$.entryFee') IN ('integer', 'real') THEN json_extract(j.obj, '$.entryFee') END,
      CASE WHEN json_type(j.obj, '$.prizeFund') = 'text' THEN json_extract(j.obj, '$.prizeFund') END,
      CASE WHEN json_type(j.obj, '$.ratingMin') IN ('integer', 'real') THEN json_extract(j.obj, '$.ratingMin') END,
      CASE WHEN json_type(j.obj, '$.ratingMax') IN ('integer', 'real') THEN json_extract(j.obj, '$.ratingMax') END,
      CASE json_type(j.obj, '$.unratedOk') WHEN 'true' THEN 1 WHEN 'false' THEN 0 END,
      CASE WHEN json_type(j.obj, '$.gradeMin') IN ('integer', 'real') THEN json_extract(j.obj, '$.gradeMin') END,
      CASE WHEN json_type(j.obj, '$.gradeMax') IN ('integer', 'real') THEN json_extract(j.obj, '$.gradeMax') END,
      CASE json_type(j.obj, '$.rulesSet') WHEN 'true' THEN 1 ELSE 0 END,
      CASE WHEN json_type(j.obj, '$.prizes') IN ('object', 'array') THEN json_extract(j.obj, '$.prizes') END,
      NULLIF(json_remove(j.obj,
        '$.name',
        CASE WHEN json_type(j.obj, '$.entryFee') IN ('integer', 'real', 'null') THEN '$.entryFee' ELSE '$.name' END,
        CASE WHEN json_type(j.obj, '$.prizeFund') IN ('text', 'null') THEN '$.prizeFund' ELSE '$.name' END,
        CASE WHEN json_type(j.obj, '$.ratingMin') IN ('integer', 'real', 'null') THEN '$.ratingMin' ELSE '$.name' END,
        CASE WHEN json_type(j.obj, '$.ratingMax') IN ('integer', 'real', 'null') THEN '$.ratingMax' ELSE '$.name' END,
        CASE WHEN json_type(j.obj, '$.unratedOk') IN ('true', 'false', 'null') THEN '$.unratedOk' ELSE '$.name' END,
        CASE WHEN json_type(j.obj, '$.gradeMin') IN ('integer', 'real', 'null') THEN '$.gradeMin' ELSE '$.name' END,
        CASE WHEN json_type(j.obj, '$.gradeMax') IN ('integer', 'real', 'null') THEN '$.gradeMax' ELSE '$.name' END,
        CASE WHEN json_type(j.obj, '$.rulesSet') IN ('true', 'false', 'null') THEN '$.rulesSet' ELSE '$.name' END,
        CASE WHEN json_type(j.obj, '$.prizes') IN ('object', 'array', 'null') THEN '$.prizes' ELSE '$.name' END
      ), '{}')
    FROM (
      SELECT
        e.key AS k,
        CASE e.type
          WHEN 'text' THEN e.value
          WHEN 'object' THEN CASE WHEN json_type(e.value, '$.name') = 'text' THEN json_extract(e.value, '$.name') END
        END AS n,
        CASE e.type WHEN 'object' THEN e.value ELSE '{}' END AS obj
      FROM json_each(CASE WHEN json_valid(NEW.sections) THEN CASE WHEN json_type(NEW.sections) = 'array' THEN NEW.sections END END) e
    ) j
    WHERE j.n = tournament_sections.name
    ORDER BY j.k
    LIMIT 1
  )
  WHERE tournament_id = NEW.id
    AND archived_at IS NULL
    AND name IN (
      SELECT n FROM (
        SELECT CASE e.type
          WHEN 'text' THEN e.value
          WHEN 'object' THEN CASE WHEN json_type(e.value, '$.name') = 'text' THEN json_extract(e.value, '$.name') END
        END AS n
        FROM json_each(CASE WHEN json_valid(NEW.sections) THEN CASE WHEN json_type(NEW.sections) = 'array' THEN NEW.sections END END) e
      )
      WHERE n IS NOT NULL AND n <> ''
    );

  -- 5. One live primary schedule.
  INSERT INTO tournament_schedules (tournament_id, is_primary)
  SELECT NEW.id, 1
  WHERE NOT EXISTS (
    SELECT 1 FROM tournament_schedules p
    WHERE p.tournament_id = NEW.id AND p.is_primary = 1 AND p.archived_at IS NULL
  );

  -- 6. A changed round_schedule that is null (SQL NULL or the JSON text
  --    'null', which the admin PATCH stores for roundSchedule: null) or a
  --    valid array replaces the primary rounds; anything else leaves them
  --    as they are.
  DELETE FROM tournament_schedule_rounds
  WHERE NEW.round_schedule IS NOT OLD.round_schedule
    AND CASE
      WHEN NEW.round_schedule IS NULL THEN 1
      WHEN json_valid(NEW.round_schedule) THEN json_type(NEW.round_schedule) IN ('array', 'null')
      ELSE 0
    END
    AND schedule_id IN (
      SELECT p.id FROM tournament_schedules p
      WHERE p.tournament_id = NEW.id AND p.is_primary = 1 AND p.archived_at IS NULL
    );

  INSERT OR IGNORE INTO tournament_schedule_rounds (schedule_id, round, date, time)
  SELECT p.id, r.round, r.date, r.time
  FROM tournament_schedules p,
    (
      -- With a single MIN(), SQLite takes date and time from that same
      -- element, so a round given twice keeps its first entry.
      SELECT round, date, time, MIN(k) AS first
      FROM (
        SELECT
          e.key AS k,
          CASE WHEN e.type = 'object' THEN
            CASE json_type(e.value, '$.round')
              WHEN 'integer' THEN json_extract(e.value, '$.round')
              WHEN 'real' THEN CAST(json_extract(e.value, '$.round') AS INTEGER)
              WHEN 'text' THEN CAST(json_extract(e.value, '$.round') AS INTEGER)
            END
          END AS round,
          CASE WHEN e.type = 'object' THEN CASE WHEN json_type(e.value, '$.date') = 'text' THEN json_extract(e.value, '$.date') END END AS date,
          CASE WHEN e.type = 'object' THEN CASE WHEN json_type(e.value, '$.time') = 'text' THEN json_extract(e.value, '$.time') END END AS time
        FROM json_each(CASE WHEN json_valid(NEW.round_schedule) THEN CASE WHEN json_type(NEW.round_schedule) = 'array' THEN NEW.round_schedule END END) e
      )
      WHERE round >= 1
      GROUP BY round
    ) r
  WHERE p.tournament_id = NEW.id AND p.is_primary = 1 AND p.archived_at IS NULL
    AND (
      NEW.round_schedule IS NOT OLD.round_schedule
      OR NOT EXISTS (SELECT 1 FROM tournament_schedule_rounds x WHERE x.schedule_id = p.id)
    )
    AND NOT EXISTS (SELECT 1 FROM tournament_schedule_rounds x WHERE x.schedule_id = p.id AND x.round = r.round);

  -- 7. section_id and schedule_id on every entry of the tournament.
  INSERT INTO tournament_sections (tournament_id, name, archived_at)
  SELECT DISTINCT r.tournament_id, r.section, datetime('now')
  FROM registrations r
  WHERE r.tournament_id = NEW.id
    AND r.section_id IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM tournament_sections s
      WHERE s.tournament_id = NEW.id AND s.name = r.section
    );

  UPDATE registrations
  SET section_id = (
    SELECT s.id FROM tournament_sections s
    WHERE s.tournament_id = NEW.id AND s.name = registrations.section
    ORDER BY s.archived_at IS NOT NULL, s.archived_at DESC, s.rowid DESC
    LIMIT 1
  )
  WHERE tournament_id = NEW.id AND section_id IS NULL;

  UPDATE registrations
  SET schedule_id = (
    SELECT p.id FROM tournament_schedules p
    WHERE p.tournament_id = NEW.id AND p.is_primary = 1 AND p.archived_at IS NULL
  )
  WHERE tournament_id = NEW.id AND schedule_id IS NULL;
END;

-- A new tournament runs the same sync: setting sections to the value just
-- inserted fires tournaments_sections_sync_update for this row (a different
-- trigger, so it fires with recursive triggers off, as on D1).
CREATE TRIGGER IF NOT EXISTS tournaments_sections_sync_insert
AFTER INSERT ON tournaments
BEGIN
  UPDATE tournaments SET sections = NEW.sections WHERE id = NEW.id;
END;

-- ---- Backfill ----

-- Every tournament through the sync once. Nothing in the row changes.
UPDATE tournaments SET sections = sections;

-- Names games use that no row has.
INSERT INTO tournament_sections (tournament_id, name, archived_at)
SELECT DISTINCT g.tournament_id, g.section, datetime('now')
FROM tournament_games g
WHERE EXISTS (SELECT 1 FROM tournaments t WHERE t.id = g.tournament_id)
  AND NOT EXISTS (
    SELECT 1 FROM tournament_sections s
    WHERE s.tournament_id = g.tournament_id AND s.name = g.section
  );
