// functions/api/admin/tournaments/[id]/generate-pairings.ts
import type { Env } from '../../../../types'
import { isResponse, requireTournamentManager } from '../../../../utils/auth'
import { generateDutchPairings } from '../../../../utils/pairing'
import type { PastGameInput, PairingPlayerInput } from '../../../../utils/pairing'
import {
  errorResponse,
  handleOptions,
  jsonResponse,
  parseJsonBody,
} from '../../../../utils/response'

interface GenerateBody {
  round?: number
  section?: string
  onlyCheckedIn?: boolean
}

function parseByes(raw: string | null): number[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
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
    `SELECT r.member_id, r.bye_rounds, r.checked_in_at, m.uscf_rating, m.full_name
     FROM registrations r
     JOIN members m ON m.id = r.member_id
     WHERE r.tournament_id = ? AND r.section = ? AND r.withdrawn_at IS NULL
     ORDER BY COALESCE(m.uscf_rating, 0) DESC`,
  )
    .bind(tournamentId, body.section)
    .all<{
      member_id: string
      bye_rounds: string | null
      checked_in_at: string | null
      uscf_rating: number | null
      full_name: string
    }>()

  const allRows = roster.results ?? []
  if (allRows.length === 0) {
    return errorResponse('No registered players in this section', 400)
  }

  // Players who requested a bye for this round get a visible half-point row —
  // regardless of check-in status, since they told us in advance they'd be out.
  const byeRows = allRows.filter((row) =>
    parseByes(row.bye_rounds).includes(body.round!),
  )

  const activeRows = allRows.filter((row) => {
    if (parseByes(row.bye_rounds).includes(body.round!)) return false
    if (body.onlyCheckedIn && !row.checked_in_at) return false
    return true
  })

  const players: PairingPlayerInput[] = activeRows.map((row) => ({
    id: row.member_id,
    rating: row.uscf_rating ?? 1200,
    name: row.full_name,
  }))

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

  const pairings = players.length > 0
    ? generateDutchPairings(players, pastGames, body.round)
    : []

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

  // Requested half-point byes: visible rows, boards after the real games
  const maxBoard = pairings.reduce((max, p) => Math.max(max, p.board), 0)
  let byeBoard = maxBoard

  for (const row of byeRows) {
    byeBoard += 1
    const id = `game-${tournamentId}-r${body.round}-b${byeBoard}-${suffix}`
    await context.env.DB.prepare(
      `INSERT INTO tournament_games (
        id, tournament_id, round, board, section,
        white_member_id, black_member_id, result
      ) VALUES (?, ?, ?, ?, ?, ?, NULL, 'bye-half')`,
    )
      .bind(id, tournamentId, body.round, byeBoard, body.section, row.member_id)
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
