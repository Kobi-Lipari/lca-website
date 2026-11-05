// test/unit/saved-section-fees.test.ts
//
// savedSectionFees in functions/utils/events/sectionsRepo.ts, the one helper
// that reads a request's sections as the section writer will store them, for
// the fee rule on a save and on a create (D24, WS08 step 4), and what
// feesRaised in domain/events/creation.ts answers on its lists. It needs no
// database: the stored rows are written out here as loadSections answers
// them, live rows first by position, then archived ones, latest first.
//   1. With no list, every row as stored, keyed by its id, in order, the
//      archived ones after the live ones, since the waitlist's offer prices
//      an entry left in an archived section from its row.
//   2. Each element matched as buildSaveSections matches it: by id first,
//      every id before any name; else the live row of its name; else the
//      first archived row of that name in the stored order; else new, keyed
//      by its place in the list. An id that names no row is new and is never
//      matched by its name. After the elements, every row the list does not
//      take, live or archived, at its own prices, in the stored order.
//   3. Each price as the writer stores it: the regular price from a numeric
//      entryFee alone, else the event's fee, for a bare name and for a fee
//      left out, null or not a number; the early and late prices from fees
//      only when they carry no regular price, a number setting a tier and
//      null clearing it, else the matched row's, null for a new section; and
//      the tiers from the event's columns as tierFees works them out.
//   4. The verdicts the rule reads: the manage answer sent back, a section
//      left out, a lowered price, a discount, a section brought back from the
//      archive at the prices its row kept and a price below $0 set to $0 are
//      no raise; a price one cent up at any tier, a discount taken away, a
//      bare name that puts a free section at the event's fee, a new section
//      above $0, a section brought back above its row's prices and the
//      event's fee raised where only an archived row pays it are.
import { describe, expect, it } from 'vitest'
import { feesRaised } from '../../domain/events/creation'
import { tierFees, type SectionListItem, type SectionRecord, type TierTournament } from '../../domain/events/sections'
import { savedSectionFees, sectionResponse, type SectionFeesEntry } from '../../functions/utils/events/sectionsRepo'

let rowSeq = 0
/** A stored row as loadSections reads it, every price null unless given. */
function row(name: string, opts: Partial<SectionRecord> = {}): SectionRecord {
  rowSeq += 1
  return {
    id: `row${rowSeq}`,
    tournamentId: 'event',
    position: 0,
    name,
    feeRegular: null,
    feeEarly: null,
    feeLate: null,
    cap: null,
    prizeFund: null,
    ratingMin: null,
    ratingMax: null,
    unratedOk: null,
    gradeMin: null,
    gradeMax: null,
    rulesSet: false,
    prizes: null,
    extra: null,
    archivedAt: null,
    ...opts,
  }
}

/** An event at $25 with no early or late price. */
const PLAIN: TierTournament = { entry_fee: 25, early_deadline: null, early_discount: 0, late_after: null, late_fee: 0 }
/** The same with a $5 discount until its deadline and nothing after a late date. */
const EARLY_ONLY: TierTournament = { ...PLAIN, early_deadline: '2026-09-01T00:00', early_discount: 5 }
/** The same with a $5 discount until its deadline and a $10 late fee after its date. */
const TIERED: TierTournament = { entry_fee: 25, early_deadline: '2026-09-01T00:00', early_discount: 5, late_after: '2026-09-10T00:00', late_fee: 10 }

const keysOf = (entries: readonly SectionFeesEntry[]) => entries.map((e) => e.key)
const feesOf = (entries: readonly SectionFeesEntry[]) => entries.map((e) => e.fees)
/** The keys of the list's own elements: the first entries of the answer, before the rows the list does not take. */
const elementKeys = (stored: readonly SectionRecord[], list: readonly SectionListItem[], tournament: TierTournament = PLAIN) =>
  keysOf(savedSectionFees(stored, list, tournament).slice(0, list.length))

/**
 * An event's rows: Open at its own $25, U1600 at the event's fee, U1200
 * free, all live; and Reserve, archived, with its own late price.
 */
