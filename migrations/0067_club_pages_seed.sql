-- 0067_club_pages_seed.sql
--
-- Hand-written migration (npm run db:generate -- <name> --custom), staged as
-- drizzle/0012_club_pages_seed.sql. drizzle/meta now records functions/db/schema.ts as it
-- is, so write the SQL that brings the database to match it. Triggers, data
-- changes and table rebuilds belong here; see migrations/README.md.
--
-- Data only: the club page's fields for today's 25 clubs, in the columns and
-- tables migration 0066 added. No table, column, index or reference changes.
--
-- Every value is typed out per club id, which never changes, rather than
-- matched by name, which an admin may have edited. Every write is to an
-- empty field: a slug only where slug is NULL, a statement or an About text
-- only where it is NULL and the club's description still equals what
-- migration 0013 stored (so a description changed in production is left for
-- K), a place only where the club has none, a point only where the place has
-- none, and the told date only where it is NULL. told_by stays NULL, so each
-- club reads "As told to LCA" with the month until K or the club's rep saves
-- it. A club added since the 25 gets a slug equal to its id and the told
-- date, and nothing else. A second run changes no row.
--
-- K's decision 1, choice 4 (a), of Friday, November 13, 2026, settles four
-- data points, and each has its statements together under a comment of its
-- own, so that one can be turned the other way by removing them alone:
-- (e2) the pins from today's map list, with (e3) the shared New Orleans
-- point, (e4) Heart of Worship's point as stored and (e6) the second place's
-- pin; (e5) Shreveport-Bossier's second pin as its second place; and (g) the
-- two doubled apostrophes mended in today's text.
--
-- Untouched: meeting_schedule, city, name, contact_email and region.
--
-- The texts in the description guards below are what 0013 stored, as it
-- wrote them, old initials and all; they are compared, never written.

-- (a) The slugs. Six clubs' ids differ from the slug of their name, so their
-- slugs are typed out, each only where no other club holds it as its id or
-- its slug. Then every club whose slug is still NULL takes its id, unless the
-- id is a word the club pages keep for their own addresses
-- (domain/clubs/slug.ts) or another club holds it as its slug. The six come
-- first, so none of them takes its id.

UPDATE clubs SET slug = 'baton-rouge-chess-club'
 WHERE id = 'baton-rouge' AND slug IS NULL
   AND NOT EXISTS (SELECT 1 FROM clubs AS other WHERE other.id = 'baton-rouge-chess-club' OR other.slug = 'baton-rouge-chess-club');

UPDATE clubs SET slug = 'metairie-chess-academy'
 WHERE id = 'metairie' AND slug IS NULL
   AND NOT EXISTS (SELECT 1 FROM clubs AS other WHERE other.id = 'metairie-chess-academy' OR other.slug = 'metairie-chess-academy');

UPDATE clubs SET slug = 'monroe-chess-club'
 WHERE id = 'monroe' AND slug IS NULL
   AND NOT EXISTS (SELECT 1 FROM clubs AS other WHERE other.id = 'monroe-chess-club' OR other.slug = 'monroe-chess-club');

UPDATE clubs SET slug = 'ruston-knights-chess-club'
 WHERE id = 'ruston' AND slug IS NULL
   AND NOT EXISTS (SELECT 1 FROM clubs AS other WHERE other.id = 'ruston-knights-chess-club' OR other.slug = 'ruston-knights-chess-club');

UPDATE clubs SET slug = 'shreveport-bossier-chess-club'
 WHERE id = 'shreveport' AND slug IS NULL
   AND NOT EXISTS (SELECT 1 FROM clubs AS other WHERE other.id = 'shreveport-bossier-chess-club' OR other.slug = 'shreveport-bossier-chess-club');

UPDATE clubs SET slug = 'slidell-chess-club'
 WHERE id = 'slidell' AND slug IS NULL
   AND NOT EXISTS (SELECT 1 FROM clubs AS other WHERE other.id = 'slidell-chess-club' OR other.slug = 'slidell-chess-club');

UPDATE clubs SET slug = id
 WHERE slug IS NULL
   AND id NOT IN ('suggest', 'reports', 'confirm', 'reply', 'page', 'contact', 'logo')
   AND NOT EXISTS (SELECT 1 FROM clubs AS other WHERE other.slug = clubs.id);

