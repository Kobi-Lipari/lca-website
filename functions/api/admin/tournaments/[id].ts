// functions/api/admin/tournaments/[id].ts
import { eq } from 'drizzle-orm'
import type { Env } from '../../../types'
import { isResponse, requireTournamentManager, requireAdmin } from '../../../utils/auth'
import { errorResponse, handleOptions, jsonResponse, parseBody } from '../../../utils/response'
import { recordAdminAction } from '../../../utils/audit'
import { getDb } from '../../../db/client'
import { tournaments } from '../../../db/schema'
import { updateTournamentRequestSchema } from '../../../../domain/contracts/events'
import {
  buildSaveSections,
  isSectionsConflict,
  loadSections,
  runBatch,
  sectionResponse,
  type SectionQuery,
} from '../../../utils/events/sectionsRepo'
import { SECTIONS_CHANGED_MESSAGE, type TierTournament } from '../../../../domain/events/sections'

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

/**
 * Edits a tournament (adminUpdateTournament). A key left out keeps its
 * column. The tournament's own columns and, when sections are sent, every
 * section write go in one D1 batch; the sections go through the one
 * writer, sectionsRepo, which refuses repeated names and removing a section
 * that still has entries or games, before anything is written. If the
 * sections change between reading them and the batch (another save at the
 * same moment), the batch fails as a whole and the answer is 409.
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

  const roundSchedule = body.roundSchedule !== undefined
    ? JSON.stringify(body.roundSchedule)
    : existing.roundSchedule

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
      entryFee: body.entryFee ?? existing.entryFee,
      rounds: body.rounds ?? existing.rounds,
      maxPlayers: body.maxPlayers !== undefined ? body.maxPlayers : existing.maxPlayers,
      status: body.status ?? existing.status,
      description: body.description !== undefined ? body.description : existing.description,
      registrationDeadline: body.registrationDeadline !== undefined ? body.registrationDeadline : existing.registrationDeadline,
      isRated,
      isVisible,
      roundSchedule: roundSchedule ?? null,
      registrationClosesAt: registrationClosesAt ?? null,
      customDetails: customDetails ?? null,
      timeControl: timeControl ?? null,
      clubId,
      pairingSystem,
      earlyDeadline: body.earlyDeadline !== undefined ? body.earlyDeadline || null : existing.earlyDeadline ?? null,
      earlyDiscount: body.earlyDiscount !== undefined ? Math.max(0, Number(body.earlyDiscount) || 0) : existing.earlyDiscount ?? 0,
      lateAfter: body.lateAfter !== undefined ? body.lateAfter || null : existing.lateAfter ?? null,
      lateFee: body.lateFee !== undefined ? Math.max(0, Number(body.lateFee) || 0) : existing.lateFee ?? 0,
      memberDiscount: body.memberDiscount !== undefined ? Math.max(0, Number(body.memberDiscount) || 0) : existing.memberDiscount ?? 0,
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

  try {
    await runBatch(db, queries)
  } catch (err) {
    if (isSectionsConflict(err)) return errorResponse(SECTIONS_CHANGED_MESSAGE, 409)
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
  ).bind(tournamentId).first<Record<string, unknown>>()
  const sections = (await loadSections(db, tournamentId)).map((s) => sectionResponse(s, tournament as unknown as TierTournament))

  return jsonResponse({
    tournament: { ...tournament, sections },
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