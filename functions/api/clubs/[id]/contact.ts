// functions/api/clubs/[id]/contact.ts
//
// POST /api/clubs/:id/contact: a message a visitor sends a club from its page
// (WS09 step 26). The address part is the club's slug, an old slug or its id,
// found as the page finds it. The message is relayed by email and never shown
// and never stored (D29): functions/utils/clubs/relay.ts sends it to the
// club's own address, else to its region's representatives, else to the LCA
// admins, and nothing is written but the limiter's count.
//
// The guards, in this order, each refusing in words with nothing sent:
//   1. CLUB_PAGES_ON unset: 403, before the body or anything else is read;
//   2. the body, through parseBody and its contract (three fields of capped
//      length, one plain address, no line break in the name or the address):
//      400 with the field's words;
//   3. five messages an hour from one place: 429, or 503 with no signing
//      secret;
//   4. the spam check: 403 when the provider says no or there is no token,
//      503 with no secret or no answer;
//   5. the club the address part names: 404 for none;
//   6. twenty messages an hour to one club, from every place together,
//      counted only for a message that has passed the spam check, so nobody
//      can use up a club's hour with messages that would never be sent: 429
//      in words of its own;
//   7. the relay: 503 "We couldn't send this. Try again later." only when no
//      keeper's address took the message.
// The answer is the same for every reader: the sign-in is never read, and no
// role opens another path. It never says which keeper took the message and
// never carries an address.
import type { Env } from '../../../types'
import { errorResponse, handleOptions, jsonResponse, parseBody } from '../../../utils/response'
import { CLUB_PAGES_ON } from '../../../utils/clubs/pages'
import { clubNamedBy } from '../../../utils/clubs/pageAnswer'
import { relayMessage } from '../../../utils/clubs/relay'
import { limit } from '../../../utils/rateLimit'
import { checkSpam } from '../../../utils/spamCheck'
import { CONTACT_NOT_SENT } from '../../../../domain/clubs/contactMessage'
import { clubContactRequestSchema, type ClubContactResponse } from '../../../../domain/contracts/clubContact'

/** The 403 everyone gets while CLUB_PAGES_ON is unset. */
export const CONTACT_CLOSED = 'Messages to clubs cannot be sent from the site yet.'
/** The 404 for an address part that names no club: the words the club's page gives. */
export const CONTACT_NO_CLUB = 'Club not found'
/** The 429 once a club's hour is used up: the limiter's own words say "from here", which is not so for this count. */
export const CONTACT_CLUB_BUSY = 'This club has had too many messages this hour. Try again in an hour.'
/** How many messages one place may send in an hour, to every club together. */
export const MESSAGES_AN_HOUR_FROM_ONE_PLACE = 5
/** How many messages one club may be sent in an hour, from every place together. */
export const MESSAGES_AN_HOUR_TO_ONE_CLUB = 20
/** The route's names in the limiter's count: one for each place, one for each club. */
export const CONTACT_PLACE_ROUTE = 'clubs/contact'
export const CONTACT_CLUB_ROUTE = 'clubs/contact:club'

/** What every answer carries: kept by no cache. */
const HEADERS = { 'Cache-Control': 'no-store' } as const

function refuse(words: string, status: number): Response {
  return jsonResponse({ error: words }, status, HEADERS)
}

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestPost: PagesFunction<Env> = async (context) => {
  if (!CLUB_PAGES_ON) return errorResponse(CONTACT_CLOSED, 403)
  const { env, request } = context

  const body = await parseBody(request, clubContactRequestSchema)
  if (body instanceof Response) {
    body.headers.set('Cache-Control', 'no-store')
    return body
  }

  const fromPlace = await limit(env, request, CONTACT_PLACE_ROUTE, { perHour: MESSAGES_AN_HOUR_FROM_ONE_PLACE })
  if (!fromPlace.ok) return refuse(fromPlace.error, fromPlace.status)

  const spam = await checkSpam(env, body.token, request)
  if (!spam.ok) return refuse(spam.error, spam.status)

  const raw = typeof context.params.id === 'string' ? context.params.id : ''
  const club = await clubNamedBy(env.DB, raw)
  if (!club) return refuse(CONTACT_NO_CLUB, 404)

  // The club's own count, from every place together: its id stands in for the place.
  const toClub = await limit(env, request, CONTACT_CLUB_ROUTE, { perHour: MESSAGES_AN_HOUR_TO_ONE_CLUB, key: club.id })
  if (!toClub.ok) return refuse(toClub.status === 429 ? CONTACT_CLUB_BUSY : toClub.error, toClub.status)

  const outcome = await relayMessage(env, request, { id: club.id, name: club.name, region: club.region }, {
    name: body.name.trim(),
    email: body.email.trim(),
    message: body.message.trim(),
  })
  if (outcome !== 'sent') return refuse(CONTACT_NOT_SENT, 503)
  const answer: ClubContactResponse = { sent: true }
  return jsonResponse(answer, 200, HEADERS)
}
