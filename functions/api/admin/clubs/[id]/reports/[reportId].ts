// functions/api/admin/clubs/[id]/reports/[reportId].ts
//
// POST: a keeper's answer to one open suggestion of the club (WS09 step 28),
// by one of three actions:
//   - apply:   marks it applied and sends nothing; the keeper then changes
//              the listing in the club's editor;
//   - answer:  sends the keeper's words to the visitor, when the visitor left
//              an address, and marks it answered;
//   - dismiss: marks it "Not an issue".
// Each sets the row's status, resolved_by and resolved_at in one statement,
// which empties the visitor's address in the same statement, and writes one
// audit entry naming the club, the row and the action, never the visitor's
// words, an address or the keeper's reply. The row keeps the visitor's words
// until the club is deleted (WS09 step 4's club delete takes its rows).
//
// Who may: whoever requireClubRep admits, as for the club's other writes: an
// LCA admin, the club's own rep and a holder of a regional seat over the
// club's region; a guest never. For answer, which sends mail from LCA's own
// address to an outside person, the rule of Reply through LCA (WS09 step 27)
// holds: a holder of the region's seat and the club's own rep answer with no
// second factor, as the club's writes that admit them ask none, and an LCA
// admin with no such seat answers as LCA only with one. Answers share Reply
// through LCA's own count (its route and its REPLIES_AN_HOUR, by the member):
// ten replies an hour from one person through either door together, all from
// LCA's address. The count is taken only once this press holds the row, so a
// press told it was already handled uses none of it; a press over the count
// puts the row back as it was, and so does a count that fails outright,
// before its fault goes on to the caller.
//
// The answers, each in words:
//   403 SUGGESTIONS_CLOSED  while CLUB_KEEPERS_ON is unset, before anything is
//                           read: no sign-in is checked and no query is made
//   401 / 403               signed out, or not a keeper of this club
//                           (requireClubRep's own answers)
//   400                     a body its contract refuses, in the field's words
//   404 NOT_THIS_CLUBS      no open-or-closed suggestion of this club has the
//                           id: a row of another club, of another kind, or none
//   409 ALREADY_HANDLED     the suggestion was resolved already, by this
//                           keeper or another; of two presses at once, one
//                           wins and the other is told this
//   400 NO_ADDRESS          answer, for a suggestion with no address left
//   403 REPLY_SECOND_FACTOR answer, by an LCA admin with no seat over the
//                           club's region and no second factor
//   429 REPLY_BUSY          answer, over ten replies an hour from one person,
//                           counted with Reply through LCA's; the row is put
//                           back as it was
//   503 REPLY_NOT_SENT      answer, when the mail did not go; the row is put
//                           back as it was, open with its address, so it can
//                           be answered again
// The reply goes to the address the row holds and to no other: no
// recipient, copy, subject or reply-to is read from the request. It is the
// answer of Reply through LCA (clubReplyEmail), from LCA's own address with
// LCA's own reply-to, signed by the role alone, and the keeper's words are
// written nowhere. Nothing here logs an address or anyone's words: the one
// log line is fixed words.
//
// While CLUB_KEEPERS_ON is unset everyone gets 403 in words before anything
// is read.
import type { Env } from '../../../../../types'
import { hasSecondFactor, isResponse, requireClubRep } from '../../../../../utils/auth'
import { isRegionalRepFor } from '../../../../../utils/admin/permissions'
import { recordAdminAction } from '../../../../../utils/admin/audit'
import { errorResponse, handleOptions, jsonResponse, parseBody } from '../../../../../utils/response'
import { sendEmail } from '../../../../../utils/email'
import { resolveSiteUrl } from '../../../../../utils/site'
import { CLUB_KEEPERS_ON } from '../../../../../utils/clubs/pages'
import { clubRepSignOff, clubReplyEmail, replySignOff } from '../../../../../utils/clubs/emails'
import { firstLines } from '../../../../../utils/clubs/reply'
import { limit, type LimitAnswer } from '../../../../../utils/rateLimit'
import { REPLIES_AN_HOUR, REPLY_BUSY, REPLY_LIMIT_ROUTE, REPLY_NOT_SENT, REPLY_SECOND_FACTOR } from '../../../../clubs/reply/[token]'
import { clubReportActionRequestSchema, type ClubReportActionResponse } from '../../../../../../domain/contracts/clubReports'

/** The 403 everyone gets while CLUB_KEEPERS_ON is unset. */
export const SUGGESTIONS_CLOSED = 'Suggestions cannot be answered yet.'
/** The 404 for an id that names no suggestion of this club. */
export const NOT_THIS_CLUBS = 'This suggestion is not one of this club\'s.'
/** The 409 for a suggestion resolved already. */
export const ALREADY_HANDLED = 'This suggestion was already handled, so nothing changed.'
/** The 400 for an answer to a suggestion that left no address. */
export const NO_ADDRESS = 'This visitor left no email address, so there is no one to reply to.'
/** The one line a reply that did not go leaves in the log: fixed words, with no address and nothing the failure said. */
export const ANSWER_NOT_SENT_LOG = 'Suggest an update: a reply to a visitor was not sent.'

/** Each action, and the status it leaves the row in. */
const STATUS = { apply: 'applied', answer: 'answered', dismiss: 'dismissed' } as const

