-- migrations/0047_repair_cascade_losses.sql
--
-- Puts back what can be rebuilt after 0040 (see 0046 for what happened).
--
-- Tournament directors: every assignment since the activity log started
-- recording them is replayed, skipping any the log shows were removed
-- afterwards, and any event or account that no longer exists.
--
-- Support tickets: 0040 cut the link between tickets and the accounts that
-- sent them. The ticket still has the sender's email, so it's linked back to
-- the account with that email (the parent's, not a child's, if they share).
--
-- Board seat assignments were never logged, so they can't be rebuilt here;
-- they're re-entered on the admin Board tab (and are logged from now on).

INSERT OR IGNORE INTO tournament_directors (tournament_id, member_id, assigned_at)
SELECT json_extract(a.detail, '$.tournament_id'), a.target_member_id, a.created_at
  FROM admin_audit_log a
 WHERE a.action = 'director_assign'
   AND a.target_member_id IN (SELECT id FROM members)
   AND json_extract(a.detail, '$.tournament_id') IN (SELECT id FROM tournaments)
   AND NOT EXISTS (
     SELECT 1 FROM admin_audit_log b
      WHERE b.action = 'director_remove'
        AND b.target_member_id = a.target_member_id
        AND json_extract(b.detail, '$.tournament_id') = json_extract(a.detail, '$.tournament_id')
        AND b.created_at >= a.created_at
   );

UPDATE support_tickets
   SET member_id = (
     SELECT m.id FROM members m
      WHERE lower(m.email) = lower(support_tickets.email)
      ORDER BY (m.guardian_id IS NOT NULL), m.created_at
      LIMIT 1
   )
 WHERE member_id IS NULL
   AND EXISTS (SELECT 1 FROM members m WHERE lower(m.email) = lower(support_tickets.email));
