import type { Env } from '../../../types'
import { jsonResponse } from '../../../utils/response'
import { requireAdmin, isResponse } from '../../../utils/auth'

export const onRequestPut: PagesFunction<Env> = async (ctx) => {
  const auth = await requireAdmin(ctx.request, ctx.env)
  if (isResponse(auth)) return auth
  const { id } = ctx.params as { id: string }
  const body = await ctx.request.json() as any
  await ctx.env.DB.prepare(
    'UPDATE board_members SET role = ?, name = ?, email = ?, sort_order = ? WHERE id = ?'
  ).bind(body.role, body.name, body.email || null, body.sort_order ?? 99, id).run()
  const member = await ctx.env.DB.prepare('SELECT * FROM board_members WHERE id = ?').bind(id).first()
  if (!member) return jsonResponse({ error: 'Not found' }, 404)
  return jsonResponse({ member })
}

export const onRequestDelete: PagesFunction<Env> = async (ctx) => {
  const auth = await requireAdmin(ctx.request, ctx.env)
  if (isResponse(auth)) return auth
  const { id } = ctx.params as { id: string }
  await ctx.env.DB.prepare('DELETE FROM board_members WHERE id = ?').bind(id).run()
  return jsonResponse({ deleted: true })
}
