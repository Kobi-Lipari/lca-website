-- 0029_admin_audit_log.sql
-- One reviewable stream of privileged actions.
--
-- Until now the only admin action leaving any trace was impersonation, and
-- even that was write-only: nothing ever read impersonation_log and nothing
-- ever set its ended_at. Meanwhile the most dangerous action available —
-- promoting an account to lca_admin — was recorded nowhere at all, which is
-- exactly the move someone makes to keep access after taking over an admin
-- account.
--
-- actor_email and target_label are deliberately denormalised copies taken at
-- the time of the action. An audit trail that reads "someone changed
-- someone's role" after the member rows have since been edited or deleted is
-- not an audit trail, so these columns record who and what it was *then*,
-- not who it resolves to now.

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id               TEXT PRIMARY KEY,
  actor_id         TEXT NOT NULL REFERENCES members(id),
  actor_email      TEXT NOT NULL,
  action           TEXT NOT NULL,
  target_member_id TEXT REFERENCES members(id),
  target_label     TEXT,
  -- JSON: whatever the action needs to be reconstructable later, typically
  -- { "from": ..., "to": ... }.
  detail           TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_created
  ON admin_audit_log(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_audit_actor
  ON admin_audit_log(actor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_audit_action
  ON admin_audit_log(action, created_at DESC);

-- impersonation_log is superseded by this table and is no longer written to.
-- It is left in place rather than dropped so the rows already in it are not
-- destroyed by running this migration.
