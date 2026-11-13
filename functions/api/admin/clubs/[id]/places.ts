// functions/api/admin/clubs/[id]/places.ts
//
// PUT: the club's places, at most two, saved by its keepers (an LCA admin,
// the club's rep and the representative for its region), while
// CLUB_KEEPERS_ON is set (functions/utils/clubs/pages.ts). Each place is a
// name, an optional street and note, and an optional point set by hand, a
// click on the map or pasted numbers, as today's pin picker sets one;
// nothing is looked up at any provider. The places replace the club's own
// in one batch with today's location and pin taken from place 1, the
// keepers' stamps and the activity row (functions/utils/clubs/save.ts), and
// the region's representatives are told after the answer. With the constant
// unset every keeper is answered 403 in words and nothing is read or
// written.
import type { Env } from '../../../../types'
import { isResponse, requireClubRep } from '../../../../utils/auth'
import { errorResponse, handleOptions, jsonResponse, parseBody } from '../../../../utils/response'
import { CLUB_KEEPERS_ON } from '../../../../utils/clubs/pages'
import { readPlaces, savePlaces } from '../../../../utils/clubs/save'
import { sendClubSaveNotice } from '../../../../utils/clubs/emails'
import { clubPlacesRequestSchema } from '../../../../../domain/contracts/clubs'

/** The 403 every keeper gets while CLUB_KEEPERS_ON is unset. */
export const PLACES_CLOSED = 'A club\'s places cannot be saved yet.'

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const clubId = context.params.id as string
  const authResult = await requireClubRep(context.request, context.env, clubId)
  if (isResponse(authResult)) return authResult
  if (!CLUB_KEEPERS_ON) return errorResponse(PLACES_CLOSED, 403)

  const existing = await context.env.DB.prepare('SELECT * FROM clubs WHERE id = ?')
    .bind(clubId)
    .first<Record<string, unknown>>()
  if (!existing) return errorResponse('Club not found', 404)

  const body = await parseBody(context.request, clubPlacesRequestSchema)
  if (isResponse(body)) return body

  const changed = await savePlaces(context.env.DB, { clubId, saver: authResult.member, existing, places: body.places })

  context.waitUntil(sendClubSaveNotice(context.env, context.request, {
    clubId,
    clubName: String(existing.name),
    saver: authResult.member,
    columns: changed,
  }))
  return jsonResponse({ places: await readPlaces(context.env.DB, clubId) })
}
