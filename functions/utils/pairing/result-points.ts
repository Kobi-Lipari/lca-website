// functions/utils/pairing/result-points.ts
// Single source of truth for how a result string converts to points.
// Used by the pairing engine, tiebreakers, and computeStandings.

import type { GameResult } from './types'

/** Points for the white-side player. Null-black bye rows: white is the recipient. */
export function whitePoints(result: GameResult): number {
  switch (result) {
    case '1-0':
    case '1-0 F':
    case 'bye':
      return 1
    case '1/2-1/2':
      return 0.5
    case 'bye-half':
      return 0.5
    default:
      return 0 // '0-1', '0-1 F', '0-0 F', 'pending'
  }
}

export function blackPoints(result: GameResult): number {
  switch (result) {
    case '0-1':
    case '0-1 F':
      return 1
    case '1/2-1/2':
      return 0.5
    default:
      return 0
  }
}
