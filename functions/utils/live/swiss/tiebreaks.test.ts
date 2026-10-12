import { describe, expect, it } from 'vitest'
import { computeStandings } from './tiebreaks'

// A 4-player, 3-round example worked by hand.
//   R1: A–B 1-0, C–D ½   R2: A–C 1-0, B–D 1-0   R3: A–D 0-1, B–C ½
const players = ['A', 'B', 'C', 'D'].map((id) => ({ id, name: id, rating: 1500 }))
const games = [
  { round: 1, whiteId: 'A', blackId: 'B', result: '1-0' as const },
  { round: 1, whiteId: 'C', blackId: 'D', result: '1/2-1/2' as const },
  { round: 2, whiteId: 'A', blackId: 'C', result: '1-0' as const },
  { round: 2, whiteId: 'B', blackId: 'D', result: '1-0' as const },
  { round: 3, whiteId: 'A', blackId: 'D', result: '0-1' as const },
  { round: 3, whiteId: 'B', blackId: 'C', result: '1/2-1/2' as const },
]

describe('US Chess tiebreaks', () => {
  const rows = computeStandings(players, games, 3)
  const by = Object.fromEntries(rows.map((r) => [r.id, r]))

  it('computes Modified Median, Solkoff and Cumulative', () => {
    expect(by.A).toMatchObject({ score: 2, modifiedMedian: 3, solkoff: 4, cumulative: 5 })
    expect(by.B).toMatchObject({ score: 1.5, modifiedMedian: 1.5, solkoff: 4.5, cumulative: 2.5 })
    expect(by.C).toMatchObject({ score: 1, modifiedMedian: 3, solkoff: 5, cumulative: 2 })
    expect(by.D).toMatchObject({ score: 1.5, modifiedMedian: 1.5, solkoff: 4.5, cumulative: 2.5 })
  })

  it('breaks a tie that survives every tiebreak on most Blacks', () => {
    expect(by.B.oppCumulative).toBe(by.D.oppCumulative)
    expect(rows.map((r) => r.id)).toEqual(['A', 'D', 'B', 'C'])
    expect(rows.map((r) => r.placeLabel)).toEqual(['1', '2', '3', '4'])
  })

  it('counts an opponent\'s bye as a draw and shares places on a full tie', () => {
    const two = [{ id: 'X', name: 'X', rating: 1 }, { id: 'Y', name: 'Y', rating: 1 }]
    const res = computeStandings(two, [
      { round: 1, whiteId: 'X', blackId: null, result: 'bye' },
      { round: 1, whiteId: 'Y', blackId: null, result: 'bye' },
    ], 1)
    expect(res.map((r) => r.placeLabel)).toEqual(['1-2', '1-2'])
  })
})
