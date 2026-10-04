import type { Env } from '../../../types'
import { jsonResponse } from '../../../utils/response'
import { requireGovernanceEditor, isResponse } from '../../../utils/auth'
import { recordAdminAction } from '../../../utils/audit'
import { isSafeLink, sanitizeDocumentHtml } from '../../../utils/posts'

interface GovernanceDocumentBody {
  category?: string
  title?: string
  content?: string | null
  filename?: string | null
  file_url?: string | null
  doc_date?: string | null
  year?: number | null
}

export const onRequestPut: PagesFunction<Env> = async (ctx) => {
  const auth = await requireGovernanceEditor(ctx.request, ctx.env)
  if (isResponse(auth)) return auth
  const { id } = ctx.params as { id: string }
  const body = (await ctx.request.json()) as GovernanceDocumentBody
  if (!body?.category?.trim() || !body?.title?.trim()) {
    return jsonResponse({ error: 'category and title are required' }, 400)
  }
  if (body.file_url && !(typeof body.file_url === 'string' && isSafeLink(body.file_url.trim()))) {
    return jsonResponse({ error: 'The file link must start with /, http:// or https://' }, 400)
  }
  // Cleaned on the way in, the same as on create: the public pages render it as it is.
  const content = typeof body.content === 'string' && body.content
    ? await sanitizeDocumentHtml(body.content)
    : null
  await ctx.env.DB.prepare(
    'UPDATE governance_documents SET category = ?, title = ?, content = ?, filename = ?, file_url = ?, doc_date = ?, year = ? WHERE id = ?'
  ).bind(body.category, body.title, content || null, body.filename || null, body.file_url || null, body.doc_date || null, body.year || null, id).run()
  const doc = await ctx.env.DB.prepare('SELECT * FROM governance_documents WHERE id = ?').bind(id).first()
  if (!doc) return jsonResponse({ error: 'Not found' }, 404)
  await recordAdminAction(ctx.env.DB, auth.member, {
    action: 'document_edit',
    targetLabel: `"${body.title.trim()}"`,
    detail: { id, category: body.category },
  })
  return jsonResponse({ document: doc })
}

export const onRequestDelete: PagesFunction<Env> = async (ctx) => {
  const auth = await requireGovernanceEditor(ctx.request, ctx.env)
  if (isResponse(auth)) return auth
  const { id } = ctx.params as { id: string }
  const doc = await ctx.env.DB.prepare('SELECT title, category FROM governance_documents WHERE id = ?')
    .bind(id).first<{ title: string; category: string }>()
  await ctx.env.DB.prepare('DELETE FROM governance_documents WHERE id = ?').bind(id).run()
  if (doc) {
    await recordAdminAction(ctx.env.DB, auth.member, {
      action: 'document_remove',
      targetLabel: `"${doc.title}"`,
      detail: { id, category: doc.category },
    })
  }
  return jsonResponse({ deleted: true })
}