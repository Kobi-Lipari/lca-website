import { assignColors, colorViolationCost } from './colors'
import type { PlayerState } from './types'

const FORBIDDEN = Number.POSITIVE_INFINITY
const BASE_WEIGHT = 1_000_000

/**
 * Maximum-weight perfect matching on a bipartite graph (S1 × S2).
 * FIDE Dutch pairing only allows S1-vs-S2 edges; this weighted assignment
 * is the bipartite case of Edmonds' blossom algorithm.
 */
export function maxWeightBipartiteMatching(
  s1Count: number,
  s2Count: number,
  weight: (i: number, j: number) => number,
): Array<[number, number]> {
  const n = Math.max(s1Count, s2Count)
  const u = new Array(n + 1).fill(0)
  const v = new Array(n + 1).fill(0)
  const p = new Array(n + 1).fill(0)
  const way = new Array(n + 1).fill(0)

  const cost = (i: number, j: number): number => {
    const w = weight(i, j)
    if (!Number.isFinite(w) || w <= -BASE_WEIGHT / 2) return FORBIDDEN
    return BASE_WEIGHT - w
  }

  for (let i = 1; i <= s1Count; i++) {
    p[0] = i
    let j0 = 0
    const minv = new Array(n + 1).fill(FORBIDDEN)
    const used = new Array(n + 1).fill(false)

    do {
      used[j0] = true
      const i0 = p[j0]
      let delta = FORBIDDEN
      let j1 = 0

      for (let j = 1; j <= s2Count; j++) {
        if (used[j]) continue
        const cur = cost(i0 - 1, j - 1) - u[i0] - v[j]
        if (cur < minv[j]) {
          minv[j] = cur
          way[j] = j0
        }
        if (minv[j] < delta) {
          delta = minv[j]
          j1 = j
        }
      }

      for (let j = 0; j <= n; j++) {
        if (used[j]) {
          u[p[j]] += delta
          v[j] -= delta
        } else {
          minv[j] -= delta
        }
      }

      j0 = j1
    } while (p[j0] !== 0)

    do {
      const j1 = way[j0]
      p[j0] = p[j1]
      j0 = j1
    } while (j0 !== 0)
  }

  const pairs: Array<[number, number]> = []
  for (let j = 1; j <= s2Count; j++) {
    if (p[j] > 0) pairs.push([p[j] - 1, j - 1])
  }
  return pairs
}

export function pairScoreGroupPool(
  pool: PlayerState[],
  s1Size: number,
): Array<{ white: PlayerState; black: PlayerState }> {
  const s1 = pool.slice(0, s1Size)
  const s2 = pool.slice(s1Size)

  const pairs = maxWeightBipartiteMatching(
    s1.length,
    s2.length,
    (i, j) => pairingEdgeWeight(s1[i], s2[j], i, j),
  )

  const result: Array<{ white: PlayerState; black: PlayerState }> = []
  for (const [i, j] of pairs) {
    const a = s1[i]
    const b = s2[j]
    const colors = assignColors(a, b)
    if (!colors) {
      throw new Error(
        `Color conflict: cannot pair ${a.id} and ${b.id} in score group`,
      )
    }
    result.push(colors)
  }
  return result
}

export function pairingEdgeWeight(
  a: PlayerState,
  b: PlayerState,
  s1Index: number,
  s2Index: number,
): number {
  if (a.opponents.has(b.id)) return Number.NEGATIVE_INFINITY

  const colors = assignColors(a, b)
  if (!colors) return Number.NEGATIVE_INFINITY

  let w = BASE_WEIGHT

  const rankDiff = Math.abs(s1Index - s2Index)
  w -= rankDiff * 10_000
  w -= Math.abs(a.rating - b.rating)

  const white = colors.white
  const black = colors.black
  w -= colorViolationCost(white, 'white')
  w -= colorViolationCost(black, 'black')

  return w
}

export function buildWeightMatrix(
  s1: PlayerState[],
  s2: PlayerState[],
): number[][] {
  return s1.map((a, i) =>
    s2.map((b, j) => pairingEdgeWeight(a, b, i, j)),
  )
}