function eventRows() {
  const open = row('Open', { position: 0, feeRegular: 25 })
  const u1600 = row('U1600', { position: 1 })
  const u1200 = row('U1200', { position: 2, feeRegular: 0 })
  const reserve = row('Reserve', { position: 3, feeRegular: 15, feeLate: 22, archivedAt: '2026-08-01 18:00:00' })
  return { open, u1600, u1200, reserve, stored: [open, u1600, u1200, reserve] }
}

describe('savedSectionFees with no list: the event\'s rows as stored, archived ones included', () => {
  it('null and a list left out each give every row, in the stored order, the archived one after the live ones, keyed by its id and priced by tierFees', () => {
    const { open, u1600, u1200, reserve, stored } = eventRows()
    for (const list of [null, undefined]) {
      const answer = savedSectionFees(stored, list, TIERED)
      expect(keysOf(answer)).toEqual([open.id, u1600.id, u1200.id, reserve.id])
      expect(feesOf(answer)).toEqual([open, u1600, u1200, reserve].map((r) => tierFees(r, TIERED)))
      expect(feesOf(answer)).toEqual([
        { regular: 25, early: 20, late: 35 },
        { regular: 25, early: 20, late: 35 },
        { regular: 0, early: null, late: null },
        { regular: 15, early: 10, late: 22 },
      ])
    }
  })

  it('gives nothing for an event with no rows, as a create has, and each archived row for an event whose rows are all archived', () => {
    expect(savedSectionFees([], null, PLAIN)).toEqual([])
    const archived = row('Open', { feeRegular: 20, archivedAt: '2026-08-01 18:00:00' })
    expect(savedSectionFees([archived], null, PLAIN)).toEqual([{ key: archived.id, fees: { regular: 20, early: null, late: null } }])
  })
})

