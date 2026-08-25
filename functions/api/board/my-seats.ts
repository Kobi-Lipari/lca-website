// functions/api/board/my-seats.ts
import type { Env } from '../../types'
import { isResponse, requireAuthedMember } from '../../utils/auth'
import { handleOptions, jsonResponse } from '../../utils/response'

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

/**
 * The seats this member currently holds. Returns an empty array rather than
 * 403 for the overwhelming majority who hold none — this is a "what can I
 * see?" question asked on every session load, and an empty answer is a valid
 * one, not an error.
 *
 * Deliberately NOT folded into /api/me: seats are a grant that changes
 * independently of the account, and keeping them on their own endpoint means
 * a seat handoff can be reflected by refetching this alone.
 */
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const authed = await requireAuthedMember(ctx.request, ctx.env)
  if (isResponse(authed)) return authed

  const { results } = await ctx.env.DB.prepare(
    `SELECT s.id,
            s.slug,
            s.role,
            s.category,
            a.started_at
       FROM board_seat_assignments a
       JOIN board_members s ON s.id = a.seat_id
      WHERE a.member_id = ?
        AND a.ended_at IS NULL
        AND s.is_active = 1
      ORDER BY s.sort_order ASC`,
  )
    .bind(authed.member.id)
    .all()

  return jsonResponse({ seats: results ?? [] })
}