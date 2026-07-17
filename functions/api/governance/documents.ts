// functions/api/governance/documents.ts
import type { Env } from '../../types'
import { errorResponse, jsonResponse, parseJsonBody } from '../../utils/response'
import { requireAdmin, isResponse } from '../../utils/auth'

// Mirrors the frontend ApiGovernanceDocument['category'] union. The DB column
// has no CHECK constraint, so this allowlist is what keeps a typo'd category
// from creating a document invisible to every filtered view.
const VALID_CATEGORIES = ['bylaws', 'rules', 'minutes', 'treasurer', 'amendments'] as const

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const url = new URL(ctx.request.url)
  const category = url.searchParams.get('category')
  const { results } = category
    ? await ctx.env.DB.prepare('SELECT * FROM governance_documents WHERE category = ? ORDER BY year DESC, doc_date DESC, created_at DESC').bind(category).all()
    : await ctx.env.DB.prepare('SELECT * FROM governance_documents ORDER BY year DESC, doc_date DESC, created_at DESC').all()
  return jsonResponse({ documents: results })
}

interface CreateDocumentBody {
  category?: string
  title?: string
  content?: string | null
  filename?: string | null
  file_url?: string | null
  doc_date?: string | null
  year?: number | null
}

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const auth = await requireAdmin(ctx.request, ctx.env)
  if (isResponse(auth)) return auth

  const body = await parseJsonBody<CreateDocumentBody>(ctx.request)
  if (!body) return errorResponse('Invalid JSON body', 400)

  if (
    typeof body.category !== 'string' ||
    !(VALID_CATEGORIES as readonly string[]).includes(body.category)
  ) {
    return errorResponse(
      `category is required and must be one of: ${VALID_CATEGORIES.join(', ')}`,
      400,
    )
  }
  if (typeof body.title !== 'string' || !body.title.trim()) {
    return errorResponse('title is required', 400)
  }

  const year =
    body.year != null && Number.isFinite(Number(body.year)) ? Number(body.year) : null

  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 16)
  await ctx.env.DB.prepare(
    'INSERT INTO governance_documents (id, category, title, content, filename, file_url, doc_date, year) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(
    id,
    body.category,
    body.title.trim(),
    body.content || null,
    body.filename || null,
    body.file_url || null,
    body.doc_date || null,
    year,
  ).run()
  const doc = await ctx.env.DB.prepare('SELECT * FROM governance_documents WHERE id = ?').bind(id).first()
  return jsonResponse({ document: doc }, 201)
}