describe('matching, as buildSaveSections matches a list to the rows', () => {
  it('an element with an id takes that row and its key, renamed or not, so a renamed section is compared with its own row', () => {
    const { open, u1200, stored } = eventRows()
    expect(elementKeys(stored, [{ id: open.id, name: 'Championship', entryFee: 25 }, { id: u1200.id, name: 'U1200', entryFee: 0 }])).toEqual([open.id, u1200.id])
  })

  it('an archived row named by its id comes back under its own key', () => {
    const { reserve, stored } = eventRows()
    expect(elementKeys(stored, [{ id: reserve.id, name: 'Reserve', entryFee: 15 }])).toEqual([reserve.id])
  })

  it('every id is matched before any name: a name listed before the element that takes its row by id finds the archived row of that name, else is new', () => {
    const open = row('Open', { position: 0, feeRegular: 25 })
    const oldOpen = row('Open', { position: 0, feeRegular: 10, archivedAt: '2026-08-01 18:00:00' })
    const list: SectionListItem[] = ['Open', { id: open.id, name: 'Premier', entryFee: 25 }]
    expect(elementKeys([open, oldOpen], list)).toEqual([oldOpen.id, open.id])
    expect(elementKeys([open], list)).toEqual(['new:0', open.id])
  })

  it('a name takes the live row of that name before an archived one, and the first archived row in the stored order, the latest, once no live row is free', () => {
    const open = row('Open', { position: 0, feeRegular: 25 })
    const latest = row('Open', { position: 0, feeRegular: 12, archivedAt: '2026-08-02 18:00:00' })
    const earlier = row('Open', { position: 0, feeRegular: 11, archivedAt: '2026-08-01 18:00:00' })
    const stored = [open, latest, earlier]
    expect(elementKeys(stored, ['Open'])).toEqual([open.id])
    expect(elementKeys(stored, [{ id: open.id, name: 'Premier' }, 'Open'])).toEqual([open.id, latest.id])
    expect(elementKeys(stored, [{ id: open.id, name: 'Premier' }, { id: latest.id, name: 'Reserve' }, 'Open']))
      .toEqual([open.id, latest.id, earlier.id])
  })

  it('an id that names no row of the event is read as a new section and is never matched by its name, which the writer then refuses', () => {
    const { open, stored } = eventRows()
    const answer = savedSectionFees(stored, [{ id: 'another-event-row', name: 'Open', entryFee: 25 }], PLAIN)
    expect(keysOf(answer.slice(0, 1))).toEqual(['new:0'])
    // Open, taken by no element, follows with its own prices, as a row the list leaves out.
    expect(answer.slice(1)).toContainEqual({ key: open.id, fees: tierFees(open, PLAIN) })
  })

  it('a name given twice, a list the writer refuses, is read without error: the first takes the row and the second the archived row of that name, else a new key', () => {
    const { open, stored } = eventRows()
    expect(elementKeys(stored, ['Open', 'Open'])).toEqual([open.id, 'new:1'])
    const reserve = stored[3]
    expect(elementKeys(stored, [{ name: 'Reserve' }, 'Reserve'])).toEqual([reserve.id, 'new:1'])
  })

  it('keys new sections by their place in the list, so every key of one answer differs', () => {
    const { open, u1600, u1200, reserve, stored } = eventRows()
    const answer = savedSectionFees(stored, ['U800', { id: open.id, name: 'Open', entryFee: 25 }, 'K-3', 'U1600', { name: 'Blitz', entryFee: 5 }], PLAIN)
    expect(keysOf(answer)).toEqual(['new:0', open.id, 'new:2', u1600.id, 'new:4', u1200.id, reserve.id])
    expect(new Set(keysOf(answer)).size).toBe(answer.length)
  })

  it('follows the order of the list, not the order of the rows, then gives every row the list does not take, live or archived, at its own prices, in the stored order', () => {
    const { open, u1600, u1200, reserve, stored } = eventRows()
    const answer = savedSectionFees(stored, [{ id: u1200.id, name: 'U1200', entryFee: 0 }, { id: open.id, name: 'Open', entryFee: 25 }], PLAIN)
    expect(keysOf(answer)).toEqual([u1200.id, open.id, u1600.id, reserve.id])
    expect(feesOf(answer).slice(2)).toEqual([u1600, reserve].map((r) => tierFees(r, PLAIN)))
  })

  it('prices a row the list does not take under the event\'s columns as the save writes them, its own prices kept, so a row with none pays the new event fee', () => {
    const { u1600, reserve, stored } = eventRows()
    const answer = savedSectionFees(stored, ['Open', 'U1200'], { ...PLAIN, entry_fee: 40 })
    expect(answer.slice(2)).toEqual([
      { key: u1600.id, fees: { regular: 40, early: null, late: null } },
      { key: reserve.id, fees: { regular: 15, early: null, late: 22 } },
    ])
  })
})

