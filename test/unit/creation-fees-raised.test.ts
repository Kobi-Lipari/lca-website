// test/unit/creation-fees-raised.test.ts
//
// feesRaised (domain/events/creation.ts) on the lists WS08 steps 4 and 10
// build: the event's own price and each section's, worked out with tierFees
// (domain/events/sections.ts) from the columns stored and the columns a save
// sends, so that a raise is a rise in what an entrant pays at any tier,
// early, regular or late. The record's deviation "A raise is a rise in what
// an entrant pays" names what passes (a discount that appears, a deadline
// that makes a stored discount real, an own early price below regular) and
// what is a raise (a late fee that appears, an own tier price above
// regular); each is held here on the columns themselves, with the edges
// around them: a discount that shrinks or is taken away, a late fee raised
// or lowered, a free event, a section added, removed, priced or following
// the event's fee, and prices worked out to the cent. Then the comparison's
// own properties, on lists of every shape: a list never raises against
// itself, its copy or its own order, nor once an entry is left out or a
// price lowered at any tier; any one price raised at any tier always does;
// and the lists handed in are never changed.
import { describe, expect, it } from 'vitest'
import { feesRaised } from '../../domain/events/creation'
import { tierFees, type TierFees, type TierSection, type TierTournament } from '../../domain/events/sections'

type Section = TierSection & { key: string }
type Priced = ReadonlyArray<{ key: string; fees: TierFees }>

/** The key of the event's own price, beside its sections' keys in the one list. */
const EVENT = 'event'

/** The list a save is compared by: the event's own price and each section's, as tierFees works them out. */
function priced(tournament: TierTournament, sections: readonly Section[]): Priced {
  return [
    { key: EVENT, fees: tierFees({}, tournament) },
    ...sections.map(({ key, ...own }) => ({ key, fees: tierFees(own, tournament) })),
  ]
}

/** A Central wall-clock deadline for the early price, and the time the late price starts. */
const DEADLINE = '2026-11-20T23:59'
const LATE_AFTER = '2026-12-01T00:00'

const BASE: TierTournament = { entry_fee: 30 }
const SECTIONS: readonly Section[] = [{ key: 'open' }, { key: 'u1400', feeRegular: 20 }]
const EARLY = (discount: number, at: string | null = DEADLINE): TierTournament => ({ ...BASE, early_deadline: at, early_discount: discount })
const LATE = (fee: number, at: string | null = LATE_AFTER): TierTournament => ({ ...BASE, late_after: at, late_fee: fee })
const withU1400 = (own: TierSection): Section[] => [SECTIONS[0], { key: 'u1400', feeRegular: 20, ...own }]

type Case = readonly [name: string, before: readonly [TierTournament, readonly Section[]], after: readonly [TierTournament, readonly Section[]], raised: boolean]

