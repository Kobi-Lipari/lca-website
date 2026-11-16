// functions/api/admin/tournaments/[id]/approval.ts
//
// POST /api/admin/tournaments/[id]/approval (WS09 step 18): the three moves
// of a regional representative's club event through the LCA admins' wait,
// the brief's Submit for LCA review, Approve and publish and Ask for changes.
// An event marked needs_lca_approval 1 (the representative's create, WS09
// step 17) is a draft (nothing sent), in review (approval_requested_at set,
// approved_at empty) or approved (approved_at set), as approvalState in
// domain/events/approval.ts reads it; an event not marked refuses all three
// with 409.
//
// - submit, from a draft: sets approval_requested_at and emails each LCA
//   admin, by the one rule D22's notice writes to them by. The person who
//   drafted the event, while a seat of theirs still keeps its club
//   (draftedInRegion), or an LCA admin. In review, it changes nothing and
//   sends nothing, and its answer says so; approved, 409.
// - approve, from a draft or in review: sets approved_at, approved_by and
//   is_visible 1 in one statement, which is the event's first listing, and
//   emails the person who drafted it. An LCA admin with a second factor
//   (requireAdmin) alone.
// - ask_changes, from in review: clears approval_requested_at and emails the
//   person who drafted it the LCA admin's note, which is kept nowhere else.
//   An LCA admin with a second factor alone.
//
// Each move is one statement whose WHERE holds the state it starts from, and
// the handler reads how many rows it changed before it writes anything else
// or sends anything: of two presses at once one goes through, and the other
// is answered as the event then stands, with no second row in the activity
// log and no second email. A move that changes the event writes one row,
// with the event's id; a move that changes nothing or is refused writes
// none. A send that fails does not undo the move: the answer says in words
// that the move was made and the email was not sent.
//
// While REGION_EVENTS_ON is unset everyone gets 403 in words before anything
// is read: no sign in is checked, the body is not read and no query is made.
import type { Env, MemberRow } from '../../../../types'
import { isResponse, requireAdmin, requireAuthedMember } from '../../../../utils/auth'
import { errorResponse, handleOptions, jsonResponse, parseBody } from '../../../../utils/response'
import { REGION_EVENTS_ON } from '../../../../utils/clubs/pages'
import { draftedInRegion } from '../../../../utils/events/creation'
import { eventDays, lcaAdminAddresses, markReviewNotified } from '../../../../utils/events/publishedReview'
import { recordAdminAction, type AdminAction } from '../../../../utils/admin/audit'
import { trySendEmail } from '../../../../utils/email'
import { resolveSiteUrl } from '../../../../utils/site'
import { approvedEmail, changesAskedEmail, reviewAskedEmail, type WaitingEvent } from '../../../../utils/clubs/emails'
import { approvalState, type ApprovalState } from '../../../../../domain/events/approval'
import { tournamentApprovalRequestSchema, type TournamentApprovalRequest, type TournamentApprovalResponse } from '../../../../../domain/contracts/events'

/** The 403 everyone gets while REGION_EVENTS_ON is unset. */
export const APPROVAL_CLOSED = 'LCA review of club events is not open yet.'

/** The 409 of every move on an event that does not wait for approval. */
export const NOT_MARKED = 'This event does not wait for LCA approval.'

/** The 409 of every move on an event an LCA admin has approved. */
export const ALREADY_APPROVED = 'This event is already approved.'

/** The 409 of Ask for changes on an event nobody has sent for review. */
export const NOT_IN_REVIEW = 'This event has not been sent for LCA review.'

/** The 409 of a move whose start the event left between the read and the write, and did not come back to. */
export const CHANGED_MEANWHILE = 'This event changed a moment ago. Reload it and try again.'

/** What the answer says about the email, in words a page can show. */
export const EMAIL_WORDS = {
  alreadyInReview: 'This event is already waiting for LCA review. No second email was sent.',
  reviewSent: 'Sent for LCA review. The LCA admins were emailed.',
  reviewPartly: 'Sent for LCA review, but the email did not reach every LCA admin.',
  reviewNotSent: 'Sent for LCA review, but the email to the LCA admins was not sent.',
  reviewNoAdmin: 'Sent for LCA review. No LCA admin has an email address on file, so no email was sent.',
  approvedSent: 'Approved and listed. The person who drafted it was emailed.',
  approvedNotSent: 'Approved and listed, but the email to the person who drafted it was not sent.',
  approvedNoDrafter: 'Approved and listed. No email was sent: the person who drafted it can no longer be reached.',
  changesSent: 'Changes asked. The person who drafted it was emailed your note.',
  changesNotSent: 'Changes asked, but the email to the person who drafted it was not sent.',
  changesNoDrafter: 'Changes asked. No email was sent: the person who drafted it can no longer be reached.',
} as const

