-- 0048_officer_photos.sql
--
-- Officer photos for the Board page, uploaded by admins.
-- members.photo_url        a seat holder's photo (follows the person if
--                          they move to another seat).
-- board_members.photo_url  for a seat with no member account linked yet.
-- Both are plain ADD COLUMNs: no table is rebuilt (see migrations/README.md).

ALTER TABLE members ADD COLUMN photo_url TEXT;
ALTER TABLE board_members ADD COLUMN photo_url TEXT;
