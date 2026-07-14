// functions/api/admin/tournaments/[id]/games/[gameId].ts
import type { Env } from '../../../../../types'
import { isResponse, requireTournamentManager } from '../../../../../utils/auth'
import {
  errorResponse,
  handleOptions,
  jsonResponse,
  parseJsonBody,
} from '../../../../../utils/response'

interface ResultBody {
  result?: string
}

// Full GameResult union — matches the pairing engine and the 0019 CHECK.
const VALID_RESULTS = [
  '1-0', '0-1', '1/2-1/2',
  '1-0 F', '0-1 F', '0-0 F',
  'bye', 'bye-half', 'pending',
]

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const tournamentId = context.params.id as string
  const gameId = context.params.gameId as string

  const authResult = await requireTournamentManager(
    context.request,
    context.env,
    tournamentId,
  )
  if (isResponse(authResult)) return authResult

  const body = await parseJsonBody<ResultBody>(context.request)
  if (!body?.result || !VALID_RESULTS.includes(body.result)) {
    return errorResponse('Valid result is required', 400)
  }

  const existing = await context.env.DB.prepare(
    'SELECT * FROM tournament_games WHERE id = ? AND tournament_id = ?',
  ).bind(gameId, tournamentId).first()

  if (!existing) return errorResponse('Game not found', 404)

  await context.env.DB.prepare(
    'UPDATE tournament_games SET result = ? WHERE id = ?',
  ).bind(body.result, gameId).run()

  const game = await context.env.DB.prepare(
    'SELECT * FROM tournament_games WHERE id = ?',
  ).bind(gameId).first()

  return jsonResponse({ game })
}