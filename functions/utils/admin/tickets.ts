// functions/utils/admin/tickets.ts
//
// One code path for opening a ticket, whatever the entry point: the contact
// form, the support form and a member's payout request all land here, so
// routing, notification and reply-to behaviour can't drift between them.

import type { Env } from '../../types'
import {
  trySendEmail,
  staffTicketNotificationEmail,
  supportTicketConfirmationEmail,
  boardSeatNotificationEmail,
} from '../email'
import { resolveSiteUrl, type SiteEnv } from '../site'

export interface SeatRow {
  id: string
  slug: string
  role: string
  category: string
  is_shared: number
}

export interface SeatHolder {
  member_id: string
  full_name: string
  email: string
}

/**
 * Resolve a seat by slug OR id. Public URLs use the readable slug
 * (/contact?to=scholastic-director); the form may post either. Only active
 * seats resolve: an unknown or retired ref returns null and the caller falls
 * back to a general inquiry rather than erroring, so a stale bookmark or a
 * seat retired mid-session still delivers the message.
 */
export async function getActiveSeat(
  db: D1Database,
  ref: string,
): Promise<SeatRow | null> {
  return db
    .prepare(
      `SELECT id, slug, role, category, is_shared
         FROM board_members
        WHERE is_active = 1 AND (slug = ?1 OR id = ?1)
        LIMIT 1`,
    )
    .bind(ref)
    .first<SeatRow>()
}

/**
 * Everyone currently holding the seat. Usually one person, sometimes none
 * (vacant), and for a shared seat like US Chess Delegate, several, all of whom
 * get notified, because they're interchangeable and either may pick it up.
 */
export async function getSeatHolders(
  db: D1Database,
  seatId: string,
): Promise<SeatHolder[]> {
  const { results } = await db
    .prepare(
      `SELECT a.member_id, m.full_name, m.email
         FROM board_seat_assignments a
         JOIN members m ON m.id = a.member_id
        WHERE a.seat_id = ? AND a.ended_at IS NULL`,
    )
    .bind(seatId)
    .all<SeatHolder>()

  return results ?? []
}

/**
 * Absolute origin for links in outbound email: the configured SITE_URL,
 * falling back to the request's origin (see resolveSiteUrl). Links must
 * point at the canonical site, not whichever preview URL the form was on.
 */
export function siteUrlFromRequest(request: Request, env?: SiteEnv): string {
  return resolveSiteUrl(env ?? {}, request)
}

export interface CreateTicketInput {
  name: string
  email: string
  subject: string
  body: string
  /** Set when the submitter was logged in; null for guests. */
  memberId?: string | null
  /** Seat slug or id. Unknown values degrade to a general inquiry. */
  seatRef?: string | null
  /** From siteUrlFromRequest(). */
  siteUrl: string
  /**
   * support_tickets.kind (migration 0059): null for an ordinary ticket, as
   * the contact and support forms open, or 'payout_request' for a member's
   * request for a payout account.
   */
  kind?: string | null
  /** support_tickets.about_id: the tournament the ticket is about, or null. */
  aboutId?: string | null
  /**
   * With memberId and kind set, opens the ticket only while the member has
   * no ticket of that kind open or in progress. The insert's own statement
   * decides it, so of two calls at the same moment only one inserts, and a
   * call that inserts nothing stores and sends nothing (created false). A
   * call with no kind, or no member, is today's plain insert: the guard
   * compares kinds, and null equals nothing.
   */
  oneOpenPerMember?: boolean
}

export interface CreateTicketResult {
  /** The new ticket's id; when created is false, nothing was stored under it. */
  ticketId: string
  /** The short number people see, e.g. 1042 for "#1042"; null when nothing was created. */
  ticketNumber: number | null
  seat: SeatRow | null
  holders: SeatHolder[]
  /** Whether the ticket was inserted: always true but for oneOpenPerMember finding one open. */
  created: boolean
}

