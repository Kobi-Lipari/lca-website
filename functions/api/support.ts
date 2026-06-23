import type { Env } from '../types'
import { verifySupabaseUser } from '../utils/auth'
import {
  errorResponse,
  handleOptions,
  jsonResponse,
  parseJsonBody,
} from '../utils/response'
import { sendEmail, supportTicketConfirmationEmail } from '../utils/email'

interface CreateTicketBody {
  name: string
  email: string
  subject: string
  body: string
}

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const body = await parseJsonBody<CreateTicketBody>(context.request)

  if (!body?.name || !body?.email || !body?.subject || !body?.body) {
    return errorResponse('All fields are required', 400)
  }

  // Try to get user but don't fail if not authenticated
  let userId: string | null = null
  try {
    const user = await verifySupabaseUser(context.request, context.env)
    userId = user?.id ?? null
  } catch {
    userId = null
  }

  const ticketId = `ticket-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const messageId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  await context.env.DB.prepare(
    `INSERT INTO support_tickets (id, member_id, name, email, subject)
     VALUES (?, ?, ?, ?, ?)`,
  ).bind(ticketId, userId, body.name, body.email, body.subject).run()

  await context.env.DB.prepare(
    `INSERT INTO support_messages (id, ticket_id, sender_id, sender_type, body)
     VALUES (?, ?, ?, ?, ?)`,
  ).bind(
    messageId,
    ticketId,
    userId,
    userId ? 'member' : 'guest',
    body.body,
  ).run()

  // Send confirmation to member (non-fatal)
  try {
    const confirmation = supportTicketConfirmationEmail({
      name: body.name,
      ticketId,
      subject: body.subject,
    })
    await sendEmail(context.env, { ...confirmation, to: body.email })
  } catch (e) {
    console.warn('Failed to send ticket confirmation email:', e)
  }

  // Notify support email (non-fatal)
  try {
    await sendEmail(context.env, {
      to: context.env.SUPPORT_EMAIL,
      subject: `[Ticket #${ticketId}] ${body.subject}`,
      html: `
        <h2>New support ticket</h2>
        <p><strong>From:</strong> ${body.name} (${body.email})</p>
        <p><strong>Ticket ID:</strong> ${ticketId}</p>
        <p><strong>Subject:</strong> ${body.subject}</p>
        <p><strong>Message:</strong></p>
        <p>${body.body.replace(/\n/g, '<br>')}</p>
      `,
    })
  } catch (e) {
    console.warn('Failed to send support notification email:', e)
  }

  return jsonResponse({ success: true, ticketId }, 201)
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const user = await verifySupabaseUser(context.request, context.env)
  if (!user) return errorResponse('Unauthorized', 401)

  // Get member email from D1
  const member = await context.env.DB.prepare(
    'SELECT email FROM members WHERE id = ?',
  ).bind(user.id).first<{ email: string }>()

  const tickets = await context.env.DB.prepare(
    `SELECT t.*,
      (SELECT COUNT(*) FROM support_messages m WHERE m.ticket_id = t.id) as message_count,
      (SELECT body FROM support_messages m WHERE m.ticket_id = t.id ORDER BY created_at DESC LIMIT 1) as last_message
     FROM support_tickets t
     WHERE t.member_id = ? OR t.email = ?
     ORDER BY t.updated_at DESC`,
  ).bind(user.id, member?.email ?? '').all()

  return jsonResponse({ tickets: tickets.results })
}