// functions/api/clubs/[id]/logo.ts
import type { Env } from '../../../types'
import { errorResponse } from '../../../utils/response'

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const clubId = context.params.id as string
  const key = `clubs/${clubId}/logo.jpg`

  const object = await context.env.CLUB_LOGOS.get(key)
  if (!object) return errorResponse('Not found', 404)

  return new Response(object.body, {
    headers: {
      'Content-Type': object.httpMetadata?.contentType ?? 'image/jpeg',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}