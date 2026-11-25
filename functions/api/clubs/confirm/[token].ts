// functions/api/clubs/confirm/[token].ts
//
// GET and POST /api/clubs/confirm/:token: the Still accurate link of the
// monthly check's email (functions/utils/clubs/monthlyCheck.ts), which works
// with no sign-in for 30 days. The club and the person come from the token
// alone, signed for the purpose club_confirm with the club's id and the
// member's id and nothing else (functions/utils/tokens.ts).
//
// - GET stamps nothing (a call with a good link is only counted, as the
//   paragraph on the limit below says), so a mail scanner that opens the
//   link changes no club: it answers the club's name and town while the
//   link is good,
//   with how the club meets in the listing's own public words (statement,
//   null when there are none), which the email itself shows, so a holder of
//   a good link learns nothing new from it.
// - POST checks, at that moment, that the person is an LCA admin or still
//   holds an active regional seat whose regions cover the club, and then
//   makes the one write Still accurate makes everywhere
//   (functions/utils/clubs/stillAccurate.ts): last_confirmed_at and
//   confirmed_by for that club alone, told_updated_at and told_by left as
//   they are. It writes no activity row and sends no email, and a second
//   POST only stamps the club again.
//
// The answers, the same for both methods:
//   403 LINK_CLOSED   while CLUB_KEEPERS_ON is unset, before anything is read:
//                     no token is read and no query is made
//   400 LINK_FORGED   a token that is not ours, cut short, changed, or made
//                     for another purpose: the same words for each, so
//                     nothing is learned from them
//   410 LINK_EXPIRED  a good token past its 30 days; the page offers a way
//                     to log in to My region
//   503 LINK_NO_KEY   no signing secret on this deployment
//   404 CLUB_GONE     the club has been deleted since the email
//   404 MEMBER_GONE   the person's account has been deleted since the email
//   403 SEAT_ENDED    the person's seat no longer covers the club
//   429 LINK_TOO_OFTEN a good link opened more than LINK_CALLS_AN_HOUR
//                     times in an hour from one place (WS09 step 25), in
//                     the link's own words, since the person sent nothing
// and for POST then:
//   409 LINK_WAITS    a visitor's suggestion for the club is open (WS09 step
//                     28): nothing is written, and the page says in words
//                     that a suggestion waits and is answered in My region
//                     after logging in
// The club is read only once the token holds, so no answer tells whether a
// club exists to someone without a good link.
//
// The limit (functions/utils/rateLimit.ts) counts a call only once the token
// holds, so a forged link is refused as before with no statement run, and
// with no signing secret the 503 above is the answer, as before. GET and
// POST share one count. On a database before migration 0071 the limiter
// writes one log line and the call goes on as before.
//
// The token rides in the address, so nothing here logs it, puts it in an
// answer's words or writes it to a row. Every answer carries no-store, no
// referrer and noindex.
import type { Env } from '../../../types'
import { errorResponse, handleOptions, jsonResponse, parseBody } from '../../../utils/response'
import { CLUB_KEEPERS_ON } from '../../../utils/clubs/pages'
import { CONFIRM_PURPOSE } from '../../../utils/clubs/monthlyCheck'
import { markStillAccurate } from '../../../utils/clubs/stillAccurate'
import { hasOpenSuggestion } from '../../../utils/clubs/suggestions'
import { LINK_WAITS } from '../../../../domain/clubs/suggestion'
import { oneLine } from '../../../utils/clubs/emails'
import { isRegionalRepFor } from '../../../utils/admin/permissions'
import { readToken } from '../../../utils/tokens'
import { limit } from '../../../utils/rateLimit'
import { monthInWords } from '../../../../domain/clubs/monthlyCheck'
import { clubLinkConfirmRequestSchema, type ClubLinkConfirmResponse, type ClubLinkResponse } from '../../../../domain/contracts/clubs'

/** The 403 everyone gets while CLUB_KEEPERS_ON is unset. */
export const LINK_CLOSED = 'Still accurate cannot be used yet.'
/** The 400 for a token that is not ours or was made for another purpose. */
export const LINK_FORGED = 'This link can\'t be read. Check that the whole link was copied from the email.'
/** The 410 for a good token past its 30 days. */
export const LINK_EXPIRED = 'This link has expired. Log in to mark the club from My region.'
/** The 503 while this deployment has no signing secret. */
export const LINK_NO_KEY = 'Links from the monthly check can\'t be read on the site right now. Try again later.'
/** The 404 for a club deleted since the email. */
export const CLUB_GONE = 'This club is no longer listed on the site.'
/** The 404 for a person whose account was deleted since the email. */
export const MEMBER_GONE = 'The account this link was sent to is no longer on the site.'
/** The 403 for a person whose seat no longer covers the club. */
export const SEAT_ENDED = 'Your seat no longer covers this club.'
/** The 429 for a good link opened too often in an hour from one place: the link's own words, not the limiter's. */
export const LINK_TOO_OFTEN = 'This link has been opened too many times this hour. Try again in an hour.'