/** The pause between one LCA admin's email and the next, the pace functions/utils/events/publishedReview.ts keeps. */
const SEND_INTERVAL_MS = 400

/** An empty or blank stored time, which the wait reads as not set. */
const UNAPPROVED = "(approved_at IS NULL OR TRIM(approved_at) = '')"
const REQUESTED = "(approval_requested_at IS NOT NULL AND TRIM(approval_requested_at) <> '')"

/** Each move's one statement: the state it starts from is in its WHERE. Approve binds the approver first. */
const MOVES = {
  submit: `UPDATE tournaments SET approval_requested_at = datetime('now') WHERE id = ? AND needs_lca_approval = 1 AND ${UNAPPROVED} AND NOT ${REQUESTED}`,
  approve: `UPDATE tournaments SET approved_at = datetime('now'), approved_by = ?, is_visible = 1 WHERE id = ? AND needs_lca_approval = 1 AND ${UNAPPROVED}`,
  ask_changes: `UPDATE tournaments SET approval_requested_at = NULL WHERE id = ? AND needs_lca_approval = 1 AND ${UNAPPROVED} AND ${REQUESTED}`,
} as const

/** Each move's row in the activity log. */
const ACTIONS: Record<TournamentApprovalRequest['action'], AdminAction> = {
  submit: 'tournament_submitted',
  approve: 'tournament_approved',
  ask_changes: 'tournament_changes_asked',
}

/** The event as the moves read it, with its club's name. */
interface WaitRow {
  id: string
  name: string
  date: string
  end_date: string | null
  club_id: string | null
  created_by: string | null
  needs_lca_approval: number
  approval_requested_at: string | null
  approved_at: string | null
  approved_by: string | null
  club_name: string | null
}

function readEvent(db: D1Database, id: string): Promise<WaitRow | null> {
  return db
    .prepare(
      `SELECT t.id, t.name, t.date, t.end_date, t.club_id, t.created_by, t.needs_lca_approval,
              t.approval_requested_at, t.approved_at, t.approved_by, c.name AS club_name
         FROM tournaments t LEFT JOIN clubs c ON c.id = t.club_id
        WHERE t.id = ?`,
    )
    .bind(id)
    .first<WaitRow>()
}

/** A stored time as the answer gives it: null when empty or blank, as the wait reads it. */
const stamp = (value: string | null) => (typeof value === 'string' && value.trim() !== '' ? value : null)

/** The answer: the event's four columns as they stand, and the email's words. */
function answer(event: WaitRow, email: string): Response {
  const body: TournamentApprovalResponse = {
    needs_lca_approval: event.needs_lca_approval === 1 ? 1 : 0,
    approval_requested_at: stamp(event.approval_requested_at),
    approved_at: stamp(event.approved_at),
    approved_by: event.approved_by || null,
    email,
  }
  return jsonResponse(body)
}

/**
 * The answer a move gets from the state it finds, before it writes, or
 * null when the move may go on: the moves' table, in one place, asked
 * before the write and again, by the press that lost a race, after it.
 */
function settled(action: TournamentApprovalRequest['action'], state: ApprovalState, event: WaitRow): Response | null {
  if (state === 'not_marked') return errorResponse(NOT_MARKED, 409)
  if (state === 'approved') return errorResponse(ALREADY_APPROVED, 409)
  if (action === 'submit' && state === 'in_review') return answer(event, EMAIL_WORDS.alreadyInReview)
  if (action === 'ask_changes' && state === 'draft') return errorResponse(NOT_IN_REVIEW, 409)
  return null
}

/** The person who drafted the event, when they can still be written to: their row is there and their email holds an "@". */
async function drafterOf(db: D1Database, createdBy: string | null): Promise<{ email: string; full_name: string } | null> {
  if (!createdBy) return null
  const row = await db.prepare('SELECT email, full_name FROM members WHERE id = ?').bind(createdBy).first<{ email: string | null; full_name: string | null }>()
  const email = row?.email?.trim() ?? ''
  if (!row || !email.includes('@')) return null
  return { email, full_name: row.full_name ?? '' }
}

