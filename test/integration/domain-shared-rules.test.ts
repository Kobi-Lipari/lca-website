// test/integration/domain-shared-rules.test.ts
// The shared rules moved into domain/ run in the Workers runtime (the
// functions and the daily-emails worker both import them). These checks run
// them inside workerd, where Intl and the America/Chicago zone data are the
// platform's, and through the old server paths the callers still use.
import { describe, expect, it } from 'vitest'
import { hasPassed, lcaTimeToMs } from '../../functions/utils/time'
import { priceEntry } from '../../functions/utils/pricing'
import { eligibilityProblem, rulesFromName } from '../../functions/utils/sectionRules'
import { isRegion, REGIONS } from '../../functions/utils/regions'
import { FAMILY_MEMBERSHIP_CHILDREN } from '../../functions/utils/family'
import { publicName } from '../../domain/households/publicName'
import { formatDate, formatTime } from '../../domain/format'

const iso = (v: string) => new Date(lcaTimeToMs(v)).toISOString()

describe('Central wall-clock times in workerd', () => {
  it('reads midnight and the minute before it', () => {
    expect(iso('2026-10-24T00:00')).toBe('2026-10-24T05:00:00.000Z')
    expect(iso('2026-10-24T23:59')).toBe('2026-10-25T04:59:00.000Z')
    expect(iso('2026-12-24T00:00')).toBe('2026-12-24T06:00:00.000Z')
  })

  it('reads times either side of both 2026 clock changes', () => {
    expect(iso('2026-03-08T01:59')).toBe('2026-03-08T07:59:00.000Z')
    expect(iso('2026-03-08T03:00')).toBe('2026-03-08T08:00:00.000Z')
    expect(iso('2026-11-01T00:59')).toBe('2026-11-01T05:59:00.000Z')
    expect(iso('2026-11-01T02:00')).toBe('2026-11-01T08:00:00.000Z')
  })

  it('takes a bare date as the end of that day, on and around a clock change', () => {
    expect(iso('2026-03-08')).toBe('2026-03-09T04:59:59.000Z')
    expect(iso('2026-11-01')).toBe('2026-11-02T05:59:59.000Z')
  })

  it('round-trips: formatting the instant in Central gives the wall-clock text back', () => {
    for (const wall of ['2026-01-10T07:15', '2026-03-08T12:00', '2026-06-30T19:00', '2026-11-01T12:00', '2026-12-31T23:59']) {
      const ms = lcaTimeToMs(wall)
      const [date, time] = wall.split('T')
      const [h, m] = time.split(':').map(Number)
      const hour12 = ((h + 11) % 12) + 1
      expect(formatTime(ms)).toBe(`${hour12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`)
      expect(formatDate(ms, { year: true })).toMatch(new RegExp(`^[A-Z][a-z]{2}, [A-Z][a-z]{2} ${Number(date.slice(8))}, ${date.slice(0, 4)}$`))
    }
  })

  it('keeps an explicit zone as given and leaves unreadable text unreadable', () => {
    expect(iso('2026-10-17T18:00:00Z')).toBe('2026-10-17T18:00:00.000Z')
    expect(iso('2026-10-17T18:00:00-05:00')).toBe('2026-10-17T23:00:00.000Z')
    expect(Number.isNaN(lcaTimeToMs('soon'))).toBe(true)
    expect(hasPassed('soon')).toBe(false)
    expect(hasPassed('')).toBe(false)
    expect(hasPassed(undefined)).toBe(false)
  })

  it('has passed exactly at the close instant and not one millisecond before', () => {
    const close = lcaTimeToMs('2026-11-01T18:00')
    expect(hasPassed('2026-11-01T18:00', close - 1)).toBe(false)
    expect(hasPassed('2026-11-01T18:00', close)).toBe(true)
  })
})

