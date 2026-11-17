// test/unit/club-switches-exhaustive.test.ts
//
// The order the clubs switches may be turned on in, checked over every
// combination rather than case by case: for each setting of clubEmailHidden,
// newLook, clubKeepers, regionEvents and newClubs, with each server constant
// set to match its switch, switchOrderProblems names a problem exactly when
// the order is broken, as the rule is written out here from the brief. It
// never reads whether a switch is on as shipped: test/unit/features.test.ts
// holds that.
import { describe, expect, it } from 'vitest'
import { FEATURES, type FeatureName, type Features } from '@/lib/features'
import { switchOrderProblems, type ClubServerSwitches } from '@/areas/clubs/switches'

interface Setting {
  clubEmailHidden: boolean
  newLook: boolean
  clubKeepers: boolean
  regionEvents: boolean
  newClubs: boolean
}

const SETTINGS: Setting[] = Array.from({ length: 32 }, (_, n) => ({
  clubEmailHidden: Boolean(n & 1),
  newLook: Boolean(n & 2),
  clubKeepers: Boolean(n & 4),
  regionEvents: Boolean(n & 8),
  newClubs: Boolean(n & 16),
}))

const ALL_OFF = Object.fromEntries((Object.keys(FEATURES) as FeatureName[]).map((n) => [n, false])) as Features
const NONE_SET: ClubServerSwitches = { CLUB_EMAIL_HIDDEN: false, CLUB_PAGES_ON: false, CLUB_KEEPERS_ON: false, REGION_EVENTS_ON: false }

/** The brief's order, written as the sentences it gives. */
function keepsTheOrder(s: Setting): boolean {
  if (s.clubKeepers && !s.clubEmailHidden) return false
  if (s.newClubs && !s.clubEmailHidden) return false
  if (s.newClubs && !s.newLook) return false
  if (s.regionEvents && !s.clubKeepers) return false
  return true
}

const label = (s: Setting) => Object.entries(s).filter(([, on]) => on).map(([name]) => name).join(', ') || 'nothing on'

describe('the order, over every combination of the five switches', () => {
  it.each(SETTINGS.map((s) => [label(s), s] as const))('with %s on, a switch and its constant set together', (_name, s) => {
    const features = { ...ALL_OFF, ...s }
    const constants: ClubServerSwitches = {
      CLUB_EMAIL_HIDDEN: s.clubEmailHidden,
      CLUB_PAGES_ON: s.newClubs,
      CLUB_KEEPERS_ON: s.clubKeepers,
      REGION_EVENTS_ON: s.regionEvents,
    }
    const problems = switchOrderProblems(features, constants)
    if (keepsTheOrder(s)) expect(problems).toEqual([])
    else expect(problems.length).toBeGreaterThan(0)
    // Switch and constant broke the order together, so each problem comes as a pair of sentences.
    expect(problems.length % 2).toBe(0)
    for (const problem of problems) expect(problem).toMatch(/^[A-Za-z_]+ is (on|set) while [A-Za-z_]+ is (off|not): .+\.$/)
  })

  it('names a problem when only a constant is out of order, with every switch off', () => {
    expect(switchOrderProblems(ALL_OFF, NONE_SET)).toEqual([])
    for (const name of ['CLUB_PAGES_ON', 'CLUB_KEEPERS_ON', 'REGION_EVENTS_ON'] as const) {
      const problems = switchOrderProblems(ALL_OFF, { ...NONE_SET, [name]: true })
      expect(problems.length, name).toBeGreaterThan(0)
      expect(problems.every((p) => p.startsWith(name)), name).toBe(true)
    }
  })

  it('does not change the answer when called twice, and does not change what it is given', () => {
    const features = { ...ALL_OFF, clubKeepers: true }
    const constants: ClubServerSwitches = { ...NONE_SET, CLUB_KEEPERS_ON: true }
    const copy = JSON.stringify([features, constants])
    expect(switchOrderProblems(features, constants)).toEqual(switchOrderProblems(features, constants))
    expect(JSON.stringify([features, constants])).toBe(copy)
  })
})
