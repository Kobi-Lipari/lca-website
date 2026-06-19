import { describe, expect, it } from 'vitest'
import { assignColors, getColorPreference } from './colors'
import type { PlayerState } from './types'

function player(
  id: string,
  overrides: Partial<PlayerState> = {},
): PlayerState {
  return {
    id,
    rating: 2000,
    score: 0,
    colorHistory: [],
    colorBalance: 0,
    opponents: new Set(),
    hadBye: false,
    buchholz: 0,
    progressive: 0,
    directEncounter: 0,
    rank: 1,
    ...overrides,
  }
}

describe('colors', () => {
  it('requires opposite color after two same colors', () => {
    const p = player('a', {
      colorHistory: ['white', 'white'],
      colorBalance: 2,
    })
    expect(getColorPreference(p).absolute).toBe('black')
  })

  it('assigns white to higher-ranked player when color costs tie', () => {
    const top = player('top', { rank: 1, rating: 2200 })
    const bottom = player('bottom', { rank: 5, rating: 1800 })
    const result = assignColors(top, bottom)
    expect(result?.white.id).toBe('top')
    expect(result?.black.id).toBe('bottom')
  })

  it('returns null when both have absolute white preference', () => {
    const a = player('a', { colorHistory: ['black', 'black'], colorBalance: -2 })
    const b = player('b', { colorHistory: ['black', 'black'], colorBalance: -2 })
    expect(assignColors(a, b)).toBeNull()
  })
})
