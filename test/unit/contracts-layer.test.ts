// test/unit/contracts-layer.test.ts
// The contract layer itself (domain/contracts): the zod dependency, the shared
// building blocks, the registry's shape, and what keeps zod out of the bundle.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  CONTRACT_METHODS,
  contracts,
  dollarsSchema,
  errorBodySchema,
  fieldErrorBodySchema,
  flagSchema,
  idSchema,
  isoDateSchema,
  storedTimestampSchema,
  tournamentListItemSchema,
  tournamentSectionSchema,
  tournamentsListResponseSchema,
} from '../../domain/contracts'
import { exportedMethods } from './routes'

const ROOT = join(__dirname, '../..')
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8')

describe('the zod dependency', () => {
  const pkg = JSON.parse(read('package.json')) as { dependencies: Record<string, string> }
  const lock = JSON.parse(read('package-lock.json')) as { packages: Record<string, { version?: string; dependencies?: Record<string, string> }> }

  it('is a runtime dependency pinned to an exact version 4 release', () => {
    expect(pkg.dependencies.zod).toMatch(/^4\.\d+\.\d+$/)
  })

  it('resolves to that same version at the top of the lockfile', () => {
    expect(lock.packages['node_modules/zod']?.version).toBe(pkg.dependencies.zod)
    expect(lock.packages['']?.dependencies?.zod).toBe(pkg.dependencies.zod)
  })
})

