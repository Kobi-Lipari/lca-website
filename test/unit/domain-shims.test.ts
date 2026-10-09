// The site and the server used to keep their own copies of a few rules
// (section eligibility, Central time, entry pricing, club regions, family
// size), held in step by a text comparison. Each rule now has one
// definition in domain/, and the old paths are one-line re-exports so no
// importer had to change. This test proves both halves: every old path hands
// back the very same objects as domain/, and no other file defines them.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import * as sectionRules from '../../domain/events/sectionRules'
import * as centralTime from '../../domain/format/centralTime'
import { CENTRAL_TIME_ZONE } from '../../domain/format/date'
import * as pricing from '../../domain/registration/pricing'
import * as regions from '../../domain/clubs/regions'
import * as family from '../../domain/households/family'
import * as tiers from '../../domain/membership/tiers'
import * as publicName from '../../domain/households/publicName'

import * as serverSectionRules from '../../functions/utils/sectionRules'
import * as serverTime from '../../functions/utils/time'
import * as serverPricing from '../../functions/utils/pricing'
import * as serverRegions from '../../functions/utils/regions'
import * as serverFamily from '../../functions/utils/family'

import * as browserSectionRules from '../../src/lib/sectionRules'
import * as browserTime from '../../src/lib/lcaTime'
import * as browserPricing from '../../src/lib/pricing'
import * as browserRegions from '../../src/lib/regions'
import * as browserFamily from '../../src/lib/family'

