-- 0072_regions_by_seat.sql
--
-- Hand-written data migration. No table, column, index or trigger changes,
-- so functions/db/schema.ts and drizzle/meta are untouched and the file was
-- written without db:generate.
--
-- What it does: the club regions become the titles of the five regional
-- representatives' seats (New Orleans Metro, Baton Rouge / East Central,
-- Lafayette / South Central, Lake Charles / Southwestern, North Louisiana),
-- the list in domain/clubs/regions.ts. It rewrites every club's region by
-- its old region and its town (clubs.city), then the region on each club
-- report, then the regions each regional seat covers.
--
-- Why: K asked for it in decision 14 of Wednesday, November 18, 2026: the
-- regions should line up with the regional representatives' seats, and the
-- clubs go into them. Where each club goes is a best guess by the nearest
-- seat's city, for K to correct: an LCA admin can change any club's region
-- in the club's editor, and a seat's regions on the Board seats page.
--
-- The rules, in order (a town's rule comes before its old region's last
-- rule, so a club of a town not named here still lands in one of the five):
--   South Central Louisiana: Baton Rouge and Gonzales to Baton Rouge / East
--     Central; every other town to Lafayette / South Central.
--   Bayou Region: Houma to New Orleans Metro; every other town to
--     Lafayette / South Central.
--   Southwest Louisiana: to Lake Charles / Southwestern.
--   North of Lake Pontchartrain: to New Orleans Metro.
--   Central Louisiana: to Lafayette / South Central.
--   New Orleans Metro and North Louisiana stay. A club with no region keeps
--   none.
-- A club report with a club takes its club's region; one with no club and
-- an old region takes that old region's last rule. Each regional seat whose
-- title begins with one of the five names covers that one region alone; any
-- other seat covers none. Every statement is safe to run again: a second run
-- changes no row.
--
-- The way back: reverting the code brings the seven names back to the list
-- but not to the rows. The reverse table, by region and town, is in the
-- WS09 section of REDESIGN_STATUS.md ("WS09 aside: the regions by the five
-- seats"). A club K has moved by hand since is K's own choice. That table
-- puts back only the towns it names; for every other club the faithful way
-- back is D1's restore point from just before this file ran (see Recovering
-- data in migrations/README.md).

-- Clubs.
UPDATE clubs SET region = 'Baton Rouge / East Central'
 WHERE region = 'South Central Louisiana' AND city IN ('Baton Rouge', 'Gonzales');

UPDATE clubs SET region = 'Lafayette / South Central'
 WHERE region = 'South Central Louisiana';

UPDATE clubs SET region = 'New Orleans Metro'
 WHERE region = 'Bayou Region' AND city = 'Houma';

UPDATE clubs SET region = 'Lafayette / South Central'
 WHERE region = 'Bayou Region';

UPDATE clubs SET region = 'Lake Charles / Southwestern'
 WHERE region = 'Southwest Louisiana';

UPDATE clubs SET region = 'New Orleans Metro'
 WHERE region = 'North of Lake Pontchartrain';

UPDATE clubs SET region = 'Lafayette / South Central'
 WHERE region = 'Central Louisiana';

-- Club reports: a report on a club takes the club's region as it now is.
UPDATE club_reports
   SET region = (SELECT c.region FROM clubs c WHERE c.id = club_reports.club_id)
 WHERE club_id IS NOT NULL
   AND region IS NOT (SELECT c.region FROM clubs c WHERE c.id = club_reports.club_id);

-- Club reports with no club: each old region's last rule.
UPDATE club_reports SET region = 'Lafayette / South Central'
 WHERE club_id IS NULL AND region = 'South Central Louisiana';

UPDATE club_reports SET region = 'Lafayette / South Central'
 WHERE club_id IS NULL AND region = 'Bayou Region';

UPDATE club_reports SET region = 'Lake Charles / Southwestern'
 WHERE club_id IS NULL AND region = 'Southwest Louisiana';

UPDATE club_reports SET region = 'New Orleans Metro'
 WHERE club_id IS NULL AND region = 'North of Lake Pontchartrain';

UPDATE club_reports SET region = 'Lafayette / South Central'
 WHERE club_id IS NULL AND region = 'Central Louisiana';

-- Seats: remove every row but a regional seat's own region, the one its
-- title begins with (with or without the word Representative after it),
-- then give each such seat that region. The result is the same as emptying
-- the table and giving each seat its own, and a second run removes and adds
-- nothing.
DELETE FROM seat_regions
 WHERE NOT (
   region IN ('New Orleans Metro', 'Baton Rouge / East Central', 'Lafayette / South Central', 'Lake Charles / Southwestern', 'North Louisiana')
   AND EXISTS (
     SELECT 1 FROM board_members s
      WHERE s.id = seat_regions.seat_id
        AND s.category = 'regional_rep'
        AND s.role LIKE seat_regions.region || '%'
   )
 );

INSERT OR IGNORE INTO seat_regions (seat_id, region)
SELECT id, 'New Orleans Metro' FROM board_members
 WHERE category = 'regional_rep' AND role LIKE 'New Orleans Metro%';

INSERT OR IGNORE INTO seat_regions (seat_id, region)
SELECT id, 'Baton Rouge / East Central' FROM board_members
 WHERE category = 'regional_rep' AND role LIKE 'Baton Rouge / East Central%';

INSERT OR IGNORE INTO seat_regions (seat_id, region)
SELECT id, 'Lafayette / South Central' FROM board_members
 WHERE category = 'regional_rep' AND role LIKE 'Lafayette / South Central%';

INSERT OR IGNORE INTO seat_regions (seat_id, region)
SELECT id, 'Lake Charles / Southwestern' FROM board_members
 WHERE category = 'regional_rep' AND role LIKE 'Lake Charles / Southwestern%';

INSERT OR IGNORE INTO seat_regions (seat_id, region)
SELECT id, 'North Louisiana' FROM board_members
 WHERE category = 'regional_rep' AND role LIKE 'North Louisiana%';
