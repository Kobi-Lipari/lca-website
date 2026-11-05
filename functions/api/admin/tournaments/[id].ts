// functions/api/admin/tournaments/[id].ts
import { eq } from 'drizzle-orm'
import type { Env, MemberRow, TournamentRow } from '../../../types'
import { isResponse, requireTournamentManager, requireAdmin, requireAuthedMember } from '../../../utils/auth'
import { errorResponse, handleOptions, jsonResponse, parseBody } from '../../../utils/response'
import { recordAdminAction } from '../../../utils/admin/audit'
import { getDb } from '../../../db/client'
import { tournaments } from '../../../db/schema'
import { updateTournamentRequestSchema } from '../../../../domain/contracts/events'
import {
  buildSaveSections,
  isSectionsConflict,
  loadSections,
  runBatch,
  savedSectionFees,
  toTournamentResponse,
  type SectionQuery,
} from '../../../utils/events/sectionsRepo'
import {
  buildSaveSchedules,
  isSchedulesConflict,
  loadSchedules,
  schedulesFitRoundsGuard,
  schedulesProblemForRounds,
  type SaveSchedulesInput,
} from '../../../utils/events/schedulesRepo'
import { CREATION_ROLES_ON, creationPerson } from '../../../utils/events/creation'
import { sendPublishedReviewNotice } from '../../../utils/events/publishedReview'
import { SECTIONS_CHANGED_MESSAGE, type TierTournament } from '../../../../domain/events/sections'
import { SCHEDULE_FORMS_MESSAGE, SCHEDULES_CHANGED_MESSAGE } from '../../../../domain/events/schedules'
import { FEES_NEED_PAYOUT_ACCOUNT, canChargeFees, canDeleteDraft, feesRaised, type CreationGrant } from '../../../../domain/events/creation'
import { LCA_RUN_NEEDS_MEMBERSHIP } from '../../../../domain/membership/requirement'

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

/** An event's pricing columns, in the names tierFees reads, from the columns as Drizzle names them. */
function pricingOf(event: {
  entryFee: number
  earlyDeadline: string | null
  earlyDiscount: number
  lateAfter: string | null
  lateFee: number
}): TierTournament {
  return {
    entry_fee: event.entryFee,
    early_deadline: event.earlyDeadline,
    early_discount: event.earlyDiscount,
    late_after: event.lateAfter,
    late_fee: event.lateFee,
  }
}

/**
 * Edits a tournament (adminUpdateTournament). A key left out keeps its
 * column. The tournament's own columns and, when sections or round times
 * are sent, every section and schedule write go in one D1 batch; the
 * sections go through their one writer, sectionsRepo, which refuses
 * repeated names and removing a section that still has entries or games,
 * and the round times through theirs, schedulesRepo, which refuses a merge
 * round outside the event's rounds, before anything is written. If the
 * sections or the schedules change between reading them and the batch
 * (another save at the same moment), the batch fails as a whole and the
 * answer is 409. A save that raises what an entrant pays, once
 * CREATION_ROLES_ON is set, needs someone canChargeFees lets set a fee (D24).
 * Once it is set, the first publish of a standing director's event also
 * tells the LCA admins by email (D22), and the publish's row in the activity
 * log says whether the mark was set and how many emails went.
 */
