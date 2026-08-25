// functions/api/contact.ts
//
// The contact form no longer writes to contact_messages and fires a mail into
// a mailbox nobody reads. It opens a support ticket, optionally routed to a
// board seat, so every message that reaches LCA is tracked and replyable in
// one place.

import type { Env } from '../types'
import { isResponse, optionalAuthedMember, requireAdmin } from '../utils/auth'
import {
  errorResponse,
  handleOptions,
  jsonResponse,
  parseJsonBody,
} from '../utils/response'
import { createTicket, siteUrlFromRequest } from '../utils/tickets'

interface ContactBody {
  name: string
  email: string
  subject: string
  body: string
  /** Seat slug from /contact?to=… — unknown values fall back to general. */
  seatRef?: string | null
}

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const body = await parseJsonBody<ContactBody>(context.request)

  if (!body?.name || !body?.email || !body?.subject || !body?.body) {
    return errorResponse('All fields are required', 400)
  }

  // Guests are fine here; a logged-in submitter gets member_id bound to the
  // ticket, which is what lets them open it again later from /support.
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

/**
 * Historical contact_messages rows, kept readable until you're satisfied
 * nothing in there still needs answering. New submissions no longer land here.
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const authResult = await requireAdmin(context.request, context.env)
  if (isResponse(authResult)) return authResult

  const messages = await context.env.DB.prepare(
    `SELECT * FROM contact_messages ORDER BY created_at DESC LIMIT 100`,
  ).all()

  return jsonResponse({ messages: messages.results })
}