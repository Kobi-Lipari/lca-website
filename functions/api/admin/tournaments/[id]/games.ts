import type { Env } from '../../../types'
import { isResponse, requireTournamentManager } from '../../../../utils/auth'
import {
  errorResponse,
  handleOptions,
  jsonResponse,
  parseJsonBody,
} from '../../../../utils/response'

interface PairingInput {
  board?: number
  whiteMemberId?: string | null
  blackMemberId?: string | null
}

interface GamesBody {
  round?: number
  section?: string
  pairings?: PairingInput[]
}

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const tournamentId = context.params.id as string
  const authResult = await requireTournamentManager(
    context.request,
    context.env,
    tournamentId,
  )
  if (isResponse(authResult)) return authResult

  const body = await parseJsonBody<GamesBody>(context.request)
  if (!body?.round || !body.section || !body.pairings?.length) {
    return errorResponse('round, section, and pairings are required', 400)
  }

  const created: unknown[] = []

  for (const [index, pairing] of body.pairings.entries()) {
    const id = `game-${tournamentId}-r${body.round}-b${pairing.board ?? index + 1}-${Date.now().toString(36)}`
    const board = pairing.board ?? index + 1

    await context.env.DB.prepare(
      `INSERT INTO tournament_games (
        id, tournament_id, round, board, section,
        white_member_id, black_member_id, result
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
      ON CONFLICT(tournament_id, round, board, section) DO UPDATE SET
        white_member_id = excluded.white_member_id,
        black_member_id = excluded.black_member_id,
        result = 'pending'`,
    )
      .bind(
        id,
        tournamentId,
        body.round,
        board,
        body.section,
        pairing.whiteMemberId ?? null,
        pairing.blackMemberId ?? null,
      )
      .run()

    const game = await context.env.DB.prepare(
      'SELECT * FROM tournament_games WHERE tournament_id = ? AND round = ? AND board = ? AND section = ?',
    )
      .bind(tournamentId, body.round, board, body.section)
      .first()

    if (game) created.push(game)
  }

  return jsonResponse({ games: created }, 201)
}
