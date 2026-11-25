// functions/utils/clubs/nameRep.ts
//
// A keeper's decision on one request of Ask to be its named rep (WS09 step
// 31): naming the member the club's rep, or declining.
//
// Naming makes the two writes no one path makes together today (the role,
// which only PATCH /api/admin/members/[id]/role writes, and the club, which
// only PATCH /api/admin/members/[id]/club writes, both LCA admins' alone) in
// one db.batch whose statements guard one another, with the request's
// outcome:
//   1. the member's role becomes club_rep and their club this club, only
//      while their role is still the one the keeper's question named and the
//      request is still open;
//   2. the request is marked approved with who decided and when, only while
//      it is open and the member now reads club_rep of this club.
// Each guard reads the rows themselves, never the connection's count of the
// statement before. A batch is one transaction, so the member is never
// changed with the request left open; of two presses at once one changes
// both and the other changes neither. The one case where the second writes
// alone: the member was made this club's rep by other hands since the keeper
// read the row, so the request, moot by then, is marked approved, and the
// press is told it was decided, with no member changed, no audit entry and no
// email. The other open requests for the club stay open for the keeper to
// decide.
//
// Then, as updateMemberRole and updateMemberClub in
// functions/utils/admin/members.ts do, the member's row is read again and
// its role and club are copied to the sign-in service by
// syncSupabaseUserMetadata, which never throws and never fails the request:
// a copy that fails leaves its one warning line, and the copy is made again
// at the member's next sign-in (upsertMemberFromAuth). The site reads the
// role from the database on every request, never from the copy, so the
// member is the club's rep at once. One audit entry (club_rep_named) names
// the member as the role change names them, with the club's id, the
// request's id and the role and club before; and the member is emailed.
//
// Declining marks the request declined with who and when in one guarded
// statement, changes nothing of the member, writes one audit entry
// (club_rep_request_declined, naming the club and the request and never the
// member, so a declined member can still be deleted) and emails the member one
// short sentence. The member may ask again afterwards.
//
// Neither email names who decided, a region or a seat. An email that did not
// go leaves one line of fixed words.
import type { Env, MemberRow } from '../../types'
import { recordAdminAction } from '../admin/audit'
import { getMemberById } from '../admin/members'
import { sendEmail } from '../email'
import { resolveSiteUrl } from '../site'
import { syncSupabaseUserMetadata } from '../supabase'
import { repDeclinedEmail, repNamedEmail } from './emails'

/** The one line a member's email that did not go leaves in the log: fixed words, with no address. */
export const REP_DECISION_NOT_SENT_LOG = 'Ask to be its named rep: the email to the member was not sent.'

/** The club a decision is for. */
export interface DecisionClub {
  id: string
  name: string
}

/** Emails the member, logging fixed words alone when it does not go. */
async function tell(env: Env, member: MemberRow, mail: { subject: string; html: string; text?: string }): Promise<void> {
  try {
    // The reply-to is left to sendEmail, LCA's own.
    await sendEmail(env, { ...mail, to: member.email })
  } catch {
    console.warn(REP_DECISION_NOT_SENT_LOG)
  }
}

/**
 * Names the member the club's rep, as above. Answers false when the batch changed nothing: the request was decided
 * meanwhile, or the member's role is no longer `roleBefore`. Nothing after the batch runs then.
 */
export async function nameRep(
  env: Env,
  request: Request,
  decider: MemberRow,
  requestId: number,
  club: DecisionClub,
  member: MemberRow,
): Promise<boolean> {
  const db = env.DB
  const roleBefore = member.role
  const [changedMember, changedRequest] = await db.batch([
    db.prepare(
      `UPDATE members SET role = 'club_rep', club_id = ?1
        WHERE id = ?2 AND role = ?3 AND role NOT IN ('lca_admin', 'guest')
          AND EXISTS (SELECT 1 FROM club_rep_requests WHERE id = ?4 AND club_id = ?1 AND member_id = ?2 AND status = 'open')`,
    ).bind(club.id, member.id, roleBefore, requestId),
    db.prepare(
      `UPDATE club_rep_requests SET status = 'approved', decided_by = ?1, decided_at = datetime('now')
        WHERE id = ?2 AND club_id = ?3 AND member_id = ?4 AND status = 'open'
          AND EXISTS (SELECT 1 FROM members WHERE id = ?4 AND role = 'club_rep' AND club_id = ?3)`,
    ).bind(decider.id, requestId, club.id, member.id),
  ])
  if ((changedMember.meta?.changes ?? 0) !== 1 || (changedRequest.meta?.changes ?? 0) !== 1) return false

  // The copy to the sign-in service, as updateMemberRole and updateMemberClub make it.
  const updated = await getMemberById(db, member.id)
  if (updated) await syncSupabaseUserMetadata(env, member.id, { role: updated.role, club_id: updated.club_id })

  await recordAdminAction(db, decider, {
    action: 'club_rep_named',
    targetMemberId: member.id,
    targetLabel: `${member.full_name} <${member.email}>`,
    detail: { requestId, clubId: club.id, from: roleBefore, to: 'club_rep', clubFrom: member.club_id ?? null },
  })
  await tell(env, member, repNamedEmail({ siteUrl: resolveSiteUrl(env, request), clubName: club.name }))
  return true
}

/** Declines the request, as above. Answers false when it was decided meanwhile, with nothing changed. */
export async function declineRep(
  env: Env,
  request: Request,
  decider: MemberRow,
  requestId: number,
  club: DecisionClub,
  member: MemberRow,
): Promise<boolean> {
  const db = env.DB
  const claimed = await db.prepare(
    `UPDATE club_rep_requests SET status = 'declined', decided_by = ?, decided_at = datetime('now')
      WHERE id = ? AND club_id = ? AND status = 'open'`,
  ).bind(decider.id, requestId, club.id).run()
  if ((claimed.meta?.changes ?? 0) !== 1) return false
  // The entry names the club and the request alone, never the member: a member
  // named by target_member_id cannot be deleted while main's audit table refers
  // to them, and a decline gives the member nothing to keep them by. The
  // request row still names the member until the member delete clears it.
  await recordAdminAction(db, decider, {
    action: 'club_rep_request_declined',
    targetLabel: club.name,
    detail: { requestId, clubId: club.id },
  })
  await tell(env, member, repDeclinedEmail({ siteUrl: resolveSiteUrl(env, request), clubName: club.name }))
  return true
}