export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const tournamentId = context.params.id as string
  const authResult = await requireTournamentManager(
    context.request,
    context.env,
    tournamentId,
  )
  if (isResponse(authResult)) return authResult

  const db = getDb(context.env.DB)
  const [existing] = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId))

  if (!existing) return errorResponse('Tournament not found', 404)

  const body = await parseBody(context.request, updateTournamentRequestSchema)
  if (isResponse(body)) return body

  if (body.status && !['upcoming', 'active', 'completed'].includes(body.status)) {
    return errorResponse('Invalid status', 400)
  }
  if (body.roundSchedule !== undefined && body.schedules !== undefined) {
    return errorResponse(SCHEDULE_FORMS_MESSAGE, 400)
  }

  // Reassigning the organizing club moves the event between reps' scopes, so
  // only an admin may do it. Checked before any write happens.
  let clubId = existing.clubId
  if (body.clubId !== undefined) {
    if (authResult.member.role !== 'lca_admin') {
      return errorResponse('Only LCA admins can change the organizing club', 403)
    }
    if (body.clubId) {
      const club = await context.env.DB.prepare('SELECT id FROM clubs WHERE id = ?')
        .bind(body.clubId)
        .first()
      if (!club) return errorResponse('Club not found', 404)
    }
    clubId = body.clubId || null
  }

  // Whether entering needs an LCA membership. Only an LCA admin or the rep
  // of the organizing club decides it; an assigned director, who reaches this
  // handler through requireTournamentManager, may not. An LCA-run event
  // (no club, after this save) always requires one. Written only when sent
  // or when taking the club off forces it on, so an edit read before another
  // save changed it cannot put the old value back.
  let requiresLcaMembership: number | undefined
  if (body.requiresLcaMembership !== undefined) {
    const { member } = authResult
    const ownsEvent = member.role === 'club_rep' && !!existing.clubId && member.club_id === existing.clubId
    if (member.role !== 'lca_admin' && !ownsEvent) {
      return errorResponse("Only the organizing club's rep or an LCA admin can change whether an LCA membership is required", 403)
    }
    if (!body.requiresLcaMembership && !clubId) {
      return errorResponse(LCA_RUN_NEEDS_MEMBERSHIP, 400)
    }
    requiresLcaMembership = body.requiresLcaMembership ? 1 : 0
  }
  if (!clubId) requiresLcaMembership = 1

  // The event's pricing columns as this save writes them: a key left out
  // keeps its column, and a discount or a late fee is never below $0.
  const entryFee = body.entryFee ?? existing.entryFee
  const earlyDeadline = body.earlyDeadline !== undefined ? body.earlyDeadline || null : existing.earlyDeadline ?? null
  const earlyDiscount = body.earlyDiscount !== undefined ? Math.max(0, Number(body.earlyDiscount) || 0) : existing.earlyDiscount ?? 0
  const lateAfter = body.lateAfter !== undefined ? body.lateAfter || null : existing.lateAfter ?? null
  const lateFee = body.lateFee !== undefined ? Math.max(0, Number(body.lateFee) || 0) : existing.lateFee ?? 0

  // D24: a save that raises what an entrant pays, at any tier of any
  // section, is refused for anyone canChargeFees does not let set a fee. The
  // stored rows are the base, so a save that sends back what the event
  // already has changes nothing, and each section the save sends is read as
  // the writer will store it (savedSectionFees), a bare name or a section
  // with no numeric fee at the event's fee. Every row counts, archived ones
  // too, since the waitlist's offer prices an entry left in an archived
  // section from its row. Each tier is read by what it costs, as tierFees
  // gives it, and not by when it applies, so a stored late date or early
  // deadline moved earlier is not read as a raise. CREATION_ROLES_ON is read
  // here, at each request; while it is unset canChargeFees lets everyone the
  // manage check admits set a fee, as before.
  const rolesOn = CREATION_ROLES_ON
  const stored = await loadSections(db, tournamentId, { includeArchived: true })
  const before = savedSectionFees(stored, null, pricingOf(existing))
  const after = savedSectionFees(stored, body.sections, pricingOf({ entryFee, earlyDeadline, earlyDiscount, lateAfter, lateFee }))
  if (feesRaised(before, after)) {
    const person = await creationPerson(context.env.DB, authResult.member, rolesOn)
    if (!canChargeFees(person, { clubId: existing.clubId, createdBy: existing.createdBy }, rolesOn)) {
      return errorResponse(FEES_NEED_PAYOUT_ACCOUNT, 403)
    }
  }

  const isRated = body.isRated !== undefined
    ? body.isRated ? 1 : 0
    : existing.isRated

  const pairingSystem = body.pairingSystem === undefined
    ? (existing.pairingSystem ?? 'uscf')
    : body.pairingSystem === 'fide' ? 'fide' : 'uscf'

  const accelerated = body.accelerated === undefined ? (existing.accelerated ?? 0) : body.accelerated ? 1 : 0
  const keepApart = body.keepApart === undefined
    ? (existing.keepApart ?? 'family')
    : ['family', 'family_club', 'none'].includes(body.keepApart) ? body.keepApart : 'family'

  const isVisible = body.isVisible !== undefined
    ? body.isVisible ? 1 : 0
    : existing.isVisible

  const customDetails = body.customDetails !== undefined
    ? JSON.stringify(body.customDetails)
    : existing.customDetails

  const registrationClosesAt = body.registrationClosesAt !== undefined
    ? body.registrationClosesAt
    : existing.registrationClosesAt

  const timeControl = body.timeControl !== undefined
    ? body.timeControl
    : existing.timeControl

  const reportSettings = body.reportSettings === undefined
    ? (existing.reportSettings ?? null)
    : body.reportSettings === null ? null : JSON.stringify(body.reportSettings).slice(0, 8000)

  const queries: SectionQuery[] = [
    db.update(tournaments).set({
      name: body.name ?? existing.name,
      location: body.location ?? existing.location,
      venue: body.venue !== undefined ? body.venue : existing.venue,
      date: body.date ?? existing.date,
      endDate: body.endDate !== undefined ? body.endDate : existing.endDate,
      entryFee,
      // Left out, the round count is not written at all, so an edit read
      // before another save changed it cannot put the old count back.
      rounds: body.rounds ?? undefined,
      maxPlayers: body.maxPlayers !== undefined ? body.maxPlayers : existing.maxPlayers,
      status: body.status ?? existing.status,
      description: body.description !== undefined ? body.description : existing.description,
      registrationDeadline: body.registrationDeadline !== undefined ? body.registrationDeadline : existing.registrationDeadline,
      isRated,
      isVisible,
      registrationClosesAt: registrationClosesAt ?? null,
      customDetails: customDetails ?? null,
      timeControl: timeControl ?? null,
      clubId,
      pairingSystem,
      earlyDeadline,
      earlyDiscount,
      lateAfter,
      lateFee,
      // memberDiscount is accepted and ignored: there is no member price, and
      // member_discount is no longer written.
      requiresLcaMembership,
      accelerated,
      keepApart,
      reportSettings,
      isStateChampionship: body.isStateChampionship === undefined ? (existing.isStateChampionship ?? 0) : body.isStateChampionship ? 1 : 0,
    }).where(eq(tournaments.id, tournamentId)),
  ]

  // sections: null, like leaving it out, keeps the sections as they are.
  if (body.sections != null) {
    const plan = await buildSaveSections(db, tournamentId, body.sections, { reportSettings })
    if (!plan.ok) return errorResponse(plan.error, 400)
    queries.push(...plan.queries)
  }

  // The round times, after the sections, so round_schedule is the batch's
  // last write. Left out, the schedules stay as they are. Whenever this save
  // writes the schedules or the round count, a guard as the batch runs checks
  // every second schedule still merges within the event's rounds, in case
  // another save landed between the reads here and the batch (409).
  const roundCount = body.rounds ?? existing.rounds
  let schedules: SaveSchedulesInput | null = null
  if (body.roundSchedule !== undefined) schedules = { roundSchedule: body.roundSchedule }
  if (body.schedules !== undefined) schedules = { schedules: body.schedules }
  if (schedules) {
    const plan = await buildSaveSchedules(db, tournamentId, schedules, { roundCount })
    if (!plan.ok) return errorResponse(plan.error, 400)
    // The plan ends with the round_schedule JSON; the guard goes just before
    // it, once the schedule rows are final.
    queries.push(...plan.queries.slice(0, -1), schedulesFitRoundsGuard(db, tournamentId), ...plan.queries.slice(-1))
  } else if (body.rounds != null) {
    if (roundCount !== existing.rounds) {
      const problem = await schedulesProblemForRounds(db, tournamentId, roundCount)
      if (problem) return errorResponse(problem, 400)
    }
    queries.push(schedulesFitRoundsGuard(db, tournamentId))
  }

  try {
    await runBatch(db, queries)
  } catch (err) {
    if (isSectionsConflict(err)) return errorResponse(SECTIONS_CHANGED_MESSAGE, 409)
    if (isSchedulesConflict(err)) return errorResponse(SCHEDULES_CHANGED_MESSAGE, 409)
    throw err
  }

  if (body.status && body.status !== existing.status && (body.status === 'completed' || existing.status === 'completed')) {
    await recordAdminAction(context.env.DB, authResult.member, {
      action: 'tournament_complete',
      targetLabel: String(body.name ?? existing.name),
      detail: { tournament_id: tournamentId, from: existing.status, to: body.status },
    })
  }

  // D22: on the change from unpublished to published, and only while
  // CREATION_ROLES_ON is set (rolesOn, read above for the fee rule), the LCA
  // admins are told by email that a standing director's event is listed.
  // sendPublishedReviewNotice sets the mark in the statement that decides the
  // send and sends in this request, after the save's own writes, so the row
  // below can say what it did. It never throws: an email that fails, or a
  // failure of its own reads and writes, is logged there, and the save still
  // writes the row and answers. With the constant unset the row is today's.
  let notice: { notified: boolean; sent: number } | null = null
  if (rolesOn && isVisible && !existing.isVisible) notice = await sendPublishedReviewNotice(context.env, tournamentId)

  if (Number(isVisible) !== Number(existing.isVisible)) {
    await recordAdminAction(context.env.DB, authResult.member, {
      action: isVisible ? 'tournament_publish' : 'tournament_unpublish',
      targetLabel: String(body.name ?? existing.name),
      detail: notice
        ? { tournament_id: tournamentId, review_notified: notice.notified, review_notices_sent: notice.sent }
        : { tournament_id: tournamentId },
    })
  }

  const tournament = await context.env.DB.prepare(
    'SELECT * FROM tournaments WHERE id = ?',
  ).bind(tournamentId).first<TournamentRow>()
  if (!tournament) return errorResponse('Tournament not found', 404)

  return jsonResponse({
    tournament: toTournamentResponse(tournament, await loadSections(db, tournamentId), await loadSchedules(db, tournamentId)),
  })
}

