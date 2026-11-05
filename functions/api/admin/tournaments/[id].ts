// functions/api/admin/tournaments/[id].ts
import { eq } from 'drizzle-orm'
import type { Env, TournamentRow } from '../../../types'
import { isResponse, requireTournamentManager, requireAdmin } from '../../../utils/auth'
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
import { SECTIONS_CHANGED_MESSAGE, type TierTournament } from '../../../../domain/events/sections'
import { SCHEDULE_FORMS_MESSAGE, SCHEDULES_CHANGED_MESSAGE } from '../../../../domain/events/schedules'
import { FEES_NEED_PAYOUT_ACCOUNT, canChargeFees, feesRaised } from '../../../../domain/events/creation'
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

  if (Number(isVisible) !== Number(existing.isVisible)) {
    await recordAdminAction(context.env.DB, authResult.member, {
      action: isVisible ? 'tournament_publish' : 'tournament_unpublish',
      targetLabel: String(body.name ?? existing.name),
      detail: { tournament_id: tournamentId },
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

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const tournamentId = context.params.id as string
  const authResult = await requireAdmin(context.request, context.env)
  if (isResponse(authResult)) return authResult

  const existing = await context.env.DB.prepare(
    'SELECT * FROM tournaments WHERE id = ?',
  ).bind(tournamentId).first()

  if (!existing) return errorResponse('Tournament not found', 404)

  await context.env.DB.prepare('DELETE FROM registrations WHERE tournament_id = ?').bind(tournamentId).run()
  await context.env.DB.prepare('DELETE FROM tournament_games WHERE tournament_id = ?').bind(tournamentId).run()
  await context.env.DB.prepare('DELETE FROM tournament_directors WHERE tournament_id = ?').bind(tournamentId).run()
  await context.env.DB.prepare('DELETE FROM tournament_reminders WHERE tournament_id = ?').bind(tournamentId).run()
  await context.env.DB.prepare('DELETE FROM tournament_attendee_reminders WHERE tournament_id = ?').bind(tournamentId).run()
  await context.env.DB.prepare('DELETE FROM tournaments WHERE id = ?').bind(tournamentId).run()

  return jsonResponse({ success: true })
}