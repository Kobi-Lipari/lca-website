// functions/api/admin/clubs/[id]/roster.ts
import type { Env } from '../../../../types'
import { isResponse, requireClubRep } from '../../../../utils/auth'
import { handleOptions, jsonResponse } from '../../../../utils/response'

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const clubId = context.params.id as string
  const authResult = await requireClubRep(context.request, context.env, clubId)
  if (isResponse(authResult)) return authResult

  const roster = await context.env.DB.prepare(
    `SELECT m.id, m.full_name, m.email, m.uscf_id, 
            m.membership_status, m.role, m.created_at
     FROM members m
     WHERE m.club_id = ?
     ORDER BY m.full_name`,
  ).bind(clubId).all()

  return jsonResponse({ roster: roster.results })
}