/** How many entries the event has, withdrawn ones included: every registrations row. */
async function entryCount(db: D1Database, tournamentId: string): Promise<number> {
  const row = await db.prepare('SELECT COUNT(*) AS n FROM registrations WHERE tournament_id = ?').bind(tournamentId).first<{ n: number }>()
  return row?.n ?? 0
}

/** The six deletes of an event, in the order they run: the rows under it, then the event's own row. */
const EVENT_DELETES = [
  'DELETE FROM registrations WHERE tournament_id = ?',
  'DELETE FROM tournament_games WHERE tournament_id = ?',
  'DELETE FROM tournament_directors WHERE tournament_id = ?',
  'DELETE FROM tournament_reminders WHERE tournament_id = ?',
  'DELETE FROM tournament_attendee_reminders WHERE tournament_id = ?',
  'DELETE FROM tournaments WHERE id = ?',
] as const

/**
 * What the guard of a creator's delete raises: json_extract with a malformed
 * path, as the section and schedule guards raise it (sectionsRepo), with a
 * path of its own, so the error can be told apart from any other.
 */
const DRAFT_GUARD_PATH = '$draft changed'
const DRAFT_GUARD_ERROR = `bad JSON path: '${DRAFT_GUARD_PATH}`

/**
 * The first statement of a creator's delete batch. It fails the batch, so
 * nothing is deleted, when the event, as the batch runs, is no longer what
 * canDeleteDraft was asked about: published, moved to another club, or with
 * an entry, any of which can land between the rule and the deletes. The
 * path holds the event's id, so SQLite raises it only for the row the WHERE
 * keeps.
 */
