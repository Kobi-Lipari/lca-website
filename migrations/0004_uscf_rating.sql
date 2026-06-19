-- Sprint 7: USCF rating cache on members
ALTER TABLE members ADD COLUMN uscf_rating INTEGER;
ALTER TABLE members ADD COLUMN uscf_rating_updated_at TEXT;
