// The redesign ships behind the switches in src/lib/features.ts. Every
// Phase 0 switch must exist and start off, so nothing new reaches visitors
// until it is turned on by hand. The switches that were there before the
// redesign must still exist.
//
// Turning a Phase 0 switch on means taking its name out of PHASE_0 below.
// WS08's switch, standingDirectors, is held off the same way in WS08 below;
// it is turned on with CREATION_ROLES_ON in functions/utils/events/creation.ts,
// in the same change that takes its name out of WS08
// (test/unit/creation-switch.test.ts holds the two equal).
import { describe, expect, it } from 'vitest'
import { FEATURES } from '@/lib/features'

const PHASE_0 = [
  'newLook',
  'themeHeritage',
  'themeScholastic',
  'newNav',
  'siteSearch',
  'homeSearch',
  'eventStrip',
  'eventStripLive',
  'liveMarker',
  'newHome',
  'homeResults',
  'homeChampions',
  'homeLive',
  'homeWeek',
  'homeRecap',
  'clubEmailHidden',
  'rosterShortNames',
] as const

const EARLIER = ['clubTournaments', 'tournamentQuickFilters', 'externalTags'] as const

/** The first part of WS08, tournament creation: its switch, held off until that part is done. */
const WS08 = ['standingDirectors'] as const

describe('feature switches', () => {
  it.each(PHASE_0)('%s exists, is a boolean and is off', (key) => {
    expect(Object.hasOwn(FEATURES, key)).toBe(true)
    expect(typeof FEATURES[key]).toBe('boolean')
    expect(FEATURES[key]).toBe(false)
  })

  it.each(WS08)('%s exists, is a boolean and is off', (key) => {
    expect(Object.hasOwn(FEATURES, key)).toBe(true)
    expect(typeof FEATURES[key]).toBe('boolean')
    expect(FEATURES[key]).toBe(false)
  })

  // Only that they exist: these switches are turned on outside the redesign.
  it.each(EARLIER)('%s is still there and is a boolean', (key) => {
    expect(Object.hasOwn(FEATURES, key)).toBe(true)
    expect(typeof FEATURES[key]).toBe('boolean')
  })

  // A subset check, not an exact one: later work adds its own switches here.
  it('holds every earlier switch, every Phase 0 switch and WS08\'s', () => {
    expect(Object.keys(FEATURES)).toEqual(expect.arrayContaining([...EARLIER, ...PHASE_0, ...WS08]))
  })

  it('runs in node, the default test environment', () => {
    // Only files that ask for jsdom get a DOM; this one does not.
    expect(typeof window).toBe('undefined')
    expect(typeof document).toBe('undefined')
  })
})
