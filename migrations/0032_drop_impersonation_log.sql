-- 0032_drop_impersonation_log.sql
--
-- impersonation_log was superseded by admin_audit_log in 0029. Nothing has
-- read it since: the impersonate route writes to admin_audit_log, no admin
-- screen queries it, and the only remaining reference was a cascade DELETE
-- during member deletion, removed alongside this migration.
--
-- Production holds one row, written 2026-08-20 during testing, with the same
-- event now recorded in admin_audit_log. Dropping the table discards it.

DROP TABLE IF EXISTS impersonation_log;
