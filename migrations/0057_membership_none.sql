-- 0057_membership_none.sql
--
-- Hand-written migration (npm run db:generate -- <name> --custom), staged as
-- drizzle/0006_membership_none.sql. drizzle/meta now records functions/db/schema.ts as it
-- is, so write the SQL that brings the database to match it. Triggers, data
-- changes and table rebuilds belong here; see migrations/README.md.
--
-- Retires "pending" as a membership status. Every account started as
-- 'pending', which members read as "a payment is in progress" when it only
-- ever meant "no membership yet". The stored states are now 'none' (an
-- account with no membership), 'active' and 'expired'. Whether a payment is
-- in flight is answered by asking Stripe (POST /api/membership/confirm),
-- not by the member row.
--
-- The column's default stays 'pending' in the table definition, because
-- changing a default in SQLite means rebuilding members, which other tables
-- cascade from (see README). Instead the two checks from 0050 accept 'none'
-- and two new triggers turn any 'pending' written, by the default or by old
-- code, into 'none' at once, so the value can never persist again. Safe to
-- run twice: the UPDATE finds nothing the second time and the triggers are
-- replaced in place. Order matters: the checks are replaced before the
-- UPDATE, because the 0050 checks would reject 'none'.

DROP TRIGGER IF EXISTS members_role_insert;
CREATE TRIGGER members_role_insert BEFORE INSERT ON members
WHEN NEW.role NOT IN ('member', 'lca_auditor', 'lca_officer', 'lca_observer', 'club_rep', 'tournament_director', 'lca_admin', 'guest')
  OR NEW.membership_status NOT IN ('active', 'expired', 'none', 'pending')
BEGIN
  SELECT RAISE(ABORT, 'members: role or membership_status not allowed');
END;

DROP TRIGGER IF EXISTS members_role_update;
CREATE TRIGGER members_role_update BEFORE UPDATE OF role, membership_status ON members
WHEN NEW.role NOT IN ('member', 'lca_auditor', 'lca_officer', 'lca_observer', 'club_rep', 'tournament_director', 'lca_admin', 'guest')
  OR NEW.membership_status NOT IN ('active', 'expired', 'none', 'pending')
BEGIN
  SELECT RAISE(ABORT, 'members: role or membership_status not allowed');
END;

-- The checks above now accept 'none', so the rows can move.
UPDATE members SET membership_status = 'none' WHERE membership_status = 'pending';

DROP TRIGGER IF EXISTS members_status_none_insert;
CREATE TRIGGER members_status_none_insert AFTER INSERT ON members
WHEN NEW.membership_status = 'pending'
BEGIN
  UPDATE members SET membership_status = 'none' WHERE id = NEW.id;
END;

DROP TRIGGER IF EXISTS members_status_none_update;
CREATE TRIGGER members_status_none_update AFTER UPDATE OF membership_status ON members
WHEN NEW.membership_status = 'pending'
BEGIN
  UPDATE members SET membership_status = 'none' WHERE id = NEW.id;
END;
