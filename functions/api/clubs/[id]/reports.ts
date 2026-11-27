// functions/api/clubs/[id]/reports.ts
//
// POST /api/clubs/:id/reports: Suggest an update (WS09 step 28), what a
// visitor sends from a club's page to say its listing is out of date. The
// address part is the club's slug, an old slug or its id, found as the page
// finds it. The suggestion is saved as a row of club_reports of the kind
// 'suggestion' and emailed to whoever keeps the listing
// (functions/utils/clubs/suggestions.ts): the club's rep, else the region's
// representatives, else the LCA admins.
//
// The guards, in the contact relay's order (functions/api/clubs/[id]/contact.ts),
// each refusing in words with nothing saved and nothing sent:
//   1. CLUB_PAGES_ON unset: 403, before the body or anything else is read;
//   2. the body, through parseBody and its contract (which of the six parts,
//      the words capped at 2,000 characters, an address only if given, of
//      254 at most and one plain address): 400 with the field's words;
//   3. five suggestions an hour from one place: 429, or 503 with no signing
//      secret;
//   4. the spam check: 403 when the provider says no or there is no token,
//      503 with no secret or no answer;
//   5. the club the address part names: 404 for none;
//   6. twenty suggestions an hour to one club, from every place together,
//      counted only for one that has passed the spam check: 429 in words of
//      its own.
// Then the row is saved and the keepers are written to. A suggestion no
// keeper's address took is saved all the same and shows in My region, so
// the visitor is told "Sent." whatever came of the emails. The answer is the
// same for every reader: the sign-in is never read, so a signed-in sender's
// row holds no more than anyone's, and no role opens another path. It never
// says who keeps the club and never carries an address.
//
// These counts are their own, apart from the contact form's, so a visitor
// who writes to a club and then suggests an update is not refused for it.
import type { Env } from '../../../types'
import { errorResponse, handleOptions, jsonResponse, parseBody } from '../../../utils/response'
import { CLUB_PAGES_ON } from '../../../utils/clubs/pages'
import { clubNamedBy } from '../../../utils/clubs/pageAnswer'
import { saveSuggestion } from '../../../utils/clubs/suggestions'
import { limit } from '../../../utils/rateLimit'
import { checkSpam } from '../../../utils/spamCheck'
import { clubSuggestionRequestSchema, type ClubSuggestionResponse } from '../../../../domain/contracts/clubReports'

/** The 403 everyone gets while CLUB_PAGES_ON is unset. */
export const SUGGEST_CLOSED = 'Suggestions cannot be sent from the site yet.'
/** The 404 for an address part that names no club: the words the club's page gives. */
export const SUGGEST_NO_CLUB = 'Club not found'
/** The 429 once a club's hour is used up: the limiter's own words say "from here", which is not so for this count. */
export const SUGGEST_CLUB_BUSY = 'This club has had too many suggestions this hour. Try again in an hour.'
/** How many suggestions one place may send in an hour, to every club together. */
export const SUGGESTIONS_AN_HOUR_FROM_ONE_PLACE = 5
/** How many suggestions one club may be sent in an hour, from every place together. */
export const SUGGESTIONS_AN_HOUR_TO_ONE_CLUB = 20
/** The route's names in the limiter's count: one for each place, one for each club. */
export const SUGGEST_PLACE_ROUTE = 'clubs/reports'
export const SUGGEST_CLUB_ROUTE = 'clubs/reports:club'

/** What every answer carries: kept by no cache. */
const HEADERS = { 'Cache-Control': 'no-store' } as const

function refuse(words: string, status: number): Response {
  return jsonResponse({ error: words }, status, HEADERS)
}

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestPost: PagesFunction<Env> = async (context) => {
  if (!CLUB_PAGES_ON) return errorResponse(SUGGEST_CLOSED, 403)
  const { env, request } = context

  const body = await parseBody(request, clubSuggestionRequestSchema)
  if (body instanceof Response) {
    body.headers.set('Cache-Control', 'no-store')
    return body
  }

  const fromPlace = await limit(env, request, SUGGEST_PLACE_ROUTE, { perHour: SUGGESTIONS_AN_HOUR_FROM_ONE_PLACE })
  if (!fromPlace.ok) return refuse(fromPlace.error, fromPlace.status)

  const spam = await checkSpam(env, body.token, request)
  if (!spam.ok) return refuse(spam.error, spam.status)

  const raw = typeof context.params.id === 'string' ? context.params.id : ''
  const club = await clubNamedBy(env.DB, raw)
  if (!club) return refuse(SUGGEST_NO_CLUB, 404)

  // The club's own count, from every place together: its id stands in for the place.
  const toClub = await limit(env, request, SUGGEST_CLUB_ROUTE, { perHour: SUGGESTIONS_AN_HOUR_TO_ONE_CLUB, key: club.id })
  if (!toClub.ok) return refuse(toClub.status === 429 ? SUGGEST_CLUB_BUSY : toClub.error, toClub.status)

  const email = body.email?.trim() ? body.email.trim() : null
  await saveSuggestion(env, request, { id: club.id, slug: club.slug, name: club.name, region: club.region }, {
    field: body.field,
    message: body.message.trim(),
    email,
  })
  const answer: ClubSuggestionResponse = { sent: true }
  return jsonResponse(answer, 200, HEADERS)
}
