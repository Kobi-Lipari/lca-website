// functions/api/admin/officer-photo.ts
//
// Officer photos for the Board page. Admins only.
//   POST   ?member=<id> or ?seat=<id>   body: the JPEG (already square, from the browser)
//   DELETE ?member=<id> or ?seat=<id>   removes it
// A linked seat's photo belongs to the member holding it (it follows them
// to another seat); a seat with no member linked keeps its own.
import type { Env } from '../../types'
import { isResponse, requireAdmin } from '../../utils/auth'
import { errorResponse, handleOptions, jsonResponse } from '../../utils/response'

const MAX_BYTES = 2 * 1024 * 1024

function target(request: Request): { kind: 'member' | 'seat'; id: string } | null {
  const url = new URL(request.url)
  const member = url.searchParams.get('member')
  const seat = url.searchParams.get('seat')
  const id = member ?? seat
  if (!id || !/^[A-Za-z0-9_-]+$/.test(id)) return null
  return { kind: member ? 'member' : 'seat', id }
}

const tableOf = (kind: 'member' | 'seat') => (kind === 'member' ? 'members' : 'board_members')

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const auth = await requireAdmin(context.request, context.env)
  if (isResponse(auth)) return auth
  const t = target(context.request)
  if (!t) return errorResponse('member or seat is required', 400)

  const exists = await context.env.DB.prepare(`SELECT id FROM ${tableOf(t.kind)} WHERE id = ?`).bind(t.id).first()
  if (!exists) return errorResponse('Not found', 404)

  if (!(context.request.headers.get('content-type') ?? '').startsWith('image/')) {
    return errorResponse('Expected an image upload', 400)
  }
  const body = await context.request.arrayBuffer()
  if (body.byteLength === 0) return errorResponse('Empty upload', 400)
  if (body.byteLength > MAX_BYTES) return errorResponse('Image too large', 413)

  const key = `${t.kind}-${t.id}`
  await context.env.CLUB_LOGOS.put(`officers/${key}.jpg`, body, { httpMetadata: { contentType: 'image/jpeg' } })
  // A new URL per upload, so caches never show the old photo.
  const photoUrl = `/api/officer-photos/${key}?v=${Date.now()}`
  await context.env.DB.prepare(`UPDATE ${tableOf(t.kind)} SET photo_url = ? WHERE id = ?`).bind(photoUrl, t.id).run()
  return jsonResponse({ photoUrl })
}

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const auth = await requireAdmin(context.request, context.env)
  if (isResponse(auth)) return auth
  const t = target(context.request)
  if (!t) return errorResponse('member or seat is required', 400)
  await context.env.CLUB_LOGOS.delete(`officers/${t.kind}-${t.id}.jpg`)
  await context.env.DB.prepare(`UPDATE ${tableOf(t.kind)} SET photo_url = NULL WHERE id = ?`).bind(t.id).run()
  return jsonResponse({ success: true })
}