/** How many calls one place may make with good links in an hour, GET and POST together. */
export const LINK_CALLS_AN_HOUR = 30
/** The route's name in the limiter's count. */
export const LINK_LIMIT_ROUTE = 'clubs/confirm'

/** What every answer carries: kept by no cache, sent on with no referrer, and indexed by no search engine. */
const LINK_HEADERS = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex' } as const

function answer(data: unknown, status = 200): Response {
  return jsonResponse(data, status, LINK_HEADERS)
}

function refuse(words: string, status: number): Response {
  return answer({ error: words }, status)
}

/** The headers an answer from a shared helper is given too. */
function withLinkHeaders(response: Response): Response {
  for (const [name, value] of Object.entries(LINK_HEADERS)) response.headers.set(name, value)
  return response
}

/** The club a good link names, as its row is read once the token holds. */
type LinkClub = { id: string; name: string; city: string; how_we_meet_text: string | null }

/** The club and the person a good link names, or the answer that refuses it. */
async function opened(context: Parameters<PagesFunction<Env>>[0]): Promise<{ club: LinkClub; memberId: string } | Response> {
  const token = typeof context.params.token === 'string' ? context.params.token : ''
  const read = await readToken(
    { current: context.env.SIGNING_SECRET, previous: context.env.SIGNING_SECRET_PREVIOUS },
    CONFIRM_PURPOSE,
    token,
    new Date(),
  )
  if (!read.ok) {
    if (read.reason === 'key_missing') return refuse(LINK_NO_KEY, 503)
    if (read.reason === 'expired') return refuse(LINK_EXPIRED, 410)
    return refuse(LINK_FORGED, 400)
  }
  const { club: clubId, member: memberId } = read.claim
  if (typeof clubId !== 'string' || clubId === '' || typeof memberId !== 'string' || memberId === '') return refuse(LINK_FORGED, 400)
  const counted = await limit(context.env, context.request, LINK_LIMIT_ROUTE, { perHour: LINK_CALLS_AN_HOUR })
  if (!counted.ok) return refuse(counted.status === 429 ? LINK_TOO_OFTEN : counted.error, counted.status)

  const db = context.env.DB
  const club = await db.prepare('SELECT id, name, city, how_we_meet_text FROM clubs WHERE id = ?').bind(clubId).first<LinkClub>()
  if (!club) return refuse(CLUB_GONE, 404)
  const member = await db.prepare('SELECT id, role FROM members WHERE id = ?').bind(memberId).first<{ id: string; role: string }>()
  if (!member) return refuse(MEMBER_GONE, 404)
  // At this moment: an LCA admin, or a holder of an active regional seat whose regions cover the club. A guest, whom
  // canManageClub refuses, is refused here too.
  const covers = member.role === 'lca_admin' || (member.role !== 'guest' && await isRegionalRepFor(db, member.id, club.id))
  if (!covers) return refuse(SEAT_ENDED, 403)
  return { club, memberId: member.id }
}

export const onRequestOptions: PagesFunction<Env> = async () => withLinkHeaders(handleOptions())

export const onRequestGet: PagesFunction<Env> = async (context) => {
  if (!CLUB_KEEPERS_ON) return withLinkHeaders(errorResponse(LINK_CLOSED, 403))
  const link = await opened(context)
  if (link instanceof Response) return link
  // The listing's own public words, as one line, and null for none or only white space.
  const statement = link.club.how_we_meet_text === null ? null : oneLine(link.club.how_we_meet_text) || null
  const body: ClubLinkResponse = { name: link.club.name, city: link.club.city, statement }
  return answer(body)
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  if (!CLUB_KEEPERS_ON) return withLinkHeaders(errorResponse(LINK_CLOSED, 403))
  const link = await opened(context)
  if (link instanceof Response) return link
  const parsed = await parseBody(context.request, clubLinkConfirmRequestSchema)
  if (parsed instanceof Response) return withLinkHeaders(parsed)
  // A suggestion no keeper has answered yet: the link waits for it, as Still accurate does in My region.
  if (await hasOpenSuggestion(context.env.DB, link.club.id)) return refuse(LINK_WAITS, 409)
  const row = await markStillAccurate(context.env.DB, link.club.id, link.memberId)
  // Deleted between the read above and this write.
  if (!row) return refuse(CLUB_GONE, 404)
  const body: ClubLinkConfirmResponse = { name: link.club.name, city: link.club.city, month: monthInWords(row.last_confirmed_at) }
  return answer(body)
}
