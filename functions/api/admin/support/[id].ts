// functions/api/admin/support/[id].ts
import type { Env } from '../../../types'
import { isResponse, requireAdmin } from '../../../utils/auth'
import {
  errorResponse,
  handleOptions,
  jsonResponse,
  parseJsonBody,
} from '../../../utils/response'
import { trySendEmail, supportReplyNotificationEmail } from '../../../utils/email'
import { resolveSiteUrl } from '../../../utils/site'
import { recordAdminAction } from '../../../utils/audit'

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const authResult = await requireAdmin(context.request, context.env)
  if (isResponse(authResult)) return authResult

  const ticketId = context.params.id as string

  const ticket = await context.env.DB.prepare(
    `SELECT * FROM support_tickets WHERE id = ?`,
  ).bind(ticketId).first()

  if (!ticket) return errorResponse('Ticket not found', 404)

  const messages = await context.env.DB.prepare(
    `SELECT * FROM support_messages WHERE ticket_id = ? ORDER BY created_at ASC`,
  ).bind(ticketId).all()

  return jsonResponse({ ticket, messages: messages.results })
}

export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const authResult = await requireAdmin(context.request, context.env)
  if (isResponse(authResult)) return authResult

  const ticketId = context.params.id as string
  const body = await parseJsonBody<{ status: string }>(context.request)

  if (!body?.status) return errorResponse('Status is required', 400)

  await context.env.DB.prepare(
    `UPDATE support_tickets SET status = ?, updated_at = datetime('now') WHERE id = ?`,
  ).bind(body.status, ticketId).run()

  return jsonResponse({ success: true })
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const authResult = await requireAdmin(context.request, context.env)
  if (isResponse(authResult)) return authResult

  const ticketId = context.params.id as string
  const body = await parseJsonBody<{ body: string }>(context.request)

  if (!body?.body) return errorResponse('Message body is required', 400)

  const ticket = await context.env.DB.prepare(
    `SELECT * FROM support_tickets WHERE id = ?`,
  ).bind(ticketId).first<{
    email: string
    name: string
    subject: string
    member_id: string | null
    number: number | null
  }>()

  if (!ticket) return errorResponse('Ticket not found', 404)

  const messageId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  await context.env.DB.prepare(
    `INSERT INTO support_messages (id, ticket_id, sender_id, sender_type, body)
     VALUES (?, ?, 'admin', 'admin', ?)`,
  ).bind(messageId, ticketId, body.body).run()

  await context.env.DB.prepare(
    `UPDATE support_tickets SET status = 'in_progress', updated_at = datetime('now') WHERE id = ?`,
  ).bind(ticketId).run()

  // Best-effort: reply is saved; notify the member if mail is up.
  const notification = supportReplyNotificationEmail({
    name: ticket.name,
    ticketId,
    subject: ticket.subject,
    replyBody: body.body,
    hasAccount: !!ticket.member_id,
    siteUrl: resolveSiteUrl(context.env, context.request),
  })
  await trySendEmail(context.env, { ...notification, to: ticket.email })

  return jsonResponse({ success: true, messageId }, 201)
}

/**
 * Permanently deletes a ticket and its messages. Admins only; any ticket,
 * including general inquiries that no board seat can see. Logged, since the
 * ticket itself is gone afterwards.
 */
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const authResult = await requireAdmin(context.request, context.env)
  if (isResponse(authResult)) return authResult

  const ticketId = context.params.id as string
  const ticket = await context.env.DB.prepare(
    `SELECT t.id, t.number, t.name, t.email, t.subject, t.seat_id, b.role AS seat_role
       FROM support_tickets t
       LEFT JOIN board_members b ON b.id = t.seat_id
      WHERE t.id = ?`,
  ).bind(ticketId).first<{
    id: string; number: number | null; name: string; email: string
    subject: string; seat_id: string | null; seat_role: string | null
  }>()
  if (!ticket) return errorResponse('Ticket not found', 404)

  await context.env.DB.batch([
    context.env.DB.prepare('DELETE FROM support_messages WHERE ticket_id = ?').bind(ticket.id),
    context.env.DB.prepare('DELETE FROM support_tickets WHERE id = ?').bind(ticket.id),
  ])

  await recordAdminAction(context.env.DB, authResult.member, {
    action: 'ticket_delete',
    targetLabel: `${ticket.seat_role ?? 'General'}: "${ticket.subject}"`,
    detail: {
      ticket_id: ticket.id,
      ticket_number: ticket.number,
      from: `${ticket.name} <${ticket.email}>`,
      seat_id: ticket.seat_id,
    },
  })

  return jsonResponse({ success: true })
}