function draftGuard(db: D1Database, tournamentId: string, clubId: string | null): D1PreparedStatement {
  return db.prepare(
    `SELECT json_extract('{}', '${DRAFT_GUARD_PATH} ' || id) FROM tournaments
      WHERE id = ? AND (is_visible IS NOT 0 OR club_id IS NOT ? OR EXISTS (SELECT 1 FROM registrations WHERE tournament_id = ?))`,
  ).bind(tournamentId, clubId, tournamentId)
}

/** True when a batch failed because draftGuard raised. The error's causes are read too, as isSectionsConflict reads them. */
function isDraftChanged(err: unknown): boolean {
  for (let e: unknown = err, depth = 0; e != null && depth < 5; depth++) {
    const message = typeof e === 'object' && typeof (e as { message?: unknown }).message === 'string'
      ? (e as { message: string }).message
      : String(e)
    if (message.includes(DRAFT_GUARD_ERROR)) return true
    e = typeof e === 'object' ? (e as { cause?: unknown }).cause : undefined
  }
  return false
}

/** Whether a run of `DELETE FROM tournaments` took the event's row, which only one delete of an event can. */
const tookEvent = (result: D1Result | undefined) => (result?.meta.changes ?? 0) > 0

/** The activity log's row for a delete, which a caller writes only while CREATION_ROLES_ON is set. */
function recordDelete(db: D1Database, member: MemberRow, existing: TournamentRow, entries: number, grant: CreationGrant): Promise<void> {
  return recordAdminAction(db, member, {
    action: 'tournament_delete',
    targetLabel: existing.name,
    detail: { tournament_id: existing.id, entries, was_visible: existing.is_visible, grant },
  })
}