/** What every answer carries: kept by no cache. */
const HEADERS = { 'Cache-Control': 'no-store' } as const

function refuse(words: string, status: number): Response {
  return jsonResponse({ error: words }, status, HEADERS)
}

interface ReportRow {
  id: number
  club_id: string | null
  kind: string
  status: string
  reporter_email: string | null
  message: string
}

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestPost: PagesFunction<Env> = async (context) => {
  if (!CLUB_KEEPERS_ON) return errorResponse(SUGGESTIONS_CLOSED, 403)
  const { env, request } = context

  const clubId = typeof context.params.id === 'string' ? context.params.id : ''
  const authed = await requireClubRep(request, env, clubId)
  if (isResponse(authed)) return authed
  const { member } = authed

  const body = await parseBody(request, clubReportActionRequestSchema)
  if (isResponse(body)) {
    body.headers.set('Cache-Control', 'no-store')
    return body
  }

  const rawId = typeof context.params.reportId === 'string' ? context.params.reportId : ''
  const reportId = /^[1-9][0-9]{0,15}$/.test(rawId) ? Number(rawId) : null
  const db = env.DB
  const row = reportId === null
    ? null
    : await db.prepare('SELECT id, club_id, kind, status, reporter_email, message FROM club_reports WHERE id = ?').bind(reportId).first<ReportRow>()
  if (!row || reportId === null || row.club_id !== clubId || row.kind !== 'suggestion') return refuse(NOT_THIS_CLUBS, 404)
  if (row.status !== 'open') return refuse(ALREADY_HANDLED, 409)
  const club = await db.prepare('SELECT id, name, slug, region FROM clubs WHERE id = ?').bind(clubId)
    .first<{ id: string; name: string; slug: string | null; region: string | null }>()
  if (!club) return refuse(NOT_THIS_CLUBS, 404)

  const address = row.reporter_email?.trim() ?? ''
  // Who answers, and how it is signed: a holder of the region's seat as the region's representative, the club's own
  // rep as the club's representative, and an LCA admin with neither as LCA, only with a second factor.
  let signOff = ''
  if (body.action === 'answer') {
    if (!address) return refuse(NO_ADDRESS, 400)
    const holdsSeat = await isRegionalRepFor(db, member.id, clubId)
    const ownRep = member.role === 'club_rep' && member.club_id === clubId
    if (!holdsSeat && !ownRep && !hasSecondFactor(request)) return refuse(REPLY_SECOND_FACTOR, 403)
    signOff = holdsSeat && club.region
      ? replySignOff({ kind: 'region', region: club.region })
      : ownRep ? clubRepSignOff(club.name) : replySignOff({ kind: 'lca' })
  }

  const status = STATUS[body.action]
  // One statement: the status, who and when, and the address emptied. Of two presses at once only one changes the row.
  const claimed = await db.prepare(
    `UPDATE club_reports
        SET status = ?, resolved_by = ?, resolved_at = datetime('now'), reporter_email = NULL
      WHERE id = ? AND club_id = ? AND kind = 'suggestion' AND status = 'open'`,
  ).bind(status, member.id, reportId, clubId).run()
  if ((claimed.meta?.changes ?? 0) !== 1) return refuse(ALREADY_HANDLED, 409)

  if (body.action === 'answer') {
    // Put back as it was, open with its address, when the reply does not go, so it can be answered again.
    const reopen = () => db.prepare(
      `UPDATE club_reports SET status = 'open', resolved_by = NULL, resolved_at = NULL, reporter_email = ?
        WHERE id = ? AND status = 'answered' AND resolved_by = ?`,
    ).bind(address, reportId, member.id).run()
    // Counted with Reply through LCA's own count, and only now that this press holds the row. A count that cannot
    // be taken at all puts the row back before its fault goes on, so no suggestion is left closed and unanswered.
    let counted: LimitAnswer
    try {
      counted = await limit(env, request, REPLY_LIMIT_ROUTE, { perHour: REPLIES_AN_HOUR, key: member.id })
    } catch (fault) {
      await reopen()
      throw fault
    }
    if (!counted.ok) {
      await reopen()
      return refuse(counted.status === 429 ? REPLY_BUSY : counted.error, counted.status)
    }
    const siteUrl = resolveSiteUrl(env, request)
    const mail = clubReplyEmail({
      siteUrl,
      clubName: club.name,
      clubUrl: `${siteUrl}/clubs/${encodeURIComponent(club.slug ?? club.id)}`,
      firstName: 'there',
      excerpt: firstLines(row.message),
      answer: body.message ?? '',
      signOff,
    })
    try {
      // The one recipient is the address the row held; the reply-to is left to sendEmail, LCA's own.
      await sendEmail(env, { ...mail, to: address })
    } catch {
      // The failure's own words are not logged: a service's refusal may name the address it refused.
      console.warn(ANSWER_NOT_SENT_LOG)
      await reopen()
      return refuse(REPLY_NOT_SENT, 503)
    }
  }

  await recordAdminAction(db, member, {
    action: 'club_suggestion_resolved',
    targetLabel: club.name,
    detail: { clubId, reportId, action: status },
  })
  const answer: ClubReportActionResponse = { id: reportId, status }
  return jsonResponse(answer, 200, HEADERS)
}
