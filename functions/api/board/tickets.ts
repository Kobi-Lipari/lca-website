// functions/api/board/tickets.ts
import type { Env } from '../../types'
import { isResponse, requireSeatAccess } from '../../utils/auth'
import { handleOptions, jsonResponse } from '../../utils/response'

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

/**
 * Tickets for every seat the caller can read. For a board member that's the
 * seats they currently hold; for an lca_admin it's all of them, so admins can
 * see what's going unanswered across the whole board.
 *
 * Access is derived entirely from board_seat_assignments — the moment a term
 * ends, these rows stop being visible to the outgoing holder and start being
 * visible to their successor, including everything received before they took
 * the seat.
 */
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const access = await requireSeatAccess(ctx.request, ctx.env)
  if (isResponse(access)) return access

  if (access.seatIds.length === 0) {
    return jsonResponse({ tickets: [], seatIds: [], isAdmin: access.isAdmin })
  }

  const url = new URL(ctx.request.url)
  const statusFilter = url.searchParams.get('status')
  const seatFilter = url.searchParams.get('seatId')

  // Only seats this caller already has access to survive the intersection, so
  // ?seatId= can't be used to read someone else's inbox.
  const seatIds = seatFilter
    ? access.seatIds.filter((id) => id === seatFilter)
    : access.seatIds

  if (seatIds.length === 0) {
    return jsonResponse({ tickets: [], seatIds: access.seatIds, isAdmin: access.isAdmin })
  }

  const placeholders = seatIds.map(() => '?').join(', ')
  const binds: unknown[] = [...seatIds]

  let statusClause = ''
  if (statusFilter) {
    statusClause = ' AND t.status = ?'
    binds.push(statusFilter)
  }

  // Three columns exist purely to answer "is anything being missed?":
  //   last_sender_type   — a ticket whose last real message came from the
  //                        visitor is awaiting a reply, whatever its status.
  //   seat_holder_count  — 0 means nobody holds this seat, so nobody but an
  //                        admin is even seeing these. The likeliest way a
  //                        message gets lost.
  //   last_activity_at   — how long it's been sitting.
  // is_note = 0 on the sender lookup: logging a Gmail exchange after the fact
  // does count as having answered, and those rows are stored as 'admin'.
  const tickets = await ctx.env.DB.prepare(
    `SELECT t.id,
            t.name,
            t.email,
            t.subject,
            t.status,
            t.seat_id,
            t.created_at,
            t.updated_at,
            b.role AS seat_role,
            (SELECT COUNT(*) FROM support_messages m WHERE m.ticket_id = t.id) AS message_count,
            (SELECT body FROM support_messages m WHERE m.ticket_id = t.id
              ORDER BY created_at DESC LIMIT 1) AS last_message,
            (SELECT sender_type FROM support_messages m
              WHERE m.ticket_id = t.id AND m.is_note = 0
              ORDER BY created_at DESC LIMIT 1) AS last_sender_type,
            (SELECT MAX(COALESCE(m.occurred_at, m.created_at)) FROM support_messages m
              WHERE m.ticket_id = t.id) AS last_activity_at,
            (SELECT COUNT(*) FROM board_seat_assignments a
              WHERE a.seat_id = t.seat_id AND a.ended_at IS NULL) AS seat_holder_count
       FROM support_tickets t
       JOIN board_members b ON b.id = t.seat_id
      WHERE t.seat_id IN (${placeholders})${statusClause}
      ORDER BY t.updated_at DESC`,
  )
    .bind(...binds)
    .all()

  return jsonResponse({
    tickets: tickets.results ?? [],
    seatIds: access.seatIds,
    isAdmin: access.isAdmin,
  })
}