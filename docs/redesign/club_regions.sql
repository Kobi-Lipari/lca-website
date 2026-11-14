-- Club regions for all 25 LCA clubs (REDESIGN_SPEC.md, Appendix C).
-- Local database only: never run this file against a remote database.
--   npx wrangler d1 execute lca-db --local --file=club_regions.sql
-- Then check that nothing was missed on the local database (expect no rows):
--   npx wrangler d1 execute lca-db --local --command "SELECT id, name, region FROM clubs WHERE region IS NULL OR region = ''"
-- Matches on club name; a returned row means that club's stored name differs from the list here.
-- Production gets the same regions from migrations/0065_club_regions.sql, which names each club by
-- its id and sets a region only where it is blank; the merge into main applies it.

UPDATE clubs SET region = 'New Orleans Metro' WHERE name IN ('Downriver Chess Club', 'Greater New Orleans Chess Club', 'New Orleans Westbank Chess Club', 'Marrero Chess Organization', 'North Kenner Library Chess Club', 'Metairie Chess Academy', 'Knight Light Chess', 'Strategic Thoughts NOLA');
UPDATE clubs SET region = 'North of Lake Pontchartrain' WHERE name IN ('Mandeville Chess Club', 'Slidell Chess Club', 'Picayune Chess Club');
UPDATE clubs SET region = 'South Central Louisiana' WHERE name IN ('Baton Rouge Chess Club', 'Bluebonnet Chess Club', 'Gonzales Chess Club', 'Lafayette Chess Club', 'Heart of Worship Church Chess');
UPDATE clubs SET region = 'Bayou Region' WHERE name IN ('Houma Chess Club', 'Morgan City Chess Club');
UPDATE clubs SET region = 'Southwest Louisiana' WHERE name IN ('Casa de Ajedrez', 'Beauregard Parish Youth Chess');
UPDATE clubs SET region = 'Central Louisiana' WHERE name IN ('Bunkie Chess Club', 'Pineville Homeschool Chess Club');
UPDATE clubs SET region = 'North Louisiana' WHERE name IN ('Shreveport-Bossier Chess Club', 'Monroe Chess Club', 'Ruston Knights Chess Club');
