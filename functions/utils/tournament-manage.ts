// functions/utils/tournament-manage.ts
import { whitePoints, blackPoints } from './pairing'
import type { GameResult } from './pairing'

interface GameRow {
  id: string
  tournament_id: string
  round: number
  board: number
  section: string
  white_member_id: string | null
  black_member_id: string | null
  result: string
  white_name?: string
  black_name?: string
}

interface StandingRow {
  member_id: string
  full_name: string
  section: string
  score: number
  wins: number
  draws: number
  losses: number
}

export function computeStandings(
  games: GameRow[],
  roster: Array<{ member_id: string; full_name: string; section: string }>,
): StandingRow[] {
  const standings = new Map<string, StandingRow>()

  for (const player of roster) {
    standings.set(player.member_id, {
      member_id: player.member_id,
      full_name: player.full_name,
      section: player.section,
      score: 0,
      wins: 0,
      draws: 0,
      losses: 0,
    })
  }

  for (const game of games) {
    if (!game.result || game.result === 'pending') continue
    const result = game.result as GameResult

    const white = game.white_member_id
      ? standings.get(game.white_member_id)
      : undefined
    const black = game.black_member_id
      ? standings.get(game.black_member_id)
      : undefined

    // Points: single source of truth, shared with the pairing engine.
    // Unknown result strings fall through every branch to zero effect.
    if (white) white.score += whitePoints(result)
    if (black) black.score += blackPoints(result)

    // W/D/L tallies (byes are neither wins nor losses)
    if (result === '1-0' || result === '1-0 F') {
      if (white) white.wins += 1
      if (black) black.losses += 1
    } else if (result === '0-1' || result === '0-1 F') {
      if (black) black.wins += 1
      if (white) white.losses += 1
    } else if (result === '1/2-1/2') {
      if (white) white.draws += 1
      if (black) black.draws += 1
    } else if (result === '0-0 F') {
      if (white) white.losses += 1
      if (black) black.losses += 1
    }
  }

  return [...standings.values()].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    if (b.wins !== a.wins) return b.wins - a.wins
    return a.full_name.localeCompare(b.full_name)
  })
}

export function parseTournamentSections(sectionsJson: string): unknown[] {
  try {
    return JSON.parse(sectionsJson) as unknown[]
  } catch {
    return []
  }
}
