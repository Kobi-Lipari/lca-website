// functions/utils/tickets.ts
//
// One code path for opening a ticket, whatever the entry point — the contact
// form and the support form both land here, so routing, notification and
// reply-to behaviour can't drift between them.

import type { Env } from '../types'
import {
  trySendEmail,
  staffTicketNotificationEmail,
  supportTicketConfirmationEmail,
  boardSeatNotificationEmail,
} from './email'

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
 * seats resolve — an unknown or retired ref returns null and the caller falls
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
 * (vacant), and for a shared seat like USCF Delegate, several — all of whom
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
 * Absolute origin for links in outbound email. Taken from the request rather
 * than an env var so it's correct on the live domain, on *.pages.dev, and on
 * preview branches without anything to configure.
 */
export function siteUrlFromRequest(request: Request): string {
  return new URL(request.url).origin
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
}

export interface CreateTicketResult {
  ticketId: string
  seat: SeatRow | null
  holders: SeatHolder[]
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

  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO support_tickets
         (id, member_id, name, email, subject, seat_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).bind(ticketId, memberId, input.name, input.email, input.subject, seat?.id ?? null),
    env.DB.prepare(
      `INSERT INTO support_messages
         (id, ticket_id, sender_id, sender_type, body)
       VALUES (?, ?, ?, ?, ?)`,
    ).bind(
      messageId,
      ticketId,
      memberId,
      memberId ? 'member' : 'guest',
      input.body,
    ),
  ])

  const seatLabel = seat?.role ?? null
  const holderNames = holders.map((h) => h.full_name).join(' & ')

  // Everything below is best-effort: the ticket is already durable, so a mail
  // outage must not turn a successful submission into a 500.

  await trySendEmail(env, {
    ...staffTicketNotificationEmail({
      ticketId,
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
      seatLabel,
      siteUrl: input.siteUrl,
    }),
    to: input.email,
  })

  return { ticketId, seat, holders }
}