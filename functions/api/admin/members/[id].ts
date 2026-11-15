// functions/api/admin/members/[id].ts
import type { Env } from '../../../types'
import { isResponse, requireAdmin } from '../../../utils/auth'
import { isMissingTableOrColumn } from '../../../utils/clubs/migrationLag'
import { forgetEmptyContact, leaveSendingNewsletter } from '../../../utils/mail/lists'
import { errorResponse, handleOptions, jsonResponse } from '../../../utils/response'
import { deleteSupabaseUser } from '../../../utils/supabase'

/** The one log line for a newsletter's rows the delete could not read; it names no address and no member. */
export const NEWSLETTER_ROWS_UNREAD_LOG = 'member delete: the newsletter that is sending could not be read; its rows are left as they were'

/** The one log line for the club references of migration 0066 the delete could not clear; it names no member. */
export const CLUB_REFERENCES_UNCLEARED_LOG = 'member delete: the club tables of migration 0066 could not be read; the delete goes on without them'

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const memberId = context.params.id as string

  const authResult = await requireAdmin(context.request, context.env)
  if (isResponse(authResult)) return authResult

  const existing = await context.env.DB.prepare(
    'SELECT * FROM members WHERE id = ?'
  ).bind(memberId).first()

  if (!existing) return errorResponse('Member not found', 404)

  // Every table that references this member. board_seat_assignments and
  // email_campaign_recipients were missing, so a deleted member could keep an
  // officer seat and stay on an in-flight campaign's recipient list.
  await context.env.DB.prepare('DELETE FROM registrations WHERE member_id = ?').bind(memberId).run()
  await context.env.DB.prepare('DELETE FROM payments WHERE member_id = ?').bind(memberId).run()
  await context.env.DB.prepare('DELETE FROM club_officers WHERE member_id = ?').bind(memberId).run()
  await context.env.DB.prepare('DELETE FROM tournament_directors WHERE member_id = ?').bind(memberId).run()
  await context.env.DB.prepare('DELETE FROM tournament_reminders WHERE member_id = ?').bind(memberId).run()
  await context.env.DB.prepare('DELETE FROM tournament_attendee_reminders WHERE member_id = ?').bind(memberId).run()
  await context.env.DB.prepare('DELETE FROM support_messages WHERE sender_id = ?').bind(memberId).run()
  await context.env.DB.prepare('DELETE FROM support_tickets WHERE member_id = ?').bind(memberId).run()
  await context.env.DB.prepare('DELETE FROM board_seat_assignments WHERE member_id = ?').bind(memberId).run()
  await context.env.DB.prepare('DELETE FROM email_campaign_recipients WHERE member_id = ?').bind(memberId).run()
  // Children managed by this account keep their own history (games, ratings)
  // and simply stop having a parent attached; an admin can reattach them.
  await context.env.DB.prepare('UPDATE members SET guardian_id = NULL WHERE guardian_id = ?').bind(memberId).run()
  // Migration 0066's references to a member, none with a delete action: the
  // club pages' last save and last check keep their dates and lose the name,
  // a report or a rep request this member decided keeps its outcome, and the
  // member's own rep requests go. They go in one batch with the member, so a
  // member whose own delete fails keeps every one of them. Before 0066 has
  // run the columns and tables are not there, and the member is deleted on
  // their own as before, with one log line.
  try {
    await context.env.DB.batch([
      context.env.DB.prepare('UPDATE clubs SET told_by = NULL WHERE told_by = ?').bind(memberId),
      context.env.DB.prepare('UPDATE clubs SET confirmed_by = NULL WHERE confirmed_by = ?').bind(memberId),
      context.env.DB.prepare('UPDATE club_reports SET resolved_by = NULL WHERE resolved_by = ?').bind(memberId),
      context.env.DB.prepare('UPDATE club_rep_requests SET decided_by = NULL WHERE decided_by = ?').bind(memberId),
      context.env.DB.prepare('DELETE FROM club_rep_requests WHERE member_id = ?').bind(memberId),
      context.env.DB.prepare('DELETE FROM members WHERE id = ?').bind(memberId),
    ])
  } catch (err) {
    if (!isMissingTableOrColumn(err)) throw err
    console.warn(CLUB_REFERENCES_UNCLEARED_LOG)
    await context.env.DB.prepare('DELETE FROM members WHERE id = ?').bind(memberId).run()
  }

  // A newsletter's rows name no member, so the delete above leaves them: once the member is gone, the newsletter that is
  // sending drops their address's untried row unless another account in its audience still holds the address, as a
  // family's does (WS16 step 7). The same batch removes the address's mail contact once no account holds the address
  // and the contact holds no choice, no stop-all and no report's mark (checkpoint M's review). A newsletter that cannot
  // be read leaves the delete as it was, with one log line.
  const email = (existing as { email?: string | null }).email ?? null
  try {
    await context.env.DB.batch([...leaveSendingNewsletter(context.env.DB, email), forgetEmptyContact(context.env.DB, email)])
  } catch {
    console.warn(NEWSLETTER_ROWS_UNREAD_LOG)
  }

  // The auth user last, so a failure here leaves an orphaned login rather than
  // a member row pointing at nothing. Reported so the admin can see it rather
  // than being told the whole delete failed.
  const authDeleted = await deleteSupabaseUser(context.env, memberId)

  return jsonResponse({ success: true, authDeleted })
}