/** Submit's emails, one to each LCA admin's address, never one message to several. Answers the words for the answer. */
async function emailAdmins(env: Env, message: ReturnType<typeof reviewAskedEmail>): Promise<string> {
  const addresses = await lcaAdminAddresses(env.DB)
  if (addresses.length === 0) return EMAIL_WORDS.reviewNoAdmin
  let sent = 0
  let index = 0
  for (const to of addresses) {
    if (index++ > 0) await new Promise((resolve) => setTimeout(resolve, SEND_INTERVAL_MS))
    if (await trySendEmail(env, { ...message, to })) sent++
  }
  if (sent === addresses.length) return EMAIL_WORDS.reviewSent
  return sent === 0 ? EMAIL_WORDS.reviewNotSent : EMAIL_WORDS.reviewPartly
}

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestPost: PagesFunction<Env> = async (context) => {
  if (!REGION_EVENTS_ON) return errorResponse(APPROVAL_CLOSED, 403)

  const authed = await requireAuthedMember(context.request, context.env)
  if (isResponse(authed)) return authed

  const body = await parseBody(context.request, tournamentApprovalRequestSchema)
  if (isResponse(body)) return body

  // Approve and Ask for changes are an LCA admin's alone, with the second
  // factor asked exactly as requireAdmin asks it everywhere.
  if (body.action !== 'submit') {
    const admin = await requireAdmin(context.request, context.env)
    if (isResponse(admin)) return admin
  }

  const db = context.env.DB
  const member: MemberRow = authed.member
  const tournamentId = context.params.id as string
  const event = await readEvent(db, tournamentId)

  // Submit: the drafter while a seat of theirs keeps the club, or an LCA
  // admin. Anyone else gets the same 403 whether the event exists or not.
  if (body.action === 'submit' && member.role !== 'lca_admin') {
    if (!event || !(await draftedInRegion(db, member, { clubId: event.club_id, createdBy: event.created_by }))) {
      return errorResponse('Forbidden', 403)
    }
  }
  if (!event) return errorResponse('Tournament not found', 404)

  const early = settled(body.action, approvalState(event), event)
  if (early) return early

  const statement = body.action === 'approve'
    ? db.prepare(MOVES.approve).bind(member.id, tournamentId)
    : db.prepare(MOVES[body.action]).bind(tournamentId)
  const result = await statement.run()
  const after = await readEvent(db, tournamentId)
  if (!after) return errorResponse('Tournament not found', 404)
  if ((result.meta.changes ?? 0) !== 1) {
    // Another press moved the event first: answered as it now stands, with no row and no email.
    return settled(body.action, approvalState(after), after) ?? errorResponse(CHANGED_MEANWHILE, 409)
  }

  // An LCA admin has just read the event, so D22's notice, which asks them to
  // look over a standing director's listed event, is not sent; its mark is set
  // by the notice's own statement, so a later hide and list through the save
  // sends nothing either.
  if (body.action === 'approve') {
    try {
      await markReviewNotified(db, tournamentId)
    } catch (err) {
      console.warn(`approval: review mark not set for ${tournamentId}:`, err instanceof Error ? err.message : String(err))
    }
  }

  // One row for the move that went through: the event's name and its id, never the note.
  await recordAdminAction(db, member, {
    action: ACTIONS[body.action],
    targetLabel: after.name,
    detail: { tournament_id: tournamentId },
  })

  const waiting: WaitingEvent = {
    siteUrl: resolveSiteUrl(context.env, context.request),
    id: after.id,
    name: after.name,
    clubName: after.club_name,
    when: eventDays(after.date, after.end_date),
  }

  if (body.action === 'submit') return answer(after, await emailAdmins(context.env, reviewAskedEmail(waiting)))

  const drafter = await drafterOf(db, after.created_by)
  if (body.action === 'approve') {
    if (!drafter) return answer(after, EMAIL_WORDS.approvedNoDrafter)
    const sent = await trySendEmail(context.env, { ...approvedEmail({ ...waiting, fullName: drafter.full_name }), to: drafter.email })
    return answer(after, sent ? EMAIL_WORDS.approvedSent : EMAIL_WORDS.approvedNotSent)
  }
  if (!drafter) return answer(after, EMAIL_WORDS.changesNoDrafter)
  const sent = await trySendEmail(context.env, { ...changesAskedEmail({ ...waiting, fullName: drafter.full_name, note: body.note }), to: drafter.email })
  return answer(after, sent ? EMAIL_WORDS.changesSent : EMAIL_WORDS.changesNotSent)
}