describe('prices, as the writer stores them', () => {
  it('reads the regular price from a numeric entryFee, $0 included, and otherwise as the event\'s fee: a bare name, and a fee left out, null, text, true or an object', () => {
    const open = row('Open', { feeRegular: 30 })
    const regularOf = (item: SectionListItem) => savedSectionFees([open], [item], PLAIN)[0].fees.regular
    expect(regularOf({ id: open.id, name: 'Open', entryFee: 0 })).toBe(0)
    expect(regularOf({ id: open.id, name: 'Open', entryFee: 12.5 })).toBe(12.5)
    for (const item of [
      'Open',
      { id: open.id, name: 'Open' },
      { id: open.id, name: 'Open', entryFee: null },
      { id: open.id, name: 'Open', entryFee: '30' },
      { id: open.id, name: 'Open', entryFee: true },
      { id: open.id, name: 'Open', entryFee: { amount: 30 } },
    ] as SectionListItem[]) {
      expect(regularOf(item), JSON.stringify(item)).toBe(25)
    }
  })

  it('reads fees that carry a regular price, as every answer gives them, as setting nothing: a matched row keeps its own early and late prices and a new section has none', () => {
    const open = row('Open', { feeRegular: 30, feeEarly: 26, feeLate: 40 })
    const echoed = { regular: 30, early: 1, late: 99 }
    expect(savedSectionFees([open], [{ id: open.id, name: 'Open', entryFee: 30, fees: echoed }], PLAIN)[0].fees).toEqual({ regular: 30, early: 26, late: 40 })
    expect(savedSectionFees([open], [{ name: 'Open', entryFee: 30, fees: echoed }], PLAIN)[0].fees).toEqual({ regular: 30, early: 26, late: 40 })
    expect(savedSectionFees([], [{ name: 'Open', entryFee: 30, fees: echoed }], PLAIN)[0].fees).toEqual({ regular: 30, early: null, late: null })
  })

  it('reads fees without a regular price as the writer does: a number sets its tier, null clears it, and a tier left out keeps the row\'s', () => {
    const open = row('Open', { feeRegular: 30, feeEarly: 26, feeLate: 40 })
    const feesFor = (fees: { early?: number | null; late?: number | null }, tournament: TierTournament = PLAIN) =>
      savedSectionFees([open], [{ id: open.id, name: 'Open', entryFee: 30, fees }], tournament)[0].fees
    expect(feesFor({ early: 24 })).toEqual({ regular: 30, early: 24, late: 40 })
    expect(feesFor({ late: 45 })).toEqual({ regular: 30, early: 26, late: 45 })
    expect(feesFor({ late: null })).toEqual({ regular: 30, early: 26, late: null })
    // A tier cleared falls back to the one the event's columns give.
    expect(feesFor({ early: null, late: null }, TIERED)).toEqual({ regular: 30, early: 25, late: 40 })
    expect(feesFor({})).toEqual({ regular: 30, early: 26, late: 40 })
  })

  it('reads a section brought back from the archive with its archived row\'s own early and late prices, unless its fees set them, under that row\'s key', () => {
    const { reserve, stored } = eventRows()
    expect(savedSectionFees(stored, ['Reserve'], PLAIN)[0]).toEqual({ key: reserve.id, fees: { regular: 25, early: null, late: 22 } })
    expect(savedSectionFees(stored, [{ id: reserve.id, name: 'Reserve', entryFee: 0, fees: { late: null } }], PLAIN)[0].fees)
      .toEqual({ regular: 0, early: null, late: null })
  })

  it('works the tiers out from the event\'s columns as tierFees does: a discount with its deadline and a late fee with its date, none for a free section, and an own price before either', () => {
    const answer = savedSectionFees([], [
      { name: 'Open', entryFee: 30 },
      { name: 'U1200', entryFee: 0 },
      { name: 'U1600', entryFee: 30, fees: { early: 28 } },
      'U1000',
    ], TIERED)
    expect(feesOf(answer)).toEqual([
      { regular: 30, early: 25, late: 40 },
      { regular: 0, early: null, late: null },
      { regular: 30, early: 28, late: 40 },
      { regular: 25, early: 20, late: 35 },
    ])
  })
})