-- (b) The old addresses: one row for each of the six, its old slug the id,
-- written only when the club holds its typed slug, so no row ever sends an
-- address to itself. A club whose id is its slug has none.

INSERT OR IGNORE INTO club_slug_history (old_slug, club_id)
SELECT 'baton-rouge', id FROM clubs WHERE id = 'baton-rouge' AND slug = 'baton-rouge-chess-club';

INSERT OR IGNORE INTO club_slug_history (old_slug, club_id)
SELECT 'metairie', id FROM clubs WHERE id = 'metairie' AND slug = 'metairie-chess-academy';

INSERT OR IGNORE INTO club_slug_history (old_slug, club_id)
SELECT 'monroe', id FROM clubs WHERE id = 'monroe' AND slug = 'monroe-chess-club';

INSERT OR IGNORE INTO club_slug_history (old_slug, club_id)
SELECT 'ruston', id FROM clubs WHERE id = 'ruston' AND slug = 'ruston-knights-chess-club';

INSERT OR IGNORE INTO club_slug_history (old_slug, club_id)
SELECT 'shreveport', id FROM clubs WHERE id = 'shreveport' AND slug = 'shreveport-bossier-chess-club';

INSERT OR IGNORE INTO club_slug_history (old_slug, club_id)
SELECT 'slidell', id FROM clubs WHERE id = 'slidell' AND slug = 'slidell-chess-club';

-- (c) How we meet: the 18 statements the Clubs-H board draws, in its words,
-- with "US Chess", one apostrophe, and "to" in every range. For these 18 the
-- description is the meeting line itself. The seven clubs with no statement
-- (casa-de-ajedrez, gonzales-chess-club, knight-light-chess,
-- lafayette-chess-club, metairie, north-kenner-library-chess-club and
-- strategic-thoughts-nola) keep an empty one. The guards of slidell and
-- mandeville-chess-club also take the text (g) leaves, so the order of the
-- two parts does not matter.

UPDATE clubs SET how_we_meet_text = 'Saturdays 10:00 AM at Jones Creek Branch Library, G/90+30. Casual meets Wednesdays 6:00 PM at Boba ParTea on O''Neil Lane.'
 WHERE id = 'baton-rouge' AND how_we_meet_text IS NULL
   AND description = 'Meets Saturdays 10am at Jones Creek Branch Library. G/90+30i time control. Casual meets Wednesdays 6pm at Boba ParTea on O''Neil Lane.';

UPDATE clubs SET how_we_meet_text = 'Every Wednesday during the summer months, 1:00 to 2:00 PM.'
 WHERE id = 'beauregard-parish-youth-chess' AND how_we_meet_text IS NULL
   AND description = 'Youth chess program. Every Wednesday during summer months, 1:00-2:00 PM.';

UPDATE clubs SET how_we_meet_text = 'Meets bi-weekly at Bluebonnet Library on the 1st and 3rd Sunday of the month, 4:30 to 5:30 PM.'
 WHERE id = 'bluebonnet-chess-club' AND how_we_meet_text IS NULL
   AND description = 'Meets bi-weekly at Bluebonnet Library on the 1st and 3rd Sunday of the month, 4:30-5:30 PM.';

UPDATE clubs SET how_we_meet_text = 'Tuesdays 4:00 to 6:00 PM at the Bunkie Library. Open to all ages 8 to 108. Free to join.'
 WHERE id = 'bunkie-chess-club' AND how_we_meet_text IS NULL
   AND description = 'Open to all ages 8-108. Free to join. Meets Tuesdays 4-6 PM at the Bunkie Library.';

UPDATE clubs SET how_we_meet_text = 'Monday and Thursday evenings at 7:00 PM. Game 15, no delay. $1 to 2 entry with US Chess membership.'
 WHERE id = 'downriver-chess-club' AND how_we_meet_text IS NULL
   AND description = 'Monday and Thursday evenings at 7 PM. Game 15, no delay. $1-2 entry with USCF membership.';

UPDATE clubs SET how_we_meet_text = 'Tuesdays 7:00 PM. 5-round G/90 tournaments, one round per week. Arrive by 6:30 PM to register.'
 WHERE id = 'greater-new-orleans-chess-club' AND how_we_meet_text IS NULL
   AND description = 'Tuesdays 7:00 PM. 5-round G/90 tournaments, 1 round per week. Arrive by 6:30 to register.';

