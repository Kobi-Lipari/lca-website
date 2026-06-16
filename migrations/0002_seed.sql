-- LCA seed data — matches React placeholder content
-- Run AFTER 0001_schema.sql

PRAGMA foreign_keys = ON;

-- ─── Clubs ───────────────────────────────────────────────────────────────────
INSERT INTO clubs (id, name, city, location, description, meeting_schedule, contact_email) VALUES
('baton-rouge', 'Baton Rouge Chess Club', 'Baton Rouge', 'Baton Rouge Community Center, 555 Government St, Baton Rouge, LA 70802', 'The Baton Rouge Chess Club is one of Louisiana''s oldest and most active clubs. We welcome players of all skill levels for weekly casual and rated games, plus quarterly club championships.', 'Tuesdays, 6:30 PM – 9:00 PM', 'brchess@louisianachess.org'),
('new-orleans', 'New Orleans Chess Club', 'New Orleans', 'New Orleans Public Library, Main Branch, 219 Loyola Ave, New Orleans, LA 70112', 'Located in the heart of the city, the New Orleans Chess Club brings together players from across the metro area. Blitz nights, lectures, and social events make every Wednesday a chess night.', 'Wednesdays, 7:00 PM – 10:00 PM', 'nochess@louisianachess.org'),
('shreveport', 'Shreveport Chess Society', 'Shreveport', 'Shreveport Public Library, Main Branch, 424 Texas St, Shreveport, LA 71101', 'The Shreveport Chess Society serves northwest Louisiana with weekly meetups, scholastic outreach, and the annual Summer Swiss tournament.', 'Thursdays, 6:00 PM – 8:30 PM', 'shreveportchess@louisianachess.org'),
('lafayette', 'Lafayette Chess Alliance', 'Lafayette', 'Lafayette Science Museum, 433 Jefferson St, Lafayette, LA 70501', 'The Lafayette Chess Alliance unites Acadiana''s chess community with weekly play, coaching for juniors, and strong participation in LCA state events.', 'Mondays, 6:30 PM – 9:00 PM', 'lafayettechess@louisianachess.org'),
('lake-charles', 'Lake Charles Chess Society', 'Lake Charles', 'Central Library, 301 W Claude St, Lake Charles, LA 70601', 'The newest LCA-affiliated club in southwest Louisiana. Family-friendly Saturday meetings with lessons for beginners and rated play for experienced members.', 'Saturdays, 2:00 PM – 5:00 PM', 'lakecharleschess@louisianachess.org'),
('monroe', 'Monroe Chess Club', 'Monroe', 'Monroe Civic Center, 401 Lea Joyner Memorial Expy, Monroe, LA 71201', 'Northeast Louisiana''s home for competitive and casual chess. Strong scholastic tradition with annual grade-level championships.', 'Fridays, 6:00 PM – 8:30 PM', 'monroechess@louisianachess.org'),
('alexandria', 'Alexandria Chess Club', 'Alexandria', 'Alexandria Main Library, 503 Washington St, Alexandria, LA 71301', 'Central Louisiana''s chess hub. Weekly meetings feature Swiss-style quads, puzzle nights, and preparation for regional tournaments.', 'Tuesdays, 7:00 PM – 9:30 PM', 'alexandriachess@louisianachess.org'),
('hammond', 'Hammond Scholastic Chess', 'Hammond', 'Southeastern Louisiana University, Student Union, Hammond, LA 70402', 'Focused on youth chess development in the Hammond area. Saturday morning sessions combine lessons, supervised play, and tournament preparation for K–12 players.', 'Saturdays, 10:00 AM – 12:30 PM', 'hammondscholastic@louisianachess.org'),
('slidell', 'Slidell Chess Club', 'Slidell', 'Slidell Branch Library, 555 Robert Blvd, Slidell, LA 70458', 'Northshore players gather weekly for blitz, bughouse, and classical games. A relaxed atmosphere with serious competition when it counts.', 'Wednesdays, 6:30 PM – 9:00 PM', 'slidellchess@louisianachess.org'),
('ruston', 'Ruston Chess Club', 'Ruston', 'Ruston Community Center, 400 N Trenton St, Ruston, LA 71270', 'Serving Lincoln Parish and the I-20 corridor. University students and community members play side by side at weekly meetups.', 'Thursdays, 6:30 PM – 9:00 PM', 'rustonchess@louisianachess.org'),
('thibodaux', 'Thibodaux Chess Club', 'Thibodaux', 'Thibodaux Library, 314 St Mary St, Thibodaux, LA 70301', 'Bayou region chess at its finest. Monday night meetings include lectures from local masters and friendly ladder matches.', 'Mondays, 7:00 PM – 9:30 PM', 'thibodauxchess@louisianachess.org'),
('covington', 'Covington Chess Club', 'Covington', 'Covington Recreation Center, 1900 Rabbit Run, Covington, LA 70433', 'St. Tammany Parish''s chess community. Tuesday evenings feature rated rapid games and a growing junior section.', 'Tuesdays, 6:00 PM – 8:30 PM', 'covingtonchess@louisianachess.org'),
('metairie', 'Metairie Chess Club', 'Metairie', 'Jefferson Parish Library, East Bank Regional, 4747 W Napoleon Ave, Metairie, LA 70001', 'Sunday afternoon chess in Metairie. Perfect for families and players who prefer weekend meetups over weekday evenings.', 'Sundays, 3:00 PM – 6:00 PM', 'metairiechess@louisianachess.org'),
('natchitoches', 'Natchitoches Chess Club', 'Natchitoches', 'Natchitoches Parish Library, 450 3rd St, Natchitoches, LA 71457', 'Historic Natchitoches hosts a welcoming Friday evening club. Small but dedicated group with players from across central Louisiana.', 'Fridays, 5:30 PM – 8:00 PM', 'natchitochess@louisianachess.org'),
('kenner', 'Kenner Chess Club', 'Kenner', 'Kenner Recreation Center, 6220 Loyola Dr, Kenner, LA 70065', 'Jefferson Parish''s Wednesday night club. Active blitz scene and regular trips to New Orleans tournaments.', 'Wednesdays, 7:30 PM – 10:00 PM', 'kennerchess@louisianachess.org');

