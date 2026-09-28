// functions/api/posts/[slug].ts — one published post, with its body.
import type { Env } from '../../types'
import { errorResponse, handleOptions, jsonResponse } from '../../utils/response'

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const slug = context.params.slug as string
  const post = await context.env.DB.prepare(
    `SELECT id, slug, title, summary, body_html, image_url, link_url, link_label, pinned, published_at, updated_at
       FROM lca_posts WHERE slug = ? AND status = 'published'`,
  ).bind(slug).first()
  if (!post) return errorResponse('Post not found', 404)
  return jsonResponse({ post })
}
