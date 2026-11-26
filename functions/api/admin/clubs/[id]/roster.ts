// functions/api/admin/clubs/[id]/roster.ts
// The club's roster, for an LCA admin, an observer and the club's own rep.
// A person admitted by a regional seat alone gets 403 in words
// (functions/utils/clubs/memberView.ts). With CLUB_PAGES_ON set
// (functions/utils/clubs/pages.ts) LCA keeps no roster for a club, so the
// GET answers 410 in words after the same checks, and reads nothing.
import type { Env } from '../../../../types'
import { isResponse, requireClubView } from '../../../../utils/auth'
import { errorResponse, handleOptions, jsonResponse } from '../../../../utils/response'
import { admittedByRegionAlone, ROSTER_KEPT_BACK } from '../../../../utils/clubs/memberView'
import { CLUB_PAGES_ON } from '../../../../utils/clubs/pages'

/** The 410 for the roster while CLUB_PAGES_ON is set: a player is no longer tied to a club. */
export const ROSTER_NOT_KEPT = 'LCA no longer keeps a roster for each club. Reload the page.'

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const clubId = context.params.id as string
  const authResult = await requireClubView(context.request, context.env, clubId)
  if (isResponse(authResult)) return authResult
  if (admittedByRegionAlone(authResult.member, clubId)) return errorResponse(ROSTER_KEPT_BACK, 403)
  if (CLUB_PAGES_ON) return errorResponse(ROSTER_NOT_KEPT, 410)

  const roster = await context.env.DB.prepare(
    `SELECT m.id, m.full_name, m.email, m.uscf_id,
            m.membership_status, m.role, m.created_at
     FROM members m
     WHERE m.club_id = ?
     ORDER BY m.full_name`,
  ).bind(clubId).all()

  return jsonResponse({ roster: roster.results })
}
