-- scripts/seed/fixtures.sql
--
-- Synthetic data for the local accessibility test database (npm run
-- test:a11y loads it into .wrangler/a11y) and for the branch preview database
-- (npm run db:seed:preview, which runs scripts/db/preview-guard.ts first and
-- stops unless the target is lca-db-preview). Never load it into lca-db.
--
-- Everything here is made up. Every person is "<first name> Fixture", every
-- email address is at example.org, no one has a US Chess ID, and every
-- link points at example.org. Nothing names a real person.
--
-- It is written against the schema after migration 0054 and needs migrations
-- 0001 to 0054 applied first. Every row it owns has an id starting "fx-", so
-- it never touches the rows the migrations add, and it can be loaded again:
--   - clubs, members, seats, posts, documents and champions are upserted
--     (INSERT ... ON CONFLICT(id) DO UPDATE), so a second load changes them
--     back to what is written here and deletes nothing;
--   - the fixture tournaments are deleted and inserted again, with their
--     entries and games, so the 0053 triggers build their section and
--     schedule rows from the JSON columns afresh each time.
-- There is no BEGIN or COMMIT: wrangler d1 execute runs a file as one batch.
--
-- Dates are relative to the day it is loaded (date('now', '+24 days')), so
-- the open event is always open and the finished one always finished.
--
-- What it holds:
--   fx-t-open     an open LCA event (no club), sections as objects with fees,
--                 an early discount and a late fee at the event level, and the
--                 Open section's own early and late prices; three entries,
--                 two of them the children below
--   fx-t-quads    an LCA event with a round_schedule (three rounds)
--   fx-t-legacy   an older event whose sections are plain strings, no fees
--   fx-t-done     a finished event with half-point results: draws, a full
--                 bye and two half-point byes
--   fx-partner-1  a partner event in the clearinghouse feed, which registers
--                 on the organizer's site
--   two clubs, a pinned news post and one more, governance documents (bylaws,
--   minutes, a treasurer's report), two champions, two board seats with their
--   holders, and a guardian with two children on a family membership.

-- ---------------------------------------------------------------------------
-- Clubs
-- ---------------------------------------------------------------------------
INSERT INTO clubs (id, name, city, location, description, meeting_schedule, contact_email, color, region, latitude, longitude)
VALUES
  ('fx-club-capital', 'Fixture Capital Chess Club', 'Baton Rouge', 'Fixture Community Center, 100 Example St, Baton Rouge, LA',
   'A made-up club for tests. Casual and rated games for every level.', 'Tuesdays at 7:00 PM', 'capital-club@example.org',
   '#1f4e79', 'South Central Louisiana', 30.4515, -91.1871),
  ('fx-club-north', 'Fixture North Chess Club', 'Monroe', 'Fixture Library, 200 Example Ave, Monroe, LA',
   'A made-up club for tests. Blitz on Fridays, lessons for new players on Saturdays.', 'Fridays at 6:30 PM', 'north-club@example.org',
   '#2e7d32', 'North Louisiana', 32.5093, -92.1193)
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name, city = excluded.city, location = excluded.location, description = excluded.description,
  meeting_schedule = excluded.meeting_schedule, contact_email = excluded.contact_email, color = excluded.color,
  region = excluded.region, latitude = excluded.latitude, longitude = excluded.longitude;

-- ---------------------------------------------------------------------------
-- Members. The guardian comes first: the children name her in guardian_id.
-- A child has no address of their own: like POST /api/me/children, each
-- child row carries the guardian's email, so confirmations go to the parent.
-- ---------------------------------------------------------------------------
INSERT INTO members (id, email, full_name, membership_status, membership_expiry, membership_type, role, club_id, uscf_rating, guardian_id)
VALUES
  ('fx-m-guardian', 'dana.fixture@example.org', 'Dana Fixture', 'active', date('now', '+300 days'), 'family', 'member', 'fx-club-capital', NULL, NULL),
  ('fx-m-child-1', 'dana.fixture@example.org', 'Robin Fixture', 'active', date('now', '+300 days'), 'family', 'member', 'fx-club-capital', 845, 'fx-m-guardian'),
  ('fx-m-child-2', 'dana.fixture@example.org', 'Quinn Fixture', 'active', date('now', '+300 days'), 'family', 'member', 'fx-club-capital', NULL, 'fx-m-guardian'),
  ('fx-m-p1', 'avery.fixture@example.org', 'Avery Fixture', 'active', date('now', '+200 days'), 'adult', 'member', 'fx-club-capital', 1910, NULL),
  ('fx-m-p2', 'jordan.fixture@example.org', 'Jordan Fixture', 'active', date('now', '+150 days'), 'adult', 'member', 'fx-club-north', 1655, NULL),
  ('fx-m-p3', 'casey.fixture@example.org', 'Casey Fixture', 'active', date('now', '+90 days'), 'scholastic', 'member', 'fx-club-north', 1420, NULL),
  ('fx-m-p4', 'morgan.fixture@example.org', 'Morgan Fixture', 'expired', date('now', '-20 days'), 'adult', 'member', NULL, 1288, NULL),
  ('fx-m-p5', 'riley.fixture@example.org', 'Riley Fixture', 'active', date('now', '+250 days'), 'senior', 'member', 'fx-club-capital', 1730, NULL)
ON CONFLICT(id) DO UPDATE SET
  email = excluded.email, full_name = excluded.full_name, membership_status = excluded.membership_status,
  membership_expiry = excluded.membership_expiry, membership_type = excluded.membership_type, role = excluded.role,
  club_id = excluded.club_id, uscf_rating = excluded.uscf_rating, guardian_id = excluded.guardian_id;

-- ---------------------------------------------------------------------------
-- Tournaments: deleted and inserted again. Entries go first (they do not
-- cascade); deleting a tournament cascades to its sections, schedules,
-- games, directors and reminders, and sets a champion's tournament to null
-- until the champions below are written again.
-- ---------------------------------------------------------------------------
DELETE FROM registrations WHERE tournament_id LIKE 'fx-%';
DELETE FROM tournaments WHERE id LIKE 'fx-%';

-- The open LCA event. The trigger reads entryFee into fee_regular; the early
-- and late prices of one section are set with the UPDATE below, because the
-- trigger never writes fee_early or fee_late.
INSERT INTO tournaments (
  id, name, location, venue, date, end_date, entry_fee, sections, rounds, max_players, status, description,
  registration_status, registration_opens_at, registration_closes_at, is_rated, is_visible, time_control,
  early_deadline, early_discount, late_after, late_fee, requires_lca_membership
) VALUES (
  'fx-t-open', 'Fixture Fall Open', 'Baton Rouge, LA', 'Fixture Community Center', date('now', '+24 days'), date('now', '+25 days'),
  40,
  '[{"name":"Open","entryFee":40,"prizeFund":"$600 based on 40 entries"},{"name":"Under 1600","entryFee":35,"ratingMax":1599},{"name":"Scholastic","entryFee":20,"gradeMax":12,"unratedOk":true}]',
  5, 120, 'upcoming', 'A made-up two-day event for tests. Five rounds, rated by US Chess.',
  'open', datetime('now', '-10 days'), date('now', '+22 days'), 1, 1, 'G/90;d5',
  date('now', '+7 days'), 5, date('now', '+20 days'), 10, 1
);
UPDATE tournament_sections SET fee_early = 32, fee_late = 50
 WHERE tournament_id = 'fx-t-open' AND name = 'Open' AND archived_at IS NULL;

-- An event with its round times in round_schedule ([{round, date, time}],
-- times as 24-hour HH:MM). The trigger writes the primary schedule's rounds.
INSERT INTO tournaments (
  id, name, location, venue, date, entry_fee, sections, rounds, status, description,
  registration_status, is_rated, is_visible, time_control, round_schedule, club_id, requires_lca_membership
) VALUES (
  'fx-t-quads', 'Fixture Saturday Quads', 'Monroe, LA', 'Fixture Library', date('now', '+10 days'), 15,
  '[{"name":"Quads","entryFee":15}]',
  3, 'upcoming', 'A made-up one-day event for tests, run by a club.',
  'open', 1, 1, 'G/30;d5',
  json_array(
    json_object('round', 1, 'date', date('now', '+10 days'), 'time', '10:00'),
    json_object('round', 2, 'date', date('now', '+10 days'), 'time', '11:30'),
    json_object('round', 3, 'date', date('now', '+10 days'), 'time', '13:00')
  ),
  'fx-club-north', 0
);

-- An older event whose sections are plain names with no fees, as events were
-- stored before sections became objects. Announced, registration not open.
INSERT INTO tournaments (
  id, name, location, date, entry_fee, sections, rounds, status, registration_status, is_visible
) VALUES (
  'fx-t-legacy', 'Fixture Winter Swiss', 'Lafayette, LA', date('now', '+45 days'), 25,
  '["Open","Reserve","Novice"]', 4, 'upcoming', 'draft', 1
);

-- A finished event with half-point results.
INSERT INTO tournaments (
  id, name, location, venue, date, entry_fee, sections, rounds, status, registration_status, is_visible, time_control
) VALUES (
  'fx-t-done', 'Fixture Summer Championship', 'Baton Rouge, LA', 'Fixture Community Center', date('now', '-30 days'), 30,
  '[{"name":"Open","entryFee":30}]', 3, 'completed', 'closed', 1, 'G/60;d5'
);

-- Entries. The 0053 trigger fills section_id and schedule_id from the names.
-- A child's grade is never stored: like the registration endpoints, an entry
-- keeps only the range the guardian confirmed ("0-12" is "12th grade or
-- below", K = 0), never the grade itself.
INSERT INTO registrations (id, tournament_id, member_id, section, payment_status, rating_at_entry, grade, registered_at)
VALUES
  ('fx-r-open-1', 'fx-t-open', 'fx-m-p1', 'Open', 'paid', 1910, NULL, datetime('now', '-6 days')),
  ('fx-r-open-2', 'fx-t-open', 'fx-m-child-1', 'Scholastic', 'paid', 845, '0-12', datetime('now', '-5 days')),
  ('fx-r-open-3', 'fx-t-open', 'fx-m-child-2', 'Scholastic', 'paid', NULL, '0-12', datetime('now', '-5 days')),
  ('fx-r-done-1', 'fx-t-done', 'fx-m-p1', 'Open', 'paid', 1905, NULL, datetime('now', '-40 days')),
  ('fx-r-done-2', 'fx-t-done', 'fx-m-p2', 'Open', 'paid', 1660, NULL, datetime('now', '-40 days')),
  ('fx-r-done-3', 'fx-t-done', 'fx-m-p3', 'Open', 'paid', 1410, NULL, datetime('now', '-39 days')),
  ('fx-r-done-4', 'fx-t-done', 'fx-m-p4', 'Open', 'paid', 1290, NULL, datetime('now', '-38 days')),
  ('fx-r-done-5', 'fx-t-done', 'fx-m-p5', 'Open', 'paid', 1725, NULL, datetime('now', '-37 days'));

-- Three rounds for five players, so one sits out each round. Final scores:
-- Avery 2½, Riley 2, Casey 1½, Morgan 1½, Jordan ½.
INSERT INTO tournament_games (id, tournament_id, round, board, section, white_member_id, black_member_id, result)
VALUES
  ('fx-g-1-1', 'fx-t-done', 1, 1, 'Open', 'fx-m-p1', 'fx-m-p2', '1-0'),
  ('fx-g-1-2', 'fx-t-done', 1, 2, 'Open', 'fx-m-p3', 'fx-m-p4', '1/2-1/2'),
  ('fx-g-1-3', 'fx-t-done', 1, 3, 'Open', 'fx-m-p5', NULL, 'bye'),
  ('fx-g-2-1', 'fx-t-done', 2, 1, 'Open', 'fx-m-p5', 'fx-m-p1', '1/2-1/2'),
  ('fx-g-2-2', 'fx-t-done', 2, 2, 'Open', 'fx-m-p2', 'fx-m-p3', '0-1'),
  ('fx-g-2-3', 'fx-t-done', 2, 3, 'Open', 'fx-m-p4', NULL, 'bye-half'),
  ('fx-g-3-1', 'fx-t-done', 3, 1, 'Open', 'fx-m-p3', 'fx-m-p1', '0-1'),
  ('fx-g-3-2', 'fx-t-done', 3, 2, 'Open', 'fx-m-p4', 'fx-m-p5', '1/2-1/2'),
  ('fx-g-3-3', 'fx-t-done', 3, 3, 'Open', 'fx-m-p2', NULL, 'bye-half');

-- A partner event: it registers on the organizer's site, never here.
INSERT INTO clearinghouse (id, name, start_date, end_date, organizer, city, state, venue, rating_system, eligibility, contact, link, is_lca)
VALUES (
  'fx-partner-1', 'Fixture Gulf Coast Open', date('now', '+31 days'), date('now', '+32 days'), 'Fixture Partner Chess Club',
  'Gulfport', 'MS', 'Fixture Hall', 'US Chess', 'Open to all', 'partner@example.org', 'https://example.org/fixture-gulf-coast-open', 0
)
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name, start_date = excluded.start_date, end_date = excluded.end_date, organizer = excluded.organizer,
  city = excluded.city, state = excluded.state, venue = excluded.venue, rating_system = excluded.rating_system,
  eligibility = excluded.eligibility, contact = excluded.contact, link = excluded.link, is_lca = excluded.is_lca;

-- ---------------------------------------------------------------------------
-- Champions, one of them linked to the finished event.
-- ---------------------------------------------------------------------------
INSERT INTO state_champions (id, year, title, champion, notes, tournament_id, kind)
VALUES
  ('fx-champ-1', CAST(strftime('%Y', 'now') AS INTEGER), 'Fixture State Champion', 'Avery Fixture', 'Won with 2½ of 3.', 'fx-t-done', 'state'),
  ('fx-champ-2', CAST(strftime('%Y', 'now') AS INTEGER) - 1, 'Fixture Scholastic Champion', 'Robin Fixture', NULL, NULL, 'scholastic')
ON CONFLICT(id) DO UPDATE SET
  year = excluded.year, title = excluded.title, champion = excluded.champion, notes = excluded.notes,
  tournament_id = excluded.tournament_id, kind = excluded.kind;

-- ---------------------------------------------------------------------------
-- News: one pinned post and one ordinary post, both published.
-- ---------------------------------------------------------------------------
INSERT INTO lca_posts (id, slug, title, summary, body_html, status, pinned, published_at)
VALUES
  ('fx-post-pinned', 'fixture-pinned-notice', 'Fixture notice: the annual meeting moves online',
   'A made-up pinned notice for tests.', '<p>A made-up pinned notice for tests. The meeting starts at 7:00 PM.</p>',
   'published', 1, datetime('now', '-2 days')),
  ('fx-post-recap', 'fixture-summer-recap', 'Fixture Summer Championship recap',
   'A made-up recap for tests.', '<p>Avery Fixture won with 2½ of 3.</p>',
   'published', 0, datetime('now', '-28 days'))
ON CONFLICT(id) DO UPDATE SET
  slug = excluded.slug, title = excluded.title, summary = excluded.summary, body_html = excluded.body_html,
  status = excluded.status, pinned = excluded.pinned, published_at = excluded.published_at;

-- ---------------------------------------------------------------------------
-- Governance documents, in categories the documents API accepts.
-- ---------------------------------------------------------------------------
INSERT INTO governance_documents (id, category, title, content, doc_date, year)
VALUES
  ('fx-doc-bylaws', 'bylaws', 'Fixture bylaws', '<h2>Article 1</h2><p>A made-up article for tests.</p>', date('now', '-400 days'), CAST(strftime('%Y', 'now', '-400 days') AS INTEGER)),
  ('fx-doc-minutes', 'minutes', 'Fixture board meeting minutes', '<p>Made-up minutes for tests. The meeting opened at 7:00 PM.</p>', date('now', '-35 days'), CAST(strftime('%Y', 'now', '-35 days') AS INTEGER)),
  ('fx-doc-treasurer', 'treasurer', 'Fixture treasurer''s report', '<p>A made-up report for tests.</p>', date('now', '-35 days'), CAST(strftime('%Y', 'now', '-35 days') AS INTEGER))
ON CONFLICT(id) DO UPDATE SET
  category = excluded.category, title = excluded.title, content = excluded.content,
  doc_date = excluded.doc_date, year = excluded.year;

-- ---------------------------------------------------------------------------
-- Board seats and their holders. The migrations' own seats are left alone.
-- ---------------------------------------------------------------------------
INSERT INTO board_members (id, role, name, sort_order, slug, category, is_active, is_shared)
VALUES
  ('fx-seat-officer', 'Fixture Secretary', 'Avery Fixture', 90, 'fixture-secretary', 'officer', 1, 0),
  ('fx-seat-rep', 'Fixture Regional Representative', 'Jordan Fixture', 91, 'fixture-regional-representative', 'regional_rep', 1, 0)
ON CONFLICT(id) DO UPDATE SET
  role = excluded.role, name = excluded.name, sort_order = excluded.sort_order, slug = excluded.slug,
  category = excluded.category, is_active = excluded.is_active, is_shared = excluded.is_shared;

INSERT OR IGNORE INTO seat_regions (seat_id, region) VALUES ('fx-seat-rep', 'North Louisiana');

INSERT INTO board_seat_assignments (id, seat_id, member_id, started_at, ended_at)
VALUES
  ('fx-assign-officer', 'fx-seat-officer', 'fx-m-p1', datetime('now', '-200 days'), NULL),
  ('fx-assign-rep', 'fx-seat-rep', 'fx-m-p2', datetime('now', '-120 days'), NULL)
ON CONFLICT(id) DO UPDATE SET
  seat_id = excluded.seat_id, member_id = excluded.member_id, started_at = excluded.started_at, ended_at = excluded.ended_at;
