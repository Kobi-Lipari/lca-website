import type { Env } from '../../types'
import { jsonResponse } from '../../utils/response'
import { requireAdmin, isResponse } from '../../utils/auth'

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const url = new URL(ctx.request.url)
  const category = url.searchParams.get('category')
  const { results } = category
    ? await ctx.env.DB.prepare('SELECT * FROM governance_documents WHERE category = ? ORDER BY year DESC, doc_date DESC, created_at DESC').bind(category).all()
    : await ctx.env.DB.prepare('SELECT * FROM governance_documents ORDER BY year DESC, doc_date DESC, created_at DESC').all()
  return jsonResponse({ documents: results })
}

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const auth = await requireAdmin(ctx.request, ctx.env)
  if (isResponse(auth)) return auth
  const body = await ctx.request.json() as any
  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 16)
  await ctx.env.DB.prepare(
    'INSERT INTO governance_documents (id, category, title, content, filename, file_url, doc_date, year) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(id, body.category, body.title, body.content || null, body.filename || null, body.file_url || null, body.doc_date || null, body.year || null).run()
  const doc = await ctx.env.DB.prepare('SELECT * FROM governance_documents WHERE id = ?').bind(id).first()
  return jsonResponse({ document: doc }, 201)
}
