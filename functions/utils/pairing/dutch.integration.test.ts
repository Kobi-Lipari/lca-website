import { describe, expect, it } from 'vitest'
import { generateDutchPairings } from './dutch'
import type { PairingPlayerInput, PastGameInput } from './types'

function makePlayers(count: number, baseRating = 2600): PairingPlayerInput[] {
  return Array.from({ length: count }, (_, i) => ({
    id: String(i + 1),
    rating: baseRating - i * 100,
  }))
}

function pairingKey(whiteId: string, blackId: string | null): string {
  return blackId ? `${whiteId}-${blackId}` : `${whiteId}-bye`
}

describe('FIDE Dutch integration', () => {
  it('round 1: 8 players pair 1v5, 2v6, 3v7, 4v8 with S1 white (C.04.2)', () => {
    const players = makePlayers(8)
    const pairings = generateDutchPairings(players, [], 1)

    expect(pairings).toHaveLength(4)
    const keys = pairings.map((p) => pairingKey(p.whiteId, p.blackId))
    expect(keys).toContain('1-5')
    expect(keys).toContain('2-6')
    expect(keys).toContain('3-7')
    expect(keys).toContain('4-8')
  })

  it('round 1: odd count gives bye to extra S1 player', () => {
    const players = makePlayers(5)
    const pairings = generateDutchPairings(players, [], 1)
    expect(pairings).toHaveLength(3)
    const bye = pairings.find((p) => p.blackId === null)
    expect(bye?.whiteId).toBe('3')
  })

  it('round 2: no rematches in generated pairings', () => {
    const players = makePlayers(8)
    const round1: PastGameInput[] = [
      { whiteId: '1', blackId: '5', result: '1-0' },
      { whiteId: '2', blackId: '6', result: '1-0' },
      { whiteId: '3', blackId: '7', result: '1-0' },
      { whiteId: '4', blackId: '8', result: '1-0' },
    ]
    const pairings = generateDutchPairings(players, round1, 2)

    for (const p of pairings) {
      if (!p.blackId) continue
      const played = round1.some(
        (g) =>
          (g.whiteId === p.whiteId && g.blackId === p.blackId) ||
          (g.whiteId === p.blackId && g.blackId === p.whiteId),
      )
      expect(played).toBe(false)
    }
  })

  it('round 2: winners with 1 point are paired together', () => {
    const players = makePlayers(8)
    const round1: PastGameInput[] = [
      { whiteId: '1', blackId: '5', result: '1-0' },
      { whiteId: '2', blackId: '6', result: '1-0' },
      { whiteId: '3', blackId: '7', result: '1-0' },
      { whiteId: '4', blackId: '8', result: '1-0' },
    ]
    const pairings = generateDutchPairings(players, round1, 2)
    const ids = new Set(
      pairings.flatMap((p) => (p.blackId ? [p.whiteId, p.blackId] : [p.whiteId])),
    )
    expect(ids.has('1')).toBe(true)
    expect(ids.has('2')).toBe(true)
    expect(ids.has('3')).toBe(true)
    expect(ids.has('4')).toBe(true)
  })
})
