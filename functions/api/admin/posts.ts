// functions/api/admin/posts.ts — LCA news posts: list all (admin) and create.
import type { Env } from '../../types'
import { isResponse, requireAdmin, requireAdminView } from '../../utils/auth'
import { errorResponse, handleOptions, jsonResponse, parseJsonBody } from '../../utils/response'
import { applyPostEdits, POST_LIST_COLUMNS, uniqueSlug, type PostBody } from '../../utils/posts'

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const authed = await requireAdminView(context.request, context.env)
  if (isResponse(authed)) return authed

  // Drafts first (they're what you're working on), then newest.
  const { results } = await context.env.DB.prepare(
    `SELECT ${POST_LIST_COLUMNS} FROM lca_posts
      ORDER BY (status = 'draft') DESC, pinned DESC, COALESCE(published_at, created_at) DESC`,
  ).all()
  return jsonResponse({ posts: results ?? [] })
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const authed = await requireAdmin(context.request, context.env)
  if (isResponse(authed)) return authed

  const body = await parseJsonBody<PostBody>(context.request)
  const title = body?.title?.trim()
  if (!body || !title) return errorResponse('A title is required', 400)

  const id = `post-${crypto.randomUUID()}`
  const slug = await uniqueSlug(context.env.DB, body.slug?.trim() || title)
  await context.env.DB.prepare(
    `INSERT INTO lca_posts (id, slug, title, created_by, updated_by) VALUES (?, ?, ?, ?, ?)`,
  ).bind(id, slug, title, authed.member.id, authed.member.id).run()

  // Everything else goes through the same path as an edit.
  const result = await applyPostEdits(context.env.DB, id, { ...body, slug: undefined }, authed.member.id)
  if (typeof result === 'string') {
    await context.env.DB.prepare('DELETE FROM lca_posts WHERE id = ?').bind(id).run()
    return errorResponse(result, 400)
  }
  return jsonResponse({ post: result }, 201)
}
