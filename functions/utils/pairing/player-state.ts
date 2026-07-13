// functions/utils/pairing/player-state.ts

import type { Color, PairingPlayerInput, PastGameInput, PlayerState } from './types'
import { whitePoints, blackPoints } from './result-points'
import { applyTiebreakers } from './tiebreakers'

export function buildPlayerStates(
  players: PairingPlayerInput[],
  games: PastGameInput[],
): PlayerState[] {
  const states: PlayerState[] = players.map((p) => ({
    id: p.id,
    rating: p.rating,
    name: p.name,
    score: 0,
    colorHistory: [],
    colorBalance: 0,
    opponents: new Set<string>(),
    hadUnplayedWin: false,
    buchholz: 0,
    progressive: 0,
    directEncounter: 0,
    rank: 0,
  }))

  const byId = new Map(states.map((s) => [s.id, s]))

  for (const game of games) {
    if (game.result === 'pending') continue

    // Either side may be absent from the current roster (withdrawn player,
    // manually paired non-roster player). The present side still scores —
    // played results stand.
    const white = byId.get(game.whiteId)
    const black = game.blackId ? byId.get(game.blackId) : undefined

    // Requested half-point bye: score only — no color effects, and does NOT
    // count toward the assigned-bye rotation.
    if (game.result === 'bye-half') {
      if (white) white.score += whitePoints(game.result)
      continue
    }

    // Assigned full-point bye: no color effects (unplayed game).
    if (!game.blackId || game.result === 'bye') {
      if (white) {
        white.score += whitePoints(game.result)
        white.hadUnplayedWin = true
      }
      continue
    }

    // The pairing happened either way — never repair these two (FIDE C.04.1.b).
    if (white && black) {
      white.opponents.add(black.id)
      black.opponents.add(white.id)
    }

    // Only games actually played count for color allocation.
    const isForfeit =
      game.result === '1-0 F' || game.result === '0-1 F' || game.result === '0-0 F'
    if (!isForfeit) {
      if (white) {
        white.colorHistory.push('white')
        white.colorBalance += 1
      }
      if (black) {
        black.colorHistory.push('black')
        black.colorBalance -= 1
      }
    }

    if (white) white.score += whitePoints(game.result)
    if (black) black.score += blackPoints(game.result)

    // Forfeit wins are unplayed wins — C.04 bye ineligibility.
    if (game.result === '1-0 F' && white) white.hadUnplayedWin = true
    else if (game.result === '0-1 F' && black) black.hadUnplayedWin = true
  }

  const withTiebreaks = applyTiebreakers(states, games)
  return sortPlayersForRanking(withTiebreaks)
}

/** FIDE C.04.1.1 — ranking order for pairing */
export function comparePlayers(a: PlayerState, b: PlayerState): number {
  if (b.score !== a.score) return b.score - a.score
  if (b.buchholz !== a.buchholz) return b.buchholz - a.buchholz
  if (b.progressive !== a.progressive) return b.progressive - a.progressive
  if (b.directEncounter !== a.directEncounter) {
    return b.directEncounter - a.directEncounter
  }
  if (b.rating !== a.rating) return b.rating - a.rating
  return a.id.localeCompare(b.id)
}

export function sortPlayersForRanking(players: PlayerState[]): PlayerState[] {
  const sorted = [...players].sort(comparePlayers)
  return sorted.map((p, index) => ({ ...p, rank: index + 1 }))
}

export function hadRematch(a: PlayerState, b: PlayerState): boolean {
  return a.opponents.has(b.id)
}

export function getLastColor(player: PlayerState): Color | null {
  return player.colorHistory.length > 0
    ? player.colorHistory[player.colorHistory.length - 1]
    : null
}
