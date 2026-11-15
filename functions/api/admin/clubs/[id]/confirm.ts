// functions/api/admin/clubs/[id]/confirm.ts
//
// POST: Still accurate, one tap by a keeper of the club that says its
// listing is as it should be. It sets the club's last check,
// last_confirmed_at, to now and confirmed_by to the person, for that club
// alone, and changes none of the listing's words, so it leaves
// told_updated_at and told_by as they are and a form another keeper has
// open is not refused as stale by it. Like a save that changes no field it
// writes no activity row, and it sends no email.
//
// Who may: whoever requireClubRep admits, as for the club's save: an LCA
// admin, the club's own rep and a holder of a regional seat over the club's
// region. Anyone else, and anyone at all for a club that does not exist but
// an LCA admin, gets the same 403, so no answer tells whether a club exists.
// WS09 step 28 adds the wait while a report or suggestion is open.
//
// While CLUB_KEEPERS_ON is unset everyone gets 403 in words before anything
// is read: no sign in is checked and no query is made.
import type { Env } from '../../../../types'
import { isResponse, requireClubRep } from '../../../../utils/auth'
import { errorResponse, handleOptions, jsonResponse, parseBody } from '../../../../utils/response'
import { CLUB_KEEPERS_ON } from '../../../../utils/clubs/pages'
import { checkWords } from '../../../../../domain/clubs/regionCards'
import { clubConfirmRequestSchema } from '../../../../../domain/contracts/clubs'

/** The 403 everyone gets while CLUB_KEEPERS_ON is unset. */
export const CONFIRM_CLOSED = 'Still accurate cannot be used yet.'

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestPost: PagesFunction<Env> = async (context) => {
  if (!CLUB_KEEPERS_ON) return errorResponse(CONFIRM_CLOSED, 403)

  const clubId = context.params.id as string
  const authResult = await requireClubRep(context.request, context.env, clubId)
  if (isResponse(authResult)) return authResult

  const body = await parseBody(context.request, clubConfirmRequestSchema)
  if (isResponse(body)) return body

  const row = await context.env.DB.prepare(
    `UPDATE clubs SET last_confirmed_at = datetime('now'), confirmed_by = ?
      WHERE id = ?
      RETURNING last_confirmed_at`,
  )
    .bind(authResult.member.id, clubId)
    .first<{ last_confirmed_at: string }>()
  // Only an LCA admin reaches here for a club that is not there.
  if (!row) return errorResponse('Club not found', 404)

  return jsonResponse({
    id: clubId,
    lastConfirmedAt: row.last_confirmed_at,
    lastCheckWords: checkWords(row.last_confirmed_at, Date.now()),
  })
}