UPDATE clubs SET how_we_meet_text = 'Fridays 5:30 to 7:00 PM. Open to anyone: join before church for chess.'
 WHERE id = 'heart-of-worship-church-chess' AND how_we_meet_text IS NULL
   AND description = 'Meets Fridays 5:30-7 PM before church. Open to anyone.';

UPDATE clubs SET how_we_meet_text = 'Mondays 6:00 to 8:30 PM at Terrebonne Parish North Library.'
 WHERE id = 'houma-chess-club' AND how_we_meet_text IS NULL
   AND description = 'Meets Mondays 6:00-8:30 PM at Terrebonne Parish North Library.';

UPDATE clubs SET how_we_meet_text = 'Meets Mondays at 5:00 PM at George''s Mexican Restaurant.'
 WHERE id = 'mandeville-chess-club' AND how_we_meet_text IS NULL
   AND description IN ('Meets Mondays at 5:00 PM at George''''s Mexican Restaurant.', 'Meets Mondays at 5:00 PM at George''s Mexican Restaurant.');

UPDATE clubs SET how_we_meet_text = 'Wednesdays 6:00 to 10:00 PM at Chopsticks Buffet. No entry fee, all welcome. Skittles games only.'
 WHERE id = 'marrero-chess-organization' AND how_we_meet_text IS NULL
   AND description = 'Meets Wednesdays 6-10 PM at Chopsticks Buffet. No entry fee, all welcome. Skittles games only.';

UPDATE clubs SET how_we_meet_text = 'Monday evenings 5:30 PM at Enochs Pub and Grill. Saturday mornings 10:00 AM at Books-A-Million. All ages welcome.'
 WHERE id = 'monroe' AND how_we_meet_text IS NULL
   AND description = 'Monday evenings 5:30 PM at Enochs Pub and Grill. Saturday mornings 10:00 AM at Books-A-Million. All ages welcome.';

UPDATE clubs SET how_we_meet_text = '1st, 3rd and 5th Tuesday evenings at 5:30 PM at First Baptist Church.'
 WHERE id = 'morgan-city-chess-club' AND how_we_meet_text IS NULL
   AND description = 'Meets 1st, 3rd, and 5th Tuesday evenings at 5:30 PM at First Baptist Church.';

UPDATE clubs SET how_we_meet_text = 'US Chess rated tournaments Thursdays 7:30 to 11:30 PM. Beginners welcome.'
 WHERE id = 'new-orleans-westbank-chess-club' AND how_we_meet_text IS NULL
   AND description = 'USCF Rated Tournaments - Thursdays 7:30-11:30 PM. Beginners welcome.';

UPDATE clubs SET how_we_meet_text = 'Mondays 6:00 to 10:00 PM at IHOP. Casual games. Quick-rated tournaments the 1st Monday of each month (4 rounds, G/20 d5).'
 WHERE id = 'picayune-chess-club' AND how_we_meet_text IS NULL
   AND description = 'Mondays 6-10 PM at IHop. Casual games. Quick rated tournaments 1st Monday of each month (4 rounds, G/20d5).';

UPDATE clubs SET how_we_meet_text = 'Meets monthly 12:30 to 2:30 PM at 300 Pearce Rd, Pineville. Must be a CCHSA homeschool group member.'
 WHERE id = 'pineville-homeschool-chess-club' AND how_we_meet_text IS NULL
   AND description = 'Must be a CCHSA homeschool group member. Meets monthly 12:30-2:30 PM at 300 Pearce Rd, Pineville, LA.';

UPDATE clubs SET how_we_meet_text = 'Tuesday nights at 6:00 PM at Utility Brewing Company.'
 WHERE id = 'ruston' AND how_we_meet_text IS NULL
   AND description = 'Tuesday nights at 6 PM at Utility Brewing Company.';

UPDATE clubs SET how_we_meet_text = 'Mondays at Gamers XP, 1:00 to 5:00 PM. Thursdays at Pierre Bossier Mall in the food court, 1:00 to 5:00 PM.'
 WHERE id = 'shreveport' AND how_we_meet_text IS NULL
   AND description = 'Mondays at Gamers XP 1-5 PM. Thursdays at Pierre Bossier Mall Food Court 1-5 PM.';

UPDATE clubs SET how_we_meet_text = 'Fridays at 7:00 PM at St. Luke''s, 910 Cross Gates Blvd., Classroom 3.'
 WHERE id = 'slidell' AND how_we_meet_text IS NULL
   AND description IN ('Meets Fridays at 7 PM at St. Luke''''s, 910 Cross Gates Blvd., Slidell, LA 70461, Classroom 3.', 'Meets Fridays at 7 PM at St. Luke''s, 910 Cross Gates Blvd., Slidell, LA 70461, Classroom 3.');

