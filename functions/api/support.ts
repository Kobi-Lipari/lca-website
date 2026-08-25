// functions/api/support.ts
import type { Env } from '../types'
import { optionalAuthedMember, verifySupabaseUser } from '../utils/auth'
import {
  errorResponse,
  handleOptions,
  jsonResponse,
  parseJsonBody,
} from '../utils/response'
import { createTicket, siteUrlFromRequest } from '../utils/tickets'

interface CreateTicketBody {
  name: string
  email: string
  subject: string
  body: string
  /** Optional board seat, same as the contact form. */
  seatRef?: string | null
}

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

/**
 * Ticket creation now lives in utils/tickets.ts, shared with /api/contact.
 * The inline INSERTs and notification mail that used to be here diverged from
 * the contact endpoint's copy — one helper means reply-to, seat routing and
 * holder notification behave identically no matter which form was used.
 */
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const body = await parseJsonBody<CreateTicketBody>(context.request)

  if (!body?.name || !body?.email || !body?.subject || !body?.body) {
    return errorResponse('All fields are required', 400)
  }

  const authed = await optionalAuthedMember(context.request, context.env)

  const { ticketId, seat } = await createTicket(context.env, {
    name: body.name,
    email: body.email,
    subject: body.subject,
    body: body.body,
    memberId: authed?.member.id ?? null,
    seatRef: body.seatRef ?? null,
    siteUrl: siteUrlFromRequest(context.request),
  })

  return jsonResponse(
    { success: true, ticketId, routedTo: seat?.role ?? null },
    201,
  )
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
      b.role AS seat_role,
      (SELECT COUNT(*) FROM support_messages m WHERE m.ticket_id = t.id) as message_count,
      (SELECT body FROM support_messages m WHERE m.ticket_id = t.id ORDER BY created_at DESC LIMIT 1) as last_message
     FROM support_tickets t
     LEFT JOIN board_members b ON b.id = t.seat_id
     WHERE t.member_id = ? OR t.email = ?
     ORDER BY t.updated_at DESC`,
  ).bind(user.id, member?.email ?? '').all()

  return jsonResponse({ tickets: tickets.results })
}