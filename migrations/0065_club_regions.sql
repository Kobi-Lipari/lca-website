-- 0065_club_regions.sql
--
-- Hand-written migration (npm run db:generate -- <name> --custom), staged as
-- drizzle/0010_club_regions.sql. drizzle/meta now records functions/db/schema.ts as it
-- is, so write the SQL that brings the database to match it. Triggers, data
-- changes and table rebuilds belong here; see migrations/README.md.
--
-- Data only: the region of each of the 25 clubs, as the brief's Appendix C
-- places them (decision D10), in the seven region names of
-- domain/clubs/regions.ts. Each club is named by its id, which never
-- changes, rather than by its name, which an admin may have edited. A
-- region is set only where it is blank (NULL or the empty string), so a
-- region an admin has already chosen stands, a club not listed here stays
-- as it is, and a second run changes no row. No table, column or index
-- changes.

UPDATE clubs SET region = 'New Orleans Metro'
 WHERE id IN ('downriver-chess-club', 'greater-new-orleans-chess-club', 'new-orleans-westbank-chess-club', 'marrero-chess-organization', 'north-kenner-library-chess-club', 'metairie', 'knight-light-chess', 'strategic-thoughts-nola')
   AND (region IS NULL OR region = '');

UPDATE clubs SET region = 'North of Lake Pontchartrain'
 WHERE id IN ('mandeville-chess-club', 'slidell', 'picayune-chess-club')
   AND (region IS NULL OR region = '');

UPDATE clubs SET region = 'South Central Louisiana'
 WHERE id IN ('baton-rouge', 'bluebonnet-chess-club', 'gonzales-chess-club', 'lafayette-chess-club', 'heart-of-worship-church-chess')
   AND (region IS NULL OR region = '');

UPDATE clubs SET region = 'Bayou Region'
 WHERE id IN ('houma-chess-club', 'morgan-city-chess-club')
   AND (region IS NULL OR region = '');

UPDATE clubs SET region = 'Southwest Louisiana'
 WHERE id IN ('casa-de-ajedrez', 'beauregard-parish-youth-chess')
   AND (region IS NULL OR region = '');

UPDATE clubs SET region = 'Central Louisiana'
 WHERE id IN ('bunkie-chess-club', 'pineville-homeschool-chess-club')
   AND (region IS NULL OR region = '');

UPDATE clubs SET region = 'North Louisiana'
 WHERE id IN ('shreveport', 'monroe', 'ruston')
   AND (region IS NULL OR region = '');
