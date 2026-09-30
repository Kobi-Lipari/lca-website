-- 0045_report_settings.sql
--
-- tournaments.report_settings  JSON with what the US Chess upload files
--                              need that the site doesn't otherwise know:
--                              affiliate ID, chief and assistant TD IDs,
--                              city/state/ZIP, scholastic flag, and per
--                              section the rating system and who gets the
--                              crosstable. Filled in once on the report card.

ALTER TABLE tournaments ADD COLUMN report_settings TEXT;
