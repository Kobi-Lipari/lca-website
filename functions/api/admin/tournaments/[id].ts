// functions/api/admin/tournaments/[id].ts
import type { Env } from '../../../types'
import { isResponse, requireTournamentManager, requireAdmin } from '../../../utils/auth'
import { errorResponse, handleOptions, jsonResponse, parseJsonBody } from '../../../utils/response'
import { parseJsonArray } from '../../../utils/json'
import { recordAdminAction } from '../../../utils/audit'

interface UpdateTournamentBody {
  name?: string
  location?: string
  venue?: string | null
  date?: string
  endDate?: string | null
  entryFee?: number
  sections?: Array<{ name: string; entryFee: number; prizeFund?: string }>
  rounds?: number
  maxPlayers?: number | null
  status?: string
  description?: string | null
  registrationDeadline?: string | null
  isRated?: boolean
  pairingSystem?: string
  /** Accelerated pairings for rounds 1–2. */
  accelerated?: boolean
  /** 'family' | 'family_club' | 'none' */
  keepApart?: string
  /** Marks the event as a state championship (badge, champions page). */
  isStateChampionship?: boolean
  /** US Chess upload details; see migration 0045. */
  reportSettings?: Record<string, unknown> | null
  /** Pricing: Central date/times and dollar amounts. null clears. */
  earlyDeadline?: string | null
  earlyDiscount?: number | null
  lateAfter?: string | null
  lateFee?: number | null
  memberDiscount?: number | null
  isVisible?: boolean
  roundSchedule?: Array<{ round: number; date: string; time: string }>
  registrationClosesAt?: string | null
  customDetails?: Array<{ title: string; body: string }>
  timeControl?: string | null
  /** lca_admin only — which club organizes the event. null detaches it. */
  clubId?: string | null
}

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const tournamentId = context.params.id as string
  const authResult = await requireTournamentManager(
    context.request,
    context.env,
    tournamentId,
  )
  if (isResponse(authResult)) return authResult

  const existing = await context.env.DB.prepare(
    'SELECT * FROM tournaments WHERE id = ?',
  )
    .bind(tournamentId)
    .first<Record<string, unknown>>()

  if (!existing) return errorResponse('Tournament not found', 404)

  const body = await parseJsonBody<UpdateTournamentBody>(context.request)
  if (!body) return errorResponse('Invalid JSON body', 400)

  if (body.status && !['upcoming', 'active', 'completed'].includes(body.status)) {
    return errorResponse('Invalid status', 400)
  }

  // Reassigning the organizing club moves the event between reps' scopes, so
  // only an admin may do it. Checked before any write happens.
  let clubId = existing.club_id as string | null
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

  const sections = body.sections != null
    ? JSON.stringify(body.sections)
    : (existing.sections as string)

  const isRated = body.isRated !== undefined
    ? body.isRated ? 1 : 0
    : existing.is_rated

  const pairingSystem = body.pairingSystem === undefined
    ? (existing.pairing_system ?? 'uscf')
    : body.pairingSystem === 'fide' ? 'fide' : 'uscf'

  const accelerated = body.accelerated === undefined ? (existing.accelerated ?? 0) : body.accelerated ? 1 : 0
  const keepApart = body.keepApart === undefined
    ? (existing.keep_apart ?? 'family')
    : ['family', 'family_club', 'none'].includes(body.keepApart) ? body.keepApart : 'family'

  const isVisible = body.isVisible !== undefined
    ? body.isVisible ? 1 : 0
    : existing.is_visible

  const roundSchedule = body.roundSchedule !== undefined
    ? JSON.stringify(body.roundSchedule)
    : existing.round_schedule

  const customDetails = body.customDetails !== undefined
    ? JSON.stringify(body.customDetails)
    : existing.custom_details

  const registrationClosesAt = body.registrationClosesAt !== undefined
    ? body.registrationClosesAt
    : existing.registration_closes_at

  const timeControl = body.timeControl !== undefined
    ? body.timeControl
    : existing.time_control

  await context.env.DB.prepare(
    `UPDATE tournaments SET
      name = ?, location = ?, venue = ?, date = ?, end_date = ?,
      entry_fee = ?, sections = ?, rounds = ?, max_players = ?,
      status = ?, description = ?, registration_deadline = ?,
      is_rated = ?, is_visible = ?, round_schedule = ?,
      registration_closes_at = ?, custom_details = ?, time_control = ?,
      club_id = ?, pairing_system = ?,
      early_deadline = ?, early_discount = ?, late_after = ?, late_fee = ?, member_discount = ?,
      accelerated = ?, keep_apart = ?, report_settings = ?, is_state_championship = ?
     WHERE id = ?`,
  ).bind(
    body.name ?? existing.name,
    body.location ?? existing.location,
    body.venue !== undefined ? body.venue : existing.venue,
    body.date ?? existing.date,
    body.endDate !== undefined ? body.endDate : existing.end_date,
    body.entryFee ?? existing.entry_fee,
    sections,
    body.rounds ?? existing.rounds,
    body.maxPlayers !== undefined ? body.maxPlayers : existing.max_players,
    body.status ?? existing.status,
    body.description !== undefined ? body.description : existing.description,
    body.registrationDeadline !== undefined ? body.registrationDeadline : existing.registration_deadline,
    isRated,
    isVisible,
    roundSchedule ?? null,
    registrationClosesAt ?? null,
    customDetails ?? null,
    timeControl ?? null,
    clubId,
    pairingSystem,
    body.earlyDeadline !== undefined ? body.earlyDeadline || null : existing.early_deadline ?? null,
    body.earlyDiscount !== undefined ? Math.max(0, Number(body.earlyDiscount) || 0) : existing.early_discount ?? 0,
    body.lateAfter !== undefined ? body.lateAfter || null : existing.late_after ?? null,
    body.lateFee !== undefined ? Math.max(0, Number(body.lateFee) || 0) : existing.late_fee ?? 0,
    body.memberDiscount !== undefined ? Math.max(0, Number(body.memberDiscount) || 0) : existing.member_discount ?? 0,
    accelerated,
    keepApart,
    body.reportSettings === undefined
      ? (existing.report_settings ?? null)
      : body.reportSettings === null ? null : JSON.stringify(body.reportSettings).slice(0, 8000),
    body.isStateChampionship === undefined ? (existing.is_state_championship ?? 0) : body.isStateChampionship ? 1 : 0,
    tournamentId,
  ).run()

  if (body.status && body.status !== existing.status && (body.status === 'completed' || existing.status === 'completed')) {
    await recordAdminAction(context.env.DB, authResult.member, {
      action: 'tournament_complete',
      targetLabel: String(body.name ?? existing.name),
      detail: { tournament_id: tournamentId, from: existing.status, to: body.status },
    })
  }

  if (Number(isVisible) !== Number(existing.is_visible)) {
    await recordAdminAction(context.env.DB, authResult.member, {
      action: isVisible ? 'tournament_publish' : 'tournament_unpublish',
      targetLabel: String(body.name ?? existing.name),
      detail: { tournament_id: tournamentId },
    })
  }

  const tournament = await context.env.DB.prepare(
    'SELECT * FROM tournaments WHERE id = ?',
  ).bind(tournamentId).first()

  const parsedSections = parseJsonArray(
    (tournament as Record<string, unknown>).sections,
  )

  return jsonResponse({
    tournament: { ...(tournament as object), sections: parsedSections },
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