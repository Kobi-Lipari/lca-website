// functions/utils/pairing/score-groups.test.ts
import { describe, expect, it } from 'vitest'
import {
  buildHomogeneousPool,
  groupByScore,
  selectByePlayer,
  selectDownfloater,
  splitS1S2,
} from './score-groups'
import type { PlayerState } from './types'

function player(id: string, rank: number, score: number): PlayerState {
  return {
    id,
    rating: 2000 - rank * 10,
    score,
    colorHistory: [],
    colorBalance: 0,
    opponents: new Set(),
    hadUnplayedWin: false,
    buchholz: 0,
    progressive: 0,
    directEncounter: 0,
    rank,
  }
}

describe('score-groups', () => {
  it('splits odd pool with extra player in S2', () => {
    const pool = [player('1', 1, 1), player('2', 2, 1), player('3', 3, 1)]
    const { s1, s2, s1Size } = splitS1S2(pool)
    expect(s1Size).toBe(2)
    expect(s1.map((p) => p.id)).toEqual(['1', '2'])
    expect(s2.map((p) => p.id)).toEqual(['3'])
  })

  it('selects lowest S2 player as downfloater', () => {
    const pool = [
      player('1', 1, 2),
      player('2', 2, 2),
      player('3', 3, 2),
    ]
    expect(selectDownfloater(pool).id).toBe('3')
  })

  it('assigns the bye to the lowest-ranked player without a prior unplayed win (C.04)', () => {
    const pool = [
      player('1', 1, 1),
      player('2', 2, 1),
      player('3', 3, 1),
    ]
    pool[2].hadUnplayedWin = true // player 3 already had a bye/forfeit win
    expect(selectByePlayer(pool).id).toBe('2') // lowest-ranked eligible
  })

  it('groups players by score preserving order', () => {
    const players = [
      player('1', 1, 2),
      player('2', 2, 2),
      player('3', 3, 1),
    ]
    const groups = groupByScore(players)
    expect(groups).toHaveLength(2)
    expect(groups[0].score).toBe(2)
    expect(groups[0].players.map((p) => p.id)).toEqual(['1', '2'])
  })

  it('places downfloaters at bottom of S1', () => {
    const bracket = [player('1', 1, 1), player('2', 2, 1), player('3', 3, 1)]
    const floater = player('f', 0, 2)
    const pool = buildHomogeneousPool(bracket, [floater])
    const { s1, s2 } = splitS1S2(pool)
    expect(s1.map((p) => p.id)).toEqual(['1', 'f'])
    expect(s2.map((p) => p.id)).toEqual(['2', '3'])
  })
})