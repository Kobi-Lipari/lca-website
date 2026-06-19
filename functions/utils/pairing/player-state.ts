import type { Color, PairingPlayerInput, PastGameInput, PlayerState } from './types'
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
    hadBye: false,
    buchholz: 0,
    progressive: 0,
    directEncounter: 0,
    rank: 0,
  }))

  const byId = new Map(states.map((s) => [s.id, s]))

  for (const game of games) {
    if (game.result === 'pending') continue

    const white = byId.get(game.whiteId)
    if (!white) continue

    if (!game.blackId || game.result === 'bye') {
      white.score += 1
      white.hadBye = true
      white.colorHistory.push('white')
      white.colorBalance += 1
      continue
    }

    const black = byId.get(game.blackId)
    if (!black) continue

    white.opponents.add(black.id)
    black.opponents.add(white.id)
    white.colorHistory.push('white')
    black.colorHistory.push('black')
    white.colorBalance += 1
    black.colorBalance -= 1

    if (game.result === '1-0') {
      white.score += 1
    } else if (game.result === '0-1') {
      black.score += 1
    } else if (game.result === '1/2-1/2') {
      white.score += 0.5
      black.score += 0.5
    }
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
