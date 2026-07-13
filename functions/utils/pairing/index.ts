// functions/utils/pairing/index.ts

export type {
  Color,
  GameResult,
  PairingPlayerInput,
  PastGameInput,
  PairingRequest,
  GeneratedPairing,
  PlayerState,
  ScoreGroup,
  ColorPreference,
  PairingEdge,
} from './types'

export {
  COLOR_PENALTY,
  REMATCH_PENALTY,
  MAX_RATING,
} from './types'

export { whitePoints, blackPoints } from './result-points'

export {
  computeBuchholz,
  computeProgressive,
  computeDirectEncounter,
  applyTiebreakers,
} from './tiebreakers'

export {
  buildPlayerStates,
  comparePlayers,
  sortPlayersForRanking,
  hadRematch,
  getLastColor,
} from './player-state'

export {
  getColorPreference,
  colorViolationCost,
  assignColors,
} from './colors'

export {
  maxWeightBipartiteMatching,
  pairScoreGroupPool,
  pairingEdgeWeight,
  buildWeightMatrix,
} from './blossom'

export {
  splitS1S2,
  selectDownfloater,
  selectByePlayer,
  groupByScore,
  buildHomogeneousPool,
  pairAllBrackets,
  toGeneratedPairings,
} from './score-groups'

export { pairRoundOne, generateDutchPairings } from './dutch'