describe('feesRaised on the columns a save sends, through tierFees', () => {
  const CASES: readonly Case[] = [
    ['a save that sends the stored prices back', [BASE, SECTIONS], [{ ...BASE }, SECTIONS.map((s) => ({ ...s }))], false],
    ['a save that sends the stored prices back, discount and late fee included', [{ ...EARLY(5), ...LATE(10) }, SECTIONS], [{ ...EARLY(5), ...LATE(10) }, SECTIONS], false],
    // What passes, as the record's deviation names it.
    ['an early discount that appears with its deadline', [BASE, SECTIONS], [EARLY(5), SECTIONS], false],
    ['a deadline that makes a stored discount real', [EARLY(5, null), SECTIONS], [EARLY(5), SECTIONS], false],
    ['a section\'s own early price below its regular price', [BASE, SECTIONS], [BASE, withU1400({ feeEarly: 15 })], false],
    // What is a raise, as the record's deviation names it.
    ['a late fee that appears with its start', [BASE, SECTIONS], [LATE(10), SECTIONS], true],
    ['a section\'s own early price above its regular price', [BASE, SECTIONS], [BASE, withU1400({ feeEarly: 25 })], true],
    ['a section\'s own late price above its regular price, with no late fee on the event', [BASE, SECTIONS], [BASE, withU1400({ feeLate: 25 })], true],
    // The edges around them.
    ['a discount that grows', [EARLY(5), SECTIONS], [EARLY(10), SECTIONS], false],
    ['a discount that shrinks: an early entrant pays more', [EARLY(10), SECTIONS], [EARLY(5), SECTIONS], true],
    ['a discount taken away with its deadline: an early entrant pays the regular price', [EARLY(5), SECTIONS], [BASE, SECTIONS], true],
    ['a stored discount with no deadline, taken away: no one paid less', [EARLY(5, null), SECTIONS], [BASE, SECTIONS], false],
    ['a deadline moved, the discount kept', [EARLY(5), SECTIONS], [EARLY(5, '2026-11-27T23:59'), SECTIONS], false],
    ['a discount larger than the fee, made larger still: the early price stays at $0', [{ ...EARLY(35) }, SECTIONS], [{ ...EARLY(50) }, SECTIONS], false],
    ['a discount larger than the fee, cut below it: the early price rises from $0', [{ ...EARLY(35) }, SECTIONS], [{ ...EARLY(25) }, SECTIONS], true],
    ['a late fee taken away', [LATE(10), SECTIONS], [BASE, SECTIONS], false],
    ['a late fee lowered', [LATE(10), SECTIONS], [LATE(5), SECTIONS], false],
    ['a late fee raised', [LATE(10), SECTIONS], [LATE(15), SECTIONS], true],
    ['a late fee kept, its start moved', [LATE(10), SECTIONS], [LATE(10, '2026-12-03T00:00'), SECTIONS], false],
    ['the event\'s fee raised: the event and every section without a price of its own', [BASE, SECTIONS], [{ entry_fee: 35 }, SECTIONS], true],
    ['the event\'s fee raised, every section priced on its own: the event\'s own price still rises', [BASE, [{ key: 'open', feeRegular: 30 }]], [{ entry_fee: 35 }, [{ key: 'open', feeRegular: 30 }]], true],
    ['the event\'s fee lowered', [BASE, SECTIONS], [{ entry_fee: 25 }, SECTIONS], false],
    ['a section\'s own regular price raised', [BASE, SECTIONS], [BASE, withU1400({ feeRegular: 22 })], true],
    ['a section\'s own regular price taken off, so it follows the event\'s higher fee', [BASE, SECTIONS], [BASE, withU1400({ feeRegular: null })], true],
    ['a section\'s own regular price taken off, so it follows the event\'s lower fee', [{ entry_fee: 15 }, SECTIONS], [{ entry_fee: 15 }, withU1400({ feeRegular: null })], false],
    ['a section\'s own late price below its regular price', [BASE, SECTIONS], [BASE, withU1400({ feeLate: 15 })], false],
    ['a section\'s own early price set to its regular price', [BASE, SECTIONS], [BASE, withU1400({ feeEarly: 20 })], false],
    ['a free event given a discount: nothing to take it from', [{ entry_fee: 0 }, [{ key: 'open' }]], [{ entry_fee: 0, early_deadline: DEADLINE, early_discount: 5 }, [{ key: 'open' }]], false],
    ['a free event given a late fee: a free section has no late price', [{ entry_fee: 0 }, [{ key: 'open' }]], [{ entry_fee: 0, late_after: LATE_AFTER, late_fee: 10 }, [{ key: 'open' }]], false],
    ['a free section given a price', [BASE, withU1400({ feeRegular: 0 })], [BASE, withU1400({ feeRegular: 10 })], true],
    ['a section added at the event\'s fee', [BASE, SECTIONS], [BASE, [...SECTIONS, { key: 'u1000' }]], true],
    ['a section added free', [BASE, SECTIONS], [BASE, [...SECTIONS, { key: 'u1000', feeRegular: 0 }]], false],
    ['a section added free on an event with a discount and a late fee', [{ ...EARLY(5), ...LATE(10) }, SECTIONS], [{ ...EARLY(5), ...LATE(10) }, [...SECTIONS, { key: 'u1000', feeRegular: 0 }]], false],
    ['a section removed', [BASE, SECTIONS], [BASE, [SECTIONS[0]]], false],
    ['every section removed', [BASE, SECTIONS], [BASE, []], false],
    ['$7.50 off, then $7.49 off: a cent more for an early entrant', [{ entry_fee: 25, early_deadline: DEADLINE, early_discount: 7.5 }, SECTIONS], [{ entry_fee: 25, early_deadline: DEADLINE, early_discount: 7.49 }, SECTIONS], true],
    ['$7.49 off, then $7.50 off: a cent less', [{ entry_fee: 25, early_deadline: DEADLINE, early_discount: 7.49 }, SECTIONS], [{ entry_fee: 25, early_deadline: DEADLINE, early_discount: 7.5 }, SECTIONS], false],
    ['the regular price lowered and the discount taken away: the early entrant still pays more', [EARLY(10), SECTIONS], [{ entry_fee: 25 }, SECTIONS], true],
    ['the regular price lowered past the discount it loses: the early entrant pays less', [EARLY(5), [SECTIONS[0]]], [{ entry_fee: 24 }, [SECTIONS[0]]], false],
    ['the same, with a section priced on its own: its discount taken away raises its early price', [EARLY(5), SECTIONS], [{ entry_fee: 24 }, SECTIONS], true],
  ]

  it.each(CASES)('%s', (_name, [beforeEvent, beforeSections], [afterEvent, afterSections], raised) => {
    expect(feesRaised(priced(beforeEvent, beforeSections), priced(afterEvent, afterSections))).toBe(raised)
  })

  it('reads a tier tierFees leaves without a price as the regular price, in both lists', () => {
    // tierFees gives null for a tier with no price of its own or worked out.
    expect(tierFees({}, BASE)).toEqual({ regular: 30, early: null, late: null })
    expect(feesRaised([{ key: EVENT, fees: { regular: 30, early: null, late: null } }], [{ key: EVENT, fees: { regular: 30, early: 30, late: 30 } }])).toBe(false)
    expect(feesRaised([{ key: EVENT, fees: { regular: 30, early: 30, late: 30 } }], [{ key: EVENT, fees: { regular: 30, early: null, late: null } }])).toBe(false)
  })
})

