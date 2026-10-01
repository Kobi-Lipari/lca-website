// functions/api/officer-photos/[key].ts — serves an officer photo from R2
// (same bucket as club logos, under officers/).
import type { Env } from '../../types'
import { errorResponse } from '../../utils/response'

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const key = context.params.key as string
  if (!/^(member|seat)-[A-Za-z0-9_-]+$/.test(key)) return errorResponse('Not found', 404)
  const object = await context.env.CLUB_LOGOS.get(`officers/${key}.jpg`)
  if (!object) return errorResponse('Not found', 404)
  return new Response(object.body, {
    headers: {
      'Content-Type': object.httpMetadata?.contentType ?? 'image/jpeg',
      // The URL carries ?v=<upload time>, so a new upload is a new URL.
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}
