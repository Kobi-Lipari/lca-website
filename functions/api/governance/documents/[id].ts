import type { Env } from '../../../types'
import { jsonResponse } from '../../../utils/response'
import { requireAdmin, isResponse } from '../../../utils/auth'

export const onRequestPut: PagesFunction<Env> = async (ctx) => {
  const auth = await requireAdmin(ctx.request, ctx.env)
  if (isResponse(auth)) return auth
  const { id } = ctx.params as { id: string }
  const body = await ctx.request.json() as any
  await ctx.env.DB.prepare(
    'UPDATE governance_documents SET category = ?, title = ?, content = ?, filename = ?, file_url = ?, doc_date = ?, year = ? WHERE id = ?'
  ).bind(body.category, body.title, body.content || null, body.filename || null, body.file_url || null, body.doc_date || null, body.year || null, id).run()
  const doc = await ctx.env.DB.prepare('SELECT * FROM governance_documents WHERE id = ?').bind(id).first()
  if (!doc) return jsonResponse({ error: 'Not found' }, 404)
  return jsonResponse({ document: doc })
}

export const onRequestDelete: PagesFunction<Env> = async (ctx) => {
  const auth = await requireAdmin(ctx.request, ctx.env)
  if (isResponse(auth)) return auth
  const { id } = ctx.params as { id: string }
  await ctx.env.DB.prepare('DELETE FROM governance_documents WHERE id = ?').bind(id).run()
  return jsonResponse({ deleted: true })
}