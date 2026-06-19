import { describe, expect, it } from 'vitest'
import {
  buildPlayerStates,
  comparePlayers,
  hadRematch,
} from './player-state'
import type { PairingPlayerInput, PastGameInput } from './types'

describe('player-state', () => {
  const players: PairingPlayerInput[] = [
    { id: '1', rating: 2600 },
    { id: '2', rating: 2500 },
    { id: '3', rating: 2400 },
    { id: '4', rating: 2300 },
  ]

  it('sorts by score then tiebreakers (FIDE C.04.1.1)', () => {
    const games: PastGameInput[] = [
      { whiteId: '1', blackId: '2', result: '1-0' },
      { whiteId: '3', blackId: '4', result: '1/2-1/2' },
    ]
    const states = buildPlayerStates(players, games)
    expect(states[0].id).toBe('1')
    expect(states[0].score).toBe(1)
    expect(states.find((s) => s.id === '3')?.score).toBe(0.5)
  })

  it('tracks opponents and rematches', () => {
    const games: PastGameInput[] = [
      { whiteId: '1', blackId: '2', result: '1-0' },
    ]
    const states = buildPlayerStates(players, games)
    const a = states.find((s) => s.id === '1')!
    const b = states.find((s) => s.id === '2')!
    expect(hadRematch(a, b)).toBe(true)
    expect(hadRematch(a, states.find((s) => s.id === '3')!)).toBe(false)
  })

  it('orders tied players by buchholz', () => {
    const a = {
      id: 'a',
      rating: 2000,
      score: 1,
      buchholz: 2,
      progressive: 1,
      directEncounter: 0,
      colorHistory: [],
      colorBalance: 0,
      opponents: new Set<string>(),
      hadBye: false,
      rank: 1,
    }
    const b = { ...a, id: 'b', buchholz: 1, rank: 2 }
    expect(comparePlayers(a, b)).toBeLessThan(0)
  })
})
