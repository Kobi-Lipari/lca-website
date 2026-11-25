// functions/utils/admin/audit.ts
import type { MemberRow } from '../../types'

/**
 * Privileged actions worth being able to reconstruct afterwards.
 *
 * Deliberately a closed union rather than free-form strings: the admin log
 * view filters on these, and a typo'd action name would silently create a
 * category nobody is looking at.
 */
export type AdminAction =
  | 'role_change'
  | 'membership_override'
  | 'club_change'
  | 'name_change'
  | 'impersonation_start'
  | 'impersonation_end'
  | 'ticket_delete'
  // What club reps and directors do (admins too, when they do it).
  | 'tournament_create'
  | 'tournament_publish'
  | 'tournament_unpublish'
  | 'tournament_delete'
  | 'round_delete'
  | 'round_paired'
  | 'pairing_edit'
  | 'tournament_complete'
  | 'announcement_sent'
  | 'director_assign'
  | 'director_remove'
  | 'payment_change'
  | 'registration_withdraw'
  | 'registration_reinstate'
  | 'waitlist_offer'
  | 'club_edit'
  | 'officer_add'
  | 'officer_remove'
  | 'group_email_sent'
  // A newsletter stopped before it had all gone (WS16); the audit page gives
  // it a label with the newsletter's tab.
  | 'group_email_stopped'
  // A press of "Send this month's check now" that sent (WS09): who pressed
  // it, the month in words and the counts, never an address or a link.
  | 'club_monthly_check_sent'
  // A keeper's answer to a visitor's suggestion for a club's listing (WS09
  // step 28): applied, answered or dismissed. It names the club, the row and
  // the action, never the visitor's words, an address or the keeper's reply.
  | 'club_suggestion_resolved'
  // A press of "Send overdue suggestions on" that tried to send (WS09 step 29):
  // who pressed it and the counts alone, never a club, the visitor's words or
  // an address.
  | 'club_report_clock_sent'
  // Mark as handled on a row of Suggest a club or Start a club (WS09 step 30):
  // it names the row's id and kind alone, never the person, their address or
  // anyone's words.
  | 'club_request_handled'
  // Ask to be its named rep (WS09 step 31): a keeper named the member the
  // club's rep. It names the member as role_change does, with the club's id,
  // the request's id and the role and club before; never the member's note.
  | 'club_rep_named'
  // Ask to be its named rep (WS09 step 31): a keeper declined the request.
  // It names the club and the request's id, never the member, so it never
  // stands in the way of the member delete; nothing changed of the member.
  | 'club_rep_request_declined'
  // A representative's club event in the LCA admins' wait (WS09 step 18): sent
  // for review, approved and listed, or sent back with changes asked. Each
  // names the event and its id, never the note an LCA admin wrote.
  | 'tournament_submitted'
  | 'tournament_approved'
  | 'tournament_changes_asked'
  | 'ticket_reply'
  // Board seats: logged so the officer history can always be rebuilt.
  | 'seat_assign'
  | 'seat_end'
  | 'seat_regions'
  // Member data leaving the site.
  | 'members_export'
  // Governance documents: bylaws, rules, amendments, minutes, treasurer's reports.
  | 'document_add'
  | 'document_edit'
  | 'document_remove'
  // Written only by scripts/apply-memberships.mjs: a member's email changed
  // on the sign-in account and the row, and an existing row linked to a
  // guardian. The audit page has no label or filter for them yet, so it
  // lists them under All actions by these names.
  | 'email_change'
  | 'guardian_link'

export interface AuditEntry {
  action: AdminAction
  targetMemberId?: string | null
  /** Who the action was aimed at, as they were named at the time. */
  targetLabel?: string | null
  /** Anything needed to make sense of the entry later, e.g. { from, to }. */
  detail?: Record<string, unknown> | null
}

/**
 * Writes one row to the admin audit log.
 *
 * Never throws. An audit write failing should not turn a successful role
 * change into a 500 the admin retries, which would risk applying the action
 * twice while still recording nothing. A failure is logged for the Worker
 * tail and swallowed; the gap is visible as a missing row rather than as a
 * broken feature.
 */
export async function recordAdminAction(
  db: D1Database,
  actor: MemberRow,
  entry: AuditEntry,
): Promise<void> {
  try {
    await db
      .prepare(
        `INSERT INTO admin_audit_log
           (id, actor_id, actor_email, action, target_member_id, target_label, detail)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        `aud-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        actor.id,
        actor.email,
        entry.action,
        entry.targetMemberId ?? null,
        entry.targetLabel ?? null,
        entry.detail ? JSON.stringify(entry.detail) : null,
      )
      .run()
  } catch (err) {
    console.warn(
      `admin audit write failed (${entry.action}):`,
      err instanceof Error ? err.message : String(err),
    )
  }
}
