-- migrations/0021_email_campaigns.sql
--
-- Mass-email admin tool: one row per campaign, one row per recipient so
-- sends are resumable and auditable (who got what, when, and whether it
-- failed) rather than a fire-and-forget loop with no record.

CREATE TABLE email_campaigns (
  id TEXT PRIMARY KEY,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  filter_json TEXT NOT NULL,          -- {"all":true} or {"roles":[],"clubIds":[],"membershipStatuses":[]}
  total_recipients INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'sending' CHECK (status IN ('sending', 'completed', 'failed')),
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  FOREIGN KEY (created_by) REFERENCES members(id)
);

CREATE TABLE email_campaign_recipients (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  error TEXT,
  sent_at TEXT,
  FOREIGN KEY (campaign_id) REFERENCES email_campaigns(id),
  FOREIGN KEY (member_id) REFERENCES members(id)
);

CREATE INDEX idx_campaign_recipients_campaign ON email_campaign_recipients(campaign_id);
CREATE INDEX idx_campaign_recipients_pending ON email_campaign_recipients(campaign_id, status);