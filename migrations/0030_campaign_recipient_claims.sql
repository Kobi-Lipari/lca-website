-- migrations/0030_campaign_recipient_claims.sql
--
-- Makes a campaign send resumable.
--
-- Sending ran entirely inside waitUntil() on the request that created the
-- campaign. At ~400ms per recipient a 194-member send takes well over a
-- minute of wall clock, and if that invocation is cut short — eviction,
-- limits, a deploy landing mid-send — the remaining recipients stay
-- 'pending' forever with nothing to pick them up. The campaign sits at
-- status 'sending' and the admin has no way to finish it.
--
-- A cron sweep can now resume those, which introduces the opposite risk:
-- two runs working the same campaign and mailing people twice. claimed_at
-- is the lock that prevents it. A run claims a bounded batch in one atomic
-- UPDATE and sends only what it claimed; a claim older than the timeout is
-- treated as abandoned and becomes reclaimable, so a crashed run doesn't
-- strand its batch either.
--
-- attempts bounds retries of transient failures (rate limits, upstream 5xx)
-- so a genuinely undeliverable address stops being retried rather than
-- being swept forever.

ALTER TABLE email_campaign_recipients ADD COLUMN claimed_at TEXT;
ALTER TABLE email_campaign_recipients ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0;

-- The sweep's entry point: find campaigns still in flight. Without this it
-- is a full scan of email_campaigns on every run.
CREATE INDEX idx_campaigns_status ON email_campaigns(status);

-- Claiming filters on status and claimed_at within a campaign; the existing
-- idx_campaign_recipients_pending covers (campaign_id, status) but not the
-- claim check, which decides most of the rows on a resumed send.
CREATE INDEX idx_campaign_recipients_claim
  ON email_campaign_recipients(campaign_id, status, claimed_at);
