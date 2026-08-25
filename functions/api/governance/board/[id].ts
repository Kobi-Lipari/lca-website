// functions/api/governance/board/[id].ts
import type { Env } from '../../../types'
import { errorResponse, jsonResponse, parseJsonBody } from '../../../utils/response'
import { requireAdmin, isResponse } from '../../../utils/auth'

interface UpdateBoardMemberBody {
  role?: string
  name?: string
  email?: string | null
  sort_order?: number
}

/**
 * Field-present semantics, matching PATCH /api/admin/tournaments/:id —
 * undefined keeps the existing value, so callers send only what changed.
 *
 * This used to be an unconditional SET on all four columns, which meant any
 * omitted field was written as null. BoardPage happened to spread the whole
 * member object, so it never bit; a caller sending just { name } would have
 * wiped the role.
 *
 * `email` is deliberately NOT wrapped in COALESCE: clearing it to null is a
 * legitimate operation, and the column is on its way out anyway now that
 * contact routing goes through seats.
 *
 * Note what this still does NOT update: slug and category. A slug is a public
 * routing key (/contact?to=scholastic-director) and the anchor for a seat's
 * whole ticket history, so it's assigned once at creation and frozen —
 * renaming a role must not break links already in the wild. Category is
 * derived from the role name at creation for the same reason.
 */
export const onRequestPut: PagesFunction<Env> = async (ctx) => {
  const auth = await requireAdmin(ctx.request, ctx.env)
  if (isResponse(auth)) return auth

  const { id } = ctx.params as { id: string }
  const body = await parseJsonBody<UpdateBoardMemberBody>(ctx.request)
  if (!body) return errorResponse('Invalid JSON body', 400)

  if (body.role !== undefined && (typeof body.role !== 'string' || !body.role.trim())) {
    return errorResponse('role cannot be empty', 400)
  }
  if (body.name !== undefined && (typeof body.name !== 'string' || !body.name.trim())) {
    return errorResponse('name cannot be empty', 400)
  }
  if (body.sort_order !== undefined && !Number.isFinite(Number(body.sort_order))) {
    return errorResponse('sort_order must be a number', 400)
  }

  await ctx.env.DB.prepare(
    `UPDATE board_members
        SET role       = COALESCE(?, role),
            name       = COALESCE(?, name),
            email      = ?,
            sort_order = COALESCE(?, sort_order)
      WHERE id = ?`,
  )
    .bind(
      body.role?.trim() ?? null,
      body.name?.trim() ?? null,
      body.email || null,
      body.sort_order == null ? null : Number(body.sort_order),
      id,
    )
    .run()

  const member = await ctx.env.DB.prepare(
    `SELECT id, role, name, email, sort_order, created_at, slug, category, is_active, is_shared
       FROM board_members WHERE id = ?`,
  )
    .bind(id)
    .first()

  if (!member) return jsonResponse({ error: 'Not found' }, 404)
  return jsonResponse({ member })
}

/**
 * Retires a seat rather than deleting the row.
 *
 * A hard DELETE can't work any more, and shouldn't: support_tickets.seat_id
 * references this table, so with foreign_keys ON the delete would throw a
 * constraint error the moment the seat has ever received a message. And if it
 * did succeed, board_seat_assignments would cascade — destroying the officer
 * history the seat/assignment split exists to preserve.
 *
 * Setting is_active = 0 hides the seat from the board page, the contact
 * picker, and requireSeatAccess, while the tickets and the record of who held
 * it stay intact. Any sitting holders' terms are closed in the same breath.
 */
export const onRequestDelete: PagesFunction<Env> = async (ctx) => {
  const auth = await requireAdmin(ctx.request, ctx.env)
  if (isResponse(auth)) return auth
  const { id } = ctx.params as { id: string }

  await ctx.env.DB.batch([
    ctx.env.DB.prepare(
      `UPDATE board_seat_assignments
          SET ended_at = datetime('now')
        WHERE seat_id = ? AND ended_at IS NULL`,
    ).bind(id),
    ctx.env.DB.prepare(
      'UPDATE board_members SET is_active = 0 WHERE id = ?',
    ).bind(id),
  ])

  return jsonResponse({ deleted: true })
}