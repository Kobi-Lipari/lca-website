import type { GameResult, PastGameInput, PlayerState } from './types'

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
    if (!scores.has(white)) continue

    if (!game.blackId || game.result === 'bye') {
      scores.set(white, (scores.get(white) ?? 0) + 1)
      continue
    }

    const black = game.blackId
    if (!scores.has(black)) continue

    opponents.get(white)?.add(black)
    opponents.get(black)?.add(white)

    const result = game.result as GameResult
    if (result === '1-0') {
      scores.set(white, (scores.get(white) ?? 0) + 1)
    } else if (result === '0-1') {
      scores.set(black, (scores.get(black) ?? 0) + 1)
    } else if (result === '1/2-1/2') {
      scores.set(white, (scores.get(white) ?? 0) + 0.5)
      scores.set(black, (scores.get(black) ?? 0) + 0.5)
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

/** Progressive / Sonneborn-Berger style cumulative score (FIDE C.13.2.2 variant) */
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
    if (game.result === 'bye' && game.whiteId === playerId) {
      running += 1
    } else if (game.blackId === playerId) {
      if (game.result === '0-1') running += 1
      else if (game.result === '1/2-1/2') running += 0.5
    } else if (game.whiteId === playerId) {
      if (game.result === '1-0') running += 1
      else if (game.result === '1/2-1/2') running += 0.5
    }
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

    if (game.whiteId === playerId) {
      if (game.result === '1-0') points += 1
      else if (game.result === '1/2-1/2') points += 0.5
    } else if (game.blackId === playerId) {
      if (game.result === '0-1') points += 1
      else if (game.result === '1/2-1/2') points += 0.5
    }
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
