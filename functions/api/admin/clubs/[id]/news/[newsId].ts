// functions/api/admin/clubs/[id]/news/[newsId].ts
import type { Env } from '../../../../../types'
import { isResponse, requireClubRep } from '../../../../../utils/auth'
import { errorResponse, handleOptions, jsonResponse } from '../../../../../utils/response'

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const clubId = context.params.id as string
  const newsId = context.params.newsId as string
  const authResult = await requireClubRep(context.request, context.env, clubId)
  if (isResponse(authResult)) return authResult

  const result = await context.env.DB.prepare(
    `DELETE FROM club_news WHERE id = ? AND club_id = ?`,
  )
    .bind(newsId, clubId)
    .run()

  if (result.meta.changes === 0) {
    return errorResponse('News post not found', 404)
  }

  return jsonResponse({ deleted: true })
}