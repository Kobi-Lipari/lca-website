// functions/api/clubs/reply/[token].ts
//
// GET and POST /api/clubs/reply/:token: Reply through LCA (WS09 step 27). A
// representative's or an LCA admin's copy of a message a visitor sent from a
// club's page carries no address of the visitor, only a link to
// /clubs/reply/{token}, whose token functions/utils/clubs/reply.ts sealed with
// the visitor's name and address, the club's id and the first lines of the
// message. Here the person answering reads the least of it and sends one
// answer, and neither side ever sees the other's address.
//
// - GET answers the visitor's first name, the club's name and the first
//   lines of the message, and nothing more: never the address, never the
//   whole name. It changes nothing and counts nothing.
// - POST takes the answer's words alone (domain/contracts/clubReply.ts) and
//   sends one email to the address the sealed token holds, and to no other:
//   no recipient, copy, subject or reply-to is ever read from the request.
//   It goes through sendEmail, from LCA's own address with LCA's own
//   reply-to, signed by the role alone ("LCA {region} representative", or
//   "Louisiana Chess Association" for an LCA admin, by K's decision 12), with
//   no name and no address of the person answering anywhere in it.
//
// The guards, the same for both methods and in this order, each refusing in
// words:
//   403 REPLY_CLOSED      while CLUB_PAGES_ON is unset, before anything is
//                         read: no sign-in, no token, no query
//   401 Unauthorized      signed out (the tree's own answer); the page offers
//                         Log in and comes back to the same address
//   403 REPLY_NOT_YOURS   a guest, an account with no member row, and anyone
//                         who neither holds a current regional seat over the
//                         club's region nor is an LCA admin; the words say
//                         nothing of the message
//   400 REPLY_LINK_REFUSED a token that is not ours, was changed, was made
//                         for another purpose, or is past its 30 days: the
//                         same words and status for each, so nothing tells a
//                         forger which
//   503 REPLY_NO_KEY      no signing secret on this deployment
//   403 REPLY_SECOND_FACTOR an LCA admin who holds no seat over the club's
//                         region and whose session carries no second factor
//   404 REPLY_CLUB_GONE   the club has been deleted since the message
// and for POST then:
//   400                   an answer empty or over 5,000 characters, in the
//                         field's words
//   429 REPLY_BUSY        more than REPLIES_AN_HOUR answers from one person in
//                         an hour (the shared limiter, counted by the member)
//   503 REPLY_NOT_SENT    the mail did not go
// The rule is asked of the club the token names, so a token for one club
// never lets anyone answer as another's representative. A holder of the
// region's seat answers with no second factor, as the club writes that admit
// a club's keepers ask none (the club's save, Still accurate). An LCA admin
// with no such seat answers as LCA only with a second factor, since this is
// mail from LCA's own address to an outside person, and every guard that
// lets an admin send mail asks one (requireAdmin, requireMailer and
// requireListMailer). An admin who holds the seat answers as the region's
// representative, and is asked what any holder is asked.
//
// Nothing is written but the limiter's count, and nothing here logs the
// token, the claim, a name, an address or the answer: the one log line is
// fixed words. Nothing is stored to stop a link being used again within its
// 30 days by a person let in, since a second answer may be wanted; the
// limit bounds it. Every answer carries no-store, no referrer and noindex.
import type { Env, MemberRow } from '../../../types'
import { hasSecondFactor, requireUser } from '../../../utils/auth'
import { getMemberById } from '../../../utils/admin/members'
import { isRegionalRepFor } from '../../../utils/admin/permissions'
import { errorResponse, handleOptions, jsonResponse, parseBody } from '../../../utils/response'
import { sendEmail } from '../../../utils/email'
import { resolveSiteUrl } from '../../../utils/site'
import { CLUB_PAGES_ON } from '../../../utils/clubs/pages'
import { clubReplyEmail, replySignOff } from '../../../utils/clubs/emails'
import { firstNameOf, openReplyLink, type ReplyClaim } from '../../../utils/clubs/reply'
import { limit } from '../../../utils/rateLimit'
import { clubReplyRequestSchema, type ClubReplyResponse, type ClubReplySentResponse } from '../../../../domain/contracts/clubReply'

/** The 403 everyone gets while CLUB_PAGES_ON is unset. */
export const REPLY_CLOSED = 'Reply through LCA cannot be used yet.'
/** The 403 for a signed-in person who is neither a representative of the club's region nor an LCA admin. */
export const REPLY_NOT_YOURS = 'Only the region\'s representative and the LCA admins can answer messages sent to this club.'
/** The 400 for a link that is not ours, was changed, was made for another purpose or has expired: one set of words for all. */
export const REPLY_LINK_REFUSED = 'This link can\'t be used. Links work for 30 days, and only as the email gave them. Check that the whole link was copied.'
/** The 503 while this deployment has no signing secret. */
export const REPLY_NO_KEY = 'Reply links can\'t be read on the site right now. Try again later.'
/** The 403 for an LCA admin with no seat over the club's region whose session carries no second factor. */
export const REPLY_SECOND_FACTOR = 'Two-factor sign-in is required to answer as LCA. Set it up in your account security settings.'
/** The 404 for a club deleted since the message. */
export const REPLY_CLUB_GONE = 'This club is no longer listed on the site.'
/** The 429 once a person's hour is used up: the limiter's own words say "from here", which is not so for a count by the member. */
export const REPLY_BUSY = 'You have sent too many replies this hour. Try again in an hour.'
/** The 503 when the mail did not go. */
export const REPLY_NOT_SENT = 'We couldn\'t send this. Try again later.'
/** The one line a reply that did not go leaves in the log: fixed words, with no address and nothing the failure said. */
export const REPLY_NOT_SENT_LOG = 'Reply through LCA: a reply was not sent.'

