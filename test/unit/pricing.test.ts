import { describe, expect, it } from 'vitest'
import { priceEntry, priceShownSection, type Price, type PriceTournament } from '../../functions/utils/pricing'
import { hasPassed, lcaTimeToMs } from '../../domain/format/centralTime'
import { normalizeLegacySections, tierFees, type TierFees, type TierSection } from '../../domain/events/sections'

/** A section as a tournament answer carries it, cut down to what pricing reads. */
interface AnsweredSection { name: string; fees: TierFees }

/**
 * How the tournament page and the family entry panel price a section by its
 * name: priceShownSection with the section from the answer. A name with no
 * section takes the event fee.
 */
function pagePrice(sections: AnsweredSection[], tour: PriceTournament, name: string, opts: { isLcaMember: boolean; nowMs: number }): Price {
  return priceShownSection(sections.find((s) => s.name === name), tour, opts.nowMs, { isLcaMember: opts.isLcaMember })
}

const t = {
  entry_fee: 0,
  early_deadline: '2026-10-10T23:59',
  early_discount: 10,
  late_after: '2026-10-16T12:00',
  late_fee: 15,
  member_discount: 5,
}
const sections: AnsweredSection[] = [{ name: 'Open', fees: tierFees({ feeRegular: 50 }, t) }, { name: 'Free', fees: tierFees({ feeRegular: 0 }, t) }]
const at = (iso: string) => Date.parse(iso)

describe('entry price on the tournament page', () => {
  it('applies the early discount and member discount before the early deadline', () => {
    const p = pagePrice(sections, t, 'Open', { isLcaMember: true, nowMs: at('2026-10-01T12:00:00Z') })
    expect(p.amount).toBe(35)
    expect(p.lines.map((l) => l.label)).toEqual(['Early entry discount', 'LCA member discount'])
  })

  it('charges the base fee in between and the late fee after the late date (Central time)', () => {
    expect(pagePrice(sections, t, 'Open', { isLcaMember: false, nowMs: at('2026-10-12T12:00:00Z') }).amount).toBe(50)
    // 11:30 AM Central on the 16th is before the noon late date.
    expect(pagePrice(sections, t, 'Open', { isLcaMember: false, nowMs: at('2026-10-16T16:30:00Z') }).amount).toBe(50)
    expect(pagePrice(sections, t, 'Open', { isLcaMember: false, nowMs: at('2026-10-16T18:00:00Z') }).amount).toBe(65)
  })

  it('keeps free sections free', () => {
    expect(pagePrice(sections, t, 'Free', { isLcaMember: true, nowMs: at('2026-10-01T12:00:00Z') }).amount).toBe(0)
  })
})

