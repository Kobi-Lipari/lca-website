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
    member_id: string
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
    siteUrl: 'https://lca-website.pages.dev',
  })
  await trySendEmail(context.env, { ...notification, to: ticket.email })

  return jsonResponse({ success: true, messageId }, 201)
}