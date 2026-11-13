// test/unit/club-pages-switch.test.ts
//
// The three clubs switches each have a server half in
// functions/utils/clubs/pages.ts, since the functions cannot read
// src/lib/features.ts (brief 0.2): newClubs with CLUB_PAGES_ON, clubKeepers
// with CLUB_KEEPERS_ON and regionEvents with REGION_EVENTS_ON. Each pair is
// turned on in the same change, so each is held equal here in the four ways
// test/unit/creation-switch.test.ts holds its pair: as the modules export
// them; as each file writes its value, once, the way vite.config.ts's
// switchInBuild reads src/lib/features.ts; by the comment above the
// constant, which says what it turns on and names the switch and this file;
// and by the constant's file reading no setting of its surroundings, so
// nothing outside the code can turn it on.
//
// The same file holds the order the switches may be turned on in, through
// switchOrderProblems in src/areas/clubs/switches.ts: clubEmailHidden with
// CLUB_EMAIL_HIDDEN first, then clubKeepers, then regionEvents, and newClubs
// only with clubEmailHidden and newLook on. The tree as shipped has no
// problem, and each state out of order has a case of its own, so a change
// that turns a switch on out of order fails here and cannot merge.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { FEATURES, type FeatureName, type Features } from '@/lib/features'
import { switchOrderProblems, type ClubServerSwitches } from '@/areas/clubs/switches'
import { CLUB_KEEPERS_ON, CLUB_PAGES_ON, REGION_EVENTS_ON } from '../../functions/utils/clubs/pages'
import { CLUB_EMAIL_HIDDEN } from '../../functions/utils/clubs/publicAnswer'

const ROOT = join(__dirname, '../..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')
const FILE = 'functions/utils/clubs/pages.ts'

/** The switch's value as src/lib/features.ts writes it: the one `name: true,` or `name: false,` line. */
function switchWritten(name: string): boolean {
  const found = [...read('src/lib/features.ts').matchAll(new RegExp(`^\\s*${name}:\\s*(true|false),`, 'gm'))]
  expect(found, `${name} is set once in src/lib/features.ts`).toHaveLength(1)
  return found[0][1] === 'true'
}

/** The constant's value as its file writes it: the one `export const NAME = true` or `= false` line. */
function constantWritten(path: string, name: string): boolean {
  const found = [...read(path).matchAll(new RegExp(`^export const ${name} = (true|false)$`, 'gm'))]
  expect(found, `${name} is set once in ${path}`).toHaveLength(1)
  return found[0][1] === 'true'
}

const PAIRS = [
  { feature: 'newClubs', constant: 'CLUB_PAGES_ON', file: FILE, value: CLUB_PAGES_ON },
  { feature: 'clubKeepers', constant: 'CLUB_KEEPERS_ON', file: FILE, value: CLUB_KEEPERS_ON },
  { feature: 'regionEvents', constant: 'REGION_EVENTS_ON', file: FILE, value: REGION_EVENTS_ON },
] as const

describe('the clubs server constants follow their switches', () => {
  it.each(PAIRS)('$constant equals FEATURES.$feature', ({ feature, value }) => {
    expect(typeof value).toBe('boolean')
    expect(value).toBe(FEATURES[feature])
  })

  it.each(PAIRS)('$file writes $constant as src/lib/features.ts writes $feature', ({ feature, constant, file }) => {
    expect(constantWritten(file, constant)).toBe(switchWritten(feature))
  })

  it.each(PAIRS)('$constant says what it turns on and names $feature and this file', ({ feature, constant, file }) => {
    const text = read(file)
    const at = text.indexOf(`export const ${constant} =`)
    expect(at).toBeGreaterThan(0)
    const comment = text.slice(text.lastIndexOf('/**', at), at)
    expect(comment).toMatch(/^\/\*\*\n \* Set: /)
    expect(comment).toContain(feature)
    expect(comment).toContain('test/unit/club-pages-switch.test.ts')
  })

  it.each(PAIRS)('$file, which holds $constant, reads no setting of its surroundings and imports nothing', ({ file }) => {
    const text = read(file)
    expect(text).not.toMatch(/\benv\b|process\.|import\.meta/)
    expect(text).not.toMatch(/^import\b/m)
  })
})

const NAMES = Object.keys(FEATURES) as FeatureName[]
const ALL_OFF = Object.fromEntries(NAMES.map((n) => [n, false])) as Features
const withOn = (...names: FeatureName[]): Features => ({ ...ALL_OFF, ...Object.fromEntries(names.map((n) => [n, true])) })
const NONE_SET: ClubServerSwitches = { CLUB_EMAIL_HIDDEN: false, CLUB_PAGES_ON: false, CLUB_KEEPERS_ON: false, REGION_EVENTS_ON: false }
const withSet = (...names: Array<keyof ClubServerSwitches>): ClubServerSwitches => ({ ...NONE_SET, ...Object.fromEntries(names.map((n) => [n, true])) })

