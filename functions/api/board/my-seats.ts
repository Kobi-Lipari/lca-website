// functions/api/board/my-seats.ts
import type { Env } from '../../types'
import { isResponse, requireAuthedMember } from '../../utils/auth'
import { getRegionalClubIds } from '../../utils/permissions'
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
    .all<{ id: string }>()
  const seats = results ?? []

  // Regions each seat covers, and the clubs its holder manages because of
  // them. Both empty for everyone but regional representatives.
  let managedClubs: Array<{ id: string; name: string; region: string | null }> = []
  if (seats.length > 0) {
    const { results: regionRows } = await ctx.env.DB.prepare(
      `SELECT r.seat_id, r.region
         FROM seat_regions r
         JOIN board_seat_assignments a ON a.seat_id = r.seat_id
        WHERE a.member_id = ? AND a.ended_at IS NULL
        ORDER BY r.region`,
    ).bind(authed.member.id).all<{ seat_id: string; region: string }>()
    for (const seat of seats as Array<{ id: string; regions?: string[] }>) {
      seat.regions = (regionRows ?? []).filter((r) => r.seat_id === seat.id).map((r) => r.region)
    }

    const ids = await getRegionalClubIds(ctx.env.DB, authed.member.id)
    if (ids.length > 0) {
      const { results: clubs } = await ctx.env.DB.prepare(
        `SELECT id, name, region FROM clubs
          WHERE id IN (${ids.map(() => '?').join(', ')})
          ORDER BY region, name`,
      ).bind(...ids).all<{ id: string; name: string; region: string | null }>()
      managedClubs = clubs ?? []
    }
  }

  return jsonResponse({ seats, managedClubs })
}