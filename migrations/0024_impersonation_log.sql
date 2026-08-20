-- 0024_impersonation_log.sql
-- Audit trail for LCA admin "log in as user" sessions.

CREATE TABLE IF NOT EXISTS impersonation_log (
  id               TEXT PRIMARY KEY,
  admin_id         TEXT NOT NULL REFERENCES members(id),
  target_member_id TEXT NOT NULL REFERENCES members(id),
  started_at       TEXT NOT NULL DEFAULT (datetime('now')),
  ended_at         TEXT
);

CREATE INDEX IF NOT EXISTS idx_impersonation_log_admin
  ON impersonation_log(admin_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_impersonation_log_target
  ON impersonation_log(target_member_id, started_at DESC);