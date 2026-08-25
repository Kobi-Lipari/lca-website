// functions/api/governance/board.ts
import type { Env } from '../../types'
import { errorResponse, jsonResponse, parseJsonBody } from '../../utils/response'
import { requireAdmin, isResponse } from '../../utils/auth'

/**
 * Stable routing key for a seat: /contact?to=scholastic-director
 *
 * Must stay in step with the derivation in migrations/0025_board_seats.sql,
 * or seats created here won't match the ones backfilled there.
 *
 * A slug is assigned ONCE, at creation. Renaming the role later must NOT
 * change it — links to the old slug are already in the wild, and the ticket
 * history hangs off the seat.
 */
function slugifyRole(role: string): string {
  return role
    .toLowerCase()
    .replace(/[.,]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** idx_board_members_slug is UNIQUE, so resolve collisions before inserting
 *  rather than letting the insert throw a constraint error at the admin. */
async function uniqueSlug(db: D1Database, base: string): Promise<string> {
  const candidate = base || 'seat'
  for (let n = 1; n < 50; n++) {
    const slug = n === 1 ? candidate : `${candidate}-${n}`
    const existing = await db
      .prepare('SELECT id FROM board_members WHERE slug = ?')
      .bind(slug)
      .first()
    if (!existing) return slug
  }
  return `${candidate}-${crypto.randomUUID().slice(0, 6)}`
}

/** Matches isRegionalRole() in src/pages/BoardPage.tsx and the backfill in 0025. */
function categoryForRole(role: string): 'officer' | 'regional_rep' {
  return /representative/i.test(role) ? 'regional_rep' : 'officer'
}

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  // Explicit columns, not SELECT *: this route is public, and `email` holds
  // legacy @louisianachess.org addresses that nothing should surface any more.
  const { results } = await ctx.env.DB.prepare(
    `SELECT id, role, name, sort_order, created_at, slug, category, is_active
       FROM board_members
      ORDER BY sort_order ASC, created_at ASC`,
  ).all()
  return jsonResponse({ members: results })
}

interface CreateBoardMemberBody {
  role?: string
  name?: string
  email?: string | null
  sort_order?: number
}

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const auth = await requireAdmin(ctx.request, ctx.env)
  if (isResponse(auth)) return auth

  const body = await parseJsonBody<CreateBoardMemberBody>(ctx.request)
  if (!body) return errorResponse('Invalid JSON body', 400)

  if (typeof body.role !== 'string' || !body.role.trim()) {
    return errorResponse('role is required', 400)
  }
  if (typeof body.name !== 'string' || !body.name.trim()) {
    return errorResponse('name is required', 400)
  }

  // ?? not ||: a sort_order of 0 is a legitimate "sort me first" value.
  const sortOrder = body.sort_order == null ? 99 : Number(body.sort_order)
  if (!Number.isFinite(sortOrder)) {
    return errorResponse('sort_order must be a number', 400)
  }

  const role = body.role.trim()
  const slug = await uniqueSlug(ctx.env.DB, slugifyRole(role))
  const category = categoryForRole(role)

  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 16)
  await ctx.env.DB.prepare(
    `INSERT INTO board_members (id, role, name, email, sort_order, slug, category, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
  )
    .bind(id, role, body.name.trim(), body.email || null, sortOrder, slug, category)
    .run()

  const member = await ctx.env.DB.prepare(
    `SELECT id, role, name, email, sort_order, created_at, slug, category, is_active
       FROM board_members WHERE id = ?`,
  )
    .bind(id)
    .first()

  return jsonResponse({ member }, 201)
}