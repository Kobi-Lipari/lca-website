// functions/api/governance/board.ts
import type { Env } from '../../types'
import { jsonResponse } from '../../utils/response'
import { requireAdmin, isResponse } from '../../utils/auth'

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const { results } = await ctx.env.DB.prepare(
    'SELECT * FROM board_members ORDER BY sort_order ASC, created_at ASC'
  ).all()
  return jsonResponse({ members: results })
}

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const auth = await requireAdmin(ctx.request, ctx.env)
  if (isResponse(auth)) return auth
  const body = await ctx.request.json() as any
  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 16)
  await ctx.env.DB.prepare(
    'INSERT INTO board_members (id, role, name, email, sort_order) VALUES (?, ?, ?, ?, ?)'
  ).bind(id, body.role, body.name, body.email || null, body.sort_order || 99).run()
  const member = await ctx.env.DB.prepare('SELECT * FROM board_members WHERE id = ?').bind(id).first()
  return jsonResponse({ member }, 201)
}
