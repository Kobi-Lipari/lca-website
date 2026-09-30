// functions/utils/swiss/tiebreaks.ts
//
// Standings with US Chess tiebreaks (Rule 34E), in the rulebook's order:
//   1. Modified Median   2. Solkoff   3. Cumulative   4. Opponents' Cumulative
// and, when everything is still equal, 5. most games with Black.
//
// Conventions (the US Chess defaults SwissSys and WinTD also use):
// - Opponents' scores are "adjusted": their unplayed games (byes, forfeits)
//   count as draws.
// - A player's own unplayed rounds contribute no opponent.
// - Modified Median drops the lowest opponent for a plus score, the highest
//   for a minus score, both for an even score; two each way from 9 rounds.
// - Cumulative subtracts one point for each unplayed win.

import type { GameResult, SwissGame } from './engine'

export interface StandingsPlayer {
  id: string
  name: string
  rating: number | null
}

export interface Tiebreaks {
  modifiedMedian: number
  solkoff: number
  cumulative: number
  oppCumulative: number
  blacks: number
}

export interface StandingRow extends Tiebreaks {
  id: string
  name: string
  rating: number | null
  score: number
  wins: number
  draws: number
  losses: number
  /** 1-based place; players tied on score and every tiebreak share it. */
  place: number
  /** "3" or "3-5" for a shared place. */
  placeLabel: string
}

const WIN = new Set<GameResult>(['1-0', '1-0 F'])
const LOSS = new Set<GameResult>(['0-1', '0-1 F'])

function points(result: GameResult, side: 'white' | 'black'): number {
  if (result === '1/2-1/2') return 0.5
  if (result === 'bye') return side === 'white' ? 1 : 0
  if (result === 'bye-half') return side === 'white' ? 0.5 : 0
  if (WIN.has(result)) return side === 'white' ? 1 : 0
  if (LOSS.has(result)) return side === 'white' ? 0 : 1
  return 0
}

const isForfeit = (r: GameResult) => r === '1-0 F' || r === '0-1 F' || r === '0-0 F'

interface Round {
  round: number
  opponent: string | null
  points: number
  played: boolean
  color: 'white' | 'black' | null
}

export function computeStandings(
  players: StandingsPlayer[],
  games: Array<SwissGame & { round: number }>,
  totalRounds?: number,
): StandingRow[] {
  const rounds = new Map<string, Round[]>()
  for (const p of players) rounds.set(p.id, [])

  for (const g of games) {
    if (g.result === 'pending') continue
    const w = rounds.get(g.whiteId)
    if (!g.blackId) {
      w?.push({ round: g.round, opponent: null, points: points(g.result, 'white'), played: false, color: null })
      continue
    }
    const b = rounds.get(g.blackId)
    const played = !isForfeit(g.result)
    w?.push({ round: g.round, opponent: g.blackId, points: points(g.result, 'white'), played, color: played ? 'white' : null })
    b?.push({ round: g.round, opponent: g.whiteId, points: points(g.result, 'black'), played, color: played ? 'black' : null })
  }

  const score = new Map<string, number>()
  const adjusted = new Map<string, number>()
  const cumulative = new Map<string, number>()
  for (const [id, list] of rounds) {
    list.sort((a, b) => a.round - b.round)
    let total = 0
    let adj = 0
    let cum = 0
    for (const r of list) {
      total += r.points
      adj += r.played ? r.points : 0.5
      cum += total
      if (!r.played && r.points === 1) cum -= 1
    }
    score.set(id, total)
    adjusted.set(id, adj)
    cumulative.set(id, cum)
  }

  const played = Math.max(totalRounds ?? 0, ...[...rounds.values()].map((l) => l.length))

  const rows: StandingRow[] = players.map((p) => {
    const list = rounds.get(p.id) ?? []
    const opps = list.filter((r) => r.opponent && r.played).map((r) => r.opponent as string)
    const oppScores = opps.map((o) => adjusted.get(o) ?? 0).sort((a, b) => a - b)
    const solkoff = oppScores.reduce((s, x) => s + x, 0)

    const own = score.get(p.id) ?? 0
    const half = played / 2
    const cut = played >= 9 ? 2 : 1
    let trimmed = [...oppScores]
    if (own > half) trimmed = trimmed.slice(cut)
    else if (own < half) trimmed = trimmed.slice(0, Math.max(0, trimmed.length - cut))
    else trimmed = trimmed.slice(cut, Math.max(cut, trimmed.length - cut))
    const modifiedMedian = trimmed.reduce((s, x) => s + x, 0)

    const oppCumulative = opps.reduce((s, o) => s + (cumulative.get(o) ?? 0), 0)

    return {
      id: p.id,
      name: p.name,
      rating: p.rating,
      score: own,
      wins: list.filter((r) => r.opponent && r.points === 1).length,
      draws: list.filter((r) => r.opponent && r.points === 0.5).length,
      losses: list.filter((r) => r.opponent && r.points === 0).length,
      modifiedMedian,
      solkoff,
      cumulative: cumulative.get(p.id) ?? 0,
      oppCumulative,
      blacks: list.filter((r) => r.color === 'black').length,
      place: 0,
      placeLabel: '',
    }
  })

  const key = (r: StandingRow) => [r.score, r.modifiedMedian, r.solkoff, r.cumulative, r.oppCumulative, r.blacks]
  rows.sort((a, b) => {
    const ka = key(a)
    const kb = key(b)
    for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return kb[i] - ka[i]
    return (b.rating ?? 0) - (a.rating ?? 0) || a.name.localeCompare(b.name)
  })

  // Shared places for rows equal on score and every tiebreak.
  let i = 0
  while (i < rows.length) {
    let j = i
    const k = key(rows[i]).join(',')
    while (j + 1 < rows.length && key(rows[j + 1]).join(',') === k) j++
    for (let x = i; x <= j; x++) {
      rows[x].place = i + 1
      rows[x].placeLabel = i === j ? String(i + 1) : `${i + 1}-${j + 1}`
    }
    i = j + 1
  }
  return rows
}