const ROOT = resolve(__dirname, '../..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

type Module = Record<string, unknown>

/** The old path, the module it loads, the domain file and the domain module. */
const SHIMS: Array<[string, Module, string, Module]> = [
  ['functions/utils/sectionRules.ts', serverSectionRules, 'domain/events/sectionRules', sectionRules],
  ['src/lib/sectionRules.ts', browserSectionRules, 'domain/events/sectionRules', sectionRules],
  ['functions/utils/time.ts', serverTime, 'domain/format/centralTime', centralTime],
  ['src/lib/lcaTime.ts', browserTime, 'domain/format/centralTime', centralTime],
  ['functions/utils/pricing.ts', serverPricing, 'domain/registration/pricing', pricing],
  ['src/lib/pricing.ts', browserPricing, 'domain/registration/pricing', pricing],
  ['functions/utils/regions.ts', serverRegions, 'domain/clubs/regions', regions],
  ['src/lib/regions.ts', browserRegions, 'domain/clubs/regions', regions],
  ['src/lib/family.ts', browserFamily, 'domain/households/family', family],
]

describe('old paths re-export domain/', () => {
  it.each(SHIMS)('%s hands back the same objects as %s', (_path, shim, _to, domain) => {
    expect(Object.keys(shim).sort()).toEqual(Object.keys(domain).sort())
    expect(Object.keys(domain).length).toBeGreaterThan(0)
    for (const name of Object.keys(domain)) expect(shim[name], name).toBe(domain[name])
  })

  it.each(SHIMS)('%s is one line that re-exports everything from %s', (path, _shim, to) => {
    const lines = read(path).split('\n').filter((l) => l.trim() !== '')
    expect(lines).toHaveLength(1)
    const alias = to.replace(/^domain\//, '@domain/')
    const relativeTo = relative(join(ROOT, path, '..'), join(ROOT, to)).split('\\').join('/')
    const expected = path.startsWith('src/')
      ? `export * from '${alias}'`
      : `export * from '${relativeTo}'`
    expect(lines[0]).toBe(expected)
  })

  it('functions/utils/family.ts keeps its database helpers and re-exports the family size', () => {
    expect(serverFamily.FAMILY_MEMBERSHIP_CHILDREN).toBe(family.FAMILY_MEMBERSHIP_CHILDREN)
    expect(family.FAMILY_MEMBERSHIP_CHILDREN).toBe(3)
    for (const fn of ['listChildren', 'canActFor', 'syncFamilyCoverage']) {
      expect(typeof (serverFamily as Module)[fn], fn).toBe('function')
    }
    expect(read('functions/utils/family.ts')).toContain("from '../../domain/households/family'")
  })

  it('every function the section rules, time and pricing tests use is still exported', () => {
    for (const name of ['rulesFromName', 'effectiveRules', 'describeRules', 'eligibilityProblem', 'gradeRangeText', 'intersectGradeRanges', 'parseGradeRange', 'formatGradeRange', 'gradeLabel', 'needsGrade']) {
      expect(typeof (serverSectionRules as Module)[name], name).toBe('function')
    }
    for (const name of ['lcaTimeToMs', 'hasPassed']) expect(typeof (serverTime as Module)[name], name).toBe('function')
    expect(typeof (serverPricing as Module).priceEntry).toBe('function')
    expect(typeof (serverPricing as Module).priceShownSection).toBe('function')
    expect(typeof serverRegions.isRegion).toBe('function')
  })
})

describe('Central time has one zone constant', () => {
  it('LCA_TIME_ZONE is the zone the date formats use', () => {
    expect(centralTime.LCA_TIME_ZONE).toBe(CENTRAL_TIME_ZONE)
    expect(serverTime.LCA_TIME_ZONE).toBe('America/Chicago')
  })

  it('names the zone once in domain/', () => {
    const hits = codeFiles(['domain']).filter((f) => read(f).includes("'America/Chicago'"))
    expect(hits).toEqual(['domain/format/date.ts'])
  })

  it('converts wall-clock times either side of midnight and across both 2026 clock changes', () => {
    const iso = (v: string) => new Date(centralTime.lcaTimeToMs(v)).toISOString()
    expect(iso('2026-10-24T00:00')).toBe('2026-10-24T05:00:00.000Z')
    expect(iso('2026-10-24T23:59:30')).toBe('2026-10-25T04:59:30.000Z')
    expect(iso('2026-03-08T01:30')).toBe('2026-03-08T07:30:00.000Z') // before the spring change, CST
    expect(iso('2026-03-08T03:30')).toBe('2026-03-08T08:30:00.000Z') // after it, CDT
    expect(iso('2026-11-01T00:30')).toBe('2026-11-01T05:30:00.000Z') // before the fall change, CDT
    expect(iso('2026-11-01T03:00')).toBe('2026-11-01T09:00:00.000Z') // after it, CST
    expect(iso('2026-01-15')).toBe('2026-01-16T05:59:59.000Z')
  })

  it('keeps unreadable values unreadable', () => {
    expect(Number.isNaN(centralTime.lcaTimeToMs('not a date'))).toBe(true)
    expect(centralTime.hasPassed('not a date', Date.now())).toBe(false)
    expect(centralTime.hasPassed(null)).toBe(false)
  })
})

describe('membership tier prices', () => {
  it('are the prices checkout has always charged', () => {
    expect(tiers.MEMBERSHIP_TIER_PRICES).toEqual({ adult: 15, scholastic: 5, family: 25, senior: 10 })
  })

  it('accept only the four tiers', () => {
    for (const t of ['adult', 'scholastic', 'family', 'senior']) expect(tiers.isMembershipTier(t), t).toBe(true)
    for (const t of ['regular', '', 'toString', 'constructor', '__proto__', undefined, null, 15]) {
      expect(tiers.isMembershipTier(t), String(t)).toBe(false)
    }
  })

  it('checkout and the membership page read them from domain/', () => {
    const checkout = read('functions/api/membership/checkout.ts')
    expect(checkout).toContain("from '../../../domain/membership/tiers'")
    expect(checkout).not.toMatch(/TIER_PRICES\s*[:=]/)
    const page = read('src/pages/MembershipPage.tsx')
    expect(page).toContain("from '@domain/membership/tiers'")
    expect(page).not.toMatch(/\bprice:\s*\d/)
  })
})

// ---- One definition each -------------------------------------------------

const SKIP_DIRS = new Set(['node_modules', 'dist', '.wrangler', '.git', 'fixtures'])

function filesUnder(dir: string): string[] {
  const full = join(ROOT, dir)
  let names: string[]
  try {
    names = readdirSync(full)
  } catch {
    return []
  }
  return names.flatMap((name) => {
    if (SKIP_DIRS.has(name)) return []
    const path = join(full, name)
    if (statSync(path).isDirectory()) return filesUnder(relative(ROOT, path))
    return /\.(ts|tsx|js|mjs)$/.test(name) ? [relative(ROOT, path).split('\\').join('/')] : []
  })
}

function codeFiles(dirs: string[]): string[] {
  return dirs.flatMap(filesUnder)
}

/** Each rule and the one file allowed to define it. */
const DEFINITIONS: Array<[string, string]> = [
  ['rulesFromName', 'domain/events/sectionRules.ts'],
  ['eligibilityProblem', 'domain/events/sectionRules.ts'],
  ['priceEntry', 'domain/registration/pricing.ts'],
  ['priceShownSection', 'domain/registration/pricing.ts'],
  // The pricing adapter over the legacy sections JSON, removed once the pages
  // priced from the section rows.
  ['entryPrice', ''],
  ['sectionBaseFee', ''],
  ['lcaTimeToMs', 'domain/format/centralTime.ts'],
  ['hasPassed', 'domain/format/centralTime.ts'],
  ['REGIONS', 'domain/clubs/regions.ts'],
  ['isRegion', 'domain/clubs/regions.ts'],
  ['FAMILY_MEMBERSHIP_CHILDREN', 'domain/households/family.ts'],
  ['MEMBERSHIP_TIER_PRICES', 'domain/membership/tiers.ts'],
  ['TIER_PRICES', ''],
  ['publicName', 'domain/households/publicName.ts'],
  ['firstNameLastInitial', 'domain/households/publicName.ts'],
]

describe('each rule is defined once, in domain/', () => {
  const files = codeFiles(['domain', 'functions', 'src', 'workers', 'scripts', 'scanner'])

  it('scans the site, the server, the workers and domain/', () => {
    for (const f of ['domain/events/sectionRules.ts', 'functions/api/membership/checkout.ts', 'src/pages/MembershipPage.tsx', 'workers/daily-emails/src/index.ts']) {
      expect(files).toContain(f)
    }
  })

  it.each(DEFINITIONS)('%s', (name, home) => {
    const declares = new RegExp(`\\b(?:function\\*?|const|let|var|class)\\s+${name}\\b`)
    const found = files.filter((f) => declares.test(read(f)))
    expect(found).toEqual(home ? [home] : [])
  })

  it('the publicName exports are what callers will use', () => {
    expect(Object.keys(publicName).sort()).toEqual(['firstNameLastInitial', 'publicName'])
  })
})
