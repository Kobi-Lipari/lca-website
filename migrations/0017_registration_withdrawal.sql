-- 0017: soft withdrawal for registrations
-- NULL = active. Timestamp records when the player was withdrawn,
-- which matters when reconciling manual Stripe refunds later.
ALTER TABLE registrations ADD COLUMN withdrawn_at TEXT;