-- (d) About: for the seven clubs with no statement alone, today's
-- description, typed out, with "US Chess" for casa-de-ajedrez. For the other
-- 18 the description is the meeting line, so About stays empty until K
-- enters a sentence.

UPDATE clubs SET about_text = 'Leisure/casual play, US Chess rated tournaments, online chess, and lessons. Sulphur/Lake Charles area.'
 WHERE id = 'casa-de-ajedrez' AND about_text IS NULL
   AND description = 'Leisure/casual play, USCF rated tournaments, online chess, and lessons. Sulphur/Lake Charles area.';

UPDATE clubs SET about_text = 'Chess club serving the Gonzales area.'
 WHERE id = 'gonzales-chess-club' AND about_text IS NULL
   AND description = 'Chess club serving the Gonzales area.';

UPDATE clubs SET about_text = 'Summer camps, after-school programs, private instruction, and community tournaments.'
 WHERE id = 'knight-light-chess' AND about_text IS NULL
   AND description = 'Summer camps, after-school programs, private instruction, and community tournaments.';

UPDATE clubs SET about_text = 'Hosts the Louisiana Open every Memorial Day Weekend and Lafayette Open in October. All skill levels welcome.'
 WHERE id = 'lafayette-chess-club' AND about_text IS NULL
   AND description = 'Hosts the Louisiana Open every Memorial Day Weekend and Lafayette Open in October. All skill levels welcome.';

UPDATE clubs SET about_text = 'Chess instruction and play for kids of all ages.'
 WHERE id = 'metairie' AND about_text IS NULL
   AND description = 'Chess instruction and play for kids of all ages.';

UPDATE clubs SET about_text = 'Skittles chess for players of all ages and abilities. North Kenner Public Library Meeting Room.'
 WHERE id = 'north-kenner-library-chess-club' AND about_text IS NULL
   AND description = 'Skittles chess for players of all ages and abilities. North Kenner Public Library Meeting Room.';

UPDATE clubs SET about_text = 'Youth chess programs in schools and NORD centers. Building a diverse chess community in New Orleans.'
 WHERE id = 'strategic-thoughts-nola' AND about_text IS NULL
   AND description = 'Youth chess programs in schools and NORD centers. Building a diverse chess community in New Orleans.';

-- (e1) Place 1 (sort 0) for each of the 25, where the club has no place and
-- its location is not blank: named from clubs.location, with the club's own
-- point when both latitude and longitude are set, and no point otherwise.
-- Two names are typed out while the location is as 0013 stored it, each with
-- one apostrophe, for slidell and mandeville-chess-club; Shreveport-Bossier's
-- place has its own statement, since (e5) names it for its Monday site alone.

INSERT INTO club_places (club_id, name, latitude, longitude, sort)
SELECT id, location,
       CASE WHEN latitude IS NOT NULL AND longitude IS NOT NULL THEN latitude END,
       CASE WHEN latitude IS NOT NULL AND longitude IS NOT NULL THEN longitude END,
       0
  FROM clubs
 WHERE id IN ('baton-rouge', 'beauregard-parish-youth-chess', 'bluebonnet-chess-club', 'bunkie-chess-club', 'casa-de-ajedrez',
              'downriver-chess-club', 'gonzales-chess-club', 'greater-new-orleans-chess-club', 'heart-of-worship-church-chess',
              'houma-chess-club', 'knight-light-chess', 'lafayette-chess-club', 'marrero-chess-organization', 'metairie', 'monroe',
              'morgan-city-chess-club', 'new-orleans-westbank-chess-club', 'north-kenner-library-chess-club', 'picayune-chess-club',
              'pineville-homeschool-chess-club', 'ruston', 'strategic-thoughts-nola')
   AND location IS NOT NULL AND TRIM(location) <> ''
   AND NOT EXISTS (SELECT 1 FROM club_places WHERE club_places.club_id = clubs.id);

