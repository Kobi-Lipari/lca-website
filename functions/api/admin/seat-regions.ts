// functions/api/admin/seat-regions.ts
//
// Sets which club regions a regional representative's seat covers. Whoever
// holds the seat manages every club in those regions (club page, officers,
// news, logo, roster). Admin only, like every other change to a seat.
import type { Env } from '../../types'
import { recordAdminAction } from '../../utils/audit'
import { isResponse, requireAdmin } from '../../utils/auth'
import { isRegion } from '../../utils/regions'
import { errorResponse, handleOptions, jsonResponse, parseJsonBody } from '../../utils/response'

interface Body {
  seatId?: string
  regions?: unknown
}

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestPut: PagesFunction<Env> = async (ctx) => {
  const auth = await requireAdmin(ctx.request, ctx.env)
  if (isResponse(auth)) return auth

  const body = await parseJsonBody<Body>(ctx.request)
  if (!body?.seatId) return errorResponse('seatId is required', 400)
  if (!Array.isArray(body.regions) || !body.regions.every(isRegion)) {
    return errorResponse('regions must be a list of LCA regions', 400)
  }
  const regions = [...new Set(body.regions as string[])]

  const seat = await ctx.env.DB.prepare(
    'SELECT id, role, category FROM board_members WHERE id = ?',
  ).bind(body.seatId).first<{ id: string; role: string; category: string }>()
  if (!seat) return errorResponse('Seat not found', 404)
  if (seat.category !== 'regional_rep') {
    return errorResponse('Only regional representative seats cover regions', 400)
  }

  const before = await ctx.env.DB.prepare(
    'SELECT region FROM seat_regions WHERE seat_id = ? ORDER BY region',
  ).bind(seat.id).all<{ region: string }>()

  await ctx.env.DB.batch([
    ctx.env.DB.prepare('DELETE FROM seat_regions WHERE seat_id = ?').bind(seat.id),
    ...regions.map((r) =>
      ctx.env.DB.prepare('INSERT INTO seat_regions (seat_id, region) VALUES (?, ?)').bind(seat.id, r),
    ),
  ])

  await recordAdminAction(ctx.env.DB, auth.member, {
    action: 'seat_regions',
    targetLabel: seat.role,
    detail: { from: (before.results ?? []).map((r) => r.region), to: [...regions].sort() },
  })

  return jsonResponse({ seatId: seat.id, regions: [...regions].sort() })
}
