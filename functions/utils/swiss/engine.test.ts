import { describe, expect, it } from 'vitest'
import { pairRound, type PairingSystem, type SwissGame, type SwissPlayer } from './engine'

function lcg(seed: number) {
  let s = seed
  return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff }
}

const field = (n: number, rnd = lcg(1)): SwissPlayer[] =>
  Array.from({ length: n }, (_, i) => ({ id: `p${i}`, rating: Math.floor(800 + rnd() * 1400), name: `P${i}` }))

function playEvent(n: number, rounds: number, seed: number, system: PairingSystem = 'uscf') {
  const rnd = lcg(seed)
  const players = field(n, rnd)
  const games: SwissGame[] = []
  const warnings: string[] = []
  for (let r = 1; r <= rounds; r++) {
    const out = pairRound(players, games, r, { system })
    warnings.push(...out.warnings)
    const seen = new Set<string>()
    for (const p of out.pairings) {
      for (const id of [p.whiteId, p.blackId]) if (id) {
        expect(seen.has(id)).toBe(false)
        seen.add(id)
      }
      const x = rnd()
      games.push(p.blackId
        ? { whiteId: p.whiteId, blackId: p.blackId, result: x < 0.45 ? '1-0' : x < 0.6 ? '1/2-1/2' : '0-1' }
        : { whiteId: p.whiteId, blackId: null, result: 'bye' })
    }
    expect(seen.size).toBe(n)
  }
  return { games, warnings }
}

describe('round 1', () => {
  it('pairs top half against bottom half and alternates colors down the boards', () => {
    const players = [2000, 1900, 1800, 1700, 1600, 1500].map((rating, i) => ({ id: `r${rating}`, rating, name: `N${i}` }))
    const { pairings } = pairRound(players, [], 1, { firstBoardWhite: true })
    expect(pairings).toEqual([
      { board: 1, whiteId: 'r2000', blackId: 'r1700' },
      { board: 2, whiteId: 'r1600', blackId: 'r1900' },
      { board: 3, whiteId: 'r1800', blackId: 'r1500' },
    ])
  })

  it('gives the round-1 bye to the lowest-rated player', () => {
    const players = [1500, 1400, 1300].map((rating) => ({ id: `r${rating}`, rating }))
    const { pairings } = pairRound(players, [], 1)
    expect(pairings.at(-1)).toMatchObject({ whiteId: 'r1300', blackId: null })
  })
})

describe('later rounds', () => {
  it('handles a lone leader (the case that crashed the old engine)', () => {
    const players = field(8)
    const games: SwissGame[] = []
    for (let r = 1; r <= 3; r++) {
      const { pairings } = pairRound(players, games, r)
      // p0 wins everything; everyone else draws, so p0 is alone at the top.
      for (const p of pairings) {
        const res = p.whiteId === 'p0' ? '1-0' : p.blackId === 'p0' ? '0-1' : '1/2-1/2'
        games.push({ whiteId: p.whiteId, blackId: p.blackId, result: p.blackId ? res : 'bye' })
      }
    }
    const { pairings, warnings } = pairRound(players, games, 4)
    expect(pairings).toHaveLength(4)
    expect(warnings).toEqual([])
  })

  it('never pairs a rematch when a clean pairing exists', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const { games } = playEvent(10, 5, seed)
      const met = new Set<string>()
      for (const g of games) {
        if (!g.blackId) continue
        const key = [g.whiteId, g.blackId].sort().join('|')
        expect(met.has(key)).toBe(false)
        met.add(key)
      }
    }
  })

  it('plays full events of many sizes without failing', () => {
    for (const n of [4, 5, 7, 12, 25, 60]) {
      for (let seed = 1; seed <= 5; seed++) playEvent(n, Math.min(7, n - 1), seed * 31 + n)
    }
  })

  it('pairs players on the same score together when it can', () => {
    const players = field(4)
    const games: SwissGame[] = [
      { whiteId: 'p0', blackId: 'p1', result: '1-0' },
      { whiteId: 'p2', blackId: 'p3', result: '1-0' },
    ]
    const { pairings } = pairRound(players, games, 2)
    const winners = pairings.find((p) => [p.whiteId, p.blackId].includes('p0'))
    expect([winners?.whiteId, winners?.blackId].sort()).toEqual(['p0', 'p2'])
  })

  it('gives the bye to the lowest player who has not had one', () => {
    const players = field(5)
    const games: SwissGame[] = [
      { whiteId: 'p0', blackId: 'p1', result: '1-0' },
      { whiteId: 'p2', blackId: 'p3', result: '1-0' },
      { whiteId: 'p4', blackId: null, result: 'bye' },
    ]
    const { pairings } = pairRound(players, games, 2)
    const bye = pairings.find((p) => !p.blackId)
    expect(bye?.whiteId).not.toBe('p4')
    expect(['p1', 'p3']).toContain(bye?.whiteId)
  })

  it('evens out colors: a player with two Whites gets Black', () => {
    const players = field(4)
    const games: SwissGame[] = [
      { whiteId: 'p0', blackId: 'p1', result: '1-0' },
      { whiteId: 'p2', blackId: 'p3', result: '1-0' },
      { whiteId: 'p0', blackId: 'p2', result: '1-0' },
      { whiteId: 'p3', blackId: 'p1', result: '1-0' },
    ]
    const { pairings } = pairRound(players, games, 3)
    for (const p of pairings) expect(p.whiteId).not.toBe('p0')
  })

  it('FIDE-style never gives anyone the same color three times running', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const { games } = playEvent(14, 7, seed, 'fide')
      const hist = new Map<string, string[]>()
      for (const g of games) {
        if (!g.blackId) continue
        ;(hist.get(g.whiteId) ?? hist.set(g.whiteId, []).get(g.whiteId)!).push('w')
        ;(hist.get(g.blackId) ?? hist.set(g.blackId, []).get(g.blackId)!).push('b')
      }
      for (const h of hist.values()) {
        for (let i = 2; i < h.length; i++) expect(h[i] === h[i - 1] && h[i] === h[i - 2]).toBe(false)
      }
    }
  })
})