describe('what feesRaised answers on the lists, the verdicts the save rule reads', () => {
  const after = (stored: readonly SectionRecord[], list: readonly SectionListItem[] | null, tournament: TierTournament) =>
    savedSectionFees(stored, list, tournament)
  const raised = (stored: readonly SectionRecord[], list: readonly SectionListItem[] | null, tournament: TierTournament, was: TierTournament = TIERED) =>
    feesRaised(savedSectionFees(stored, null, was), after(stored, list, tournament))

  it('reads the manage answer sent back, every live section as sectionResponse gives it, as no raise, a section at the event\'s fee among them', () => {
    const { open, u1600, u1200, stored } = eventRows()
    const echo = [open, u1600, u1200].map((r) => sectionResponse(r, TIERED)) as unknown as SectionListItem[]
    expect(raised(stored, echo, TIERED)).toBe(false)
    expect(feesOf(after(stored, echo, TIERED))).toEqual(feesOf(savedSectionFees(stored, null, TIERED)))
  })

  it('reads a section left out, a lowered price, a discount that appears with its deadline and an own early price below regular as no raise', () => {
    const { open, u1600, u1200, stored } = eventRows()
    const keep = [{ id: u1600.id, name: 'U1600' }, { id: u1200.id, name: 'U1200', entryFee: 0 }]
    expect(raised(stored, [{ id: open.id, name: 'Open', entryFee: 25 }], TIERED)).toBe(false)
    expect(raised(stored, [{ id: open.id, name: 'Open', entryFee: 20 }, ...keep], TIERED)).toBe(false)
    expect(raised(stored, null, EARLY_ONLY, PLAIN)).toBe(false)
    // A deadline that makes a stored discount real lowers the early price too.
    expect(raised(stored, null, EARLY_ONLY, { ...EARLY_ONLY, early_deadline: null })).toBe(false)
    expect(raised(stored, [{ id: open.id, name: 'Open', entryFee: 25, fees: { early: 15 } }, ...keep], TIERED)).toBe(false)
  })

  it('reads a price one cent up at any tier as a raise, and the same price at every tier as none', () => {
    const { open, u1600, u1200, stored } = eventRows()
    const keep = [{ id: u1600.id, name: 'U1600' }, { id: u1200.id, name: 'U1200', entryFee: 0 }]
    const openWith = (entryFee: number, fees?: { early?: number | null; late?: number | null }) => [{ id: open.id, name: 'Open', entryFee, ...(fees ? { fees } : {}) }, ...keep]
    expect(raised(stored, openWith(25, { early: 20, late: 35 }), TIERED)).toBe(false)
    expect(raised(stored, openWith(25.01), TIERED)).toBe(true)
    expect(raised(stored, openWith(25, { early: 20.01 }), TIERED)).toBe(true)
    expect(raised(stored, openWith(25, { late: 35.01 }), TIERED)).toBe(true)
  })

  it('reads a discount taken away, by its deadline or its amount, and an own early price below regular cleared, as raises of the early price', () => {
    const { open, u1600, u1200, stored } = eventRows()
    expect(raised(stored, null, { ...TIERED, early_deadline: null })).toBe(true)
    expect(raised(stored, null, { ...TIERED, early_discount: 2 })).toBe(true)
    const own = row('Open', { feeRegular: 25, feeEarly: 15 })
    expect(feesRaised(savedSectionFees([own], null, PLAIN), savedSectionFees([own], [{ id: own.id, name: 'Open', entryFee: 25, fees: { early: null } }], PLAIN))).toBe(true)
    // A late fee taken away lowers the late price.
    expect(raised(stored, [open, u1600, u1200].map((r) => sectionResponse(r, TIERED)) as unknown as SectionListItem[], { ...TIERED, late_after: null })).toBe(false)
  })

  it('reads the event\'s fee raised as a raise only where a section pays it', () => {
    const { stored } = eventRows()
    expect(raised(stored, null, { ...TIERED, entry_fee: 30 })).toBe(true)
    const ownPrices = [row('Open', { feeRegular: 25 }), row('U1200', { position: 1, feeRegular: 0 })]
    expect(feesRaised(savedSectionFees(ownPrices, null, PLAIN), savedSectionFees(ownPrices, null, { ...PLAIN, entry_fee: 30 }))).toBe(false)
  })

  it('reads bare names that put a free section at the event\'s fee, and a new section above $0 at any tier, as raises; a new free section is none', () => {
    const { open, u1600, u1200, stored } = eventRows()
    expect(raised(stored, ['Open', 'U1600', 'U1200'], TIERED)).toBe(true)
    const keep = [{ id: open.id, name: 'Open', entryFee: 25 }, { id: u1600.id, name: 'U1600' }, { id: u1200.id, name: 'U1200', entryFee: 0 }]
    expect(raised(stored, [...keep, { name: 'U800', entryFee: 0 }], TIERED)).toBe(false)
    expect(raised(stored, [...keep, { name: 'U800', entryFee: 0.01 }], TIERED)).toBe(true)
    expect(raised(stored, [...keep, { name: 'U800', entryFee: 0, fees: { late: 5 } }], TIERED)).toBe(true)
    expect(raised(stored, [...keep, { name: 'U800', entryFee: 0, fees: { early: 5 } }], TIERED)).toBe(true)
  })

  it('reads a section brought back from the archive against its own row: at the prices it kept, or below them, no raise; a bare name at a higher event fee, or a price above them, a raise', () => {
    const { open, u1600, u1200, stored } = eventRows()
    const keep = [{ id: open.id, name: 'Open', entryFee: 25 }, { id: u1600.id, name: 'U1600' }, { id: u1200.id, name: 'U1200', entryFee: 0 }]
    expect(raised(stored, [...keep, { name: 'Reserve', entryFee: 15 }], TIERED)).toBe(false)
    expect(raised(stored, [...keep, { name: 'Reserve', entryFee: 0 }], TIERED)).toBe(false)
    expect(raised(stored, [...keep, { name: 'Reserve', entryFee: 0, fees: { late: null } }], TIERED)).toBe(false)
    expect(raised(stored, [...keep, 'Reserve'], TIERED)).toBe(true)
    expect(raised(stored, [...keep, { name: 'Reserve', entryFee: 15.01 }], TIERED)).toBe(true)
    expect(raised(stored, [...keep, { name: 'Reserve', entryFee: 15, fees: { late: 22.01 } }], TIERED)).toBe(true)
  })

  it('reads the event\'s fee raised as a raise where only an archived row pays it, whether the save sends no list or one that leaves the row archived, and as none once every row has its own price', () => {
    const open = row('Open', { position: 0, feeRegular: 25 })
    const old = row('Reserve', { position: 1, archivedAt: '2026-08-01 18:00:00' })
    const raisedTo = (stored: readonly SectionRecord[], list: readonly SectionListItem[] | null) =>
      feesRaised(savedSectionFees(stored, null, PLAIN), savedSectionFees(stored, list, { ...PLAIN, entry_fee: 30 }))
    expect(raisedTo([open, old], null)).toBe(true)
    expect(raisedTo([open, old], [{ id: open.id, name: 'Open', entryFee: 25 }])).toBe(true)
    // A live row left out keeps its stored prices, under the event's new fee.
    expect(raisedTo([open, { ...old, archivedAt: null }], [{ id: open.id, name: 'Open', entryFee: 25 }])).toBe(true)
    const priced = { ...old, feeRegular: 15 }
    expect(raisedTo([open, priced], null)).toBe(false)
    expect(raisedTo([open, priced], [{ id: open.id, name: 'Open', entryFee: 25 }])).toBe(false)
  })

  it('reads a price below $0 as $0, as checkout charges it: a fee stored below $0 set to $0, or left where it is, is no raise, a cent above $0 is one, and a new section priced below $0 is none', () => {
    const open = row('Open', { position: 0 })
    const below: TierTournament = { ...PLAIN, entry_fee: -5 }
    const raisedFrom = (after: TierTournament, list: readonly SectionListItem[] | null = null) =>
      feesRaised(savedSectionFees([open], null, below), savedSectionFees([open], list, after))
    expect(raisedFrom({ ...PLAIN, entry_fee: 0 })).toBe(false)
    expect(raisedFrom(below)).toBe(false)
    expect(raisedFrom({ ...PLAIN, entry_fee: -2 })).toBe(false)
    expect(raisedFrom({ ...PLAIN, entry_fee: 0.01 })).toBe(true)
    expect(raisedFrom(below, ['Open', { name: 'U800', entryFee: -10 }])).toBe(false)
    expect(raisedFrom(below, [{ name: 'Open', entryFee: 0, fees: { late: -1 } }])).toBe(false)
    expect(raisedFrom(below, [{ name: 'Open', entryFee: 0, fees: { late: 1 } }])).toBe(true)
  })
})