describe('priceShownSection prices the answered section as checkout prices the stored row', () => {
  // Checkout prices the tournament_sections row (priceEntry with its own
  // fee_regular, fee_early and fee_late); the page has only the answer, whose
  // fees mix the section's own prices with worked-out ones (tierFees).
  const tours: PriceTournament[] = [
    t,
    { ...t, entry_fee: 40 },
    // Early and late windows overlap, and the discount is larger than the fee.
    { entry_fee: 25, early_deadline: '2026-10-20T23:59', early_discount: 30, late_after: '2026-10-05T12:00', late_fee: 10, member_discount: 0 },
    { entry_fee: 30, early_deadline: null, early_discount: 0, late_after: null, late_fee: 0, member_discount: 5 },
  ]
  const rows: TierSection[] = [
    {},
    { feeRegular: 50 },
    { feeRegular: 50, feeEarly: 22 },
    { feeRegular: 50, feeLate: 70 },
    { feeEarly: 0, feeLate: 12 },
    { feeRegular: 25, feeEarly: 20, feeLate: 35 },
    { feeRegular: 0, feeEarly: 5 },
    { feeRegular: 19.99, feeEarly: 15.5 },
  ]
  /** A section's own early price equal to a worked-out one that was clamped at $0: the answer reads the same either way. */
  const ownEarlyLooksWorkedOut = (row: TierSection, tour: PriceTournament) => {
    const worked = tierFees({ feeRegular: row.feeRegular }, tour)
    return row.feeEarly != null && row.feeEarly === worked.early && worked.regular - (tour.early_discount ?? 0) < 0
  }
  const moments = ['2026-10-01T12:00:00Z', '2026-10-12T12:00:00Z', '2026-10-17T12:00:00Z', '2026-10-25T12:00:00Z'].map(at)

  it('gives the same amount and lines for every row, tournament, moment and membership', () => {
    for (const tour of tours) {
      for (const row of rows) {
        const answered = { fees: tierFees(row, tour) }
        if (ownEarlyLooksWorkedOut(row, tour)) continue
        for (const nowMs of moments) {
          for (const isLcaMember of [true, false]) {
            const label = JSON.stringify({ tour, row, nowMs, isLcaMember })
            expect(priceShownSection(answered, tour, nowMs, { isLcaMember }), label).toEqual(priceEntry(row, tour, nowMs, { isLcaMember }))
          }
        }
      }
    }
  })

  it('an own early price of $0 where the worked-out one is also $0 is read as worked out (the one case the answer cannot tell apart)', () => {
    const tour = tours[2]
    const row = { feeEarly: 0, feeLate: 12 }
    expect(ownEarlyLooksWorkedOut(row, tour)).toBe(true)
    const answered = { fees: tierFees(row, tour) }
    const nowMs = at('2026-10-10T12:00:00Z')
    // The amount still agrees here; only the size of the early line differs (the whole discount, not the whole fee).
    expect(priceShownSection(answered, tour, nowMs, { isLcaMember: false }).amount).toBe(priceEntry(row, tour, nowMs, { isLcaMember: false }).amount)
    expect(priceShownSection(answered, tour, nowMs, { isLcaMember: false }).lines[0]).toEqual({ label: 'Early entry discount', amount: -30 })
  })

  it('takes the whole early discount off before the late fee, as checkout does (25 - 30 + 10 = 5)', () => {
    const tour = tours[2]
    const answered = { fees: tierFees({}, tour) }
    expect(answered.fees).toEqual({ regular: 25, early: 0, late: 35 })
    expect(priceShownSection(answered, tour, at('2026-10-10T12:00:00Z'), { isLcaMember: false }).amount).toBe(5)
  })

  it('prices at the event fee when no section is chosen', () => {
    expect(priceShownSection(undefined, { ...t, entry_fee: 40 }, at('2026-10-12T12:00:00Z'), { isLcaMember: false })).toEqual({ amount: 40, base: 40, lines: [] })
  })
})

// The checkout price as it was worked out before priceEntry, from the legacy
// sections JSON, kept here word for word so the two can be compared.
function baseBefore(sectionsJson: string, sectionName: string, defaultFee: number): number {
  try {
    const parsed = JSON.parse(sectionsJson) as Array<{ name: string; entryFee?: number } | string>
    const match = parsed.find((s) => typeof s !== 'string' && s.name === sectionName) as { entryFee?: number } | undefined
    return match?.entryFee ?? defaultFee
  } catch {
    return defaultFee
  }
}

/** A tournament with the legacy sections JSON, as the pages held it before. */
interface PricedTournament extends PriceTournament { sections: string }

function priceBefore(tour: PricedTournament, sectionName: string, opts: { isLcaMember: boolean; nowMs: number }): Price {
  const base = baseBefore(tour.sections, sectionName, tour.entry_fee)
  const lines: Price['lines'] = []
  if (base > 0) {
    if (tour.early_deadline && (tour.early_discount ?? 0) > 0 && !hasPassed(tour.early_deadline, opts.nowMs)) {
      lines.push({ label: 'Early entry discount', amount: -(tour.early_discount as number) })
    }
    if (opts.isLcaMember && (tour.member_discount ?? 0) > 0) {
      lines.push({ label: 'LCA member discount', amount: -(tour.member_discount as number) })
    }
    if (tour.late_after && (tour.late_fee ?? 0) > 0 && hasPassed(tour.late_after, opts.nowMs)) {
      lines.push({ label: 'Late entry fee', amount: tour.late_fee as number })
    }
  }
  const amount = Math.max(0, Math.round((base + lines.reduce((s, l) => s + l.amount, 0)) * 100) / 100)
  return { amount, base, lines }
}