-- ─── Seed members (officers + sample players; not Supabase auth users) ───────
INSERT INTO members (id, email, full_name, uscf_id, membership_status, membership_expiry, role) VALUES
('00000000-0000-4000-8000-000000000001', 'admin@louisianachess.org', 'LCA Admin', NULL, 'active', '2026-12-31', 'lca_admin'),
('00000000-0000-4000-8000-000000000002', 'james.whitfield@example.com', 'James Whitfield', '12345678', 'active', '2026-12-31', 'member'),
('00000000-0000-4000-8000-000000000003', 'maria.santos@example.com', 'Maria Santos', '23456789', 'active', '2026-12-31', 'member'),
('00000000-0000-4000-8000-000000000004', 'david.chen@example.com', 'David Chen', '34567890', 'active', '2026-12-31', 'member'),
('00000000-0000-4000-8000-000000000005', 'priya.patel@example.com', 'Priya Patel', '45678901', 'active', '2026-12-31', 'member'),
('00000000-0000-4000-8000-000000000006', 'tyler.brooks@example.com', 'Tyler Brooks', '56789012', 'pending', NULL, 'member'),
('00000000-0000-4000-8000-000000000007', 'andre.williams@example.com', 'Andre Williams', '67890123', 'active', '2026-12-31', 'member'),
('00000000-0000-4000-8000-000000000008', 'sophie.martin@example.com', 'Sophie Martin', '78901234', 'active', '2026-12-31', 'member'),
('00000000-0000-4000-8000-000000000009', 'ethan.nguyen@example.com', 'Ethan Nguyen', '89012345', 'active', '2026-12-31', 'member'),
('00000000-0000-4000-8000-000000000010', 'robert.hale@example.com', 'Robert Hale', '90123456', 'active', '2026-12-31', 'member'),
('00000000-0000-4000-8000-000000000011', 'linda.foster@example.com', 'Linda Foster', '01234567', 'active', '2026-12-31', 'member'),
('00000000-0000-4000-8000-000000000012', 'marcus.johnson@example.com', 'Marcus Johnson', '33445566', 'active', '2026-12-31', 'club_rep'),
('00000000-0000-4000-8000-000000000013', 'emily.tran@example.com', 'Emily Tran', '44556677', 'active', '2026-12-31', 'member'),
('00000000-0000-4000-8000-000000000014', 'grace.wilson@example.com', 'Grace Wilson', '66778899', 'active', '2026-12-31', 'club_rep'),
('00000000-0000-4000-8000-000000000015', 'noah.davis@example.com', 'Noah Davis', '55667788', 'active', '2026-12-31', 'member'),
('00000000-0000-4000-8000-000000000016', 'carlos.rivera@example.com', 'Carlos Rivera', '11223344', 'active', '2026-12-31', 'club_rep'),
('00000000-0000-4000-8000-000000000017', 'anna.kowalski@example.com', 'Anna Kowalski', '22334455', 'active', '2026-12-31', 'member');

