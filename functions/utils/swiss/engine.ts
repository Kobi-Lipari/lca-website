// functions/utils/swiss/engine.ts
//
// Swiss pairing engine. US Chess rules by default (Rule 29), with a
// FIDE-style option.
//
// How it works: every legal pairing of two players (they haven't met) is an
// edge in a graph, scored by how well it follows the rules. A maximum-weight
// matching (./matching) then picks the best complete set of pairings for the
// whole section at once. Because it looks at the whole section, it can't
// paint itself into a corner the way score-group-by-score-group pairing can:
// if a complete pairing exists without rematches, it finds one.
//
// The score of a pairing, from most to least important:
//   1. Players meet others on the same score (score groups), floating as
//      little as possible.
//   2. Within a score group, top half meets bottom half by rating
//      (US Chess 29C). A floater is the lowest-rated player of the higher
//      group and meets the highest-rated player available below (29D).
//   3. Colors: equalization, then alternation (29E). A color fix may move a
//      pairing by up to about 80 rating points (the US Chess transposition
//      guideline) for alternation, 200 for equalization.
//   4. Optional "avoid" pairs (family, same club) — soft, never at the cost
//      of the score groups.
//
// Accelerated pairings (US Chess 28R, added-score method): for the first
// rounds the top half of the field is paired as if it had one extra point,
// so the strongest players don't all meet the weakest in round 1. The extra
// point only affects pairing, never the score.
// Rematches are never used unless no complete pairing exists without one.

import { maxWeightMatching, type WeightedEdge } from './matching'

export type PairingSystem = 'uscf' | 'fide'
export type Color = 'white' | 'black'

export type GameResult =
  | '1-0' | '0-1' | '1/2-1/2'
  | '1-0 F' | '0-1 F' | '0-0 F'
  | 'bye' | 'bye-half'
  | 'pending'

export interface SwissPlayer {
  id: string
  /** 0 or null for unrated; they rank below rated players. */
  rating: number | null
  name?: string
}

export interface SwissGame {
  whiteId: string
  blackId: string | null
  result: GameResult
}

export interface PairingOptions {
  system?: PairingSystem
  /**
   * Round 1: does the higher-rated player on board 1 get White? US Chess
   * decides this by coin toss; boards then alternate. Defaults to true.
   */
  firstBoardWhite?: boolean
  /** Pairs of player ids to keep apart where possible (family, teammates). */
  avoid?: Array<[string, string]>
  /**
   * Accelerated pairings: ids of the players given an extra point for
   * pairing this round. The caller decides who (the top half by rating)
   * and for which rounds.
   */
  bonusPoint?: Set<string> | string[]
}

export interface Pairing {
  board: number
  whiteId: string
  /** null = full-point bye */
  blackId: string | null
}

export interface PairingOutcome {
  pairings: Pairing[]
  /** Plain-language notes for the director, e.g. an unavoidable rematch. */
  warnings: string[]
}

interface State {
  id: string
  rating: number
  name: string
  /** In half points, so every score is an integer. */
  score2: number
  opponents: Set<string>
  colors: Color[]
  /** whites minus blacks, played games only */
  balance: number
  /** Already had a full-point bye or a forfeit win. */
  hadUnplayedPoint: boolean
  /** Rank for pairing: score, then rating (1 = top). */
  rank: number
  group: number
  posInGroup: number
  groupSize: number
}

const points2 = (result: GameResult, side: 'white' | 'black'): number => {
  switch (result) {
    case '1-0': case '1-0 F': return side === 'white' ? 2 : 0
    case '0-1': case '0-1 F': return side === 'white' ? 0 : 2
    case '1/2-1/2': return 1
    case 'bye': return side === 'white' ? 2 : 0
    case 'bye-half': return side === 'white' ? 1 : 0
    default: return 0
  }
}