describe('feesRaised\'s own properties, on lists of every shape', () => {
  const fees = (regular: number, early: number | null = null, late: number | null = null): TierFees => ({ regular, early, late })
  const LISTS: readonly Priced[] = [
    [],
    [{ key: 'a', fees: fees(20) }],
    [{ key: 'a', fees: fees(0) }],
    [{ key: 'a', fees: fees(20, 15, 25) }, { key: 'b', fees: fees(0) }],
    [{ key: 'a', fees: fees(30, 30, 30) }, { key: 'b', fees: fees(10, 0) }, { key: 'c', fees: fees(45.5, 40.25, 50) }],
    [{ key: EVENT, fees: fees(25, 20) }, { key: 'open', fees: fees(25, null, 35) }, { key: 'u1200', fees: fees(15, 12.5, null) }],
  ]
  const copy = (list: Priced): Priced => list.map((e) => ({ key: e.key, fees: { ...e.fees } }))
  const reversed = (list: Priced): Priced => [...list].reverse()
  type Tier = 'early' | 'regular' | 'late'
  const TIERS: readonly Tier[] = ['early', 'regular', 'late']
  /** What an entrant pays at the tier: the tier's own price, or the regular price when it has none. */
  const pays = (f: TierFees, tier: Tier) => (tier === 'regular' ? f.regular : (f[tier] ?? f.regular))
  /** The list with one entry's price at one tier moved by `by`, the tier given a price of its own when it had none. */
  function moved(list: Priced, index: number, tier: Tier, by: number): Priced {
    return list.map((e, i) => {
      if (i !== index) return { key: e.key, fees: { ...e.fees } }
      if (tier === 'regular') {
        // The early and late prices keep what the entrant paid at them, so only the regular tier moves.
        return { key: e.key, fees: { regular: e.fees.regular + by, early: pays(e.fees, 'early'), late: pays(e.fees, 'late') } }
      }
      return { key: e.key, fees: { ...e.fees, [tier]: pays(e.fees, tier) + by } }
    })
  }

  it('a list never raises against itself or its copy', () => {
    for (const list of LISTS) {
      expect(feesRaised(list, list)).toBe(false)
      expect(feesRaised(list, copy(list))).toBe(false)
    }
  })

  it('the order of either list changes no answer', () => {
    for (const before of LISTS) {
      for (const after of LISTS) {
        const answer = feesRaised(before, after)
        expect(feesRaised(reversed(before), after)).toBe(answer)
        expect(feesRaised(before, reversed(after))).toBe(answer)
        expect(feesRaised(reversed(before), reversed(after))).toBe(answer)
      }
    }
  })

  it('leaving any entry out never makes a raise', () => {
    for (const list of LISTS) {
      list.forEach((_entry, i) => expect(feesRaised(list, list.filter((_e, j) => j !== i))).toBe(false))
    }
  })

  it('any one price lowered, at any tier, never raises; any one price raised, at any tier, always does', () => {
    for (const list of LISTS) {
      list.forEach((entry, i) => {
        for (const tier of TIERS) {
          const name = `${entry.key}, ${tier}`
          expect(feesRaised(list, moved(list, i, tier, 1)), name).toBe(true)
          expect(feesRaised(list, moved(list, i, tier, 0.01)), name).toBe(true)
          if (pays(entry.fees, tier) > 0) expect(feesRaised(list, moved(list, i, tier, -Math.min(1, pays(entry.fees, tier)))), name).toBe(false)
        }
      })
    }
  })

  it('an empty list after a save never raises; a priced entry against an empty list always does', () => {
    for (const list of LISTS) expect(feesRaised(list, [])).toBe(false)
    expect(feesRaised([], [{ key: 'a', fees: fees(0.01) }])).toBe(true)
    expect(feesRaised([], [{ key: 'a', fees: fees(0, 1) }])).toBe(true)
    expect(feesRaised([], [{ key: 'a', fees: fees(0, null, 1) }])).toBe(true)
    expect(feesRaised([], [{ key: 'a', fees: fees(0, 0, 0) }])).toBe(false)
  })

  it('matches keys exactly: an entry under a key the earlier list does not hold is new, and priced from $0', () => {
    const before: Priced = [{ key: 'open', fees: fees(20) }]
    expect(feesRaised(before, [{ key: 'Open', fees: fees(20) }])).toBe(true)
    expect(feesRaised(before, [{ key: 'open ', fees: fees(20) }])).toBe(true)
    expect(feesRaised(before, [{ key: 'open', fees: fees(20) }])).toBe(false)
  })

  it('changes neither list it is handed', () => {
    for (const before of LISTS) {
      for (const after of LISTS) {
        const freeze = (list: Priced) => Object.freeze(list.map((e) => Object.freeze({ key: e.key, fees: Object.freeze({ ...e.fees }) })))
        const [b, a] = [freeze(before), freeze(after)]
        expect(() => feesRaised(b, a)).not.toThrow()
        expect(b).toEqual(before)
        expect(a).toEqual(after)
      }
    }
  })
})
