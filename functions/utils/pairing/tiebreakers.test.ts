import { describe, expect, it } from 'vitest'
import {
  computeBuchholz,
  computeDirectEncounter,
  computeProgressive,
} from './tiebreakers'
import type { PastGameInput } from './types'

describe('tiebreakers', () => {
  const games: PastGameInput[] = [
    { whiteId: 'a', blackId: 'b', result: '1-0' },
    { whiteId: 'c', blackId: 'd', result: '0-1' },
    { whiteId: 'a', blackId: 'c', result: '1/2-1/2' },
  ]

  it('computes Buchholz as sum of opponent scores', () => {
    const scores = new Map([
      ['a', 1.5],
      ['b', 0],
      ['c', 1.5],
      ['d', 1],
    ])
    const opponents = new Map([
      ['a', new Set(['b', 'c'])],
      ['b', new Set(['a'])],
      ['c', new Set(['d', 'a'])],
      ['d', new Set(['c'])],
    ])

    expect(computeBuchholz('a', scores, opponents)).toBe(1.5)
    expect(computeBuchholz('c', scores, opponents)).toBe(2.5)
  })

  it('computes progressive cumulative score', () => {
    expect(computeProgressive('a', games)).toBeGreaterThan(0)
    expect(computeProgressive('b', games)).toBe(0)
  })

  it('computes direct encounter among tied players', () => {
    const tied = ['a', 'c']
    expect(computeDirectEncounter('a', tied, games)).toBe(0.5)
    expect(computeDirectEncounter('c', tied, games)).toBe(0.5)
  })
})