function buildStates(players: SwissPlayer[], games: SwissGame[], bonus: Set<string> = new Set()): State[] {
  const byId = new Map<string, State>()
  for (const p of players) {
    byId.set(p.id, {
      id: p.id,
      rating: p.rating && p.rating > 0 ? p.rating : 0,
      name: p.name ?? p.id,
      score2: 0,
      opponents: new Set(),
      colors: [],
      balance: 0,
      hadUnplayedPoint: false,
      rank: 0, group: 0, posInGroup: 0, groupSize: 0,
    })
  }
  for (const g of games) {
    if (g.result === 'pending') continue
    const w = byId.get(g.whiteId)
    const b = g.blackId ? byId.get(g.blackId) : undefined
    if (!g.blackId) {
      if (w) {
        w.score2 += points2(g.result, 'white')
        if (g.result === 'bye') w.hadUnplayedPoint = true
      }
      continue
    }
    if (w && b) {
      w.opponents.add(b.id)
      b.opponents.add(w.id)
    }
    const forfeit = g.result === '1-0 F' || g.result === '0-1 F' || g.result === '0-0 F'
    if (!forfeit) {
      if (w) { w.colors.push('white'); w.balance += 1 }
      if (b) { b.colors.push('black'); b.balance -= 1 }
    }
    if (w) w.score2 += points2(g.result, 'white')
    if (b) b.score2 += points2(g.result, 'black')
    if (g.result === '1-0 F' && w) w.hadUnplayedPoint = true
    if (g.result === '0-1 F' && b) b.hadUnplayedPoint = true
  }

  for (const id of bonus) {
    const s = byId.get(id)
    if (s) s.score2 += 2
  }

  const sorted = [...byId.values()].sort(
    (a, b) => b.score2 - a.score2 || b.rating - a.rating || a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
  )
  let group = -1
  let lastScore = Number.NaN
  const groups: State[][] = []
  sorted.forEach((s, i) => {
    s.rank = i + 1
    if (s.score2 !== lastScore) {
      group += 1
      lastScore = s.score2
      groups.push([])
    }
    s.group = group
    s.posInGroup = groups[group].length
    groups[group].push(s)
  })
  for (const g of groups) for (const s of g) s.groupSize = g.length
  return sorted
}

// ── Colors ───────────────────────────────────────────────────────────────────

interface Due {
  /** The color this player should get next, or null if nothing is owed. */
  color: Color | null
  /** 2 = equalization (more of one color), 1 = alternation, 0 = none */
  strength: 0 | 1 | 2
  /** FIDE: must get this color (third in a row / imbalance of 3). */
  absolute: boolean
}

function due(s: State, system: PairingSystem): Due {
  const last = s.colors[s.colors.length - 1]
  if (system === 'fide') {
    const two = s.colors.length >= 2 && s.colors[s.colors.length - 1] === s.colors[s.colors.length - 2]
    if (s.balance >= 2 || (two && last === 'white')) return { color: 'black', strength: 2, absolute: true }
    if (s.balance <= -2 || (two && last === 'black')) return { color: 'white', strength: 2, absolute: true }
  }
  if (s.balance > 0) return { color: 'black', strength: 2, absolute: false }
  if (s.balance < 0) return { color: 'white', strength: 2, absolute: false }
  if (last) return { color: last === 'white' ? 'black' : 'white', strength: 1, absolute: false }
  return { color: null, strength: 0, absolute: false }
}

/**
 * Who gets White (US Chess 29E): satisfy the stronger claim; on equal
 * claims, compare color histories from the most recent round back and give
 * each the color they had less recently; failing that the higher-ranked
 * player gets their due color.
 */
function assignColors(a: State, b: State, system: PairingSystem, fallbackAWhite: boolean): { white: State; black: State } {
  const da = due(a, system)
  const db = due(b, system)
  const give = (white: State, black: State) => ({ white, black })
  const aWhite = give(a, b)
  const bWhite = give(b, a)

  if (da.absolute && !db.absolute) return da.color === 'white' ? aWhite : bWhite
  if (db.absolute && !da.absolute) return db.color === 'white' ? bWhite : aWhite

  if (da.color && db.color && da.color !== db.color) return da.color === 'white' ? aWhite : bWhite
  if (da.color && !db.color) return da.color === 'white' ? aWhite : bWhite
  if (db.color && !da.color) return db.color === 'white' ? bWhite : aWhite

  if (da.color && db.color && da.color === db.color) {
    // Both want the same color: the stronger claim wins.
    if (da.strength !== db.strength) {
      const winner = da.strength > db.strength ? 'a' : 'b'
      const color = winner === 'a' ? da.color : db.color
      if (winner === 'a') return color === 'white' ? aWhite : bWhite
      return color === 'white' ? bWhite : aWhite
    }
    // Same strength: walk back through the histories until they differ.
    for (let i = 1; i <= Math.min(a.colors.length, b.colors.length); i++) {
      const ca = a.colors[a.colors.length - i]
      const cb = b.colors[b.colors.length - i]
      if (ca !== cb) return ca === 'black' ? aWhite : bWhite
    }
    // Identical histories: the higher-ranked player gets their due color.
    const higher = a.rank < b.rank ? a : b
    return higher === a
      ? (da.color === 'white' ? aWhite : bWhite)
      : (db.color === 'white' ? bWhite : aWhite)
  }

  return fallbackAWhite ? aWhite : bWhite
}