-- ─── Tournaments ─────────────────────────────────────────────────────────────
INSERT INTO tournaments (id, name, location, venue, date, end_date, entry_fee, sections, rounds, max_players, status, description, registration_deadline, club_id, created_by) VALUES
('spring-open-2026', 'LCA Spring Open', 'Baton Rouge, LA', 'Baton Rouge Community Center, 555 Government St', 'Saturday, March 14, 2026', NULL, 45, '[{"name":"Open","entryFee":45,"prizeFund":"$800"},{"name":"U1800","entryFee":40,"prizeFund":"$400"},{"name":"U1400","entryFee":35,"prizeFund":"$250"}]', 5, 120, 'upcoming', 'The LCA Spring Open kicks off the 2026 tournament season with five rounds of USCF-rated Swiss pairings. Open to all players — join competitors from across Louisiana for a full day of chess.', 'March 12, 2026 at 11:59 PM', 'baton-rouge', '00000000-0000-4000-8000-000000000001'),
('new-orleans-classic-2026', 'New Orleans Classic', 'New Orleans, LA', 'New Orleans Marriott, 555 Canal St', 'Saturday, April 18, 2026', NULL, 40, '[{"name":"Open","entryFee":40,"prizeFund":"$600"},{"name":"U1600","entryFee":35,"prizeFund":"$300"},{"name":"Scholastic","entryFee":20,"prizeFund":"Trophies"}]', 4, 80, 'upcoming', 'A four-round Swiss tournament in the heart of New Orleans. Features Open, U1600, and Scholastic sections with cash prizes in each.', 'April 16, 2026 at 11:59 PM', 'new-orleans', '00000000-0000-4000-8000-000000000001'),
('shreveport-summer-swiss-2026', 'Shreveport Summer Swiss', 'Shreveport, LA', 'Shreveport Public Library, Main Branch', 'Saturday, June 6, 2026', NULL, 35, '[{"name":"Open","entryFee":35,"prizeFund":"$500"},{"name":"U2000","entryFee":30,"prizeFund":"$250"},{"name":"U1200","entryFee":25,"prizeFund":"$150"}]', 5, 64, 'upcoming', 'Beat the summer heat with five rounds of competitive chess in Shreveport. Family-friendly venue with plenty of parking.', 'June 4, 2026 at 11:59 PM', 'shreveport', '00000000-0000-4000-8000-000000000001'),
('lafayette-winter-classic-2026', 'Lafayette Winter Classic', 'Lafayette, LA', 'Lafayette Science Museum', 'Saturday, February 8, 2026', NULL, 40, '[{"name":"Open","entryFee":40,"prizeFund":"$700"},{"name":"U1800","entryFee":35,"prizeFund":"$350"},{"name":"U1400","entryFee":30,"prizeFund":"$200"},{"name":"Scholastic","entryFee":20,"prizeFund":"Trophies"}]', 5, 96, 'active', 'Round 3 is currently in progress. Five-round Swiss with four sections including a dedicated Scholastic division.', 'Registration closed', 'lafayette', '00000000-0000-4000-8000-000000000001'),
('state-championship-2025', 'Louisiana State Championship', 'New Orleans, LA', 'Hilton New Orleans Riverside', 'November 15–17, 2025', '2025-11-17', 75, '[{"name":"Championship","entryFee":75,"prizeFund":"$2,000"},{"name":"Reserve","entryFee":60,"prizeFund":"$800"},{"name":"Class A","entryFee":50,"prizeFund":"$400"},{"name":"Class B","entryFee":40,"prizeFund":"$250"}]', 7, 150, 'completed', 'The premier event of the Louisiana chess calendar. Seven rounds over three days determine the state champion across four sections.', 'Registration closed', 'new-orleans', '00000000-0000-4000-8000-000000000001'),
('baton-rouge-fall-open-2025', 'Baton Rouge Fall Open', 'Baton Rouge, LA', 'Baton Rouge Community Center', 'Saturday, October 11, 2025', NULL, 45, '[{"name":"Open","entryFee":45,"prizeFund":"$700"},{"name":"U2000","entryFee":40,"prizeFund":"$350"},{"name":"U1600","entryFee":35,"prizeFund":"$200"},{"name":"U1200","entryFee":30,"prizeFund":"$150"}]', 5, 100, 'completed', 'A five-round fall classic that drew players from across the Gulf South. Final standings are published below.', 'Registration closed', 'baton-rouge', '00000000-0000-4000-8000-000000000001'),
('monroe-scholastic-2025', 'Monroe Scholastic Championship', 'Monroe, LA', 'Monroe Civic Center', 'Saturday, September 20, 2025', NULL, 25, '[{"name":"K–5","entryFee":20,"prizeFund":"Trophies"},{"name":"6–8","entryFee":20,"prizeFund":"Trophies"},{"name":"9–12","entryFee":25,"prizeFund":"Trophies"},{"name":"Open Scholastic","entryFee":25,"prizeFund":"Trophies"}]', 4, 80, 'completed', 'Louisiana''s premier scholastic event, organized by grade level. Trophies awarded in each section.', 'Registration closed', 'monroe', '00000000-0000-4000-8000-000000000001');