describe('the order the clubs switches may be turned on in', () => {
  it('finds no problem in the switches and the constants as shipped', () => {
    const shipped: ClubServerSwitches = { CLUB_EMAIL_HIDDEN, CLUB_PAGES_ON, CLUB_KEEPERS_ON, REGION_EVENTS_ON }
    expect(switchOrderProblems(FEATURES, shipped)).toEqual([])
  })

  it('finds none at any point of the order: clubEmailHidden, then clubKeepers, then regionEvents, then newClubs with newLook', () => {
    const steps: Array<[FeatureName[], Array<keyof ClubServerSwitches>]> = [
      [[], []],
      [['clubEmailHidden'], ['CLUB_EMAIL_HIDDEN']],
      [['clubEmailHidden', 'clubKeepers'], ['CLUB_EMAIL_HIDDEN', 'CLUB_KEEPERS_ON']],
      [['clubEmailHidden', 'clubKeepers', 'regionEvents'], ['CLUB_EMAIL_HIDDEN', 'CLUB_KEEPERS_ON', 'REGION_EVENTS_ON']],
      [['clubEmailHidden', 'clubKeepers', 'regionEvents', 'newLook'], ['CLUB_EMAIL_HIDDEN', 'CLUB_KEEPERS_ON', 'REGION_EVENTS_ON']],
      [['clubEmailHidden', 'clubKeepers', 'regionEvents', 'newLook', 'newClubs'], ['CLUB_EMAIL_HIDDEN', 'CLUB_KEEPERS_ON', 'REGION_EVENTS_ON', 'CLUB_PAGES_ON']],
    ]
    for (const [features, constants] of steps) expect(switchOrderProblems(withOn(...features), withSet(...constants)), features.join(', ')).toEqual([])
    // newClubs may also come before clubKeepers, once clubEmailHidden and newLook are on.
    expect(switchOrderProblems(withOn('clubEmailHidden', 'newLook', 'newClubs'), withSet('CLUB_EMAIL_HIDDEN', 'CLUB_PAGES_ON'))).toEqual([])
  })

  it('refuses clubKeepers on while clubEmailHidden is off', () => {
    const problems = switchOrderProblems(withOn('clubKeepers'), NONE_SET)
    expect(problems).toHaveLength(1)
    expect(problems[0]).toMatch(/^clubKeepers is on while clubEmailHidden is off: /)
    expect(problems[0]).toContain('the email for messages is never shown')
  })

  it('refuses CLUB_KEEPERS_ON set while CLUB_EMAIL_HIDDEN is not', () => {
    const problems = switchOrderProblems(ALL_OFF, withSet('CLUB_KEEPERS_ON'))
    expect(problems).toHaveLength(1)
    expect(problems[0]).toMatch(/^CLUB_KEEPERS_ON is set while CLUB_EMAIL_HIDDEN is not: /)
  })

  it('refuses newClubs on while clubEmailHidden is off, even with newLook on', () => {
    const problems = switchOrderProblems(withOn('newClubs', 'newLook'), NONE_SET)
    expect(problems).toHaveLength(1)
    expect(problems[0]).toMatch(/^newClubs is on while clubEmailHidden is off: /)
    expect(problems[0]).toContain('today\'s club page and its answer stay live')
  })

  it('refuses CLUB_PAGES_ON set while CLUB_EMAIL_HIDDEN is not, even with newLook on', () => {
    const problems = switchOrderProblems(withOn('newLook'), withSet('CLUB_PAGES_ON'))
    expect(problems).toHaveLength(1)
    expect(problems[0]).toMatch(/^CLUB_PAGES_ON is set while CLUB_EMAIL_HIDDEN is not: /)
  })

  it('refuses newClubs on while newLook is off, even with clubEmailHidden on', () => {
    const problems = switchOrderProblems(withOn('newClubs', 'clubEmailHidden'), withSet('CLUB_EMAIL_HIDDEN'))
    expect(problems).toHaveLength(1)
    expect(problems[0]).toMatch(/^newClubs is on while newLook is off: /)
  })

  it('refuses CLUB_PAGES_ON set while newLook is off, since the constant follows newClubs alone', () => {
    const problems = switchOrderProblems(withOn('clubEmailHidden'), withSet('CLUB_EMAIL_HIDDEN', 'CLUB_PAGES_ON'))
    expect(problems).toHaveLength(1)
    expect(problems[0]).toMatch(/^CLUB_PAGES_ON is set while newLook is off: /)
    expect(problems[0]).toContain('serve the sitemap and open the forms')
  })

  it('refuses regionEvents on while clubKeepers is off', () => {
    const problems = switchOrderProblems(withOn('regionEvents', 'clubEmailHidden'), withSet('CLUB_EMAIL_HIDDEN'))
    expect(problems).toHaveLength(1)
    expect(problems[0]).toMatch(/^regionEvents is on while clubKeepers is off: /)
  })

  it('refuses REGION_EVENTS_ON set while CLUB_KEEPERS_ON is not', () => {
    const problems = switchOrderProblems(withOn('clubEmailHidden'), withSet('CLUB_EMAIL_HIDDEN', 'REGION_EVENTS_ON'))
    expect(problems).toHaveLength(1)
    expect(problems[0]).toMatch(/^REGION_EVENTS_ON is set while CLUB_KEEPERS_ON is not: /)
  })

  it('names every problem at once, one sentence each, when everything is on but clubEmailHidden', () => {
    const features = { ...withOn(...NAMES), clubEmailHidden: false }
    const problems = switchOrderProblems(features, withSet('CLUB_PAGES_ON', 'CLUB_KEEPERS_ON', 'REGION_EVENTS_ON'))
    expect(problems.map((p) => p.slice(0, p.indexOf(':')))).toEqual([
      'clubKeepers is on while clubEmailHidden is off',
      'CLUB_KEEPERS_ON is set while CLUB_EMAIL_HIDDEN is not',
      'newClubs is on while clubEmailHidden is off',
      'CLUB_PAGES_ON is set while CLUB_EMAIL_HIDDEN is not',
    ])
    for (const problem of problems) expect(problem.endsWith('.')).toBe(true)
  })
})
