import type { Color, ColorPreference, PlayerState } from './types'
import { getLastColor } from './player-state'

/** FIDE C.04.3 — color preferences */
export function getColorPreference(player: PlayerState): ColorPreference {
  const last = getLastColor(player)
  const balance = player.colorBalance

  if (player.colorHistory.length >= 2) {
    const lastTwo = player.colorHistory.slice(-2)
    if (lastTwo[0] === lastTwo[1]) {
      const required: Color = lastTwo[0] === 'white' ? 'black' : 'white'
      return { absolute: required, preferred: required, strength: 'absolute' }
    }
  }

  if (balance >= 2) {
    return { absolute: null, preferred: 'black', strength: 'strong' }
  }
  if (balance <= -2) {
    return { absolute: null, preferred: 'white', strength: 'strong' }
  }
  if (balance === 1) {
    return { absolute: null, preferred: 'black', strength: 'mild' }
  }
  if (balance === -1) {
    return { absolute: null, preferred: 'white', strength: 'mild' }
  }

  const preferred: Color =
    last === 'white' ? 'black' : last === 'black' ? 'white' : 'white'
  return { absolute: null, preferred, strength: 'mild' }
}

export function colorViolationCost(
  player: PlayerState,
  color: Color,
): number {
  const pref = getColorPreference(player)
  if (pref.absolute && pref.absolute !== color) return 1_000_000
  if (pref.preferred !== color) {
    return pref.strength === 'strong' ? 10_000 : 1_000
  }
  return 0
}

/** Assign white/black for a pair; returns null if absolute rules conflict */
export function assignColors(
  a: PlayerState,
  b: PlayerState,
): { white: PlayerState; black: PlayerState } | null {
  const prefA = getColorPreference(a)
  const prefB = getColorPreference(b)

  if (prefA.absolute === 'white' && prefB.absolute === 'white') return null
  if (prefA.absolute === 'black' && prefB.absolute === 'black') return null

  if (prefA.absolute === 'white') return { white: a, black: b }
  if (prefB.absolute === 'white') return { white: b, black: a }
  if (prefA.absolute === 'black') return { white: b, black: a }
  if (prefB.absolute === 'black') return { white: a, black: b }

  const costAWhite =
    colorViolationCost(a, 'white') + colorViolationCost(b, 'black')
  const costBWhite =
    colorViolationCost(b, 'white') + colorViolationCost(a, 'black')

  if (costAWhite !== costBWhite) {
    return costAWhite < costBWhite
      ? { white: a, black: b }
      : { white: b, black: a }
  }

  if (a.rank !== b.rank) {
    return a.rank < b.rank ? { white: a, black: b } : { white: b, black: a }
  }
  if (a.rating !== b.rating) {
    return a.rating >= b.rating
      ? { white: a, black: b }
      : { white: b, black: a }
  }

  return a.id < b.id ? { white: a, black: b } : { white: b, black: a }
}