/**
 * Deletes an event and every row under it (adminDeleteTournament). An LCA
 * admin, with two-step sign-in, deletes any event, as before. Once
 * CREATION_ROLES_ON is set, so may the event's creator, while they still hold
 * the grant that let them create it and the event is an unpublished draft
 * with no entries, as canDeleteDraft decides. The role is read first, so an
 * admin, and everyone while the constant is unset, is answered by
 * requireAdmin before anything about the event is read, and the six deletes
 * run one at a time, as before. Anyone else gets the same 403 whether the
 * event exists or not, so the answer says nothing about a hidden draft, and
 * the creator's six deletes run in one batch led by draftGuard, so a draft
 * published, moved or entered after the rule was asked is not deleted. The
 * delete goes in the activity log only while the constant is set, and only
 * from the request that took the event's row.
 */
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const tournamentId = context.params.id as string
  const authed = await requireAuthedMember(context.request, context.env)
  if (isResponse(authed)) return authed
  const { member } = authed
  // Read here, at each request, as the save reads it.
  const rolesOn = CREATION_ROLES_ON

  if (member.role === 'lca_admin' || !rolesOn) {
    // Today's path: requireAdmin answers anyone but an admin, and an admin
    // without two-step sign-in, before the event is read.
    const authResult = await requireAdmin(context.request, context.env)
    if (isResponse(authResult)) return authResult

    const existing = await context.env.DB.prepare(
      'SELECT * FROM tournaments WHERE id = ?',
    ).bind(tournamentId).first<TournamentRow>()

    if (!existing) return errorResponse('Tournament not found', 404)
    // Counted only for the activity log's row.
    const entries = rolesOn ? await entryCount(context.env.DB, tournamentId) : 0

    // One statement at a time, in today's order, as before.
    let removed: D1Result | undefined
    for (const statement of EVENT_DELETES) removed = await context.env.DB.prepare(statement).bind(tournamentId).run()

    // An admin's delete sent twice at once is logged by the one that took the event's row.
    if (rolesOn && tookEvent(removed)) await recordDelete(context.env.DB, member, existing, entries, 'admin')
    return jsonResponse({ success: true })
  }

  // The creator's path, once the constant is set: a missing event and one
  // the person may not delete get the same answer.
  const existing = await context.env.DB.prepare(
    'SELECT * FROM tournaments WHERE id = ?',
  ).bind(tournamentId).first<TournamentRow>()
  const entries = await entryCount(context.env.DB, tournamentId)
  const person = await creationPerson(context.env.DB, member, rolesOn)
  if (!existing || !canDeleteDraft(person, { clubId: existing.club_id, createdBy: existing.created_by, isVisible: existing.is_visible, entries }, rolesOn)) {
    return errorResponse('Forbidden', 403)
  }

  // The same six deletes, in one batch led by draftGuard, which checks the
  // draft again as the batch runs.
  let results: D1Result[]
  try {
    results = await context.env.DB.batch([
      draftGuard(context.env.DB, tournamentId, existing.club_id),
      ...EVENT_DELETES.map((statement) => context.env.DB.prepare(statement).bind(tournamentId)),
    ])
  } catch (err) {
    if (isDraftChanged(err)) return errorResponse('Forbidden', 403)
    throw err
  }
  // Another delete took the draft first: answered as a missing draft is, and not logged twice.
  if (!tookEvent(results.at(-1))) return errorResponse('Forbidden', 403)

  await recordDelete(context.env.DB, member, existing, entries, person.grant)
  return jsonResponse({ success: true })
}