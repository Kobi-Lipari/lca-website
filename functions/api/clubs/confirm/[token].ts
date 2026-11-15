// functions/api/clubs/confirm/[token].ts
//
// GET and POST /api/clubs/confirm/:token: the Still accurate link of the
// monthly check's email (functions/utils/clubs/monthlyCheck.ts), which works
// with no sign-in for 30 days. The club and the person come from the token
// alone, signed for the purpose club_confirm with the club's id and the
// member's id and nothing else (functions/utils/tokens.ts).
//
// - GET changes nothing, so a mail scanner that opens the link stamps
//   nothing: it answers the club's name and town while the link is good.
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
//   410 LINK_EXPIRED  a good token past its 30 days; the page offers Log in
//   503 LINK_NO_KEY   no signing secret on this deployment
//   404 CLUB_GONE     the club has been deleted since the email
//   404 MEMBER_GONE   the person's account has been deleted since the email
//   403 SEAT_ENDED    the person's seat no longer covers the club
// The club is read only once the token holds, so no answer tells whether a
// club exists to someone without a good link.
//
// The token rides in the address, so nothing here logs it, puts it in an
// answer's words or writes it to a row. Every answer carries no-store, no
// referrer and noindex.
import type { Env } from '../../../types'
import { errorResponse, handleOptions, jsonResponse, parseBody } from '../../../utils/response'
import { CLUB_KEEPERS_ON } from '../../../utils/clubs/pages'
import { CONFIRM_PURPOSE } from '../../../utils/clubs/monthlyCheck'
import { markStillAccurate } from '../../../utils/clubs/stillAccurate'
import { isRegionalRepFor } from '../../../utils/admin/permissions'
import { readToken } from '../../../utils/tokens'
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

/** The club and the person a good link names, or the answer that refuses it. */
async function opened(context: Parameters<PagesFunction<Env>>[0]): Promise<{ club: { id: string; name: string; city: string }; memberId: string } | Response> {
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

  const db = context.env.DB
  const club = await db.prepare('SELECT id, name, city FROM clubs WHERE id = ?').bind(clubId).first<{ id: string; name: string; city: string }>()
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
  const body: ClubLinkResponse = { name: link.club.name, city: link.club.city }
  return answer(body)
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  if (!CLUB_KEEPERS_ON) return withLinkHeaders(errorResponse(LINK_CLOSED, 403))
  const link = await opened(context)
  if (link instanceof Response) return link
  const parsed = await parseBody(context.request, clubLinkConfirmRequestSchema)
  if (parsed instanceof Response) return withLinkHeaders(parsed)
  const row = await markStillAccurate(context.env.DB, link.club.id, link.memberId)
  // Deleted between the read above and this write.
  if (!row) return refuse(CLUB_GONE, 404)
  const body: ClubLinkConfirmResponse = { name: link.club.name, city: link.club.city, month: monthInWords(row.last_confirmed_at) }
  return answer(body)
}