describe('priceEntry', () => {
  // Late date before the early deadline, so between the two both tiers apply.
  const overlap = {
    entry_fee: 30,
    early_deadline: '2026-10-20',
    early_discount: 5,
    late_after: '2026-10-10T00:00',
    late_fee: 12.5,
    member_discount: 3,
  }
  const inOverlap = lcaTimeToMs('2026-10-15T12:00')

  it('answers { amount, base, lines } with the labels the tournament page shows', () => {
    const price = priceEntry({ feeRegular: 40 }, overlap, inOverlap, { isLcaMember: true })
    expect(price).toEqual({
      amount: 44.5,
      base: 40,
      lines: [
        { label: 'Early entry discount', amount: -5 },
        { label: 'LCA member discount', amount: -3 },
        { label: 'Late entry fee', amount: 12.5 },
      ],
    })
  })

  it('uses the event fee when the section sets none', () => {
    expect(priceEntry({ feeRegular: null }, overlap, inOverlap, { isLcaMember: false })).toMatchObject({ base: 30, amount: 37.5 })
    expect(priceEntry({}, overlap, inOverlap, { isLcaMember: false }).base).toBe(30)
  })

  it('never goes below zero, and a free section has no lines', () => {
    const steep = { ...overlap, early_discount: 50, late_fee: 1 }
    expect(priceEntry({ feeRegular: 20 }, steep, inOverlap, { isLcaMember: true }).amount).toBe(0)
    expect(priceEntry({ feeRegular: 0 }, overlap, inOverlap, { isLcaMember: true })).toEqual({ amount: 0, base: 0, lines: [] })
  })

  it('reads the tiers from the columns it is given, so a changed column changes the price', () => {
    const before = lcaTimeToMs('2026-10-01T12:00')
    expect(priceEntry({ feeRegular: 25 }, { entry_fee: 25 }, before, { isLcaMember: true }).amount).toBe(25)
    expect(priceEntry({ feeRegular: 25 }, { entry_fee: 25, early_deadline: '2099-01-01', early_discount: 5, member_discount: 3 }, before, { isLcaMember: true }).amount).toBe(17)
    expect(priceEntry({ feeRegular: 25 }, { entry_fee: 25, late_after: '2020-01-01T00:00', late_fee: 10 }, before, { isLcaMember: false }).amount).toBe(35)
  })

  it("lets a section's own early or late price replace the worked-out line, under the same label", () => {
    const own = { feeRegular: 40, feeEarly: 32, feeLate: 55 }
    expect(priceEntry(own, overlap, inOverlap, { isLcaMember: false })).toEqual({
      amount: 47,
      base: 40,
      lines: [
        { label: 'Early entry discount', amount: -8 },
        { label: 'Late entry fee', amount: 15 },
      ],
    })
    // Only while the tier is open: before the late date the late price does nothing.
    const early = lcaTimeToMs('2026-10-05T12:00')
    expect(priceEntry(own, overlap, early, { isLcaMember: false }).amount).toBe(32)
    // An own price works without a discount or fee on the event, and one equal to the base adds no line.
    const bare = { entry_fee: 30, early_deadline: '2026-10-20', late_after: '2026-10-10T00:00' }
    expect(priceEntry({ feeRegular: 30, feeEarly: 25 }, bare, inOverlap, { isLcaMember: false }).lines).toEqual([{ label: 'Early entry discount', amount: -5 }])
    expect(priceEntry({ feeRegular: 30, feeEarly: 30, feeLate: 30 }, bare, inOverlap, { isLcaMember: false }).lines).toEqual([])
  })

  it('ignores a zero or negative discount or fee, as before', () => {
    const odd = { ...overlap, early_discount: -5, late_fee: 0, member_discount: -2 }
    expect(priceEntry({ feeRegular: 40 }, odd, inOverlap, { isLcaMember: true })).toEqual({ amount: 40, base: 40, lines: [] })
  })

  it('prices every case exactly as checkout did before, from the sections an answer carries', () => {
    const sectionsJson = JSON.stringify([
      { name: 'Open', entryFee: 40 }, { name: 'Reserve' }, 'Bare', { name: 'Free', entryFee: 0 }, { name: 'Odd', entryFee: 19.99 },
    ])
    const tournaments: PricedTournament[] = [
      { ...overlap, sections: sectionsJson },
      { ...overlap, sections: sectionsJson, early_deadline: null, late_after: null },
      { ...overlap, sections: sectionsJson, early_discount: 45, member_discount: 10 },
      { ...overlap, sections: sectionsJson, early_discount: 0.1, late_fee: 0.2, member_discount: 0.05 },
      { entry_fee: 2, sections: '[]', early_deadline: '2026-10-20', early_discount: 5, member_discount: 5 },
      { ...overlap, sections: 'oops' },
    ]
    // The rows the 0053 backfill makes from that JSON, priced as sectionResponse
    // answers them: fee_regular is a numeric entryFee, else null (the event fee).
    const answered = (tour: PricedTournament): AnsweredSection[] => normalizeLegacySections(tour.sections).map((s) => ({
      name: s.name,
      fees: tierFees({ feeRegular: typeof s.entryFee === 'number' ? s.entryFee : null }, tour),
    }))
    const times = ['2026-10-01T12:00', '2026-10-10T00:00', '2026-10-15T12:00', '2026-10-20', '2026-10-21T00:00'].map((v) => lcaTimeToMs(v))
    let compared = 0
    for (const tour of tournaments) {
      const list = answered(tour)
      for (const name of ['Open', 'Reserve', 'Bare', 'Free', 'Odd', 'Missing']) {
        for (const nowMs of [...times, times[3] - 1000]) {
          for (const isLcaMember of [true, false]) {
            expect(pagePrice(list, tour, name, { isLcaMember, nowMs }), `${name} at ${nowMs}`).toEqual(priceBefore(tour, name, { isLcaMember, nowMs }))
            compared++
          }
        }
      }
    }
    expect(compared).toBe(432)
  })
})

