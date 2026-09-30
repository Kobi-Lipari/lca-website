// functions/utils/prizes.ts
//
// Who wins what, the US Chess way (rules 32B–32C):
//
// - Cash is split by score, not tiebreaks. Players tied on score pool the
//   prizes for the places they occupy and share them equally.
// - A player receives one cash prize: whichever pays them most, place or
//   class. When a player takes a class prize, they drop out of the place
//   pool and everyone below moves up (and the reverse).
// - Unrated players can win place prizes and prizes meant for unrated
//   players, but not rating-class prizes unless the director allows it.
// - Non-cash prizes (a trophy, a medal) can't be split, so they go down the
//   standings in tiebreak order.
//
// Prizes are set per section by the director; nothing here is fixed.

export interface PrizeSlot {
  /** Cash in dollars; 0 or missing for a non-cash prize. */
  amount?: number
  /** e.g. "Trophy". Shown with the cash if both are set. */
  label?: string
}

export interface PrizeClass {
  /** e.g. "Top U1400", "Top unrated", "Top 3rd grade". */
  label: string
  /** Rating at entry below which a player qualifies (U1400 → 1399). */
  ratingMax?: number | null
  ratingMin?: number | null
  /** Only unrated players (the "Top unrated" prize). */
  unratedOnly?: boolean
  /** Let unrated players compete for this rating class too. */
  unratedOk?: boolean
  gradeMin?: number | null
  gradeMax?: number | null
  prizes: PrizeSlot[]
}

export interface SectionPrizes {
  place?: PrizeSlot[]
  classes?: PrizeClass[]
}

export interface PrizeStanding {
  member_id: string
  section: string
  score: number
  /** Rating at entry; null = unrated. */
  rating: number | null
  /** Grade range the player confirmed (K = 0). Only used by grade classes. */
  gradeRange?: { min: number; max: number } | null
}

export interface PrizeAward {
  member_id: string
  section: string
  /** "1st–2nd place (tie)", "Top U1400", … */
  prize: string
  cash: number
  /** Non-cash items won, e.g. ["Trophy"]. */
  items: string[]
}

const ordinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`
}
const round2 = (n: number) => Math.round(n * 100) / 100

interface Pool {
  key: string
  label: string
  slots: PrizeSlot[]
  eligible: (p: PrizeStanding) => boolean
  isPlace: boolean
}

function classEligible(c: PrizeClass) {
  return (p: PrizeStanding) => {
    const rated = p.rating != null && p.rating > 0
    if (c.unratedOnly) return !rated
    const ratingLimited = c.ratingMax != null || c.ratingMin != null
    if (ratingLimited) {
      if (!rated) return !!c.unratedOk
      if (c.ratingMax != null && (p.rating as number) > c.ratingMax) return false
      if (c.ratingMin != null && (p.rating as number) < c.ratingMin) return false
    }
    if (c.gradeMin != null || c.gradeMax != null) {
      // Eligible only if everything they confirmed falls inside the class.
      const g = p.gradeRange
      if (!g) return false
      if (g.min < (c.gradeMin ?? 0) || g.max > (c.gradeMax ?? 12)) return false
    }
    return true
  }
}

/**
 * Cash share of each player in a pool: walk score groups down the prize
 * slots; a group pools the slots it covers and splits them evenly.
 * Returns member → { cash, first, last } (slot positions, 1-based).
 */
function poolShares(pool: Pool, players: PrizeStanding[]) {
  const out = new Map<string, { cash: number; first: number; last: number; tied: number }>()
  const cashSlots = pool.slots.map((s) => Math.max(0, s.amount ?? 0))
  let pos = 0
  let i = 0
  while (i < players.length && pos < pool.slots.length) {
    let j = i
    while (j < players.length && players[j].score === players[i].score) j++
    const group = players.slice(i, j)
    const covered = cashSlots.slice(pos, pos + group.length)
    const share = covered.reduce((a, b) => a + b, 0) / group.length
    for (const p of group) {
      out.set(p.member_id, { cash: share, first: pos + 1, last: Math.min(pos + group.length, pool.slots.length), tied: group.length })
    }
    pos += group.length
    i = j
  }
  return out
}

/**
 * Awards for one tournament. `standings` must be in final order (score,
 * then tiebreaks), which is how computeStandings returns them.
 */
export function awardPrizes(
  sections: Array<{ name: string; prizes?: SectionPrizes }>,
  standings: PrizeStanding[],
): PrizeAward[] {
  const awards: PrizeAward[] = []
  for (const section of sections) {
    const cfg = section.prizes
    if (!cfg) continue
    const field = standings.filter((s) => s.section === section.name)
    const pools: Pool[] = []
    if (cfg.place?.length) {
      pools.push({ key: 'place', label: 'place', slots: cfg.place, eligible: () => true, isPlace: true })
    }
    for (const [n, c] of (cfg.classes ?? []).entries()) {
      if (c.prizes?.length) pools.push({ key: `class${n}`, label: c.label, slots: c.prizes, eligible: classEligible(c), isPlace: false })
    }
    if (pools.length === 0) continue

    // Who has been moved out of which pool because another pays them more.
    // Only ever grows, so this settles.
    const excluded = new Map<string, Set<string>>()
    const isOut = (pool: Pool, id: string) => excluded.get(pool.key)?.has(id) ?? false
    let shares = new Map<string, Map<string, { cash: number; first: number; last: number; tied: number }>>()
    let chosen = new Map<string, string>()
    for (let guard = 0; guard < 100; guard++) {
      shares = new Map(pools.map((pool) => [
        pool.key,
        poolShares(pool, field.filter((p) => pool.eligible(p) && !isOut(pool, p.member_id))),
      ]))
      // Each player's best-paying pool; on equal cash the place prize wins.
      chosen = new Map()
      for (const p of field) {
        let best: { key: string; cash: number } | null = null
        for (const pool of pools) {
          const s = shares.get(pool.key)?.get(p.member_id)
          if (!s || s.cash <= 0) continue
          if (!best || s.cash > best.cash + 1e-9) best = { key: pool.key, cash: s.cash }
        }
        if (best) chosen.set(p.member_id, best.key)
      }
      let changed = false
      for (const [id, key] of chosen) {
        for (const pool of pools) {
          if (pool.key === key || isOut(pool, id)) continue
          if ((shares.get(pool.key)?.get(id)?.cash ?? 0) > 0) {
            if (!excluded.has(pool.key)) excluded.set(pool.key, new Set())
            excluded.get(pool.key)!.add(id)
            changed = true
          }
        }
      }
      if (!changed) break
    }

    // Cash.
    const byMember = new Map<string, PrizeAward>()
    for (const [id, key] of chosen) {
      const pool = pools.find((x) => x.key === key)!
      const s = shares.get(key)!.get(id)!
      const places = s.first === s.last ? ordinal(s.first) : `${ordinal(s.first)}–${ordinal(s.last)}`
      const name = pool.isPlace ? `${places} place` : `${pool.label}${pool.slots.length > 1 ? `, ${places}` : ''}`
      byMember.set(id, { member_id: id, section: section.name, prize: s.tied > 1 ? `${name} (tie)` : name, cash: round2(s.cash), items: [] })
    }

    // Non-cash items by tiebreak order: the n-th eligible player in the
    // standings gets slot n's item. Cash winners of other pools still count
    // as occupying their place here, unlike cash, since a trophy for 1st
    // should go to whoever finished 1st.
    for (const pool of pools) {
      const eligible = field.filter(pool.eligible)
      pool.slots.forEach((slot, n) => {
        const winner = eligible[n]
        if (!slot.label || !winner) return
        const entry = byMember.get(winner.member_id) ?? {
          member_id: winner.member_id,
          section: section.name,
          prize: pool.isPlace ? `${ordinal(n + 1)} place` : pool.label,
          cash: 0,
          items: [],
        }
        entry.items.push(pool.isPlace ? `${slot.label} (${ordinal(n + 1)})` : `${slot.label} (${pool.label})`)
        byMember.set(winner.member_id, entry)
      })
    }

    const order = new Map(field.map((p, i) => [p.member_id, i]))
    awards.push(...[...byMember.values()].sort((a, b) => (order.get(a.member_id) ?? 0) - (order.get(b.member_id) ?? 0)))
  }
  return awards
}

/** Total cash on offer in a section, for the "prize fund" line. */
export function prizeFundTotal(cfg: SectionPrizes | undefined): number {
  if (!cfg) return 0
  const sum = (slots: PrizeSlot[] = []) => slots.reduce((a, s) => a + Math.max(0, s.amount ?? 0), 0)
  return sum(cfg.place) + (cfg.classes ?? []).reduce((a, c) => a + sum(c.prizes), 0)
}
