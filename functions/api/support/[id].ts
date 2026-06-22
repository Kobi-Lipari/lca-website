import type { Env } from '../../types'
import { verifySupabaseUser } from '../../utils/auth'
import {
  errorResponse,
  handleOptions,
  jsonResponse,
  parseJsonBody,
} from '../../utils/response'
import { sendEmail, supportReplyNotificationEmail } from '../../utils/email'

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const user = await verifySupabaseUser(context.request, context.env)
  if (!user) return errorResponse('Unauthorized', 401)

  const ticketId = context.params.id as string

  const ticket = await context.env.DB.prepare(
    `SELECT * FROM support_tickets WHERE id = ? AND member_id = ?`,
  ).bind(ticketId, user.id).first()

  if (!ticket) return errorResponse('Ticket not found', 404)

  const messages = await context.env.DB.prepare(
    `SELECT * FROM support_messages WHERE ticket_id = ? ORDER BY created_at ASC`,
  ).bind(ticketId).all()

  return jsonResponse({ ticket, messages: messages.results })
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const user = await verifySupabaseUser(context.request, context.env)
  if (!user) return errorResponse('Unauthorized', 401)

  const ticketId = context.params.id as string
  const body = await parseJsonBody<{ body: string }>(context.request)

  if (!body?.body) return errorResponse('Message body is required', 400)

  const ticket = await context.env.DB.prepare(
    `SELECT * FROM support_tickets WHERE id = ? AND member_id = ?`,
  ).bind(ticketId, user.id).first<{ email: string; name: string; subject: string }>()

  if (!ticket) return errorResponse('Ticket not found', 404)

  const messageId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  await context.env.DB.prepare(
    `INSERT INTO support_messages (id, ticket_id, sender_id, sender_type, body)
     VALUES (?, ?, ?, 'member', ?)`,
  ).bind(messageId, ticketId, user.id, body.body).run()

  await context.env.DB.prepare(
    `UPDATE support_tickets SET updated_at = datetime('now') WHERE id = ?`,
  ).bind(ticketId).run()

  // Notify support team
  await sendEmail(context.env, {
    to: context.env.SUPPORT_EMAIL,
    subject: `Member reply on ticket: ${ticket.subject}`,
    html: `
      <h2>Member replied to support ticket</h2>
      <p><strong>Ticket:</strong> ${ticketId}</p>
      <p><strong>From:</strong> ${ticket.name}</p>
      <p><strong>Message:</strong></p>
      <p>${body.body.replace(/\n/g, '<br>')}</p>
    `,
  })

  return jsonResponse({ success: true, messageId }, 201)
}