INSERT INTO club_places (club_id, name, latitude, longitude, sort)
SELECT id,
       CASE WHEN location IN ('St. Luke''''s, 910 Cross Gates Blvd., Slidell, LA 70461', 'St. Luke''s, 910 Cross Gates Blvd., Slidell, LA 70461')
            THEN 'St. Luke''s, 910 Cross Gates Blvd., Slidell, LA 70461' ELSE location END,
       CASE WHEN latitude IS NOT NULL AND longitude IS NOT NULL THEN latitude END,
       CASE WHEN latitude IS NOT NULL AND longitude IS NOT NULL THEN longitude END,
       0
  FROM clubs
 WHERE id = 'slidell' AND location IS NOT NULL AND TRIM(location) <> ''
   AND NOT EXISTS (SELECT 1 FROM club_places WHERE club_places.club_id = clubs.id);

INSERT INTO club_places (club_id, name, latitude, longitude, sort)
SELECT id,
       CASE WHEN location IN ('George''''s Mexican Restaurant, Mandeville, LA', 'George''s Mexican Restaurant, Mandeville, LA')
            THEN 'George''s Mexican Restaurant, Mandeville, LA' ELSE location END,
       CASE WHEN latitude IS NOT NULL AND longitude IS NOT NULL THEN latitude END,
       CASE WHEN latitude IS NOT NULL AND longitude IS NOT NULL THEN longitude END,
       0
  FROM clubs
 WHERE id = 'mandeville-chess-club' AND location IS NOT NULL AND TRIM(location) <> ''
   AND NOT EXISTS (SELECT 1 FROM club_places WHERE club_places.club_id = clubs.id);

INSERT INTO club_places (club_id, name, latitude, longitude, sort)
SELECT id, location,
       CASE WHEN latitude IS NOT NULL AND longitude IS NOT NULL THEN latitude END,
       CASE WHEN latitude IS NOT NULL AND longitude IS NOT NULL THEN longitude END,
       0
  FROM clubs
 WHERE id = 'shreveport' AND location IS NOT NULL AND TRIM(location) <> ''
   AND NOT EXISTS (SELECT 1 FROM club_places WHERE club_places.club_id = clubs.id);

-- (e2) The pins from today's map list (src/areas/clubs/clubMapData.ts),
-- matched to each club id by hand: each on place 1 only where it has no
-- point and is named with the location 0013 stored (with one apostrophe), so
-- a stored point stands, and a place someone else made or a location changed
-- since gets no pin from the old list and is left for K to place.
-- Remove this part, with (e3), (e4) and (e6), to seed no pins.

UPDATE club_places SET latitude = 30.3964191, longitude = -91.0186082 WHERE club_id = 'baton-rouge' AND sort = 0 AND latitude IS NULL AND longitude IS NULL
   AND name = 'Jones Creek Branch Library, Baton Rouge, LA';
UPDATE club_places SET latitude = 30.8452283, longitude = -93.2867372 WHERE club_id = 'beauregard-parish-youth-chess' AND sort = 0 AND latitude IS NULL AND longitude IS NULL
   AND name = 'Beauregard Parish, LA';
UPDATE club_places SET latitude = 30.3652922, longitude = -91.1052538 WHERE club_id = 'bluebonnet-chess-club' AND sort = 0 AND latitude IS NULL AND longitude IS NULL
   AND name = 'Bluebonnet Library, Baton Rouge, LA';
UPDATE club_places SET latitude = 30.9532472, longitude = -92.1826258 WHERE club_id = 'bunkie-chess-club' AND sort = 0 AND latitude IS NULL AND longitude IS NULL
   AND name = 'Bunkie Library, Bunkie, LA';
UPDATE club_places SET latitude = 30.2307522, longitude = -93.3766652 WHERE club_id = 'casa-de-ajedrez' AND sort = 0 AND latitude IS NULL AND longitude IS NULL
   AND name = 'Sulphur/Lake Charles, LA';
UPDATE club_places SET latitude = 29.9603311, longitude = -90.0597334 WHERE club_id = 'downriver-chess-club' AND sort = 0 AND latitude IS NULL AND longitude IS NULL
   AND name = 'New Orleans, LA';
UPDATE club_places SET latitude = 30.2721888, longitude = -90.9845975 WHERE club_id = 'gonzales-chess-club' AND sort = 0 AND latitude IS NULL AND longitude IS NULL
   AND name = 'Gonzales, LA';
