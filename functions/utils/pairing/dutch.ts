// functions/utils/pairing/dutch.ts

import { assignColors } from './colors'
import { buildPlayerStates, sortPlayersForRanking } from './player-state'
import {
  groupByScore,
  pairAllBrackets,
  splitS1S2,
  toGeneratedPairings,
} from './score-groups'
import type {
  GeneratedPairing,
  PairingPlayerInput,
  PastGameInput,
  PlayerState,
} from './types'

/** FIDE C.04.2 — round 1 pairing by rating; odd count gives the bye to the lowest-rated */
export function pairRoundOne(players: PlayerState[]): GeneratedPairing[] {
  let sorted = sortPlayersForRanking(
    players.map((p) => ({ ...p, score: 0 })),
  ).sort((a, b) => b.rating - a.rating || a.id.localeCompare(b.id))

  let byePlayer: PlayerState | null = null
  if (sorted.length % 2 === 1) {
    byePlayer = sorted[sorted.length - 1] // lowest-rated gets the round-1 bye
    sorted = sorted.slice(0, -1)
  }

  const { s1Size } = splitS1S2(sorted)
  const s1 = sorted.slice(0, s1Size)
  const s2 = sorted.slice(s1Size)

  const pairings: GeneratedPairing[] = []

  for (let i = 0; i < s1.length; i++) {
    const colors = assignColors(s1[i], s2[i])
    if (!colors) {
      throw new Error(`Round 1 color conflict: ${s1[i].id} vs ${s2[i].id}`)
    }
    pairings.push({
      board: i + 1,
      whiteId: colors.white.id,
      blackId: colors.black.id,
    })
  }

  if (byePlayer) {
    pairings.push({
      board: pairings.length + 1,
      whiteId: byePlayer.id,
      blackId: null,
      isBye: true,
    })
  }

  return pairings
}

/** FIDE C.04 Dutch system — full pairing for a round */
export function generateDutchPairings(
  players: PairingPlayerInput[],
  games: PastGameInput[],
  round: number,
): GeneratedPairing[] {
  if (players.length === 0) return []

  const states = buildPlayerStates(players, games)

  if (round === 1) {
    return pairRoundOne(states)
  }

  const sorted = [...states].sort((a, b) => a.rank - b.rank)
  const scoreGroups = groupByScore(sorted)
  const { pairings, byes } = pairAllBrackets(scoreGroups)

  return toGeneratedPairings(pairings, byes)
}
