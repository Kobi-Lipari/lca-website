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
    if (game.result === 'pending') continue

    const white = game.white_member_id
      ? standings.get(game.white_member_id)
      : undefined
    const black = game.black_member_id
      ? standings.get(game.black_member_id)
      : undefined

    if (game.result === 'bye') {
      const player = white ?? black
      if (player) {
        player.score += 1
        player.wins += 1
      }
      continue
    }

    if (game.result === '1-0') {
      if (white) {
        white.score += 1
        white.wins += 1
      }
      if (black) {
        black.losses += 1
      }
    } else if (game.result === '0-1') {
      if (black) {
        black.score += 1
        black.wins += 1
      }
      if (white) {
        white.losses += 1
      }
    } else if (game.result === '1/2-1/2') {
      if (white) {
        white.score += 0.5
        white.draws += 1
      }
      if (black) {
        black.score += 0.5
        black.draws += 1
      }
    }
  }

  return [...standings.values()].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
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
