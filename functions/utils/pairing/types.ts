/** FIDE C.04 Dutch system — core data types */

export type Color = 'white' | 'black'

export type GameResult = '1-0' | '0-1' | '1/2-1/2' | 'bye' | 'pending' | 'forfeit'

export interface PairingPlayerInput {
  id: string
  rating: number
  name?: string
}

export interface PastGameInput {
  whiteId: string
  blackId: string | null
  result: GameResult
}

export interface PairingRequest {
  players: PairingPlayerInput[]
  games: PastGameInput[]
  round: number
}

export interface GeneratedPairing {
  board: number
  whiteId: string
  blackId: string | null
  isBye?: boolean
}

export interface PlayerState {
  id: string
  rating: number
  name?: string
  score: number
  colorHistory: Color[]
  /** whites - blacks played */
  colorBalance: number
  opponents: Set<string>
  hadBye: boolean
  /** FIDE tiebreakers (C.04.1.1 ordering) */
  buchholz: number
  progressive: number
  directEncounter: number
  /** Sort rank within tournament (1 = highest) */
  rank: number
}

export interface ScoreGroup {
  score: number
  players: PlayerState[]
  /** S1 = upper half by rank, S2 = lower half (FIDE C.04.1.2) */
  s1: PlayerState[]
  s2: PlayerState[]
  /** Players floated down from a higher score group */
  downfloaters: PlayerState[]
}

export interface ColorPreference {
  /** Must play this color if set (absolute preference, C.04.3) */
  absolute: Color | null
  /** Preferred color when no absolute rule applies */
  preferred: Color
  strength: 'absolute' | 'strong' | 'mild'
}

export interface PairingEdge {
  a: number
  b: number
  weight: number
  whiteIndex: number
  blackIndex: number
}

export const COLOR_PENALTY = 1_000_000
export const REMATCH_PENALTY = 10_000_000
export const MAX_RATING = 4000
