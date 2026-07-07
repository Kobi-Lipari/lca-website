-- migrations/0016_stripe_payment_tracking.sql
ALTER TABLE payments ADD COLUMN stripe_session_id TEXT;
ALTER TABLE payments ADD COLUMN stripe_payment_intent TEXT;