-- migrations/0028_fix_seat_slugs_categories.sql
--
-- Repairs two things the original 0025 got wrong on databases that were
-- migrated before it was corrected:
--
--   1. Categories were derived with LIKE '%Region%'. LCA's role names say
--      "Representative" — "New Orleans Metro Representative", "North Louisiana
--      Representative" — so every regional seat was filed as an officer and
--      rendered under the wrong heading.
--
--   2. Slugs kept runs of hyphens. 'Secretary - Treasurer' became
--      'secretary---treasurer' and 'Baton Rouge / East Central Representative'
--      became 'baton-rouge---east-central-representative'.
--
-- Safe to run on a database built from the corrected 0025: every statement is
-- a no-op there.
--
-- Slugs are normally frozen once assigned, because they're public URLs and the
-- anchor for a seat's ticket history. Changing them is only acceptable here
-- because this runs before any ticket exists and before any link has been
-- shared. After this, treat them as immutable.

-- Category is derived from the role name, so recompute both directions rather
-- than only setting the ones that changed.
UPDATE board_members
   SET category = 'regional_rep'
 WHERE role LIKE '%Representative%';

UPDATE board_members
   SET category = 'officer'
 WHERE role NOT LIKE '%Representative%';

-- Two passes: one replace() call turns '---' into '--', not into '-'.
UPDATE board_members
   SET slug = replace(slug, '--', '-')
 WHERE slug LIKE '%--%';

UPDATE board_members
   SET slug = replace(slug, '--', '-')
 WHERE slug LIKE '%--%';

UPDATE board_members
   SET slug = trim(slug, '-')
 WHERE slug LIKE '-%' OR slug LIKE '%-';