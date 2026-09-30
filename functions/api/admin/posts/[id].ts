// functions/api/admin/posts/[id].ts — edit or delete one LCA news post.
import type { Env } from '../../../types'
import { isResponse, requireAdmin, requireAdminView } from '../../../utils/auth'
import { errorResponse, handleOptions, jsonResponse, parseJsonBody } from '../../../utils/response'
import { applyPostEdits, type PostBody } from '../../../utils/posts'

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const authed = await requireAdminView(context.request, context.env)
  if (isResponse(authed)) return authed
  const post = await context.env.DB.prepare('SELECT * FROM lca_posts WHERE id = ?')
    .bind(context.params.id as string).first()
  if (!post) return errorResponse('Post not found', 404)
  return jsonResponse({ post })
}

export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const authed = await requireAdmin(context.request, context.env)
  if (isResponse(authed)) return authed

  const body = await parseJsonBody<PostBody>(context.request)
  if (!body) return errorResponse('Invalid JSON body', 400)

  const result = await applyPostEdits(context.env.DB, context.params.id as string, body, authed.member.id)
  if (typeof result === 'string') {
    return errorResponse(result, result === 'Post not found' ? 404 : 400)
  }
  return jsonResponse({ post: result })
}

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const authed = await requireAdmin(context.request, context.env)
  if (isResponse(authed)) return authed

  const id = context.params.id as string
  const result = await context.env.DB.prepare('DELETE FROM lca_posts WHERE id = ?').bind(id).run()
  if (!result.meta.changes) return errorResponse('Post not found', 404)
  // The picture goes too; a missing one is fine.
  try {
    await context.env.CLUB_LOGOS.delete(`posts/${id}.jpg`)
  } catch {
    // best effort
  }
  return jsonResponse({ success: true })
}
