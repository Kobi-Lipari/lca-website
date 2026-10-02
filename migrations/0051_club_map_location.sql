-- 0051_club_map_location.sql
--
-- Where a club's pin goes on the Clubs map. Set from the club's admin page
-- (admins, the club's rep, and its regional representative). Clubs without
-- one fall back to the original club list, matched on name.

ALTER TABLE clubs ADD COLUMN latitude REAL;
ALTER TABLE clubs ADD COLUMN longitude REAL;
