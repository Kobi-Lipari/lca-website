// functions/api/admin/posts/[id]/image.ts — upload (POST) or remove (DELETE)
// a post's picture. The browser shrinks it first (longest edge 1600px), so
// R2 only ever stores a reasonably sized JPEG.
import type { Env } from '../../../../types'
import { isResponse, requireAdmin } from '../../../../utils/auth'
import { errorResponse, handleOptions, jsonResponse } from '../../../../utils/response'

const MAX_BYTES = 3 * 1024 * 1024

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const authed = await requireAdmin(context.request, context.env)
  if (isResponse(authed)) return authed

  const id = context.params.id as string
  const exists = await context.env.DB.prepare('SELECT 1 FROM lca_posts WHERE id = ?').bind(id).first()
  if (!exists) return errorResponse('Post not found', 404)

  const contentType = context.request.headers.get('content-type') ?? ''
  if (!contentType.startsWith('image/')) return errorResponse('Expected an image upload', 400)

  const body = await context.request.arrayBuffer()
  if (body.byteLength === 0) return errorResponse('Empty upload', 400)
  if (body.byteLength > MAX_BYTES) return errorResponse('Image too large', 413)

  await context.env.CLUB_LOGOS.put(`posts/${id}.jpg`, body, {
    httpMetadata: { contentType: 'image/jpeg' },
  })

  const imageUrl = `/api/post-images/${id}?v=${Date.now()}`
  await context.env.DB.prepare(
    `UPDATE lca_posts SET image_url = ?, updated_by = ?, updated_at = datetime('now') WHERE id = ?`,
  ).bind(imageUrl, authed.member.id, id).run()

  return jsonResponse({ imageUrl })
}

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const authed = await requireAdmin(context.request, context.env)
  if (isResponse(authed)) return authed

  const id = context.params.id as string
  await context.env.DB.prepare(
    `UPDATE lca_posts SET image_url = NULL, updated_by = ?, updated_at = datetime('now') WHERE id = ?`,
  ).bind(authed.member.id, id).run()
  try {
    await context.env.CLUB_LOGOS.delete(`posts/${id}.jpg`)
  } catch {
    // best effort
  }
  return jsonResponse({ success: true })
}
