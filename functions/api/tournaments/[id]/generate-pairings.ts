// functions/api/tournaments/[id]/generate-pairings.ts
import type { Env } from '../../../../types'
import { isResponse, requireTournamentManager } from '../../../utils/auth'
import { generateDutchPairings } from '../../../utils/pairing'
import type { PastGameInput, PairingPlayerInput } from '../../../utils/pairing'
import {
  errorResponse,
  handleOptions,
  jsonResponse,
  parseJsonBody,
} from '../../../utils/response'

interface GenerateBody {
  round?: number
  section?: string
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

  const body = await parseJsonBody<GenerateBody>(context.request)
  if (!body?.round || !body.section) {
    return errorResponse('round and section are required', 400)
  }

  if (body.round < 1) {
    return errorResponse('round must be at least 1', 400)
  }

  const existingRound = await context.env.DB.prepare(
    `SELECT id FROM tournament_games
     WHERE tournament_id = ? AND round = ? AND section = ? LIMIT 1`,
  )
    .bind(tournamentId, body.round, body.section)
    .first()

  if (existingRound) {
    return errorResponse(
      'Pairings already exist for this round and section. Delete them first or choose the next round.',
      409,
    )
  }

  if (body.round > 1) {
    const priorRound = body.round - 1
    const pendingPrior = await context.env.DB.prepare(
      `SELECT id FROM tournament_games
       WHERE tournament_id = ? AND round = ? AND section = ? AND result = 'pending' LIMIT 1`,
    )
      .bind(tournamentId, priorRound, body.section)
      .first()

    if (pendingPrior) {
      return errorResponse(
        `Enter all results for round ${priorRound} before generating round ${body.round}.`,
        400,
      )
    }
  }

  const roster = await context.env.DB.prepare(
    `SELECT r.member_id, m.uscf_rating, m.full_name
     FROM registrations r
     JOIN members m ON m.id = r.member_id
     WHERE r.tournament_id = ? AND r.section = ?
     ORDER BY COALESCE(m.uscf_rating, 0) DESC`,
  )
    .bind(tournamentId, body.section)
    .all<{ member_id: string; uscf_rating: number | null; full_name: string }>()

  const players: PairingPlayerInput[] = (roster.results ?? []).map((row) => ({
    id: row.member_id,
    rating: row.uscf_rating ?? 1200,
    name: row.full_name,
  }))

  if (players.length === 0) {
    return errorResponse('No registered players in this section', 400)
  }

  const priorGames = await context.env.DB.prepare(
    `SELECT white_member_id, black_member_id, result
     FROM tournament_games
     WHERE tournament_id = ? AND section = ? AND round < ?`,
  )
    .bind(tournamentId, body.section, body.round)
    .all<{ white_member_id: string; black_member_id: string | null; result: string }>()

  const pastGames: PastGameInput[] = (priorGames.results ?? []).map((game) => ({
    whiteId: game.white_member_id,
    blackId: game.black_member_id,
    result: game.result as PastGameInput['result'],
  }))

  const pairings = generateDutchPairings(players, pastGames, body.round)

  const created: unknown[] = []
  const suffix = Date.now().toString(36)

  for (const pairing of pairings) {
    const id = `game-${tournamentId}-r${body.round}-b${pairing.board}-${suffix}`
    await context.env.DB.prepare(
      `INSERT INTO tournament_games (
        id, tournament_id, round, board, section,
        white_member_id, black_member_id, result
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        id,
        tournamentId,
        body.round,
        pairing.board,
        body.section,
        pairing.whiteId,
        pairing.blackId,
        pairing.blackId ? 'pending' : 'bye',
      )
      .run()

    const game = await context.env.DB.prepare(
      'SELECT * FROM tournament_games WHERE id = ?',
    )
      .bind(id)
      .first()

    if (game) created.push(game)
  }

  return jsonResponse(
    {
      round: body.round,
      section: body.section,
      pairings: created,
      count: created.length,
    },
    201,
  )
}
