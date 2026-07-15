-- 0020_membership_type.sql
-- Adds the membership tier to members. Nullable, no CHECK constraint yet:
-- existing rows (and walk-in guests) have no tier, and the tier list is
-- still settling (the 'test' tier dies before launch; family accounts are
-- about to change how 'family' behaves). Tighten with a CHECK later if wanted.
-- Values written by the bulk import: adult | scholastic | family | senior | single_event
ALTER TABLE members ADD COLUMN membership_type TEXT DEFAULT NULL;
