// functions/api/admin/tournaments/[id]/registration.ts
import type { Env, TournamentRow } from '../../../../types'
import { isResponse, requireTournamentManager } from '../../../../utils/auth'
import { notifyRegistrationOpen } from '../../../../utils/registrationOpenNotify'
import {
  errorResponse,
  handleOptions,
  jsonResponse,
  parseBody,
} from '../../../../utils/response'
import { getDb } from '../../../../db/client'
import { loadSections, toTournamentResponse } from '../../../../utils/events/sectionsRepo'
import { loadSchedules } from '../../../../utils/events/schedulesRepo'
import { registrationSettingsRequestSchema } from '../../../../../domain/contracts/events'

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const tournamentId = context.params.id as string

  const authResult = await requireTournamentManager(context.request, context.env, tournamentId)
  if (isResponse(authResult)) return authResult

  const body = await parseBody(context.request, registrationSettingsRequestSchema)
  if (isResponse(body)) return body

  const tournament = await context.env.DB.prepare(
    'SELECT * FROM tournaments WHERE id = ?',
  ).bind(tournamentId).first<{ registration_status: string; name: string }>()

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
  ).bind(tournamentId).first<TournamentRow>()
  if (!updated) return errorResponse('Tournament not found', 404)

  // Fire the registration-open notification only on the transition INTO
  // 'open' — never on a re-save of an already-open tournament. Runs via
  // waitUntil so a slow batch of subscriber emails doesn't hold up the
  // admin's save request.
  const wasOpen = tournament.registration_status === 'open'
  const isNowOpen = body.registration_status === 'open'
  if (!wasOpen && isNowOpen) {
    context.waitUntil(notifyRegistrationOpen(context.env, tournamentId, tournament.name))
  }

  // The page reloads the event after saving and reads nothing from this
  // answer; it is the tournament as every endpoint answers it.
  const db = getDb(context.env.DB)
  return jsonResponse({ tournament: toTournamentResponse(updated, await loadSections(db, tournamentId), await loadSchedules(db, tournamentId)) })
}
