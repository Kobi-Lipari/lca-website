// functions/api/admin/tournaments/[id]/rounds/[round].ts
import type { Env } from '../../../../../types'
import { isResponse, requireTournamentManager } from '../../../../../utils/auth'
import { errorResponse, handleOptions, jsonResponse } from '../../../../../utils/response'
import { recordAdminAction } from '../../../../../utils/audit'

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const tournamentId = context.params.id as string
  const round = Number(context.params.round)
  const url = new URL(context.request.url)
  const section = url.searchParams.get('section')

  if (!Number.isInteger(round) || round < 1) {
    return errorResponse('Invalid round', 400)
  }
  if (!section) {
    return errorResponse('section query parameter is required', 400)
  }

  const authResult = await requireTournamentManager(
    context.request,
    context.env,
    tournamentId,
  )
  if (isResponse(authResult)) return authResult

  // Refuse if any later round exists for this section — deleting round N
  // under a posted round N+1 corrupts pairing history.
  const laterRound = await context.env.DB.prepare(
    `SELECT id FROM tournament_games
     WHERE tournament_id = ? AND section = ? AND round > ? LIMIT 1`,
  )
    .bind(tournamentId, section, round)
    .first()

  if (laterRound) {
    return errorResponse(
      'A later round has already been paired in this section. Delete rounds from the latest backward.',
      400,
    )
  }

  const existing = await context.env.DB.prepare(
    `SELECT COUNT(*) as count FROM tournament_games
     WHERE tournament_id = ? AND section = ? AND round = ?`,
  )
    .bind(tournamentId, section, round)
    .first<{ count: number }>()

  if (!existing || existing.count === 0) {
    return errorResponse('No pairings exist for this round and section', 404)
  }

  await context.env.DB.prepare(
    `DELETE FROM tournament_games
     WHERE tournament_id = ? AND section = ? AND round = ?`,
  )
    .bind(tournamentId, section, round)
    .run()

  const t = await context.env.DB.prepare('SELECT name FROM tournaments WHERE id = ?')
    .bind(tournamentId).first<{ name: string }>()
  await recordAdminAction(context.env.DB, authResult.member, {
    action: 'round_delete',
    targetLabel: t?.name ?? tournamentId,
    detail: { tournament_id: tournamentId, round, section, games: existing.count },
  })

  return jsonResponse({ deleted: existing.count, round, section })
}