/** Cost in rating-point units of the color outcome for this pair. */
function colorCost(a: State, b: State, system: PairingSystem): number {
  const da = due(a, system)
  const db = due(b, system)
  if (!da.color || !db.color || da.color !== db.color) return 0
  // Both owed the same color: one of them won't get it.
  const loser = Math.min(da.strength, db.strength)
  let cost = loser === 2 ? 200 : 80
  // Extra weight when the player who misses out would get the same color a
  // third time running; US Chess allows it but directors avoid it.
  const wouldRepeatThird = (s: State, color: Color) =>
    s.colors.length >= 2 && s.colors[s.colors.length - 1] === color && s.colors[s.colors.length - 2] === color
  const other: Color = da.color === 'white' ? 'black' : 'white'
  if (wouldRepeatThird(a, other) || wouldRepeatThird(b, other)) cost += 150
  return cost
}

// ── Pairing ──────────────────────────────────────────────────────────────────

const SCORE_UNIT = 1_000_000_000 // per (half-point gap)^2
const AVOID_COST = 500_000_000
const PLACEMENT_UNIT = 1_000 // per rating point of deviation
const REMATCH_COST = 1_000_000_000_000
const FORBIDDEN_COLOR_COST = 100_000_000_000

function placementCost(a: State, b: State, groups: State[][], system: PairingSystem): number {
  const [hi, lo] = a.rank < b.rank ? [a, b] : [b, a]
  if (hi.group === lo.group) {
    const g = groups[hi.group]
    const half = Math.floor(g.length / 2)
    // Same half: strongly discouraged (US Chess pairs top half vs bottom half).
    const hiTop = hi.posInGroup < half
    const loTop = lo.posInGroup < half
    let cost = hiTop === loTop ? 400 : 0
    if (hiTop && !loTop) {
      const ideal = g[hi.posInGroup + half] ?? g[g.length - 1]
      cost += system === 'fide'
        ? Math.abs(lo.posInGroup - ideal.posInGroup) * 50
        : Math.abs(lo.rating - ideal.rating)
    }
    return cost
  }
  // Floater: prefer the lowest-rated of the higher group meeting the
  // highest-rated of the lower group.
  const hiGroup = groups[hi.group]
  const loGroup = groups[lo.group]
  if (system === 'fide') {
    return (hiGroup.length - 1 - hi.posInGroup) * 50 + lo.posInGroup * 50
  }
  const lowestOfHigh = hiGroup[hiGroup.length - 1].rating
  const highestOfLow = loGroup[0].rating
  return Math.max(0, hi.rating - lowestOfHigh) + Math.max(0, highestOfLow - lo.rating)
}

function roundOne(states: State[], firstBoardWhite: boolean, avoid: Set<string> = new Set()): PairingOutcome {
  const sorted = [...states].sort((a, b) => b.rating - a.rating || a.name.localeCompare(b.name))
  const pairings: Pairing[] = []
  let bye: State | null = null
  let pool = sorted
  if (pool.length % 2 === 1) {
    bye = pool[pool.length - 1]
    pool = pool.slice(0, -1)
  }
  const half = pool.length / 2
  // Bottom half in order; swap neighbours to keep "avoid" pairs apart, the
  // usual small transposition a director would make by hand.
  const bottoms = pool.slice(half)
  const clash = (i: number) => avoid.has([pool[i].id, bottoms[i].id].sort().join('|'))
  for (let i = 0; i < half; i++) {
    if (!clash(i)) continue
    for (const j of [i + 1, i - 1, i + 2, i - 2]) {
      if (j < 0 || j >= half) continue
      ;[bottoms[i], bottoms[j]] = [bottoms[j], bottoms[i]]
      if (!clash(i) && !clash(j)) break
      ;[bottoms[i], bottoms[j]] = [bottoms[j], bottoms[i]]
    }
  }
  for (let i = 0; i < half; i++) {
    const top = pool[i]
    const bottom = bottoms[i]
    // Board 1 per the coin toss, then alternate down the boards.
    const topWhite = (i % 2 === 0) === firstBoardWhite
    pairings.push({ board: i + 1, whiteId: topWhite ? top.id : bottom.id, blackId: topWhite ? bottom.id : top.id })
  }
  if (bye) pairings.push({ board: pairings.length + 1, whiteId: bye.id, blackId: null })
  return { pairings, warnings: [] }
}