-- ─── Registrations (sample rosters) ────────────────────────────────────────────
INSERT INTO registrations (id, tournament_id, member_id, section, payment_status) VALUES
('reg-spring-1', 'spring-open-2026', '00000000-0000-4000-8000-000000000002', 'Open', 'paid'),
('reg-spring-2', 'spring-open-2026', '00000000-0000-4000-8000-000000000003', 'Open', 'paid'),
('reg-spring-3', 'spring-open-2026', '00000000-0000-4000-8000-000000000004', 'U1800', 'paid'),
('reg-spring-4', 'spring-open-2026', '00000000-0000-4000-8000-000000000005', 'U1800', 'paid'),
('reg-spring-5', 'spring-open-2026', '00000000-0000-4000-8000-000000000006', 'U1400', 'pending'),
('reg-nola-1', 'new-orleans-classic-2026', '00000000-0000-4000-8000-000000000007', 'Open', 'paid'),
('reg-nola-2', 'new-orleans-classic-2026', '00000000-0000-4000-8000-000000000008', 'U1600', 'pending'),
('reg-lafayette-1', 'lafayette-winter-classic-2026', '00000000-0000-4000-8000-000000000016', 'Open', 'paid'),
('reg-state-1', 'state-championship-2025', '00000000-0000-4000-8000-000000000002', 'Championship', 'paid'),
('reg-state-2', 'state-championship-2025', '00000000-0000-4000-8000-000000000007', 'Championship', 'paid');

-- ─── Club officers ───────────────────────────────────────────────────────────
INSERT INTO club_officers (id, club_id, member_id, role) VALUES
('off-br-1', 'baton-rouge', '00000000-0000-4000-8000-000000000012', 'president'),
('off-br-2', 'baton-rouge', '00000000-0000-4000-8000-000000000013', 'rep'),
('off-br-3', 'baton-rouge', '00000000-0000-4000-8000-000000000010', 'secretary'),
('off-no-1', 'new-orleans', '00000000-0000-4000-8000-000000000007', 'president'),
('off-no-2', 'new-orleans', '00000000-0000-4000-8000-000000000008', 'rep'),
('off-no-3', 'new-orleans', '00000000-0000-4000-8000-000000000003', 'treasurer'),
('off-sh-1', 'shreveport', '00000000-0000-4000-8000-000000000011', 'president'),
('off-lc-1', 'lake-charles', '00000000-0000-4000-8000-000000000014', 'president'),
('off-lc-2', 'lake-charles', '00000000-0000-4000-8000-000000000015', 'rep');

-- ─── Club news ───────────────────────────────────────────────────────────────
INSERT INTO club_news (id, club_id, title, news_date, excerpt) VALUES
('news-br-1', 'baton-rouge', 'Club Championship Results Posted', 'January 20, 2026', 'Congratulations to Carlos Rivera for winning the 2025–26 club championship with a perfect 7/7 score.'),
('news-br-2', 'baton-rouge', 'New Member Orientation February 4', 'January 10, 2026', 'First-time visitors are welcome at our monthly orientation — free boards and clocks provided.'),
('news-no-1', 'new-orleans', 'Blitz Championship This Month', 'February 5, 2026', 'Five rounds of G/5 blitz — $10 entry, trophies for top three in each rating class.'),
('news-sh-1', 'shreveport', 'Scholastic Program Expanding', 'January 28, 2026', 'We are partnering with three Caddo Parish schools to bring after-school chess to 120 new students.'),
('news-laf-1', 'lafayette', 'Winter Classic Underway', 'February 8, 2026', 'Round 3 of the Lafayette Winter Classic is in progress — follow live results on the tournament page.'),
('news-lc-1', 'lake-charles', 'Welcome to the LCA Network', 'January 15, 2026', 'Lake Charles Chess Society is now officially affiliated with the Louisiana Chess Association.'),
('news-lc-2', 'lake-charles', 'First Club Tournament Planned for April', 'February 1, 2026', 'We are planning a four-round Swiss for April — details coming soon.');
