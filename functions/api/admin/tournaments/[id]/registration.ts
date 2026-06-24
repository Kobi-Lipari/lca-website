// functions/api/admin/tournaments/[id]/registration.ts
import type { Env } from '../../../../types'
import { isResponse, requireTournamentManager } from '../../../../utils/auth'
import {
  errorResponse,
  handleOptions,
  jsonResponse,
  parseJsonBody,
} from '../../../../utils/response'

interface RegistrationControlBody {
  registration_status?: 'draft' | 'open' | 'closed'
  registration_opens_at?: string | null
  reminder_1_days_before?: number
  reminder_1_enabled?: boolean
  reminder_2_days_before?: number
  reminder_2_enabled?: boolean
}

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const tournamentId = context.params.id as string

  const authResult = await requireTournamentManager(context.request, context.env, tournamentId)
  if (isResponse(authResult)) return authResult

  const body = await parseJsonBody<RegistrationControlBody>(context.request)
  if (!body) return errorResponse('Invalid JSON body', 400)

  const tournament = await context.env.DB.prepare(
    'SELECT * FROM tournaments WHERE id = ?',
  ).bind(tournamentId).first()

  if (!tournament) return errorResponse('Tournament not found', 404)

  await context.env.DB.prepare(
    `UPDATE tournaments SET
      registration_status = COALESCE(?, registration_status),
      registration_opens_at = CASE WHEN ? IS NOT NULL THEN ? ELSE registration_opens_at END,
      reminder_1_days_before = COALESCE(?, reminder_1_days_before),
      reminder_1_enabled = COALESCE(?, reminder_1_enabled),
      reminder_2_days_before = COALESCE(?, reminder_2_days_before),
      reminder_2_enabled = COALESCE(?, reminder_2_enabled)
     WHERE id = ?`,
  ).bind(
    body.registration_status ?? null,
    body.registration_opens_at !== undefined ? 1 : null,
    body.registration_opens_at ?? null,
    body.reminder_1_days_before ?? null,
    body.reminder_1_enabled !== undefined ? (body.reminder_1_enabled ? 1 : 0) : null,
    body.reminder_2_days_before ?? null,
    body.reminder_2_enabled !== undefined ? (body.reminder_2_enabled ? 1 : 0) : null,
    tournamentId,
  ).run()

  const updated = await context.env.DB.prepare(
    'SELECT * FROM tournaments WHERE id = ?',
  ).bind(tournamentId).first()

  return jsonResponse({ tournament: updated })
}
