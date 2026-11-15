// test/unit/club-switches.test.ts
//
// What the clubs switches turn on together, in src/areas/clubs/switches.ts:
// the public clubs pages need newClubs and newLook both, as the new header
// needs newNav and newLook in src/lib/nav.ts; the keepers' pages need
// clubKeepers alone; the representatives' club events need regionEvents and
// clubKeepers both. Each is read with every switch off, with its own
// switches on, and with every switch on, and each reads the switches as
// written when given none. Whether a switch is on as shipped is for
// test/unit/features.test.ts.
import { describe, expect, it } from 'vitest'
import { FEATURES, type FeatureName, type Features } from '@/lib/features'
import { clubPagesOn, keepersOn, regionEventsOn } from '@/areas/clubs/switches'

const NAMES = Object.keys(FEATURES) as FeatureName[]
const ALL_OFF = Object.fromEntries(NAMES.map((n) => [n, false])) as Features
const ALL_ON = Object.fromEntries(NAMES.map((n) => [n, true])) as Features
const withOn = (...names: FeatureName[]): Features => ({ ...ALL_OFF, ...Object.fromEntries(names.map((n) => [n, true])) })

describe('clubPagesOn', () => {
  it('is on only with newClubs and newLook both on', () => {
    expect(clubPagesOn(ALL_OFF)).toBe(false)
    expect(clubPagesOn(withOn('newClubs'))).toBe(false)
    expect(clubPagesOn(withOn('newLook'))).toBe(false)
    expect(clubPagesOn(withOn('newClubs', 'newLook'))).toBe(true)
    expect(clubPagesOn(ALL_ON)).toBe(true)
  })

  it('reads no other switch: every other switch on leaves it off without newClubs', () => {
    expect(clubPagesOn({ ...ALL_ON, newClubs: false })).toBe(false)
    expect(clubPagesOn({ ...ALL_ON, newLook: false })).toBe(false)
    expect(clubPagesOn(withOn('newClubs', 'newLook', 'clubKeepers', 'regionEvents', 'clubEmailHidden'))).toBe(true)
  })
})

describe('keepersOn', () => {
  it('follows clubKeepers alone', () => {
    expect(keepersOn(ALL_OFF)).toBe(false)
    expect(keepersOn(withOn('clubKeepers'))).toBe(true)
    expect(keepersOn({ ...ALL_ON, clubKeepers: false })).toBe(false)
    expect(keepersOn(withOn('newClubs', 'newLook', 'regionEvents', 'clubEmailHidden'))).toBe(false)
  })
})

describe('regionEventsOn', () => {
  it('is on only with regionEvents and clubKeepers both on', () => {
    expect(regionEventsOn(ALL_OFF)).toBe(false)
    expect(regionEventsOn(withOn('regionEvents'))).toBe(false)
    expect(regionEventsOn(withOn('clubKeepers'))).toBe(false)
    expect(regionEventsOn(withOn('regionEvents', 'clubKeepers'))).toBe(true)
    expect(regionEventsOn({ ...ALL_ON, clubKeepers: false })).toBe(false)
  })

  it('needs neither newClubs nor standingDirectors', () => {
    expect(regionEventsOn({ ...ALL_ON, newClubs: false, newLook: false, standingDirectors: false })).toBe(true)
  })
})

describe('the site as shipped', () => {
  it('reads the switches as written when given none', () => {
    expect(clubPagesOn()).toBe(clubPagesOn(FEATURES))
    expect(keepersOn()).toBe(keepersOn(FEATURES))
    expect(regionEventsOn()).toBe(regionEventsOn(FEATURES))
  })
})
