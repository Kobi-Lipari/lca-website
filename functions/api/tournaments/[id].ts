// functions/api/admin/tournaments/[id].ts
import type { Env } from '../../types'
import { isResponse, requireTournamentManager, requireAdmin } from '../../utils/auth'
import { errorResponse, handleOptions, jsonResponse, parseJsonBody } from '../../utils/response'

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
  isVisible?: boolean
  roundSchedule?: Array<{ round: number; date: string; time: string }>
  registrationClosesAt?: string | null
  customDetails?: Array<{ title: string; body: string }>
}

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const tournamentId = context.params.id as string
  const authResult = await requireTournamentManager(context.request, context.env, tournamentId)
  if (isResponse(authResult)) return authResult

  const existing = await context.env.DB.prepare(
    'SELECT * FROM tournaments WHERE id = ?',
  ).bind(tournamentId).first<Record<string, unknown>>()

  if (!existing) return errorResponse('Tournament not found', 404)

  const body = await parseJsonBody<UpdateTournamentBody>(context.request)
  if (!body) return errorResponse('Invalid JSON body', 400)

  if (body.status && !['upcoming', 'active', 'completed'].includes(body.status)) {
    return errorResponse('Invalid status', 400)
  }

  const sections = body.sections != null
    ? JSON.stringify(body.sections)
    : (existing.sections as string)

  const isRated = body.isRated !== undefined
    ? body.isRated ? 1 : 0
    : existing.is_rated

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

  await context.env.DB.prepare(
    `UPDATE tournaments SET
      name = ?, location = ?, venue = ?, date = ?, end_date = ?,
      entry_fee = ?, sections = ?, rounds = ?, max_players = ?,
      status = ?, description = ?, registration_deadline = ?,
      is_rated = ?, is_visible = ?, round_schedule = ?,
      registration_closes_at = ?, custom_details = ?
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
    tournamentId,
  ).run()

  const tournament = await context.env.DB.prepare(
    'SELECT * FROM tournaments WHERE id = ?',
  ).bind(tournamentId).first<Record<string, unknown>>()

  let parsedSections: unknown[] = []
  try { parsedSections = JSON.parse((tournament as Record<string, unknown>).sections as string) } catch { parsedSections = [] }

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