describe('zod stays out of the bundle', () => {
  it('functions/utils/response.ts takes zod types only', () => {
    const source = read('functions/utils/response.ts')
    const imports = [...source.matchAll(/^\s*import\s+(type\s+)?[^'"]*from\s*['"]([^'"]+)['"]/gm)]
    const zodImports = imports.filter((m) => /^zod(\/|$)/.test(m[2]))
    expect(zodImports.length).toBeGreaterThan(0)
    for (const m of zodImports) expect(m[1], `${m[0]} must be import type`).toBeTruthy()
    expect(source).not.toMatch(/import\s*\(\s*['"]zod/)
  })

  it('no handler under functions/api imports zod directly', () => {
    // Handlers get zod through domain/contracts, which the coverage ratchet tracks.
    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((e) => {
        const full = join(dir, e)
        return statSync(full).isDirectory() ? walk(full) : full.endsWith('.ts') ? [full] : []
      })
    for (const file of walk(join(ROOT, 'functions/api'))) {
      expect(readFileSync(file, 'utf8'), file).not.toMatch(/from\s*['"]zod(\/|['"])/)
    }
  })

  it('domain/contracts imports only zod and its own files', () => {
    for (const rel of ['common', 'events', 'registry', 'index']) {
      const source = read(`domain/contracts/${rel}.ts`)
      for (const m of source.matchAll(/(?:from|import)\s*['"]([^'"]+)['"]/g)) {
        expect(m[1] === 'zod' || m[1].startsWith('./'), `${rel}.ts imports ${m[1]}`).toBe(true)
      }
    }
  })
})

describe('registry', () => {
  it('lists only methods that take a contract, never OPTIONS', () => {
    expect([...CONTRACT_METHODS]).toEqual(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])
    for (const methods of Object.values(contracts)) {
      for (const method of Object.keys(methods)) expect(CONTRACT_METHODS as readonly string[]).toContain(method)
    }
  })

  it('keys each route as file routing names it, and each key has a handler file', () => {
    for (const [route, methods] of Object.entries(contracts)) {
      expect(route).not.toMatch(/^\/|^api\/|\.ts$/)
      const file = join(ROOT, 'functions/api', `${route}.ts`)
      const index = join(ROOT, 'functions/api', route, 'index.ts')
      let source: string | undefined
      for (const candidate of [file, index]) {
        try { source = readFileSync(candidate, 'utf8'); break } catch { /* try the next */ }
      }
      expect(source, `no handler file for '${route}'`).toBeDefined()
      const exported = exportedMethods(source!)
      for (const method of Object.keys(methods)) expect(exported, `${route} ${method}`).toContain(method)
    }
  })

  it('gives every contract a response schema', () => {
    for (const methods of Object.values(contracts)) {
      for (const contract of Object.values(methods)) expect(contract.response).toBeDefined()
    }
  })

  it('holds the tournaments list contract', () => {
    expect(contracts.tournaments.GET.response).toBe(tournamentsListResponseSchema)
  })
})

describe('common schemas', () => {
  it('ids are non-empty text', () => {
    expect(idSchema.safeParse('tour-1').success).toBe(true)
    expect(idSchema.safeParse('').success).toBe(false)
    expect(idSchema.safeParse(7).success).toBe(false)
  })

  it('calendar dates are real days, with no time part', () => {
    for (const ok of ['2026-10-24', '2028-02-29', '2026-03-08', '2026-11-01', '2026-12-31', '2027-01-01']) {
      expect(isoDateSchema.safeParse(ok).success, ok).toBe(true)
    }
    for (const bad of ['2026-02-29', '2026-02-30', '2026-13-01', '2026-10-24T00:00:00', '2026-10-24T00:00:00-05:00', '10/24/2026', 'Sat, Oct 24', '2026-1-5', '']) {
      expect(isoDateSchema.safeParse(bad).success, bad).toBe(false)
    }
    expect(isoDateSchema.safeParse(null).success).toBe(false)
  })

  it('stored timestamps are the database text form, not ISO with a T or a zone', () => {
    expect(storedTimestampSchema.safeParse('2026-10-08 14:05:00').success).toBe(true)
    // Midnight and the hours around a clock change are still just stored UTC text.
    expect(storedTimestampSchema.safeParse('2026-03-08 00:00:00').success).toBe(true)
    expect(storedTimestampSchema.safeParse('2026-11-01 06:30:00').success).toBe(true)
    for (const bad of ['2026-10-08T14:05:00', '2026-10-08T14:05:00Z', '2026-10-08', '2026-10-08 14:05', '']) {
      expect(storedTimestampSchema.safeParse(bad).success, bad).toBe(false)
    }
  })

  it('money is dollars as a number: decimals fine, negatives, text and cents-as-text not', () => {
    for (const ok of [0, 25, 12.5, 0.5]) expect(dollarsSchema.safeParse(ok).success, String(ok)).toBe(true)
    for (const bad of [-1, -0.01, '25', '$25.00', null, NaN, Infinity]) {
      expect(dollarsSchema.safeParse(bad).success, String(bad)).toBe(false)
    }
  })

  it('flags are 0 or 1, not booleans or other numbers', () => {
    expect(flagSchema.safeParse(0).success).toBe(true)
    expect(flagSchema.safeParse(1).success).toBe(true)
    for (const bad of [2, -1, true, false, '1', null]) expect(flagSchema.safeParse(bad).success, String(bad)).toBe(false)
  })

  it('the error body is exactly { error }', () => {
    expect(errorBodySchema.safeParse({ error: 'Not found' }).success).toBe(true)
    expect(errorBodySchema.safeParse({ error: 'Not found', fields: {} }).success).toBe(false)
    expect(errorBodySchema.safeParse({}).success).toBe(false)
    expect(errorBodySchema.safeParse({ error: 404 }).success).toBe(false)
  })

  it('the field error body is { error, fields } with text messages', () => {
    expect(fieldErrorBodySchema.safeParse({ error: 'x', fields: { name: 'Required' } }).success).toBe(true)
    expect(fieldErrorBodySchema.safeParse({ error: 'x', fields: {} }).success).toBe(true)
    expect(fieldErrorBodySchema.safeParse({ error: 'x' }).success).toBe(false)
    expect(fieldErrorBodySchema.safeParse({ error: 'x', fields: { name: 1 } }).success).toBe(false)
    expect(fieldErrorBodySchema.safeParse({ error: 'x', fields: {}, extra: 1 }).success).toBe(false)
  })
})

describe('events schemas', () => {
  it('a section takes an entry fee in dollars and the optional entry rules', () => {
    expect(tournamentSectionSchema.safeParse({ name: 'Open', entryFee: 25 }).success).toBe(true)
    expect(tournamentSectionSchema.safeParse({ name: 'U1200', entryFee: 12.5, ratingMax: 1199, ratingMin: null, unratedOk: true, rulesSet: true }).success).toBe(true)
    expect(tournamentSectionSchema.safeParse({ name: 'Open' }).success).toBe(false)
    expect(tournamentSectionSchema.safeParse({ name: 'Open', entryFee: -5 }).success).toBe(false)
    expect(tournamentSectionSchema.safeParse({ name: 'Open', entryFee: 25, surprise: 1 }).success).toBe(false)
  })

  it('an empty list is a valid answer', () => {
    expect(tournamentsListResponseSchema.safeParse({ tournaments: [] }).success).toBe(true)
    expect(tournamentsListResponseSchema.safeParse({}).success).toBe(false)
    expect(tournamentsListResponseSchema.safeParse({ tournaments: [], total: 0 }).success).toBe(false)
  })

  it('names all 41 tournaments columns plus the two from the club join and the schedules', () => {
    expect(Object.keys(tournamentListItemSchema.shape)).toHaveLength(44)
    expect(Object.keys(tournamentListItemSchema.shape)).toEqual(expect.arrayContaining(['end_date', 'club_name', 'club_color', 'member_discount', 'schedules']))
  })
})
