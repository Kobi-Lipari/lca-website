// functions/api/governance/board.ts
import type { Env } from '../../types'
import { errorResponse, jsonResponse, parseJsonBody } from '../../utils/response'
import { requireAdmin, isResponse } from '../../utils/auth'

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const { results } = await ctx.env.DB.prepare(
    'SELECT * FROM board_members ORDER BY sort_order ASC, created_at ASC'
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

  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 16)
  await ctx.env.DB.prepare(
    'INSERT INTO board_members (id, role, name, email, sort_order) VALUES (?, ?, ?, ?, ?)'
  ).bind(id, body.role.trim(), body.name.trim(), body.email || null, sortOrder).run()
  const member = await ctx.env.DB.prepare('SELECT * FROM board_members WHERE id = ?').bind(id).first()
  return jsonResponse({ member }, 201)
}
