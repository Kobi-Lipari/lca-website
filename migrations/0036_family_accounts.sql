-- migrations/0036_family_accounts.sql
--
-- Family accounts: a parent (guardian) manages profiles for their children.
--
-- A child is an ordinary members row — so registrations, pairings,
-- standings, ratings and the check-in desk all work unchanged — with
-- guardian_id pointing at the parent who manages it. Children have no
-- login of their own; their email is the guardian's, so every existing
-- email (registration confirmations, reminders) reaches the parent.
--
-- Plain ADD COLUMN, no table rebuild: nothing about members' CHECK
-- constraints changes. NULL for every existing row.
ALTER TABLE members ADD COLUMN guardian_id TEXT REFERENCES members(id) DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_members_guardian_id ON members(guardian_id);
