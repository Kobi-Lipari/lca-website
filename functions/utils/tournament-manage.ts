// functions/utils/tournament-manage.ts
import type { GameResult } from './swiss/engine'
import { computeStandings as standingsFor, type Tiebreaks } from './swiss/tiebreaks'
import { awardPrizes, type PrizeAward, type SectionPrizes } from './prizes'
import { parseGradeRange, type GradeRange } from './sectionRules'

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

/**
 * Prize winners for a tournament, from the prizes the director set on each
 * section. `sections` are the tournament's sections as an answer gives them
 * (sectionResponse in utils/events/sectionsRepo.ts, read from
 * tournament_sections). Grades are looked up here rather than carried on
 * the standings, so the public standings never expose a child's grade.
 */
export async function tournamentPrizes(
  db: D1Database,
  tournamentId: string,
  sections: ReadonlyArray<{ name: string; prizes?: unknown }>,
  standings: Array<{ member_id: string; section: string; score: number; rating: number | null }>,
): Promise<PrizeAward[]> {
  const withPrizes = sections
    .filter((s): s is { name: string; prizes: SectionPrizes } => !!s.name && typeof s.prizes === 'object' && s.prizes !== null)
  if (withPrizes.length === 0 || standings.length === 0) return []
  const needsGrades = withPrizes.some((s) => s.prizes.classes?.some((c) => c.gradeMin != null || c.gradeMax != null))
  const grades = new Map<string, GradeRange | null>()
  if (needsGrades) {
    const { results } = await db.prepare(
      `SELECT member_id, grade FROM registrations WHERE tournament_id = ?`,
    ).bind(tournamentId).all<{ member_id: string; grade: string | null }>()
    for (const r of results ?? []) grades.set(r.member_id, parseGradeRange(r.grade))
  }
  return awardPrizes(withPrizes, standings.map((s) => ({ ...s, gradeRange: grades.get(s.member_id) ?? null })))
}
