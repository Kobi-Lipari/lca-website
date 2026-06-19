import { describe, expect, it } from 'vitest'
import {
  buildWeightMatrix,
  maxWeightBipartiteMatching,
  pairingEdgeWeight,
} from './blossom'
import type { PlayerState } from './types'

function player(id: string, rank: number, rating: number): PlayerState {
  return {
    id,
    rating,
    score: 1,
    colorHistory: [],
    colorBalance: 0,
    opponents: new Set(),
    hadBye: false,
    buchholz: 0,
    progressive: 0,
    directEncounter: 0,
    rank,
  }
}

describe('blossom / weighted bipartite matching', () => {
  it('prefers diagonal S1/S2 pairings', () => {
    const s1 = [player('1', 1, 2600), player('2', 2, 2500)]
    const s2 = [player('5', 5, 2200), player('6', 6, 2100)]

    const matrix = buildWeightMatrix(s1, s2)
    expect(matrix[0][0]).toBeGreaterThan(matrix[0][1])
    expect(matrix[1][1]).toBeGreaterThan(matrix[1][0])

    const pairs = maxWeightBipartiteMatching(2, 2, (i, j) => matrix[i][j])
    expect(pairs).toEqual([
      [0, 0],
      [1, 1],
    ])
  })

  it('forbids rematches', () => {
    const a = player('a', 1, 2000)
    const b = player('b', 2, 1900)
    a.opponents.add('b')
    b.opponents.add('a')
    expect(pairingEdgeWeight(a, b, 0, 0)).toBe(Number.NEGATIVE_INFINITY)
  })
})
