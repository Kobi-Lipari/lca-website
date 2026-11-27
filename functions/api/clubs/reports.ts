// functions/api/clubs/reports.ts
//
// POST /api/clubs/reports: Suggest a club and Start a club (WS09 step 30),
// what a visitor sends from the form at /clubs/suggest, with no club. A
// static file beside functions/api/clubs/[id].ts and its folder: Pages routes
// a fixed name before a parameter, so this file takes POST and OPTIONS to
// /api/clubs/reports, and a GET of that address still reaches [id].ts and
// answers its "Club not found", as before ("reports" is a name no club may
// take, domain/clubs/slug.ts). The row is saved as one of club_reports of the
// kind 'new_club' or 'start_club' and emailed to the representatives of the
// region the place was found in, else to the LCA admins
// (functions/utils/clubs/clubRequests.ts).
//
// The guards, in Suggest an update's order (functions/api/clubs/[id]/reports.ts),
// each refusing in words with nothing saved and nothing sent:
//   1. CLUB_PAGES_ON unset: 403, before the body or anything else is read;
//   2. the body, through parseBody and its contract (the kind, the club's
//      name, the city or ZIP, where and when, the person's name and address,
//      each held to domain/clubs/newClub.ts): 400 with the field's words;
//   3. five requests an hour from one place: 429, or 503 with no signing
//      secret;
//   4. the spam check: 403 when the provider says no or there is no token,
//      503 with no secret or no answer;
//   5. the place and its region (functions/utils/clubs/places.ts), where
//      "not found" is an answer and not a refusal;
//   6. ten requests an hour to one set of keepers, from every place together
//      (a region's representatives, or the LCA admins), counted only for one
//      that has passed the spam check: 429 in words of its own. A row whose
//      representatives could not be reached is counted again against the
//      admins' set before it falls to them, and with that hour used up it is
//      saved and sends nothing. So by this door each person is sent at most
//      ten emails an hour, 240 in a day, for each set they are in: a
//      representative one set for each region their seats cover (one, as
//      migration 0072 leaves every seat), and an LCA admin the admins' set,
//      and one more for each region whose seat the admin also holds.
// Then the row is saved and the keepers are written to. A row no keeper's
// address took is saved all the same and shows in My region, so the visitor
// is told it was sent whatever came of the emails. The answer is the same
// for every reader and every place: the sign-in is never read, so a
// signed-in sender's row holds no more than anyone's. It never says which
// region was found or who it went to.
//
// These counts are their own, apart from Suggest an update's and the contact
// form's, so a visitor who has suggested an update is not refused for it.
import type { Env } from '../../types'
import { errorResponse, handleOptions, jsonResponse, parseBody } from '../../utils/response'
import { CLUB_PAGES_ON } from '../../utils/clubs/pages'
import { CLUB_REQUEST_ADMINS_KEY, clubRequestGoesTo, saveClubRequest } from '../../utils/clubs/clubRequests'
import { regionOfPlace } from '../../utils/clubs/places'
import { limit } from '../../utils/rateLimit'
import { checkSpam } from '../../utils/spamCheck'
import { clubRequestSchema, type ClubRequestResponse } from '../../../domain/contracts/clubRequests'

/** The 403 everyone gets while CLUB_PAGES_ON is unset. */
export const CLUB_REQUESTS_CLOSED = 'Clubs cannot be suggested from the site yet.'
/** The 429 once the keepers' hour is used up: the limiter's own words say "from here", which is not so for this count. */
export const CLUB_REQUESTS_BUSY = 'Too many clubs have been suggested this hour. Try again in an hour.'
/** How many requests one place may send in an hour. */
export const CLUB_REQUESTS_AN_HOUR_FROM_ONE_PLACE = 5
/** How many requests one set of keepers may be sent in an hour, from every place together. */
export const CLUB_REQUESTS_AN_HOUR_TO_ONE_KEEPER = 10
/** The route's names in the limiter's count: one for each place, one for each set of keepers. */
export const CLUB_REQUEST_PLACE_ROUTE = 'clubs/new'
export const CLUB_REQUEST_KEEPER_ROUTE = 'clubs/new:keepers'

/** What every answer carries: kept by no cache. */
const HEADERS = { 'Cache-Control': 'no-store' } as const

function refuse(words: string, status: number): Response {
  return jsonResponse({ error: words }, status, HEADERS)
}

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestPost: PagesFunction<Env> = async (context) => {
  if (!CLUB_PAGES_ON) return errorResponse(CLUB_REQUESTS_CLOSED, 403)
  const { env, request } = context

  const body = await parseBody(request, clubRequestSchema)
  if (body instanceof Response) {
    body.headers.set('Cache-Control', 'no-store')
    return body
  }

  const fromPlace = await limit(env, request, CLUB_REQUEST_PLACE_ROUTE, { perHour: CLUB_REQUESTS_AN_HOUR_FROM_ONE_PLACE })
  if (!fromPlace.ok) return refuse(fromPlace.error, fromPlace.status)

  const spam = await checkSpam(env, body.token, request)
  if (!spam.ok) return refuse(spam.error, spam.status)

  const place = body.place.trim()
  const region = regionOfPlace(place)

  // The keepers' own count, from every place together: where the emails go first stands in for the place.
  const goesTo = await clubRequestGoesTo(env.DB, region)
  const toKeepers = await limit(env, request, CLUB_REQUEST_KEEPER_ROUTE, { perHour: CLUB_REQUESTS_AN_HOUR_TO_ONE_KEEPER, key: goesTo })
  if (!toKeepers.ok) return refuse(toKeepers.status === 429 ? CLUB_REQUESTS_BUSY : toKeepers.error, toKeepers.status)

  // When no representative of the region is reached, the admins' own hour is counted before the row falls to them.
  const adminsMayBeWritten = async () =>
    (await limit(env, request, CLUB_REQUEST_KEEPER_ROUTE, { perHour: CLUB_REQUESTS_AN_HOUR_TO_ONE_KEEPER, key: CLUB_REQUEST_ADMINS_KEY })).ok

  await saveClubRequest(env, request, {
    kind: body.kind,
    clubName: body.clubName.trim(),
    place,
    message: body.message.trim(),
    name: body.name.trim(),
    email: body.email.trim(),
    region,
  }, adminsMayBeWritten)
  const answer: ClubRequestResponse = { sent: true }
  return jsonResponse(answer, 200, HEADERS)
}
