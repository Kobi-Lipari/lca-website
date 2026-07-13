// functions/utils/pairing/score-groups.ts

import { pairScoreGroupPool } from './blossom'
import type { GeneratedPairing, PlayerState } from './types'

/** FIDE C.04.1.2 — upper half S1, lower half S2 (extra player in S2 if odd) */
export function splitS1S2(pool: PlayerState[]): {
  s1: PlayerState[]
  s2: PlayerState[]
  s1Size: number
} {
  const s1Size = Math.ceil(pool.length / 2)
  return {
    s1: pool.slice(0, s1Size),
    s2: pool.slice(s1Size),
    s1Size,
  }
}

/** Lowest-ranked player in S2 becomes downfloater (C.04.1.2) */
export function selectDownfloater(pool: PlayerState[]): PlayerState {
  const { s2 } = splitS1S2(pool)
  return s2[s2.length - 1]
}

/** C.04 — bye goes to the LOWEST-ranked player without a prior unplayed win */
export function selectByePlayer(pool: PlayerState[]): PlayerState {
  const withoutUnplayedWin = pool.filter((p) => !p.hadUnplayedWin)
  const candidates = withoutUnplayedWin.length > 0 ? withoutUnplayedWin : pool
  return [...candidates].sort(
    (a, b) => b.rank - a.rank || a.rating - b.rating || a.id.localeCompare(b.id),
  )[0]
}

export function groupByScore(
  players: PlayerState[],
): Array<{ score: number; players: PlayerState[] }> {
  const groups: Array<{ score: number; players: PlayerState[] }> = []
  let currentScore: number | null = null
  let current: PlayerState[] = []

  for (const player of players) {
    if (currentScore === null || player.score !== currentScore) {
      if (current.length > 0) groups.push({ score: currentScore!, players: current })
      currentScore = player.score
      current = [player]
    } else {
      current.push(player)
    }
  }
  if (current.length > 0 && currentScore !== null) {
    groups.push({ score: currentScore, players: current })
  }
  return groups
}

/**
 * Build homogeneous pool with incoming downfloaters at the bottom of S1
 * (FIDE C.04.1.2).
 */
export function buildHomogeneousPool(
  bracketPlayers: PlayerState[],
  downfloaters: PlayerState[],
): PlayerState[] {
  if (downfloaters.length === 0) return [...bracketPlayers]

  const s1Size = Math.ceil((bracketPlayers.length + downfloaters.length) / 2)
  const s1MainCount = s1Size - downfloaters.length
  const s1Main = bracketPlayers.slice(0, s1MainCount)
  const s2 = bracketPlayers.slice(s1MainCount)
  return [...s1Main, ...downfloaters, ...s2]
}

export function pairAllBrackets(
  scoreGroups: Array<{ score: number; players: PlayerState[] }>,
): {
  pairings: Array<{ white: PlayerState; black: PlayerState }>
  byes: PlayerState[]
} {
  const allPairings: Array<{ white: PlayerState; black: PlayerState }> = []
  const byes: PlayerState[] = []
  let downfloaters: PlayerState[] = []

  for (let g = 0; g < scoreGroups.length; g++) {
    const isLast = g === scoreGroups.length - 1
    let pool = buildHomogeneousPool(scoreGroups[g].players, downfloaters)
    downfloaters = []

    while (pool.length % 2 === 1 && !isLast) {
      const floater = selectDownfloater(pool)
      pool = pool.filter((p) => p.id !== floater.id)
      downfloaters.push(floater)
    }

    if (pool.length % 2 === 1 && isLast) {
      const bye = selectByePlayer(pool)
      pool = pool.filter((p) => p.id !== bye.id)
      byes.push(bye)
    }

    if (pool.length > 0) {
      const { s1Size } = splitS1S2(pool)
      allPairings.push(...pairScoreGroupPool(pool, s1Size))
    }
  }

  return { pairings: allPairings, byes }
}

export function toGeneratedPairings(
  pairings: Array<{ white: PlayerState; black: PlayerState }>,
  byes: PlayerState[],
): GeneratedPairing[] {
  const result: GeneratedPairing[] = []

  // Real games first — byes go on the last boards, matching wall-chart convention.
  for (const { white, black } of pairings) {
    result.push({
      board: 0,
      whiteId: white.id,
      blackId: black.id,
    })
  }

  for (const bye of byes) {
    result.push({
      board: 0,
      whiteId: bye.id,
      blackId: null,
      isBye: true,
    })
  }

  return result.map((p, index) => ({ ...p, board: index + 1 }))
}
