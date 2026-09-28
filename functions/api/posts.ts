// functions/api/posts.ts — public list of published LCA news posts.
import type { Env } from '../types'
import { POST_LIST_COLUMNS } from '../utils/posts'
import { handleOptions, jsonResponse } from '../utils/response'

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const raw = Number(new URL(context.request.url).searchParams.get('limit') ?? 20)
  const limit = Number.isFinite(raw) ? Math.min(Math.max(Math.trunc(raw), 1), 50) : 20

  const { results } = await context.env.DB.prepare(
    `SELECT ${POST_LIST_COLUMNS} FROM lca_posts
      WHERE status = 'published'
      ORDER BY pinned DESC, published_at DESC, created_at DESC
      LIMIT ?`,
  ).bind(limit).all()

  return jsonResponse({ posts: results ?? [] }, 200)
}
