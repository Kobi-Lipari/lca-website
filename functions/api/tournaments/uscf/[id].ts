import type { Env } from '../../types'
import {
  fetchUscfRatingFromWeb,
  isRatingCacheStale,
  refreshMemberUscfRating,
} from '../../../utils/uscf'
import { errorResponse, handleOptions, jsonResponse } from '../../../utils/response'

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const uscfId = context.params.id as string

  if (!uscfId?.trim()) {
    return errorResponse('USCF ID is required', 400)
  }

  const member = await context.env.DB.prepare(
    `SELECT id, uscf_rating, uscf_rating_updated_at FROM members WHERE uscf_id = ? LIMIT 1`,
  )
    .bind(uscfId.trim())
    .first<{
      id: string
      uscf_rating: number | null
      uscf_rating_updated_at: string | null
    }>()

  if (
    member &&
    member.uscf_rating != null &&
    !isRatingCacheStale(member.uscf_rating_updated_at)
  ) {
    return jsonResponse({
      uscfId: uscfId.trim(),
      rating: member.uscf_rating,
      cached: true,
    })
  }

  const lookup = await fetchUscfRatingFromWeb(uscfId)

  if (member) {
    await refreshMemberUscfRating(context.env.DB, member.id, uscfId.trim())
  }

  return jsonResponse({
    uscfId: lookup.uscfId,
    rating: lookup.rating,
    name: lookup.name,
    cached: false,
  })
}
