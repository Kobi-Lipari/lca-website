// functions/api/admin/members/[id].ts
import type { Env } from '../../../types'
import { isResponse, requireAdmin } from '../../../utils/auth'
import { errorResponse, handleOptions, jsonResponse } from '../../../utils/response'

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const memberId = context.params.id as string

  const authResult = await requireAdmin(context.request, context.env)
  if (isResponse(authResult)) return authResult

  const existing = await context.env.DB.prepare(
    'SELECT * FROM members WHERE id = ?'
  ).bind(memberId).first()

  if (!existing) return errorResponse('Member not found', 404)

  // Delete all related records first
  await context.env.DB.prepare('DELETE FROM registrations WHERE member_id = ?').bind(memberId).run()
  await context.env.DB.prepare('DELETE FROM payments WHERE member_id = ?').bind(memberId).run()
  await context.env.DB.prepare('DELETE FROM club_officers WHERE member_id = ?').bind(memberId).run()
  await context.env.DB.prepare('DELETE FROM tournament_directors WHERE member_id = ?').bind(memberId).run()
  await context.env.DB.prepare('DELETE FROM tournament_reminders WHERE member_id = ?').bind(memberId).run()
  await context.env.DB.prepare('DELETE FROM tournament_attendee_reminders WHERE member_id = ?').bind(memberId).run()
  await context.env.DB.prepare('DELETE FROM support_messages WHERE sender_id = ?').bind(memberId).run()
  await context.env.DB.prepare('DELETE FROM support_tickets WHERE member_id = ?').bind(memberId).run()
  await context.env.DB.prepare('DELETE FROM members WHERE id = ?').bind(memberId).run()

  return jsonResponse({ success: true })
}