UPDATE club_places SET latitude = 29.982613, longitude = -90.110207 WHERE club_id = 'greater-new-orleans-chess-club' AND sort = 0 AND latitude IS NULL AND longitude IS NULL
   AND name = 'New Orleans, LA';
UPDATE club_places SET latitude = 29.6760904, longitude = -90.7798245 WHERE club_id = 'houma-chess-club' AND sort = 0 AND latitude IS NULL AND longitude IS NULL
   AND name = 'Terrebonne Parish North Library, Houma, LA';
UPDATE club_places SET latitude = 30.1907073, longitude = -92.0117427 WHERE club_id = 'lafayette-chess-club' AND sort = 0 AND latitude IS NULL AND longitude IS NULL
   AND name = 'Lafayette, LA';
UPDATE club_places SET latitude = 30.389274, longitude = -90.0885684 WHERE club_id = 'mandeville-chess-club' AND sort = 0 AND latitude IS NULL AND longitude IS NULL
   AND name = 'George''s Mexican Restaurant, Mandeville, LA';
UPDATE club_places SET latitude = 29.9171259, longitude = -90.050963 WHERE club_id = 'marrero-chess-organization' AND sort = 0 AND latitude IS NULL AND longitude IS NULL
   AND name = 'Chopsticks Buffet, Marrero, LA';
UPDATE club_places SET latitude = 30.0116765, longitude = -90.1826911 WHERE club_id = 'metairie' AND sort = 0 AND latitude IS NULL AND longitude IS NULL
   AND name = 'Metairie, LA';
UPDATE club_places SET latitude = 32.5103488, longitude = -92.1183106 WHERE club_id = 'monroe' AND sort = 0 AND latitude IS NULL AND longitude IS NULL
   AND name = 'Enochs Pub and Grill / Books-A-Million, Monroe, LA';
UPDATE club_places SET latitude = 29.696866, longitude = -91.183601 WHERE club_id = 'morgan-city-chess-club' AND sort = 0 AND latitude IS NULL AND longitude IS NULL
   AND name = 'First Baptist Church, Morgan City, LA';
UPDATE club_places SET latitude = 29.918542, longitude = -89.992922 WHERE club_id = 'new-orleans-westbank-chess-club' AND sort = 0 AND latitude IS NULL AND longitude IS NULL
   AND name = 'Gretna, LA';
UPDATE club_places SET latitude = 30.0222995, longitude = -90.259437 WHERE club_id = 'north-kenner-library-chess-club' AND sort = 0 AND latitude IS NULL AND longitude IS NULL
   AND name = 'North Kenner Public Library, Kenner, LA';
UPDATE club_places SET latitude = 30.5185318, longitude = -89.665567 WHERE club_id = 'picayune-chess-club' AND sort = 0 AND latitude IS NULL AND longitude IS NULL
   AND name = 'IHop, Picayune, MS';
UPDATE club_places SET latitude = 31.3560986, longitude = -92.4040809 WHERE club_id = 'pineville-homeschool-chess-club' AND sort = 0 AND latitude IS NULL AND longitude IS NULL
   AND name = '300 Pearce Rd, Pineville, LA';
UPDATE club_places SET latitude = 32.5299987, longitude = -92.6376724 WHERE club_id = 'ruston' AND sort = 0 AND latitude IS NULL AND longitude IS NULL
   AND name = 'Utility Brewing Company, Ruston, LA';
UPDATE club_places SET latitude = 32.486477, longitude = -93.7077442 WHERE club_id = 'shreveport' AND sort = 0 AND latitude IS NULL AND longitude IS NULL
   AND name = 'Gamers XP / Pierre Bossier Mall, Shreveport, LA';
UPDATE club_places SET latitude = 30.29445, longitude = -89.729002 WHERE club_id = 'slidell' AND sort = 0 AND latitude IS NULL AND longitude IS NULL
   AND name = 'St. Luke''s, 910 Cross Gates Blvd., Slidell, LA 70461';

-- (e3) The one shared New Orleans pin, kept for both clubs that meet at
-- several sites in the city, guarded as (e2). Remove this part to leave both.

UPDATE club_places SET latitude = 29.9508941, longitude = -90.0758356 WHERE club_id = 'knight-light-chess' AND sort = 0 AND latitude IS NULL AND longitude IS NULL
   AND name = 'New Orleans, LA';
