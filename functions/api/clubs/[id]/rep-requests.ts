// functions/api/clubs/[id]/rep-requests.ts
//
// POST /api/clubs/:address/rep-requests: Ask to be its named rep (WS09 step
// 31), what a signed-in member sends from a club's page with no named rep.
// The address part is read as the club's page reads it (clubNamedBy: a
// current slug, an old slug, then an id). The row is saved in
// club_rep_requests and emailed to the club's region's representatives and
// the LCA admins (functions/utils/clubs/repRequests.ts). There is no
// self-serve claim: the request changes nothing until a keeper decides it.
//
// The guards, in this order, each refusing in words with nothing saved and
// nothing sent:
//   1. CLUB_PAGES_ON unset: 403, before the sign-in or anything else is read;
//   2. the session: signed out, the site's own 401; a guest account, 403;
//   3. the body, through parseBody and its contract (the connection, one of
//      four, and a note that may be empty, held to
//      domain/clubs/repRequest.ts): 400 with the field's words;
//   4. three requests an hour from one member, counted by the member's id:
//      429, or 503 with no signing secret;
//   5. the club: 404 when the address names none, 409 when it already has a
//      named rep (clubHasRep, by the routing's own rule);
//   6. an open request of this member for this club: 409;
//   7. ten requests an hour to each set of keepers a request writes to, from
//      everyone together: every request writes to the LCA admins, and also to
//      the club's region while someone holds its seat, so the region's count
//      is taken first and then the admins' own (key 'lca', the name step 30
//      gives the admins' set), each at ten, and either used up is the 429 in
//      words of its own; while the region's seat is open the one count is
//      the admins'. A count taken at the region's key is kept when the
//      admins' then refuses.
// Then the row is written by a statement that writes only when no open
// request of the member and the club stands, so of two sends at once the
// second is told it has asked already. The member is the one the session
// names, never one the body names. No spam check: the sender is signed in.
// Nothing of the network address or the browser's name is kept.
//
// The answer names no person, region or seat: `{ sent: true }`, kept by no
// cache.
import type { Env } from '../../../types'
import { isResponse, requireAuthedMember } from '../../../utils/auth'
import { errorResponse, handleOptions, jsonResponse, parseBody } from '../../../utils/response'
import { CLUB_PAGES_ON } from '../../../utils/clubs/pages'
import { clubNamedBy } from '../../../utils/clubs/pageAnswer'
import { REP_REQUEST_ADMINS_KEY, clubHasRep, hasOpenRepRequest, repRequestGoesTo, saveRepRequest } from '../../../utils/clubs/repRequests'
import { limit } from '../../../utils/rateLimit'
import {
  REP_REQUESTS_CLOSED, REP_REQUEST_ALREADY, REP_REQUEST_GUEST, REP_REQUEST_HAS_REP, REP_REQUEST_KEEPERS_BUSY, REP_REQUEST_MEMBER_BUSY, REP_REQUEST_NO_CLUB,
} from '../../../../domain/clubs/repRequest'
import { repRequestSchema, type RepRequestResponse } from '../../../../domain/contracts/clubRepRequests'

/** How many requests one member may send in an hour, to every club together. */
export const REP_REQUESTS_AN_HOUR_FROM_ONE_MEMBER = 3
/** How many requests one set of keepers may be sent in an hour, from everyone together. */
export const REP_REQUESTS_AN_HOUR_TO_ONE_KEEPER = 10
/** The route's names in the limiter's count: one for each member, one for each set of keepers. */
export const REP_REQUEST_MEMBER_ROUTE = 'clubs/rep-requests'
export const REP_REQUEST_KEEPER_ROUTE = 'clubs/rep-requests:keepers'

/** What every answer carries: kept by no cache. */
const HEADERS = { 'Cache-Control': 'no-store' } as const

function refuse(words: string, status: number): Response {
  return jsonResponse({ error: words }, status, HEADERS)
}

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestPost: PagesFunction<Env> = async (context) => {
  if (!CLUB_PAGES_ON) return errorResponse(REP_REQUESTS_CLOSED, 403)
  const { env, request } = context

  const authed = await requireAuthedMember(request, env)
  if (isResponse(authed)) return authed
  const { member } = authed
  if (member.role === 'guest') return refuse(REP_REQUEST_GUEST, 403)

  const body = await parseBody(request, repRequestSchema)
  if (isResponse(body)) {
    body.headers.set('Cache-Control', 'no-store')
    return body
  }

  // The member's own count, by their id and not by the place.
  const fromMember = await limit(env, request, REP_REQUEST_MEMBER_ROUTE, { perHour: REP_REQUESTS_AN_HOUR_FROM_ONE_MEMBER, key: member.id })
  if (!fromMember.ok) return refuse(fromMember.status === 429 ? REP_REQUEST_MEMBER_BUSY : fromMember.error, fromMember.status)

  const raw = typeof context.params.id === 'string' ? context.params.id : ''
  const club = await clubNamedBy(env.DB, raw)
  if (!club) return refuse(REP_REQUEST_NO_CLUB, 404)
  if (await clubHasRep(env.DB, club.id)) return refuse(REP_REQUEST_HAS_REP, 409)
  if (await hasOpenRepRequest(env.DB, club.id, member.id)) return refuse(REP_REQUEST_ALREADY, 409)

  // The keepers' own counts, from everyone together: each set the emails go to stands in for the place, the region's
  // first while someone holds its seat, then the admins', who are written to for every request.
  const target = { id: club.id, name: club.name, region: club.region || null }
  const goesTo = await repRequestGoesTo(env.DB, target)
  const sets = goesTo === REP_REQUEST_ADMINS_KEY ? [REP_REQUEST_ADMINS_KEY] : [goesTo, REP_REQUEST_ADMINS_KEY]
  for (const key of sets) {
    const toKeepers = await limit(env, request, REP_REQUEST_KEEPER_ROUTE, { perHour: REP_REQUESTS_AN_HOUR_TO_ONE_KEEPER, key })
    if (!toKeepers.ok) return refuse(toKeepers.status === 429 ? REP_REQUEST_KEEPERS_BUSY : toKeepers.error, toKeepers.status)
  }

  const saved = await saveRepRequest(env, request, target, member, { connection: body.connection, note: body.note ?? '' })
  if (saved === null) return refuse(REP_REQUEST_ALREADY, 409)
  const answer: RepRequestResponse = { sent: true }
  return jsonResponse(answer, 200, HEADERS)
}