/** How many answers one person may send in an hour, to every visitor together. */
export const REPLIES_AN_HOUR = 10
/** The route's name in the limiter's count. */
export const REPLY_LIMIT_ROUTE = 'clubs/reply'

/** What every answer carries: kept by no cache, sent on with no referrer, and indexed by no search engine. */
const REPLY_HEADERS = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex' } as const

function answer(data: unknown, status = 200): Response {
  return jsonResponse(data, status, REPLY_HEADERS)
}

function refuse(words: string, status: number): Response {
  return answer({ error: words }, status)
}

/** The headers an answer from a shared helper is given too. */
function withReplyHeaders(response: Response): Response {
  for (const [name, value] of Object.entries(REPLY_HEADERS)) response.headers.set(name, value)
  return response
}

/** The club the token names, as its row is read once the person is let in. */
type ReplyClub = { id: string; name: string; slug: string | null; region: string | null }

/** Who answers: a holder of the region's seat, by the region, or an LCA admin. */
type Answerer = { kind: 'region'; region: string } | { kind: 'lca' }

interface Opened {
  claim: ReplyClaim
  club: ReplyClub
  by: Answerer
  member: MemberRow
}

/** The person, the link and the club, or the answer that refuses them, in the order at the head of this file. */
async function opened(context: Parameters<PagesFunction<Env>>[0]): Promise<Opened | Response> {
  const { env, request } = context
  const user = await requireUser(request, env)
  if (user instanceof Response) return withReplyHeaders(user)
  // Read, never made: an account with no member row holds no seat and is no admin, so nothing is written for it.
  const member = await getMemberById(env.DB, user.id)
  if (!member || member.role === 'guest') return refuse(REPLY_NOT_YOURS, 403)

  const token = typeof context.params.token === 'string' ? context.params.token : ''
  const link = await openReplyLink(env, token, new Date())
  if (!link.ok) return link.reason === 'key_missing' ? refuse(REPLY_NO_KEY, 503) : refuse(REPLY_LINK_REFUSED, 400)

  // The club the token names is the one the rule is asked about. A holder of its region's seat answers as the
  // region's representative, an admin who holds it among them; an LCA admin with no such seat, as LCA.
  const holdsSeat = await isRegionalRepFor(env.DB, member.id, link.claim.clubId)
  if (!holdsSeat && member.role !== 'lca_admin') return refuse(REPLY_NOT_YOURS, 403)
  // Mail from LCA's own address, sent as LCA: asked of an admin as every admin mail guard asks it.
  if (!holdsSeat && !hasSecondFactor(request)) return refuse(REPLY_SECOND_FACTOR, 403)
  const club = await env.DB.prepare('SELECT id, name, slug, region FROM clubs WHERE id = ?').bind(link.claim.clubId).first<ReplyClub>()
  if (!club) return refuse(REPLY_CLUB_GONE, 404)
  const by: Answerer = holdsSeat && club.region ? { kind: 'region', region: club.region } : { kind: 'lca' }
  return { claim: link.claim, club, by, member }
}

export const onRequestOptions: PagesFunction<Env> = async () => withReplyHeaders(handleOptions())

export const onRequestGet: PagesFunction<Env> = async (context) => {
  if (!CLUB_PAGES_ON) return withReplyHeaders(errorResponse(REPLY_CLOSED, 403))
  const link = await opened(context)
  if (link instanceof Response) return link
  const body: ClubReplyResponse = { firstName: firstNameOf(link.claim.name), club: link.club.name, excerpt: link.claim.excerpt }
  return answer(body)
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  if (!CLUB_PAGES_ON) return withReplyHeaders(errorResponse(REPLY_CLOSED, 403))
  const link = await opened(context)
  if (link instanceof Response) return link
  const { env, request } = context

  const body = await parseBody(request, clubReplyRequestSchema)
  if (body instanceof Response) return withReplyHeaders(body)

  const counted = await limit(env, request, REPLY_LIMIT_ROUTE, { perHour: REPLIES_AN_HOUR, key: link.member.id })
  if (!counted.ok) return refuse(counted.status === 429 ? REPLY_BUSY : counted.error, counted.status)

  const siteUrl = resolveSiteUrl(env, request)
  const firstName = firstNameOf(link.claim.name)
  const mail = clubReplyEmail({
    siteUrl,
    clubName: link.club.name,
    clubUrl: `${siteUrl}/clubs/${encodeURIComponent(link.club.slug ?? link.club.id)}`,
    firstName,
    excerpt: link.claim.excerpt,
    answer: body.message,
    signOff: replySignOff(link.by),
  })
  try {
    // The one recipient is the address the sealed token holds; the reply-to is left to sendEmail, LCA's own.
    await sendEmail(env, { ...mail, to: link.claim.email })
  } catch {
    // The failure's own words are not logged: a service's refusal may name the address it refused.
    console.warn(REPLY_NOT_SENT_LOG)
    return refuse(REPLY_NOT_SENT, 503)
  }
  const sent: ClubReplySentResponse = { sent: true, firstName }
  return answer(sent)
}