describe('entry pricing through the server path', () => {
  const t = {
    entry_fee: 30,
    early_deadline: '2026-10-16', early_discount: 5,
    late_after: '2026-10-23T00:00', late_fee: 10, member_discount: 3,
  }
  // Open has its own fee; Reserve has none, so it takes the event fee.
  const open = { feeRegular: 40 }
  const reserve = { feeRegular: null }

  it('keeps the early discount until the end of its date in Central time, then drops it', () => {
    // A bare date closes at 11:59:59 PM Central, and the close instant itself counts as passed.
    const close = lcaTimeToMs('2026-10-16')
    expect(priceEntry(open, t, close - 1000).amount).toBe(35)
    expect(priceEntry(open, t, close).amount).toBe(40)
  })

  it('adds the late fee from Central midnight, not UTC midnight', () => {
    const midnight = lcaTimeToMs('2026-10-23T00:00')
    expect(priceEntry(open, t, midnight - 1).amount).toBe(40)
    const late = priceEntry(open, t, midnight)
    expect(late.amount).toBe(50)
    expect(late.lines.map((l) => l.label)).toEqual(['Late entry fee'])
  })

  it('uses the section fee, falling back to the event fee, and never reads the member discount left in the row', () => {
    const now = lcaTimeToMs('2026-10-20T12:00')
    expect(priceEntry(open, t, now).amount).toBe(40)
    expect(priceEntry(reserve, t, now).amount).toBe(30)
    expect(priceEntry(reserve, t, now).base).toBe(30)
  })

  it('never goes below zero and charges nothing extra on a free section', () => {
    expect(priceEntry({ feeRegular: 0 }, t, lcaTimeToMs('2026-10-25T12:00'))).toEqual({ amount: 0, base: 0, lines: [] })
    const cheap = { ...t, entry_fee: 2, early_discount: 5 }
    expect(priceEntry({}, cheap, lcaTimeToMs('2026-10-10T12:00')).amount).toBe(0)
  })

  it('prices a section with no price of its own at the event fee', () => {
    expect(priceEntry({}, t, 0).base).toBe(30)
  })
})

describe('section rules, regions and family size through the server paths', () => {
  it('reads rules from the section name and flags a player outside them', () => {
    expect(rulesFromName('U1600')).toEqual({ ratingMax: 1599, unratedOk: true })
    expect(eligibilityProblem({ name: 'U1600' }, { rating: 1600 })).toMatch(/under 1600/)
    expect(eligibilityProblem({ name: 'U1600' }, { rating: 1599 })).toBeNull()
    expect(eligibilityProblem({ name: 'U1600' }, { rating: null })).toBeNull()
    expect(eligibilityProblem({ name: '1800+' }, { rating: null })).toMatch(/rated players only/)
    expect(eligibilityProblem({ name: 'K-5' }, { rating: 900, gradeRange: { min: 6, max: 6 } })).toMatch(/Tick the box/)
    expect(eligibilityProblem({ name: 'K-5' }, { rating: 900, gradeRange: { min: 3, max: 3 } })).toBeNull()
  })

  it('knows the seven regions and nothing else', () => {
    expect(REGIONS).toHaveLength(7)
    for (const r of REGIONS) expect(isRegion(r)).toBe(true)
    for (const r of ['Greater New Orleans', 'north louisiana', '', null, undefined, 3, 'toString']) expect(isRegion(r)).toBe(false)
  })

  it('covers three children on a family membership', () => {
    expect(FAMILY_MEMBERSHIP_CHILDREN).toBe(3)
  })
})

describe('public names in workerd', () => {
  const leo = { fullName: 'Leo Robichaux', hasActiveGuardianLink: false, entryMarkedMinor: false }
  it('shortens on the entrants list only, for either trigger', () => {
    expect(publicName({ ...leo, hasActiveGuardianLink: true }, 'entrants')).toBe('Leo R.')
    expect(publicName({ ...leo, entryMarkedMinor: true }, 'entrants')).toBe('Leo R.')
    expect(publicName(leo, 'entrants')).toBe('Leo Robichaux')
    expect(publicName({ ...leo, hasActiveGuardianLink: true, entryMarkedMinor: true }, 'results')).toBe('Leo Robichaux')
  })
})
