-- 0042_registration_rules.sql
--
-- Phase 2 registration features.
--
-- registrations.grade        grade given at entry when a section has grade
--                            limits ('K', '1'..'12').
-- registrations.waitlisted_at set while an entry is on the waitlist; such
--                            entries don't count toward the cap, aren't paired
--                            and aren't charged until a spot is offered.
-- members.grade              last grade given, to prefill the next entry.
-- members.uscf_expiration    US Chess membership expiry, from the nightly sync,
--                            so entry can warn about a lapsed membership.
-- tournaments pricing        early-entry discount (until early_deadline),
--                            late fee (after late_after), and a discount for
--                            current LCA members. Amounts in dollars.

ALTER TABLE registrations ADD COLUMN grade TEXT;
ALTER TABLE registrations ADD COLUMN waitlisted_at TEXT;
ALTER TABLE members ADD COLUMN grade TEXT;
ALTER TABLE members ADD COLUMN uscf_expiration TEXT;
ALTER TABLE tournaments ADD COLUMN early_deadline TEXT;
ALTER TABLE tournaments ADD COLUMN early_discount REAL NOT NULL DEFAULT 0;
ALTER TABLE tournaments ADD COLUMN late_after TEXT;
ALTER TABLE tournaments ADD COLUMN late_fee REAL NOT NULL DEFAULT 0;
ALTER TABLE tournaments ADD COLUMN member_discount REAL NOT NULL DEFAULT 0;
