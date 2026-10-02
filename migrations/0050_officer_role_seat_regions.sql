-- 0050_officer_role_seat_regions.sql
--
-- 1. The lca_officer role: everything lca_observer can do except the mailing
--    tools. Roles are enforced by triggers since 0046, so adding one is a
--    DROP TRIGGER + CREATE TRIGGER. No table is rebuilt.
--
-- 2. seat_regions: which club regions a regional representative's seat
--    covers. Whoever holds the seat manages every club in those regions.
--    A seat can cover several regions, and a region can have several seats.
--    Seat names don't line up with region names everywhere ("Baton Rouge /
--    East Central Representative"), so this is set by an admin on the Board
--    seats page; the obvious matches are filled in below as a starting point.

DROP TRIGGER IF EXISTS members_role_insert;
CREATE TRIGGER members_role_insert BEFORE INSERT ON members
WHEN NEW.role NOT IN ('member', 'lca_auditor', 'lca_officer', 'lca_observer', 'club_rep', 'tournament_director', 'lca_admin', 'guest')
  OR NEW.membership_status NOT IN ('active', 'expired', 'pending')
BEGIN
  SELECT RAISE(ABORT, 'members: role or membership_status not allowed');
END;

DROP TRIGGER IF EXISTS members_role_update;
CREATE TRIGGER members_role_update BEFORE UPDATE OF role, membership_status ON members
WHEN NEW.role NOT IN ('member', 'lca_auditor', 'lca_officer', 'lca_observer', 'club_rep', 'tournament_director', 'lca_admin', 'guest')
  OR NEW.membership_status NOT IN ('active', 'expired', 'pending')
BEGIN
  SELECT RAISE(ABORT, 'members: role or membership_status not allowed');
END;

CREATE TABLE IF NOT EXISTS seat_regions (
  seat_id TEXT NOT NULL REFERENCES board_members(id) ON DELETE CASCADE,
  region TEXT NOT NULL,
  PRIMARY KEY (seat_id, region)
);

CREATE INDEX IF NOT EXISTS idx_seat_regions_region ON seat_regions(region);

-- Starting matches from the seat names. Anything not matched here is left
-- for an admin to set.
INSERT OR IGNORE INTO seat_regions (seat_id, region)
SELECT id, 'New Orleans Metro' FROM board_members
 WHERE category = 'regional_rep' AND role LIKE '%New Orleans%';

INSERT OR IGNORE INTO seat_regions (seat_id, region)
SELECT id, 'North Louisiana' FROM board_members
 WHERE category = 'regional_rep' AND role LIKE '%North Louisiana%';

INSERT OR IGNORE INTO seat_regions (seat_id, region)
SELECT id, 'Central Louisiana' FROM board_members
 WHERE category = 'regional_rep' AND role LIKE '%Central Louisiana%'
   AND role NOT LIKE '%South Central%';

INSERT OR IGNORE INTO seat_regions (seat_id, region)
SELECT id, 'South Central Louisiana' FROM board_members
 WHERE category = 'regional_rep' AND role LIKE '%South Central%';

INSERT OR IGNORE INTO seat_regions (seat_id, region)
SELECT id, 'Southwest Louisiana' FROM board_members
 WHERE category = 'regional_rep' AND role LIKE '%Southwest%';

INSERT OR IGNORE INTO seat_regions (seat_id, region)
SELECT id, 'Bayou Region' FROM board_members
 WHERE category = 'regional_rep' AND role LIKE '%Bayou%';

INSERT OR IGNORE INTO seat_regions (seat_id, region)
SELECT id, 'North of Lake Pontchartrain' FROM board_members
 WHERE category = 'regional_rep'
   AND (role LIKE '%Lake Pontchartrain%' OR role LIKE '%Northshore%' OR role LIKE '%North Shore%');
