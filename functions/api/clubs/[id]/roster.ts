import type { Env } from '../../../types'
import { isResponse, requireClubRep } from '../../../utils/auth'
import { handleOptions, jsonResponse } from '../../../utils/response'

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const clubId = context.params.id as string
  const authResult = await requireClubRep(context.request, context.env, clubId)
  if (isResponse(authResult)) return authResult

  const { results } = await context.env.DB.prepare(
    `SELECT id, email, full_name, uscf_id, membership_status, role, created_at
     FROM members
     WHERE club_id = ?
     ORDER BY full_name ASC`,
  )
    .bind(clubId)
    .all()

  return jsonResponse({ roster: results ?? [] })
}
