-- 0018: day-of check-in for registrations
-- NULL = not checked in. Check-in means "present at the event" (one flag,
-- not per-round). Must apply AFTER 0017.
ALTER TABLE registrations ADD COLUMN checked_in_at TEXT;
