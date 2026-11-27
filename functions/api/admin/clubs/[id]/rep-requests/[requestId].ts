// functions/api/admin/clubs/[id]/rep-requests/[requestId].ts
//
// POST: a keeper's decision on one open request of Ask to be its named rep
// (WS09 step 31): approve, which names the member the club's rep, or
// decline. The writes, the copy to the sign-in service, the audit entry and
// the member's email are functions/utils/clubs/nameRep.ts's.
//
// Who may decide:
//   - an LCA admin, asked what today's role endpoint asks of an admin
//     (requireAdmin, with its second factor);
//   - a holder of an active regional seat whose regions cover the club's
//     region, not a guest, asked no second factor.
// Never the club's own rep (who cannot name another), another region's
// representative, another club's rep, a director, an officer, an observer or
// a member: each is refused before anything of the request is read. Nor the
// member who asked, whoever they are.
//
// One role: members.role holds one. A representative may name only a member
// whose role is exactly member at the press; for any other role the press
// changes nothing and answers 409 with the reason in words and that an LCA
// admin decides this one, and the request stays open on the admins' rows.
// An LCA admin may also name a member who holds another role, which replaces
// that role, but only when the body names the role the question named, and
// never an admin (it would take their admin role away, and they can already
// edit every club's page) or a guest account.
//
// For a representative the reason a member of another role is the admins'
// is asked before the body's role is compared with the member's, so a
// representative is told an LCA admin decides this one, never to read the
// question again; an LCA admin's order is the comparison first, as before.
//
// The answer of a decision carries told: whether the email to the member
// went. The naming or the decline stands either way.
//
// The answers, each in words:
//   403 REP_DECIDE_CLOSED      while CLUB_KEEPERS_ON is unset, before
//                              anything is read
//   401                        signed out (requireAuthedMember's own answer)
//   403 REP_DECIDE_FOR_KEEPERS anyone the rule above does not admit
//   403 (mfaRequired)          an LCA admin with no second factor
//   400                        a body its contract refuses
//   404 REP_DECIDE_NOT_THIS_CLUBS no request of this club has the id
//   409 REP_DECIDE_ALREADY     decided already; of two presses at once, one
//                              wins and the other is told this
//   403 REP_DECIDE_OWN         the keeper's own request
//   409                        approve of a member this keeper may not name,
//                              or whose role has changed since the question
import type { Env, MemberRow } from '../../../../../types'
import { isResponse, requireAdmin, requireAuthedMember } from '../../../../../utils/auth'
import { getMemberById } from '../../../../../utils/admin/members'
import { isRegionalRepFor } from '../../../../../utils/admin/permissions'
import { errorResponse, handleOptions, jsonResponse, parseBody } from '../../../../../utils/response'
import { CLUB_KEEPERS_ON } from '../../../../../utils/clubs/pages'
import { declineRep, nameRep } from '../../../../../utils/clubs/nameRep'
import {
  REP_DECIDE_ALREADY, REP_DECIDE_CLOSED, REP_DECIDE_FOR_KEEPERS, REP_DECIDE_NOT_THIS_CLUBS, REP_DECIDE_OWN, REP_ROLE_CHANGED, adminsDecideWords, neverNamed,
} from '../../../../../../domain/clubs/repRequest'
import { repDecisionRequestSchema, type RepDecisionResponse } from '../../../../../../domain/contracts/clubRepRequests'

/** What every answer carries: kept by no cache. */
const HEADERS = { 'Cache-Control': 'no-store' } as const

function refuse(words: string, status: number): Response {
  return jsonResponse({ error: words }, status, HEADERS)
}

interface RequestRow {
  id: number
  club_id: string
  member_id: string
  status: string
}