export async function createTicket(
  env: Env,
  input: CreateTicketInput,
): Promise<CreateTicketResult> {
  const seat = input.seatRef ? await getActiveSeat(env.DB, input.seatRef) : null
  const holders = seat ? await getSeatHolders(env.DB, seat.id) : []

  const ticketId = `ticket-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const messageId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const memberId = input.memberId ?? null
  const kind = input.kind ?? null
  const aboutId = input.aboutId ?? null

  // The number is taken inside the INSERT itself, so two tickets opened at
  // the same moment can't be handed the same one (D1 runs statements one at
  // a time, and the unique index would catch it regardless).
  //
  // One open per member is decided by that INSERT too. Today's form is an
  // aggregate with no GROUP BY, which yields one row even when its WHERE
  // leaves none, so a NOT EXISTS there would still insert, numbered 1001,
  // and fail on the unique index. The guarded form takes the number in a
  // subquery and puts its WHERE NOT EXISTS on a SELECT of no table, which
  // yields no row, and so inserts nothing, while the member has a ticket of
  // the kind open or in progress. The message is inserted only when its
  // ticket exists: support_messages.ticket_id must name a ticket, and a
  // message for a ticket left out would fail the whole batch.
  const guarded = Boolean(input.oneOpenPerMember && memberId && kind)
  const ticket = guarded
    ? env.DB.prepare(
        `INSERT INTO support_tickets
           (id, number, member_id, name, email, subject, seat_id, kind, about_id)
         SELECT ?, (SELECT COALESCE(MAX(number), 1000) + 1 FROM support_tickets), ?, ?, ?, ?, ?, ?, ?
          WHERE NOT EXISTS (
            SELECT 1 FROM support_tickets
             WHERE member_id = ? AND kind = ? AND status IN ('open', 'in_progress'))`,
      ).bind(ticketId, memberId, input.name, input.email, input.subject, seat?.id ?? null, kind, aboutId, memberId, kind)
    : env.DB.prepare(
        `INSERT INTO support_tickets
           (id, number, member_id, name, email, subject, seat_id, kind, about_id)
         SELECT ?, COALESCE(MAX(number), 1000) + 1, ?, ?, ?, ?, ?, ?, ?
           FROM support_tickets`,
      ).bind(ticketId, memberId, input.name, input.email, input.subject, seat?.id ?? null, kind, aboutId)
  const results = await env.DB.batch([
    ticket,
    env.DB.prepare(
      `INSERT INTO support_messages
         (id, ticket_id, sender_id, sender_type, body)
       SELECT ?, ?, ?, ?, ?
        WHERE EXISTS (SELECT 1 FROM support_tickets WHERE id = ?)`,
    ).bind(
      messageId,
      ticketId,
      memberId,
      memberId ? 'member' : 'guest',
      input.body,
      ticketId,
    ),
    env.DB.prepare('SELECT number FROM support_tickets WHERE id = ?').bind(ticketId),
  ])
  // Today's form always inserts; only the guarded one can leave the ticket
  // out, which its first statement's count of changed rows says.
  if (guarded && (results[0]?.meta?.changes ?? 0) === 0) {
    return { ticketId, ticketNumber: null, seat, holders, created: false }
  }
  const ticketNumber = (results[2]?.results?.[0] as { number: number | null } | undefined)?.number ?? null

  const seatLabel = seat?.role ?? null
  const holderNames = holders.map((h) => h.full_name).join(' & ')

  // Everything below is best-effort: the ticket is already durable, so a mail
  // outage must not turn a successful submission into a 500.

  await trySendEmail(env, {
    ...staffTicketNotificationEmail({
      ticketId,
      ticketNumber,
      name: input.name,
      email: input.email,
      subject: input.subject,
      body: input.body,
      seatLabel,
      holderName: holderNames || null,
      siteUrl: input.siteUrl,
    }),
    to: env.CONTACT_EMAIL,
  })

  // Sent individually rather than as one multi-recipient message so no holder
  // sees another's personal address in a To: line.
  for (const holder of holders) {
    await trySendEmail(env, {
      ...boardSeatNotificationEmail({
        holderName: holder.full_name,
        seatLabel: seat?.role ?? '',
        ticketId,
        ticketNumber,
        subject: input.subject,
        body: input.body,
        fromName: input.name,
        fromEmail: input.email,
        siteUrl: input.siteUrl,
      }),
      to: holder.email,
    })
  }

  await trySendEmail(env, {
    ...supportTicketConfirmationEmail({
      name: input.name,
      ticketId,
      subject: input.subject,
      body: input.body,
      seatLabel,
      hasAccount: !!memberId,
      siteUrl: input.siteUrl,
    }),
    to: input.email,
  })

  return { ticketId, ticketNumber, seat, holders, created: true }
}