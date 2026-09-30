// functions/utils/tournament-manage.ts
import type { GameResult } from './swiss/engine'
import { computeStandings as standingsFor, type Tiebreaks } from './swiss/tiebreaks'

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
  rating: number | null
  score: number
  wins: number
  draws: number
  losses: number
  /** Place within the section; tied players share it (see placeLabel). */
  place: number
  placeLabel: string
  tiebreaks: Tiebreaks
}

/**
 * Standings per section, ordered by score then US Chess tiebreaks
 * (utils/swiss/tiebreaks). Withdrawn players are included: their played
 * results stand.
 */
export function computeStandings(
  games: GameRow[],
  roster: Array<{
    member_id: string
    full_name: string
    section: string
    rating_at_entry?: number | null
    uscf_rating?: number | null
  }>,
  totalRounds?: number,
): StandingRow[] {
  const sections = [...new Set(roster.map((r) => r.section))]
  const out: StandingRow[] = []
  for (const section of sections) {
    const players = roster.filter((r) => r.section === section)
    const ids = new Set(players.map((p) => p.member_id))
    const sectionGames = games
      .filter((g) => g.section === section && g.white_member_id && ids.has(g.white_member_id))
      .map((g) => ({
        round: g.round,
        whiteId: g.white_member_id as string,
        blackId: g.black_member_id,
        result: g.result as GameResult,
      }))
    const rows = standingsFor(
      players.map((p) => ({ id: p.member_id, name: p.full_name, rating: p.rating_at_entry ?? p.uscf_rating ?? null })),
      sectionGames,
      totalRounds,
    )
    for (const r of rows) {
      out.push({
        member_id: r.id,
        full_name: r.name,
        section,
        rating: r.rating,
        score: r.score,
        wins: r.wins,
        draws: r.draws,
        losses: r.losses,
        place: r.place,
        placeLabel: r.placeLabel,
        tiebreaks: {
          modifiedMedian: r.modifiedMedian,
          solkoff: r.solkoff,
          cumulative: r.cumulative,
          oppCumulative: r.oppCumulative,
          blacks: r.blacks,
        },
      })
    }
  }
  return out
}

export function parseTournamentSections(sectionsJson: string): unknown[] {
  try {
    return JSON.parse(sectionsJson) as unknown[]
  } catch {
    return []
  }
}
