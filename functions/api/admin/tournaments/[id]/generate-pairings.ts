// functions/api/admin/tournaments/[id]/generate-pairings.ts
//
// Pairs the next round of one section with the Swiss engine
// (utils/swiss/engine): US Chess rules unless the tournament is set to
// FIDE-style. Everything is written in one batch, so a failure leaves no
// half-paired round behind.
import type { Env } from '../../../../types'
import { isResponse, requireTournamentManager } from '../../../../utils/auth'
import { recordAdminAction } from '../../../../utils/audit'
import { pairRound, type PairingSystem, type SwissGame, type SwissPlayer } from '../../../../utils/swiss/engine'
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
  /** Round 1 coin toss: higher-rated player on board 1 gets White. Random if omitted. */
  firstBoardWhite?: boolean
  /** Pair a round beyond the advertised number of rounds (e.g. a playoff). */
  allowExtraRound?: boolean
}

function parseByes(raw: string | null): number[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((n) => typeof n === 'number') : []
  } catch {
    return []
  }
}

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const tournamentId = context.params.id as string
  const authResult = await requireTournamentManager(context.request, context.env, tournamentId)
  if (isResponse(authResult)) return authResult

  const body = await parseJsonBody<GenerateBody>(context.request)
  if (!body?.round || !body.section) {
    return errorResponse('round and section are required', 400)
  }
  const round = Math.floor(body.round)
  const section = body.section
  if (round < 1) return errorResponse('round must be at least 1', 400)

  const db = context.env.DB
  const tournament = await db.prepare('SELECT name, rounds, pairing_system FROM tournaments WHERE id = ?')
    .bind(tournamentId).first<{ name: string; rounds: number; pairing_system: string | null }>()
  if (!tournament) return errorResponse('Tournament not found', 404)

  if (round > tournament.rounds && !body.allowExtraRound) {
    return errorResponse(
      `This tournament has ${tournament.rounds} rounds. To pair round ${round} anyway (for a playoff), confirm the extra round.`,
      400,
    )
  }

  const latest = await db.prepare(
    `SELECT MAX(round) AS r FROM tournament_games WHERE tournament_id = ? AND section = ?`,
  ).bind(tournamentId, section).first<{ r: number | null }>()
  const lastRound = latest?.r ?? 0
  if (round <= lastRound) {
    return errorResponse(
      `Round ${round} is already paired for ${section}. Delete it first to re-pair, or pair round ${lastRound + 1}.`,
      409,
    )
  }
  if (round !== lastRound + 1) {
    return errorResponse(`Pair round ${lastRound + 1} of ${section} first.`, 400)
  }

  const pending = await db.prepare(
    `SELECT COUNT(*) AS n FROM tournament_games
      WHERE tournament_id = ? AND section = ? AND result = 'pending'`,
  ).bind(tournamentId, section).first<{ n: number }>()
  if ((pending?.n ?? 0) > 0) {
    return errorResponse(
      `Enter all results for round ${lastRound} (${pending?.n} still missing) before pairing round ${round}.`,
      400,
    )
  }

  const roster = await db.prepare(
    `SELECT r.member_id, r.bye_rounds, r.checked_in_at, r.rating_at_entry,
            m.uscf_rating, m.full_name
       FROM registrations r
       JOIN members m ON m.id = r.member_id
      WHERE r.tournament_id = ? AND r.section = ? AND r.withdrawn_at IS NULL`,
  ).bind(tournamentId, section).all<{
    member_id: string
    bye_rounds: string | null
    checked_in_at: string | null
    rating_at_entry: number | null
    uscf_rating: number | null
    full_name: string
  }>()

  const rows = roster.results ?? []
  if (rows.length === 0) return errorResponse('No registered players in this section', 400)

  const requestedBye = rows.filter((r) => parseByes(r.bye_rounds).includes(round))
  const notCheckedIn = body.onlyCheckedIn
    ? rows.filter((r) => !r.checked_in_at && !parseByes(r.bye_rounds).includes(round))
    : []
  const skip = new Set([...requestedBye, ...notCheckedIn].map((r) => r.member_id))
  const players: SwissPlayer[] = rows
    .filter((r) => !skip.has(r.member_id))
    .map((r) => ({ id: r.member_id, rating: r.rating_at_entry ?? r.uscf_rating ?? null, name: r.full_name }))

  const prior = await db.prepare(
    `SELECT white_member_id, black_member_id, result FROM tournament_games
      WHERE tournament_id = ? AND section = ? AND round < ?`,
  ).bind(tournamentId, section, round).all<{ white_member_id: string; black_member_id: string | null; result: string }>()
  const games: SwissGame[] = (prior.results ?? []).map((g) => ({
    whiteId: g.white_member_id,
    blackId: g.black_member_id,
    result: g.result as SwissGame['result'],
  }))

  const system: PairingSystem = tournament.pairing_system === 'fide' ? 'fide' : 'uscf'
  const firstBoardWhite = body.firstBoardWhite ?? Math.random() < 0.5
  const outcome = players.length > 0
    ? pairRound(players, games, round, { system, firstBoardWhite })
    : { pairings: [], warnings: [] }

  const suffix = Date.now().toString(36)
  const statements: D1PreparedStatement[] = []
  for (const p of outcome.pairings) {
    statements.push(db.prepare(
      `INSERT INTO tournament_games (id, tournament_id, round, board, section, white_member_id, black_member_id, result)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(`game-${tournamentId}-r${round}-b${p.board}-${suffix}`, tournamentId, round, p.board, section,
      p.whiteId, p.blackId, p.blackId ? 'pending' : 'bye'))
  }
  // Requested half-point byes: visible rows after the real boards.
  let board = outcome.pairings.length
  for (const r of requestedBye) {
    board += 1
    statements.push(db.prepare(
      `INSERT INTO tournament_games (id, tournament_id, round, board, section, white_member_id, black_member_id, result)
       VALUES (?, ?, ?, ?, ?, ?, NULL, 'bye-half')`,
    ).bind(`game-${tournamentId}-r${round}-b${board}-${suffix}`, tournamentId, round, board, section, r.member_id))
  }
  // The event is under way once anything is paired.
  statements.push(db.prepare(`UPDATE tournaments SET status = 'active' WHERE id = ? AND status = 'upcoming'`).bind(tournamentId))
  await db.batch(statements)

  const created = await db.prepare(
    `SELECT * FROM tournament_games WHERE tournament_id = ? AND section = ? AND round = ? ORDER BY board`,
  ).bind(tournamentId, section, round).all()

  await recordAdminAction(db, authResult.member, {
    action: 'round_paired',
    targetLabel: tournament.name,
    detail: { tournament_id: tournamentId, round, section, boards: outcome.pairings.length, system },
  })

  const warnings = [...outcome.warnings]
  if (notCheckedIn.length > 0) {
    warnings.push(`Not paired because they haven't checked in: ${notCheckedIn.map((r) => r.full_name).join(', ')}.`)
  }

  return jsonResponse(
    {
      round,
      section,
      pairings: created.results ?? [],
      count: (created.results ?? []).length,
      warnings,
    },
    201,
  )
}
