// functions/api/admin/members/[id].ts
import type { Env } from '../../../types'
import { isResponse, requireAdmin } from '../../../utils/auth'
import { errorResponse, handleOptions, jsonResponse } from '../../../utils/response'
import { deleteSupabaseUser } from '../../../utils/supabase'

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
  await context.env.DB.prepare('DELETE FROM members WHERE id = ?').bind(memberId).run()

  // The auth user last, so a failure here leaves an orphaned login rather than
  // a member row pointing at nothing. Reported so the admin can see it rather
  // than being told the whole delete failed.
  const authDeleted = await deleteSupabaseUser(context.env, memberId)

  return jsonResponse({ success: true, authDeleted })
}