describe('priceEntry at Central midnight and the daylight-saving changes', () => {
  const free = { isLcaMember: false }
  const early = (deadline: string) => ({ entry_fee: 30, early_deadline: deadline, early_discount: 10 })
  const late = (after: string) => ({ entry_fee: 30, late_after: after, late_fee: 10 })
  const at = (iso: string) => Date.parse(iso)

  it('a date with no time means the end of that day in Louisiana, not in UTC', () => {
    // 11:59:59 PM CDT on October 10 is 04:59:59 UTC on the 11th.
    const t = early('2026-10-10')
    expect(priceEntry({}, t, at('2026-10-11T04:59:58Z'), free).amount).toBe(20)
    // A UTC reading would have closed the discount at 7:00 PM on the 9th.
    expect(priceEntry({}, t, at('2026-10-10T12:00:00Z'), free).amount).toBe(20)
    expect(priceEntry({}, t, at('2026-10-11T05:00:00Z'), free).amount).toBe(30)
  })

  it('a deadline at 12:00 AM is the start of the day in Louisiana', () => {
    const t = late('2026-10-10T00:00')
    // Midnight CDT is 05:00 UTC.
    expect(priceEntry({}, t, at('2026-10-10T04:59:59Z'), free).amount).toBe(30)
    expect(priceEntry({}, t, at('2026-10-10T05:00:01Z'), free).amount).toBe(40)
  })

  it('on the exact deadline the early discount has ended and the late fee has begun', () => {
    const edge = lcaTimeToMs('2026-10-12T18:00')
    const both = { entry_fee: 30, early_deadline: '2026-10-12T18:00', early_discount: 10, late_after: '2026-10-12T18:00', late_fee: 10 }
    expect(priceEntry({}, both, edge - 1, free).lines.map((l) => l.label)).toEqual(['Early entry discount'])
    expect(priceEntry({}, both, edge, free).lines.map((l) => l.label)).toEqual(['Late entry fee'])
    // Together, the tie charges the base plus the late fee.
    expect(priceEntry({}, both, edge, free).amount).toBe(40)
  })

  it('keeps the end of the day on the day clocks go back (November 1, 2026)', () => {
    // 11:59:59 PM CST on November 1 is 05:59:59 UTC on the 2nd; a fixed -5 offset would end it an hour early.
    const t = early('2026-11-01')
    expect(priceEntry({}, t, at('2026-11-02T00:00:00Z'), free).amount).toBe(20)
    expect(priceEntry({}, t, at('2026-11-02T05:30:00Z'), free).amount).toBe(20)
    expect(priceEntry({}, t, at('2026-11-02T06:00:00Z'), free).amount).toBe(30)
  })

  it('starts a late fee at midnight CST the day after clocks go back', () => {
    const t = late('2026-11-02T00:00')
    expect(priceEntry({}, t, at('2026-11-02T05:59:59Z'), free).amount).toBe(30)
    expect(priceEntry({}, t, at('2026-11-02T06:00:00Z'), free).amount).toBe(40)
  })

  it('keeps the end of the day on the day clocks go forward (March 8, 2026)', () => {
    const t = early('2026-03-08')
    // 11:59:59 PM CDT on March 8 is 04:59:59 UTC on the 9th.
    expect(priceEntry({}, t, at('2026-03-09T04:59:58Z'), free).amount).toBe(20)
    expect(priceEntry({}, t, at('2026-03-09T05:00:00Z'), free).amount).toBe(30)
  })

  it('reads a noon deadline on a change day in the offset in force at noon', () => {
    // Noon on March 8 is CDT (17:00 UTC); noon on November 1 is CST (18:00 UTC).
    expect(priceEntry({}, early('2026-03-08T12:00'), at('2026-03-08T16:59:59Z'), free).amount).toBe(20)
    expect(priceEntry({}, early('2026-03-08T12:00'), at('2026-03-08T17:00:00Z'), free).amount).toBe(30)
    expect(priceEntry({}, early('2026-11-01T12:00'), at('2026-11-01T17:59:59Z'), free).amount).toBe(20)
    expect(priceEntry({}, early('2026-11-01T12:00'), at('2026-11-01T18:00:00Z'), free).amount).toBe(30)
  })

  it('a deadline given with its own zone is taken as that instant', () => {
    const t = early('2026-10-10T12:00:00Z')
    expect(priceEntry({}, t, at('2026-10-10T11:59:59Z'), free).amount).toBe(20)
    expect(priceEntry({}, t, at('2026-10-10T12:00:00Z'), free).amount).toBe(30)
  })
})