/**
 * Pairs one round of one section.
 *
 * `players` are the people to pair this round: exclude anyone withdrawn or
 * taking a requested bye. `games` are all earlier games in the section,
 * including those of players no longer in it.
 */
export function pairRound(
  players: SwissPlayer[],
  games: SwissGame[],
  round: number,
  options: PairingOptions = {},
): PairingOutcome {
  const system = options.system ?? 'uscf'
  const firstBoardWhite = options.firstBoardWhite ?? true
  if (players.length === 0) return { pairings: [], warnings: [] }

  const bonus = new Set(options.bonusPoint ?? [])
  const states = buildStates(players, games, bonus)
  const playedAny = games.some((g) => g.result !== 'pending' && g.blackId)
  if (round === 1 || (!playedAny && states.every((s) => s.score2 === 0) && bonus.size === 0)) {
    const avoidSet = new Set((options.avoid ?? []).map(([x, y]) => [x, y].sort().join('|')))
    if (bonus.size === 0) return roundOne(states, firstBoardWhite, avoidSet)
    // Accelerated round 1: pair the top group and the rest separately,
    // each top half against bottom half, boards numbered straight on.
    const top = states.filter((s) => bonus.has(s.id))
    const rest = states.filter((s) => !bonus.has(s.id))
    // An odd top group would hand the bye to a strong player: the lowest of
    // the top group joins the rest instead.
    if (top.length % 2 === 1) rest.unshift(top.pop() as State)
    const a = roundOne(top, firstBoardWhite, avoidSet)
    // Keep colors alternating down the boards across the two groups.
    const topBoards = a.pairings.filter((p) => p.blackId).length
    const b = roundOne(rest, topBoards % 2 === 0 ? firstBoardWhite : !firstBoardWhite, avoidSet)
    const games1 = [...a.pairings.filter((p) => p.blackId), ...b.pairings.filter((p) => p.blackId)]
    const byes = [...a.pairings, ...b.pairings].filter((p) => !p.blackId)
    const pairings = [...games1, ...byes].map((p, i) => ({ ...p, board: i + 1 }))
    return { pairings, warnings: [] }
  }

  const groups: State[][] = []
  for (const s of states) (groups[s.group] ??= []).push(s)

  const avoid = new Set((options.avoid ?? []).map(([x, y]) => [x, y].sort().join('|')))
  const n = states.length
  const odd = n % 2 === 1
  const BYE = n // extra vertex when the count is odd

  const buildEdges = (allowRematch: boolean, allowColorBreak: boolean, anyBye: boolean): WeightedEdge[] => {
    const raw: Array<[number, number, number]> = []
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = states[i]
        const b = states[j]
        let cost = 0
        if (a.opponents.has(b.id)) {
          if (!allowRematch) continue
          cost += REMATCH_COST
        }
        if (system === 'fide') {
          const da = due(a, system)
          const db = due(b, system)
          if (da.absolute && db.absolute && da.color === db.color) {
            if (!allowColorBreak) continue
            cost += FORBIDDEN_COLOR_COST
          }
        }
        const gap = Math.abs(a.score2 - b.score2)
        cost += gap * gap * SCORE_UNIT
        if (avoid.has([a.id, b.id].sort().join('|'))) cost += AVOID_COST
        cost += (placementCost(a, b, groups, system) + colorCost(a, b, system)) * PLACEMENT_UNIT
        raw.push([i, j, cost])
      }
    }
    if (odd) {
      // The bye goes to the lowest-ranked player of the lowest score group
      // who hasn't already had an unplayed point.
      const lowestScore = states[n - 1].score2
      const allHad = anyBye || states.every((s) => s.hadUnplayedPoint)
      for (let i = 0; i < n; i++) {
        const s = states[i]
        if (s.hadUnplayedPoint && !allHad) continue
        const gap = s.score2 - lowestScore
        const cost = gap * gap * SCORE_UNIT + (n - s.rank) * PLACEMENT_UNIT * 10
        raw.push([i, BYE, cost])
      }
    }
    const maxCost = raw.reduce((m, e) => Math.max(m, e[2]), 0)
    return raw.map(([i, j, c]) => [i, j, maxCost - c + 1])
  }

  const target = odd ? n + 1 : n
  const attempt = (allowRematch: boolean, allowColorBreak: boolean, anyBye = false) => {
    const edges = buildEdges(allowRematch, allowColorBreak, anyBye)
    const mate = edges.length ? maxWeightMatching(edges, true) : []
    let matched = 0
    for (let v = 0; v < mate.length; v++) if (mate[v] >= 0) matched++
    return { mate, complete: matched === target }
  }

  const warnings: string[] = []
  let result = attempt(false, false)
  if (!result.complete && system === 'fide') {
    result = attempt(false, true)
    if (result.complete) warnings.push('Some color rules could not be met this round.')
  }
  // A second full-point bye is the lesser evil than a rematch.
  if (!result.complete && odd) {
    result = attempt(false, system === 'fide', true)
    if (result.complete) warnings.push('Every eligible player has already had a bye, so someone gets a second one.')
  }
  if (!result.complete) {
    result = attempt(true, true, true)
    if (result.complete) warnings.push('No pairing without a rematch exists this round, so one rematch was allowed.')
  }

  const { mate } = result
  const pairs: Array<{ white: State; black: State }> = []
  let byePlayer: State | null = null
  const seen = new Set<number>()
  for (let i = 0; i < n; i++) {
    if (seen.has(i)) continue
    const m = mate[i] ?? -1
    if (m === BYE && odd) {
      byePlayer = states[i]
      seen.add(i)
      continue
    }
    if (m < 0 || m >= n) {
      warnings.push(`${states[i].name} could not be paired.`)
      continue
    }
    seen.add(i)
    seen.add(m)
    const a = states[i]
    const b = states[m]
    if (a.opponents.has(b.id)) warnings.push(`Rematch: ${a.name} and ${b.name} have played already.`)
    pairs.push(assignColors(a, b, system, a.rank < b.rank ? firstBoardWhite : !firstBoardWhite))
  }

  // Boards: top score first, then the higher-rated pair.
  pairs.sort((p, q) => {
    const ps = Math.max(p.white.score2, p.black.score2)
    const qs = Math.max(q.white.score2, q.black.score2)
    if (ps !== qs) return qs - ps
    const psum = p.white.score2 + p.black.score2
    const qsum = q.white.score2 + q.black.score2
    if (psum !== qsum) return qsum - psum
    return Math.max(q.white.rating, q.black.rating) - Math.max(p.white.rating, p.black.rating)
  })

  const pairings: Pairing[] = pairs.map((p, i) => ({ board: i + 1, whiteId: p.white.id, blackId: p.black.id }))
  if (byePlayer) pairings.push({ board: pairings.length + 1, whiteId: byePlayer.id, blackId: null })
  return { pairings, warnings }
}

/**
 * Who gets the extra pairing point in an accelerated event: the top half by
 * rating (an even number, so the top group pairs within itself).
 */
export function acceleratedTopGroup(players: SwissPlayer[]): string[] {
  const sorted = [...players].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || (a.name ?? a.id).localeCompare(b.name ?? b.id))
  let count = Math.ceil(sorted.length / 2)
  if (count % 2 === 1) count -= 1
  return sorted.slice(0, count).map((p) => p.id)
}

/**
 * Worth accelerating? With more than 2^rounds players, a plain Swiss can end
 * with several perfect scores; acceleration separates the top players sooner.
 */
export const accelerationRecommended = (players: number, rounds: number) =>
  rounds >= 3 && players > 2 ** rounds
