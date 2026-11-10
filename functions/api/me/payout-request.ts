// functions/api/me/payout-request.ts
//
// POST /api/me/payout-request: "Ask LCA to set up my payout account", the
// second button of the panel a fee above $0 shows to someone who may not
// charge one (D24). It opens a support ticket of kind payout_request for
// the signed-in member, which the LCA admins see in Admin's support list
// today, and answers the member's open one instead while one of their
// payout requests is open or in progress, so a request then opens nothing.
// The rule is the one statement createTicket runs
// (functions/utils/admin/tickets.ts), so two requests in flight together
// open one ticket. Its contract is in domain/contracts/me.ts. The answer
// names the ticket by its id and never its number, which is for staff and
// board members only, as the member's own support pages keep it.
//
// Refused with 403 while CREATION_ROLES_ON is unset, so the server opens no
// such ticket until the switch goes on. Behind standingDirectors, G1's ask
// calls it from the manage page, about the event, and from the wizard's
// sections step, about no event yet (WS08 step 10).
import type { Env, MemberRow } from '../../types'
import { isResponse, requireAuthedMember } from '../../utils/auth'
import { errorResponse, handleOptions, jsonResponse, parseBody } from '../../utils/response'
import { canManageTournament } from '../../utils/admin/permissions'
import { createTicket, siteUrlFromRequest } from '../../utils/admin/tickets'
import { CREATION_ROLES_ON } from '../../utils/events/creation'
import { eventDays } from '../../utils/events/publishedReview'
import { payoutRequestRequestSchema, type PayoutRequestResponse } from '../../../domain/contracts/me'

type OpenTicket = PayoutRequestResponse['ticket']

/** The member's payout request that is open or in progress, the newest should there be two. */
async function openRequest(db: D1Database, memberId: string): Promise<OpenTicket | null> {
  const row = await db
    .prepare(
      `SELECT id, status
         FROM support_tickets
        WHERE member_id = ? AND kind = 'payout_request' AND status IN ('open', 'in_progress')
        ORDER BY created_at DESC
        LIMIT 1`,
    )
    .bind(memberId)
    .first<{ id: string; status: string }>()
  return row ? { id: row.id, kind: 'payout_request', status: row.status } : null
}

/**
 * The event the request names, as the ticket names it: its id and the line
 * its message gains, "Event: Lafayette Winter Quads (Sat, Dec 5 to Sun, Dec
 * 6, 2026)". Only an event the member manages is named. An event they do
 * not manage, a hidden draft among them, gives null and is never read, so a
 * member who knows a draft's id learns nothing of it and the ticket says
 * nothing of it; an id with no event behind it, which canManageTournament
 * admits for an LCA admin, names nothing either.
 */
async function managedEvent(db: D1Database, member: MemberRow, tournamentId: string | null | undefined): Promise<{ id: string; line: string } | null> {
  if (!tournamentId) return null
  if (!(await canManageTournament(db, member, tournamentId))) return null
  const event = await db
    .prepare('SELECT id, name, date, end_date FROM tournaments WHERE id = ?')
    .bind(tournamentId)
    .first<{ id: string; name: string; date: string; end_date: string | null }>()
  return event ? { id: event.id, line: `Event: ${event.name} (${eventDays(event.date, event.end_date)})` } : null
}

/** The answer: the member's open request, and whether this request opened it. */
function answer(ticket: OpenTicket, created: boolean): Response {
  const body: PayoutRequestResponse = { ticket, created }
  return jsonResponse(body, created ? 201 : 200)
}

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const authed = await requireAuthedMember(context.request, context.env)
  if (isResponse(authed)) return authed
  const { member } = authed

  // CREATION_ROLES_ON is read here, at each request, before the body or any
  // ticket is read.
  if (!CREATION_ROLES_ON) return errorResponse('Not available yet.', 403)

  const body = await parseBody(context.request, payoutRequestRequestSchema)
  if (isResponse(body)) return body

  const db = context.env.DB
  const open = await openRequest(db, member.id)
  if (open) return answer(open, false)

  const event = await managedEvent(db, member, body.tournamentId)
  const name = member.full_name
  const message = [
    `${name} asked LCA to set up a payout account for them: a connected account inside LCA's Stripe account (Stripe Connect), so their events can charge entry fees and the money reaches them. Until it exists their events run at $0.`,
    ...(event ? [event.line] : []),
  ].join('\n\n')

  const result = await createTicket(context.env, {
    name,
    email: member.email,
    subject: `Payout account request from ${name}`,
    body: message,
    memberId: member.id,
    seatRef: null,
    siteUrl: siteUrlFromRequest(context.request, context.env),
    kind: 'payout_request',
    aboutId: event?.id ?? null,
    oneOpenPerMember: true,
  })
  if (result.created) return answer({ id: result.ticketId, kind: 'payout_request', status: 'open' }, true)

  // Nothing was inserted: a request in flight with this one opened the
  // member's ticket between the read above and the insert. Answer that one.
  const opened = await openRequest(db, member.id)
  if (opened) return answer(opened, false)
  // Only a change of the ticket's status between the insert and this read
  // leaves nothing open, so the member is asked to send it again.
  return errorResponse('We could not save your request just now. Please try again.', 409)
}
