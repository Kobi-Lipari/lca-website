// functions/api/admin/board-seats.ts
import type { Env } from '../../types'
import { isResponse, requireAdmin } from '../../utils/auth'
import {
  errorResponse,
  handleOptions,
  jsonResponse,
  parseJsonBody,
} from '../../utils/response'

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

interface AssignBody {
  seatId?: string
  /** Add this member to the seat. Omit (or null) together with endMemberId. */
  memberId?: string | null
  /** End this member's term on the seat. */
  endMemberId?: string | null
  /** Vacate the seat entirely — ends every current holder. */
  vacate?: boolean
  note?: string | null
}

/**
 * Every seat (including retired ones), its current holders, and the full term
 * history. Inactive seats are included so an admin can see what was retired
 * and why the tickets attached to it still exist.
 */
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const auth = await requireAdmin(ctx.request, ctx.env)
  if (isResponse(auth)) return auth

  const seats = await ctx.env.DB.prepare(
    `SELECT s.id,
            s.slug,
            s.role,
            s.category,
            s.is_active,
            s.is_shared,
            s.sort_order,
            s.name AS fallback_name,
            (SELECT COUNT(*) FROM support_tickets t WHERE t.seat_id = s.id) AS ticket_count
       FROM board_members s
      ORDER BY s.is_active DESC, s.sort_order ASC, s.role ASC`,
  ).all()

  // Current holders as their own list rather than joined onto the seat row: a
  // shared seat has several, and the panel needs each one separately so it can
  // offer a remove button per person.
  const holders = await ctx.env.DB.prepare(
    `SELECT a.id            AS assignment_id,
            a.seat_id,
            a.member_id,
            a.started_at,
            m.full_name     AS member_name,
            m.email         AS member_email
       FROM board_seat_assignments a
       JOIN members m ON m.id = a.member_id
      WHERE a.ended_at IS NULL
      ORDER BY a.started_at ASC`,
  ).all()

  const history = await ctx.env.DB.prepare(
    `SELECT a.id,
            a.seat_id,
            a.member_id,
            a.started_at,
            a.ended_at,
            a.note,
            m.full_name AS member_name
       FROM board_seat_assignments a
       LEFT JOIN members m ON m.id = a.member_id
      ORDER BY a.started_at DESC`,
  ).all()

  return jsonResponse({
    seats: seats.results ?? [],
    holders: holders.results ?? [],
    history: history.results ?? [],
  })
}

/**
 * Assign, replace, remove one holder, or vacate.
 *
 * The is_shared distinction is the whole reason this isn't a one-liner. On an
 * ordinary seat, adding a holder means replacing the sitting one — there can
 * only be a single President. On a shared seat (two USCF Delegates who do the
 * same job), adding a holder must NOT evict the other, or assigning the second
 * delegate would silently remove the first.
 *
 * Nothing about the member's account changes in any case — not their role, not
 * their club, not their USCF data. Access to the seat's tickets appears and
 * disappears purely through ended_at.
 */
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const auth = await requireAdmin(ctx.request, ctx.env)
  if (isResponse(auth)) return auth

  const body = await parseJsonBody<AssignBody>(ctx.request)
  if (!body?.seatId) return errorResponse('seatId is required', 400)

  const seat = await ctx.env.DB.prepare(
    'SELECT id, role, is_shared FROM board_members WHERE id = ?',
  )
    .bind(body.seatId)
    .first<{ id: string; role: string; is_shared: number }>()
  if (!seat) return errorResponse('Seat not found', 404)

  // ── Remove one holder ──────────────────────────────────────────────────────
  if (body.endMemberId) {
    await ctx.env.DB.prepare(
      `UPDATE board_seat_assignments
          SET ended_at = datetime('now')
        WHERE seat_id = ? AND member_id = ? AND ended_at IS NULL`,
    )
      .bind(body.seatId, body.endMemberId)
      .run()

    return jsonResponse({ success: true, seatId: body.seatId, removed: body.endMemberId })
  }

  // ── Vacate entirely ────────────────────────────────────────────────────────
  if (body.vacate || !body.memberId) {
    await ctx.env.DB.prepare(
      `UPDATE board_seat_assignments
          SET ended_at = datetime('now')
        WHERE seat_id = ? AND ended_at IS NULL`,
    )
      .bind(body.seatId)
      .run()

    return jsonResponse({ success: true, seatId: body.seatId, memberId: null })
  }

  // ── Add a holder ───────────────────────────────────────────────────────────
  const member = await ctx.env.DB.prepare('SELECT id FROM members WHERE id = ?')
    .bind(body.memberId)
    .first()
  if (!member) return errorResponse('Member not found', 404)

  const existing = await ctx.env.DB.prepare(
    `SELECT id FROM board_seat_assignments
      WHERE seat_id = ? AND member_id = ? AND ended_at IS NULL`,
  )
    .bind(body.seatId, body.memberId)
    .first()
  if (existing) {
    return errorResponse('That member already holds this seat', 409)
  }

  const statements = []

  // Only an unshared seat evicts the sitting holder. idx_seat_member_current
  // stops the same person being added twice, but nothing at the database level
  // enforces one-holder-per-seat any more — this is where that rule lives.
  if (!seat.is_shared) {
    statements.push(
      ctx.env.DB.prepare(
        `UPDATE board_seat_assignments
            SET ended_at = datetime('now')
          WHERE seat_id = ? AND ended_at IS NULL`,
      ).bind(body.seatId),
    )
  }

  statements.push(
    ctx.env.DB.prepare(
      `INSERT INTO board_seat_assignments
         (seat_id, member_id, appointed_by, note)
       VALUES (?, ?, ?, ?)`,
    ).bind(body.seatId, body.memberId, auth.member.id, body.note ?? null),
  )

  // Batched so an unshared seat can never end up with two live holders, or
  // none when a replacement was intended.
  await ctx.env.DB.batch(statements)

  return jsonResponse({ success: true, seatId: body.seatId, memberId: body.memberId })
}