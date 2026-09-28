// functions/api/post-images/[id].ts — serves a post's picture from R2.
// Stored in the same bucket as club logos, under posts/.
import type { Env } from '../../types'
import { errorResponse } from '../../utils/response'

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const id = context.params.id as string
  if (!/^[a-z0-9-]+$/i.test(id)) return errorResponse('Not found', 404)
  const object = await context.env.CLUB_LOGOS.get(`posts/${id}.jpg`)
  if (!object) return errorResponse('Not found', 404)
  return new Response(object.body, {
    headers: {
      'Content-Type': object.httpMetadata?.contentType ?? 'image/jpeg',
      // The URL carries ?v=<upload time>, so a new upload is a new URL.
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}