describe('priceEntry with nothing or little to go on', () => {
  const now = lcaTimeToMs('2026-10-15T12:00')
  const no = { isLcaMember: false }

  it('no deadlines, discounts or fees is the base price with no lines', () => {
    expect(priceEntry({ feeRegular: 25 }, { entry_fee: 25 }, now, no)).toEqual({ amount: 25, base: 25, lines: [] })
    expect(priceEntry({ feeRegular: 25 }, { entry_fee: 25, early_deadline: null, early_discount: null, late_after: null, late_fee: null, member_discount: null }, now, { isLcaMember: true }))
      .toEqual({ amount: 25, base: 25, lines: [] })
  })

  it('a deadline with no discount, or a discount with no deadline, adds no line', () => {
    expect(priceEntry({ feeRegular: 25 }, { entry_fee: 25, early_deadline: '2099-01-01' }, now, no).lines).toEqual([])
    expect(priceEntry({ feeRegular: 25 }, { entry_fee: 25, early_discount: 5 }, now, no).lines).toEqual([])
    expect(priceEntry({ feeRegular: 25 }, { entry_fee: 25, late_after: '2020-01-01T00:00' }, now, no).lines).toEqual([])
    expect(priceEntry({ feeRegular: 25 }, { entry_fee: 25, late_fee: 5 }, now, no).lines).toEqual([])
  })

  it('the member discount only counts for an active member', () => {
    const t = { entry_fee: 25, member_discount: 5 }
    expect(priceEntry({ feeRegular: 25 }, t, now, { isLcaMember: true })).toEqual({ amount: 20, base: 25, lines: [{ label: 'LCA member discount', amount: -5 }] })
    expect(priceEntry({ feeRegular: 25 }, t, now, no).amount).toBe(25)
  })

  it('a free section stays free with every tier open, and a section without a fee takes the event fee', () => {
    const everything = { entry_fee: 0, early_deadline: '2099-01-01', early_discount: 5, late_after: '2020-01-01T00:00', late_fee: 5, member_discount: 5 }
    expect(priceEntry({ feeRegular: 0 }, everything, now, { isLcaMember: true })).toEqual({ amount: 0, base: 0, lines: [] })
    expect(priceEntry({}, everything, now, { isLcaMember: true })).toEqual({ amount: 0, base: 0, lines: [] })
    expect(priceEntry({ feeRegular: null }, { entry_fee: 12 }, now, no)).toEqual({ amount: 12, base: 12, lines: [] })
  })

  it('rounds the total to the cent and not the lines', () => {
    const t = { entry_fee: 19.99, early_deadline: '2099-01-01', early_discount: 0.1, late_after: '2020-01-01T00:00', late_fee: 0.2 }
    const p = priceEntry({ feeRegular: 19.99 }, t, now, no)
    expect(p.amount).toBe(20.09)
    expect(p.lines).toEqual([{ label: 'Early entry discount', amount: -0.1 }, { label: 'Late entry fee', amount: 0.2 }])
  })

  it('an own early price below zero still cannot take the total below zero', () => {
    expect(priceEntry({ feeRegular: 20, feeEarly: -50 }, { entry_fee: 20, early_deadline: '2099-01-01' }, now, no).amount).toBe(0)
  })

  it('uses only plain-language labels', () => {
    const t = { entry_fee: 30, early_deadline: '2099-01-01', early_discount: 5, late_after: '2020-01-01T00:00', late_fee: 5, member_discount: 5 }
    for (const line of priceEntry({ feeRegular: 30 }, t, now, { isLcaMember: true }).lines) {
      expect(line.label).not.toMatch(/uscf|\.5\b/i)
    }
  })
})
