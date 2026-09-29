-- migrations/0038_campaign_external_recipients.sql
--
-- Group email can now go to addresses that don't belong to an account yet
-- (a parent, a school contact, someone who hasn't signed up). Those
-- recipient rows have no member, so member_id becomes nullable.
--
-- SQLite can't drop NOT NULL in place, so the table is rebuilt. Nothing
-- references email_campaign_recipients, so the usual copy-and-rename is safe
-- here (unlike members, which child tables point at). Column list is 0021's
-- plus 0030's claimed_at and attempts — the whole table today.

PRAGMA defer_foreign_keys = true;

CREATE TABLE email_campaign_recipients_new (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  member_id TEXT,
  email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  error TEXT,
  sent_at TEXT,
  claimed_at TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (campaign_id) REFERENCES email_campaigns(id),
  FOREIGN KEY (member_id) REFERENCES members(id)
);

INSERT INTO email_campaign_recipients_new
  (id, campaign_id, member_id, email, status, error, sent_at, claimed_at, attempts)
SELECT id, campaign_id, member_id, email, status, error, sent_at, claimed_at, attempts
  FROM email_campaign_recipients;

DROP TABLE email_campaign_recipients;
ALTER TABLE email_campaign_recipients_new RENAME TO email_campaign_recipients;

CREATE INDEX IF NOT EXISTS idx_campaign_recipients_campaign ON email_campaign_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_pending ON email_campaign_recipients(campaign_id, status);
