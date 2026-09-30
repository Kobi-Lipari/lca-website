-- 0043_grade_ranges.sql
--
-- Entry forms no longer ask a player's grade; they ask the player to
-- confirm they're in the section's range ("8th grade or below"). What's
-- kept is the confirmed range, "min-max" with K = 0.
--
-- registrations.grade  now holds that range. Entries made while the form
--                      still asked for a grade ('K', '3') become a range of
--                      one grade.
-- members.grade        dropped: nothing about a player's grade is kept
--                      on their account any more.

UPDATE registrations SET grade = '0-0' WHERE grade IN ('K', 'k', 'KG');
UPDATE registrations SET grade = grade || '-' || grade
 WHERE grade IS NOT NULL AND grade NOT LIKE '%-%';
UPDATE members SET grade = NULL;
ALTER TABLE members DROP COLUMN grade;
