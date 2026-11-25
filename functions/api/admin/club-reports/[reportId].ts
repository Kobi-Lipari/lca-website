// functions/api/admin/club-reports/[reportId].ts
//
// POST: Mark as handled (WS09 step 30), for one open row of Suggest a club or
// Start a club, a row with no club. In one guarded statement it sets the
// row's status to answered, resolved_by and resolved_at, empties the
// person's address and takes their name out of proposed_json, so a handled
// row keeps the club's name, the place as typed and the words, and nothing
// of the person. Of two presses at once only one changes the row, and the
// other is told in words that it was already handled. It sends no email.
// One audit entry names the row's id and kind alone, never the person, the
// address or the words.
//
// Who may: an LCA admin, asked for no second factor, as a club's writes that
// send no mail ask none (WS09 step 28's apply and dismiss); a holder of an
// active regional seat whose regions cover the row's region; a guest never.
// A row with no region, whose place was not found, is the LCA admins' alone.
// A row that has a club, a suggestion of WS09 step 28, is not this
// endpoint's: functions/api/admin/clubs/[id]/reports/[reportId].ts serves it.
//
// The answers, each in words:
//   403 REQUESTS_CLOSED   while CLUB_KEEPERS_ON is unset, before anything is
//                         read: no sign-in is checked and no query is made
//   401                   signed out (requireAuthedMember's own answer)
//   403 REQUESTS_FOR_KEEPERS a guest, or anyone who is not an LCA admin and
//                         holds no active regional seat: a member and a
//                         club's rep with no seat among them
//   400                   a body its contract refuses, in the field's words
//   404 NOT_A_REQUEST     no row of the two kinds has the id
//   400 HAS_A_CLUB        the row is a suggestion for a club's listing
//   403 NOT_YOUR_REGION   a holder of a seat that does not cover the row's
//                         region, or a row with no region
//   409 ALREADY_HANDLED   the row was handled already, by this keeper or
//                         another
import type { Env } from '../../../types'
import { isResponse, requireAuthedMember } from '../../../utils/auth'
import { recordAdminAction } from '../../../utils/admin/audit'
import { errorResponse, handleOptions, jsonResponse, parseBody } from '../../../utils/response'
import { CLUB_KEEPERS_ON } from '../../../utils/clubs/pages'
import { seatRegionsCovered } from '../../../utils/clubs/clubRequests'
import { CLUB_REQUEST_ROW_WORDS } from '../../../../domain/clubs/newClub'
import { clubRequestHandledRequestSchema, type ClubRequestHandledResponse } from '../../../../domain/contracts/clubRequests'

/** The 403 everyone gets while CLUB_KEEPERS_ON is unset. */
export const REQUESTS_CLOSED = 'New club requests cannot be handled yet.'
/** The 403 for a signed-in person who is neither an LCA admin nor the holder of a regional seat. */
export const REQUESTS_FOR_KEEPERS = 'New club requests are for the holders of a regional representative\'s seat and the LCA admins.'
/** The 404 for an id that names no row of the two kinds. */
export const NOT_A_REQUEST = 'This is not a new club request.'
/** The 400 for a row that has a club: a suggestion for a club's listing, answered on that club's pages. */
export const HAS_A_CLUB = 'This is a suggestion for a club\'s listing. Answer it on that club\'s page.'
/** The 403 for a seat that does not cover the row's region, or a row with no region. */
export const NOT_YOUR_REGION = 'This request is not for a region your seat keeps.'
/** The 409 for a row handled already. */
export const ALREADY_HANDLED = 'This request was already handled, so nothing changed.'

/** What every answer carries: kept by no cache. */
const HEADERS = { 'Cache-Control': 'no-store' } as const

function refuse(words: string, status: number): Response {
  return jsonResponse({ error: words }, status, HEADERS)
}

interface RequestRow {
  id: number
  club_id: string | null
  kind: string
  status: string
  region: string | null
}

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestPost: PagesFunction<Env> = async (context) => {
  if (!CLUB_KEEPERS_ON) return errorResponse(REQUESTS_CLOSED, 403)
  const { env, request } = context

  const authed = await requireAuthedMember(request, env)
  if (isResponse(authed)) return authed
  const { member } = authed
  if (member.role === 'guest') return refuse(REQUESTS_FOR_KEEPERS, 403)
  const db = env.DB
  const isAdmin = member.role === 'lca_admin'
  const covered = isAdmin ? [] : await seatRegionsCovered(db, member.id)
  if (!isAdmin && covered.length === 0) return refuse(REQUESTS_FOR_KEEPERS, 403)

  const body = await parseBody(request, clubRequestHandledRequestSchema)
  if (isResponse(body)) {
    body.headers.set('Cache-Control', 'no-store')
    return body
  }

  const rawId = typeof context.params.reportId === 'string' ? context.params.reportId : ''
  const reportId = /^[1-9][0-9]{0,15}$/.test(rawId) ? Number(rawId) : null
  const row = reportId === null
    ? null
    : await db.prepare('SELECT id, club_id, kind, status, region FROM club_reports WHERE id = ?').bind(reportId).first<RequestRow>()
  if (!row || reportId === null) return refuse(NOT_A_REQUEST, 404)
  if (row.club_id !== null || row.kind === 'suggestion') return refuse(HAS_A_CLUB, 400)
  if (row.kind !== 'new_club' && row.kind !== 'start_club') return refuse(NOT_A_REQUEST, 404)
  if (!isAdmin && (!row.region || !covered.includes(row.region))) return refuse(NOT_YOUR_REGION, 403)
  if (row.status !== 'open') return refuse(ALREADY_HANDLED, 409)

  // One statement: the status, who and when, the address emptied and the name taken out. Of two presses at once only
  // one changes the row.
  const claimed = await db.prepare(
    `UPDATE club_reports
        SET status = 'answered', resolved_by = ?, resolved_at = datetime('now'), reporter_email = NULL,
            proposed_json = CASE WHEN json_valid(proposed_json) THEN json_remove(proposed_json, '$.name') ELSE NULL END
      WHERE id = ? AND club_id IS NULL AND kind IN ('new_club', 'start_club') AND status = 'open'`,
  ).bind(member.id, reportId).run()
  if ((claimed.meta?.changes ?? 0) !== 1) return refuse(ALREADY_HANDLED, 409)

  await recordAdminAction(db, member, {
    action: 'club_request_handled',
    targetLabel: CLUB_REQUEST_ROW_WORDS[row.kind],
    detail: { reportId, kind: row.kind },
  })
  const answer: ClubRequestHandledResponse = { id: reportId, status: 'answered' }
  return jsonResponse(answer, 200, HEADERS)
}
