// functions/utils/pairing/tiebreakers.ts

import type { PastGameInput, PlayerState } from './types'
import { whitePoints, blackPoints } from './result-points'

interface ScoreMap {
  scores: Map<string, number>
  opponents: Map<string, Set<string>>
}

function buildScoreMap(
  playerIds: string[],
  games: PastGameInput[],
): ScoreMap {
  const scores = new Map<string, number>()
  const opponents = new Map<string, Set<string>>()

  for (const id of playerIds) {
    scores.set(id, 0)
    opponents.set(id, new Set())
  }

  for (const game of games) {
    if (game.result === 'pending') continue

    const white = game.whiteId
    const whiteKnown = scores.has(white)

    // Bye rows (full or half): white side is the recipient.
    if (!game.blackId) {
      if (whiteKnown) {
        scores.set(white, (scores.get(white) ?? 0) + whitePoints(game.result))
      }
      continue
    }

    const black = game.blackId
    const blackKnown = scores.has(black)

    if (whiteKnown && blackKnown) {
      opponents.get(white)?.add(black)
      opponents.get(black)?.add(white)
    }

    // A present player scores even if the opponent is absent from the
    // current roster (withdrawn, non-roster manual pairing).
    if (whiteKnown) {
      scores.set(white, (scores.get(white) ?? 0) + whitePoints(game.result))
    }
    if (blackKnown) {
      scores.set(black, (scores.get(black) ?? 0) + blackPoints(game.result))
    }
  }

  return { scores, opponents }
}

/** Buchholz: sum of opponents' scores (FIDE C.13.2.1) */
export function computeBuchholz(
  playerId: string,
  scores: Map<string, number>,
  opponents: Map<string, Set<string>>,
): number {
  let total = 0
  for (const opp of opponents.get(playerId) ?? []) {
    total += scores.get(opp) ?? 0
  }
  return total
}

/** Progressive (cumulative) score tiebreak */
export function computeProgressive(
  playerId: string,
  games: PastGameInput[],
): number {
  let cumulative = 0
  let running = 0
  const playerGames = games.filter(
    (g) =>
      g.result !== 'pending' &&
      (g.whiteId === playerId || g.blackId === playerId),
  )

  for (const game of playerGames) {
    if (game.whiteId === playerId) running += whitePoints(game.result)
    else if (game.blackId === playerId) running += blackPoints(game.result)
    cumulative += running
  }

  return cumulative
}

/** Direct encounter among tied players (FIDE C.13.2.5) */
export function computeDirectEncounter(
  playerId: string,
  tiedPlayerIds: string[],
  games: PastGameInput[],
): number {
  if (tiedPlayerIds.length <= 1) return 0

  let points = 0
  for (const game of games) {
    if (game.result === 'pending' || !game.blackId) continue
    const inTie =
      tiedPlayerIds.includes(game.whiteId) &&
      tiedPlayerIds.includes(game.blackId)
    if (!inTie) continue

    if (game.whiteId === playerId) points += whitePoints(game.result)
    else if (game.blackId === playerId) points += blackPoints(game.result)
  }

  return points
}

export function applyTiebreakers(
  players: PlayerState[],
  games: PastGameInput[],
): PlayerState[] {
  const ids = players.map((p) => p.id)
  const { scores, opponents } = buildScoreMap(ids, games)

  const scoreGroups = new Map<number, string[]>()
  for (const p of players) {
    const list = scoreGroups.get(p.score) ?? []
    list.push(p.id)
    scoreGroups.set(p.score, list)
  }

  return players.map((p) => {
    const tied = scoreGroups.get(p.score) ?? [p.id]
    return {
      ...p,
      buchholz: computeBuchholz(p.id, scores, opponents),
      progressive: computeProgressive(p.id, games),
      directEncounter: computeDirectEncounter(p.id, tied, games),
    }
  })
}
