-- 0041_pairing_system_rating_at_entry.sql
--
-- pairing_system: 'uscf' (US Chess Rule 29, the default) or 'fide'
-- (FIDE-style colors and placement), chosen per tournament by the director.
--
-- rating_at_entry: the player's rating when they entered. Pairings, wall
-- charts and the rating report use this, not the member's current rating,
-- which the nightly sync overwrites (after the event is rated it would show
-- the post-event rating). Existing entries take today's rating as the best
-- available value. A director can edit it (e.g. to assign an unrated
-- player a rating for pairing purposes).

ALTER TABLE tournaments ADD COLUMN pairing_system TEXT NOT NULL DEFAULT 'uscf';
ALTER TABLE registrations ADD COLUMN rating_at_entry INTEGER;

UPDATE registrations
   SET rating_at_entry = (SELECT m.uscf_rating FROM members m WHERE m.id = registrations.member_id)
 WHERE rating_at_entry IS NULL;
