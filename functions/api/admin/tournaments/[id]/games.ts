// functions/api/admin/tournaments/[id]/games.ts
//
// Manual pairings: the director sets or changes a board by hand (swap
// colors, fix a pairing, add a late entrant). The director has the final
// say, but the obvious mistakes are caught: players must be in the section
// and not withdrawn, can't play themselves, can't be on two boards, and a
// board with a result on it isn't overwritten without confirmation.
// Rematches are allowed but reported.
import type { Env } from '../../../../types'
import { isResponse, requireTournamentManager } from '../../../../utils/auth'
import { recordAdminAction } from '../../../../utils/audit'
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
  /** Replace boards that already have a result. */
  confirmReplace?: boolean
}

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const tournamentId = context.params.id as string
  const authResult = await requireTournamentManager(context.request, context.env, tournamentId)
  if (isResponse(authResult)) return authResult

  const body = await parseJsonBody<GamesBody>(context.request)
  if (!body?.round || !body.section || !body.pairings?.length) {
    return errorResponse('round, section, and pairings are required', 400)
  }
  const { round, section } = body
  const db = context.env.DB

  const roster = await db.prepare(
    `SELECT r.member_id, m.full_name FROM registrations r JOIN members m ON m.id = r.member_id
      WHERE r.tournament_id = ? AND r.section = ? AND r.withdrawn_at IS NULL`,
  ).bind(tournamentId, section).all<{ member_id: string; full_name: string }>()
  const names = new Map((roster.results ?? []).map((r) => [r.member_id, r.full_name]))
  const nameOf = (id: string) => names.get(id) ?? 'That player'

  const existing = await db.prepare(
    `SELECT id, board, white_member_id, black_member_id, result FROM tournament_games
      WHERE tournament_id = ? AND section = ? AND round = ?`,
  ).bind(tournamentId, section, round).all<{ id: string; board: number; white_member_id: string | null; black_member_id: string | null; result: string }>()
  const current = existing.results ?? []

  const boardsBeingSet = new Set<number>()
  const placed = new Map<string, number>()
  for (const [i, p] of body.pairings.entries()) {
    const board = p.board ?? i + 1
    boardsBeingSet.add(board)
    const ids = [p.whiteMemberId, p.blackMemberId].filter((x): x is string => !!x)
    if (ids.length === 0) return errorResponse(`Board ${board} needs at least one player.`, 400)
    if (p.whiteMemberId && p.whiteMemberId === p.blackMemberId) {
      return errorResponse(`A player can't play themselves (board ${board}).`, 400)
    }
    for (const id of ids) {
      if (!names.has(id)) return errorResponse(`${nameOf(id)} isn't an active player in ${section}.`, 400)
      if (placed.has(id)) return errorResponse(`${nameOf(id)} is on two boards (${placed.get(id)} and ${board}).`, 400)
      placed.set(id, board)
    }
  }
  // Players already on another board of this round that isn't being replaced.
  for (const g of current) {
    if (boardsBeingSet.has(g.board)) continue
    for (const id of [g.white_member_id, g.black_member_id]) {
      if (id && placed.has(id)) {
        return errorResponse(`${nameOf(id)} is already paired on board ${g.board} this round. Change that board too.`, 400)
      }
    }
  }
  const withResults = current.filter((g) => boardsBeingSet.has(g.board) && g.result !== 'pending' && g.black_member_id)
  if (withResults.length > 0 && !body.confirmReplace) {
    return jsonResponse({
      error: `Board ${withResults.map((g) => g.board).join(', ')} already has a result. Confirm to replace it; the result will be cleared.`,
      needsConfirm: true,
    }, 409)
  }

  const prior = await db.prepare(
    `SELECT white_member_id, black_member_id FROM tournament_games
      WHERE tournament_id = ? AND section = ? AND round < ? AND black_member_id IS NOT NULL`,
  ).bind(tournamentId, section, round).all<{ white_member_id: string; black_member_id: string }>()
  const met = new Set((prior.results ?? []).map((g) => [g.white_member_id, g.black_member_id].sort().join('|')))

  const warnings: string[] = []
  const statements: D1PreparedStatement[] = []
  const suffix = Date.now().toString(36)
  for (const [i, p] of body.pairings.entries()) {
    const board = p.board ?? i + 1
    const white = p.whiteMemberId ?? null
    const black = p.blackMemberId ?? null
    if (white && black && met.has([white, black].sort().join('|'))) {
      warnings.push(`Board ${board}: ${nameOf(white)} and ${nameOf(black)} have already played each other.`)
    }
    // A board with one player is a full-point bye.
    const [w, b] = white ? [white, black] : [black, null]
    statements.push(db.prepare(
      `INSERT INTO tournament_games (id, tournament_id, round, board, section, white_member_id, black_member_id, result)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(tournament_id, round, board, section) DO UPDATE SET
         white_member_id = excluded.white_member_id,
         black_member_id = excluded.black_member_id,
         result = excluded.result`,
    ).bind(`game-${tournamentId}-r${round}-b${board}-${suffix}`, tournamentId, round, board, section, w, b, b ? 'pending' : 'bye'))
  }
  await db.batch(statements)

  const t = await db.prepare('SELECT name FROM tournaments WHERE id = ?').bind(tournamentId).first<{ name: string }>()
  await recordAdminAction(db, authResult.member, {
    action: 'pairing_edit',
    targetLabel: t?.name ?? tournamentId,
    detail: { tournament_id: tournamentId, round, section, boards: [...boardsBeingSet] },
  })

  const games = await db.prepare(
    `SELECT * FROM tournament_games WHERE tournament_id = ? AND section = ? AND round = ? ORDER BY board`,
  ).bind(tournamentId, section, round).all()

  return jsonResponse({ games: games.results ?? [], warnings }, 201)
}
