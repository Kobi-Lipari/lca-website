// functions/api/admin/clubs/[id]/logo.ts
import type { Env } from '../../../../types'
import { isResponse, requireClubRep } from '../../../../utils/auth'
import { errorResponse, handleOptions, jsonResponse } from '../../../../utils/response'

const MAX_BYTES = 2 * 1024 * 1024 // 2MB — generous for a resized 400x220 JPEG, guards against abuse

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const clubId = context.params.id as string
  const authResult = await requireClubRep(context.request, context.env, clubId)
  if (isResponse(authResult)) return authResult

  const contentType = context.request.headers.get('content-type') ?? ''
  if (!contentType.startsWith('image/')) {
    return errorResponse('Expected an image upload', 400)
  }

  const body = await context.request.arrayBuffer()
  if (body.byteLength === 0) return errorResponse('Empty upload', 400)
  if (body.byteLength > MAX_BYTES) return errorResponse('Image too large', 413)

  // Deterministic key — re-uploading a club's logo overwrites the previous
  // file in R2 instead of accumulating orphaned objects over time.
  const key = `clubs/${clubId}/logo.jpg`

  await context.env.CLUB_LOGOS.put(key, body, {
    httpMetadata: { contentType: 'image/jpeg' },
  })

  // Cache-busting query param so browsers/CDN don't keep serving the old
  // image at the same URL after a re-upload.
  const imageUrl = `/api/clubs/${clubId}/logo?v=${Date.now()}`

  await context.env.DB.prepare('UPDATE clubs SET image_url = ? WHERE id = ?')
    .bind(imageUrl, clubId)
    .run()

  return jsonResponse({ imageUrl })
}