UPDATE club_places SET latitude = 29.9508941, longitude = -90.0758356 WHERE club_id = 'strategic-thoughts-nola' AND sort = 0 AND latitude IS NULL AND longitude IS NULL
   AND name = 'New Orleans, LA';

-- (e4) Heart of Worship's pin as the map list holds it, about 23 miles from
-- the Bunkie pin while its row says Opelousas; K corrects it in the editor.
-- Guarded as (e2). Remove this part to leave it for K to place.

UPDATE club_places SET latitude = 30.9735709, longitude = -91.7961073 WHERE club_id = 'heart-of-worship-church-chess' AND sort = 0 AND latitude IS NULL AND longitude IS NULL
   AND name = 'Heart of Worship Church, Opelousas, LA';

-- (e5) Shreveport-Bossier's second pin, its Thursday site, as place 2
-- (sort 1), with no point of its own until (e6), and place 1 named for its
-- Monday site alone. Both only while the location is as 0013 stored it,
-- place 1 is the one (e1) wrote and there is no place 2. Remove this part to
-- keep one place with both sites named.

INSERT INTO club_places (club_id, name, latitude, longitude, sort)
SELECT id, 'Pierre Bossier Mall, Shreveport, LA', NULL, NULL, 1
  FROM clubs
 WHERE id = 'shreveport' AND location = 'Gamers XP / Pierre Bossier Mall, Shreveport, LA'
   AND EXISTS (SELECT 1 FROM club_places WHERE club_places.club_id = clubs.id AND sort = 0 AND name = 'Gamers XP / Pierre Bossier Mall, Shreveport, LA')
   AND NOT EXISTS (SELECT 1 FROM club_places WHERE club_places.club_id = clubs.id AND sort <> 0);

UPDATE club_places SET name = 'Gamers XP, Shreveport, LA'
 WHERE club_id = 'shreveport' AND sort = 0 AND name = 'Gamers XP / Pierre Bossier Mall, Shreveport, LA'
   AND EXISTS (SELECT 1 FROM club_places AS second WHERE second.club_id = 'shreveport' AND second.sort = 1 AND second.name = 'Pierre Bossier Mall, Shreveport, LA');

-- (e6) The Thursday pin from today's map list, on the place 2 that (e5)
-- wrote, only where it has no point. Part of the pins: remove it with (e2),
-- (e3) and (e4) to seed no pins. Without (e5) it writes nothing.

UPDATE club_places SET latitude = 32.5264466, longitude = -93.70758
 WHERE club_id = 'shreveport' AND sort = 1 AND name = 'Pierre Bossier Mall, Shreveport, LA'
   AND latitude IS NULL AND longitude IS NULL;

-- (f) The told date: the month of this run, where it is NULL, for every
-- club. told_by stays NULL.

UPDATE clubs SET told_updated_at = datetime('now') WHERE told_updated_at IS NULL;

-- (g) The two doubled apostrophes in today's description and location of
-- slidell and mandeville-chess-club become one, each only where the stored
-- text still equals what 0013 stored. The one part a visitor meets with
-- every switch off: today's club page, its link preview and the admin club
-- page show the text. Remove this part to leave today's text as it is.

UPDATE clubs SET description = 'Meets Fridays at 7 PM at St. Luke''s, 910 Cross Gates Blvd., Slidell, LA 70461, Classroom 3.'
 WHERE id = 'slidell' AND description = 'Meets Fridays at 7 PM at St. Luke''''s, 910 Cross Gates Blvd., Slidell, LA 70461, Classroom 3.';

UPDATE clubs SET location = 'St. Luke''s, 910 Cross Gates Blvd., Slidell, LA 70461'
 WHERE id = 'slidell' AND location = 'St. Luke''''s, 910 Cross Gates Blvd., Slidell, LA 70461';

UPDATE clubs SET description = 'Meets Mondays at 5:00 PM at George''s Mexican Restaurant.'
 WHERE id = 'mandeville-chess-club' AND description = 'Meets Mondays at 5:00 PM at George''''s Mexican Restaurant.';

UPDATE clubs SET location = 'George''s Mexican Restaurant, Mandeville, LA'
 WHERE id = 'mandeville-chess-club' AND location = 'George''''s Mexican Restaurant, Mandeville, LA';