/** Whether this signed-in person may decide the club's requests, and as which. */
async function deciderOf(request: Request, env: Env, member: MemberRow, clubId: string): Promise<'admin' | 'region' | Response> {
  if (member.role === 'guest') return refuse(REP_DECIDE_FOR_KEEPERS, 403)
  if (member.role === 'lca_admin') {
    const admin = await requireAdmin(request, env)
    return isResponse(admin) ? admin : 'admin'
  }
  // The club's own rep cannot name another, whatever seat they hold.
  if (member.role === 'club_rep' && member.club_id === clubId) return refuse(REP_DECIDE_FOR_KEEPERS, 403)
  return (await isRegionalRepFor(env.DB, member.id, clubId)) ? 'region' : refuse(REP_DECIDE_FOR_KEEPERS, 403)
}

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestPost: PagesFunction<Env> = async (context) => {
  if (!CLUB_KEEPERS_ON) return errorResponse(REP_DECIDE_CLOSED, 403)
  const { env, request } = context

  const authed = await requireAuthedMember(request, env)
  if (isResponse(authed)) return authed
  const decider = authed.member
  const clubId = typeof context.params.id === 'string' ? context.params.id : ''
  const as = await deciderOf(request, env, decider, clubId)
  if (isResponse(as)) {
    as.headers.set('Cache-Control', 'no-store')
    return as
  }

  const body = await parseBody(request, repDecisionRequestSchema)
  if (isResponse(body)) {
    body.headers.set('Cache-Control', 'no-store')
    return body
  }

  const db = env.DB
  const rawId = typeof context.params.requestId === 'string' ? context.params.requestId : ''
  const requestId = /^[1-9][0-9]{0,15}$/.test(rawId) ? Number(rawId) : null
  const row = requestId === null
    ? null
    : await db.prepare('SELECT id, club_id, member_id, status FROM club_rep_requests WHERE id = ?').bind(requestId).first<RequestRow>()
  if (!row || requestId === null || row.club_id !== clubId) return refuse(REP_DECIDE_NOT_THIS_CLUBS, 404)
  if (row.status !== 'open') return refuse(REP_DECIDE_ALREADY, 409)
  if (row.member_id === decider.id) return refuse(REP_DECIDE_OWN, 403)

  const club = await db.prepare('SELECT id, name FROM clubs WHERE id = ?').bind(clubId).first<{ id: string; name: string }>()
  const member = await getMemberById(db, row.member_id)
  if (!club || !member) return refuse(REP_DECIDE_NOT_THIS_CLUBS, 404)

  if (body.decision === 'decline') {
    const declined = await declineRep(env, request, decider, requestId, club, member)
    if (!declined) return refuse(REP_DECIDE_ALREADY, 409)
    const answer: RepDecisionResponse = { id: requestId, status: 'declined', told: declined.told }
    return jsonResponse(answer, 200, HEADERS)
  }

  // One role: who may be named through this door, by whom.
  const never = neverNamed(member.full_name, member.role)
  if (never) return refuse(never, 409)
  // A representative names only a plain member: any other role is the admins' to decide, asked before the body's
  // role is compared, so the representative reads why and not that the question changed.
  if (member.role !== 'member' && as === 'region') {
    const other = member.role === 'club_rep' && member.club_id
      ? (await db.prepare('SELECT name FROM clubs WHERE id = ?').bind(member.club_id).first<{ name: string }>())?.name ?? null
      : null
    return refuse(adminsDecideWords(member.full_name, member.role, other), 409)
  }
  if (body.role !== undefined && body.role !== member.role) return refuse(REP_ROLE_CHANGED, 409)
  // An admin replaces another role only when the body names the one the question named.
  if (member.role !== 'member' && body.role !== member.role) return refuse(REP_ROLE_CHANGED, 409)

  const named = await nameRep(env, request, decider, requestId, club, member)
  if (!named) {
    const now = await db.prepare('SELECT status FROM club_rep_requests WHERE id = ?').bind(requestId).first<{ status: string }>()
    return refuse(now?.status === 'open' ? REP_ROLE_CHANGED : REP_DECIDE_ALREADY, 409)
  }
  const answer: RepDecisionResponse = { id: requestId, status: 'approved', told: named.told }
  return jsonResponse(answer, 200, HEADERS)
}
