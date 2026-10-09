// test/integration/handler-exports.test.ts
// The contract coverage test reads which methods each handler file exports
// from its source text (test/unit/routes.ts). This loads every handler file
// in the Workers runtime and checks the text scan against the real exports,
// so the ratchet cannot drift from what Pages serves.
import { describe, expect, it } from 'vitest'
import { contracts } from '../../domain/contracts'
import { exportedMethods } from '../unit/routes'

const modules = import.meta.glob(
  ['../../functions/api/**/*.ts', '../../functions/tournaments/*.ts', '../../functions/clubs/*.ts', '../../functions/news/*.ts'],
  { eager: true },
) as Record<string, Record<string, unknown>>

const sources = import.meta.glob(
  ['../../functions/api/**/*.ts', '../../functions/tournaments/*.ts', '../../functions/clubs/*.ts', '../../functions/news/*.ts'],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>

const runtimeMethods = (mod: Record<string, unknown>): string[] =>
  Object.keys(mod)
    .map((k) => /^onRequest(\w*)$/.exec(k))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => (m[1] === '' ? 'ALL' : m[1].toUpperCase()))
    .sort()

describe('handler exports', () => {
  it('loads the handler files (guard against a glob that finds nothing)', () => {
    expect(Object.keys(modules).filter((f) => f.includes('/functions/api/')).length).toBeGreaterThanOrEqual(88)
  })

  it('the source scan names the same methods as the loaded module, for every handler file', () => {
    const mismatches: string[] = []
    for (const [file, mod] of Object.entries(modules)) {
      const scanned = [...exportedMethods(sources[file])].sort()
      const actual = runtimeMethods(mod)
      if (JSON.stringify(scanned) !== JSON.stringify(actual)) {
        mismatches.push(`${file}: source scan ${JSON.stringify(scanned)}, module exports ${JSON.stringify(actual)}`)
      }
    }
    expect(mismatches).toEqual([])
  })

  it('every exported handler is a function', () => {
    for (const [file, mod] of Object.entries(modules)) {
      for (const [name, value] of Object.entries(mod)) {
        if (/^onRequest\w*$/.test(name)) expect(typeof value, `${file} ${name}`).toBe('function')
      }
    }
  })

  it('no handler answers every method with a bare onRequest', () => {
    for (const [file, mod] of Object.entries(modules)) expect('onRequest' in mod, file).toBe(false)
  })

  it('every contracted method is a real export of its file', () => {
    for (const [route, methods] of Object.entries(contracts)) {
      const key = `../../functions/api/${route}.ts`
      const indexKey = `../../functions/api/${route}/index.ts`
      const mod = modules[key] ?? modules[indexKey]
      expect(mod, `no handler file for ${route}`).toBeDefined()
      for (const method of Object.keys(methods)) {
        expect(typeof mod[`onRequest${method[0]}${method.slice(1).toLowerCase()}`], `${route} ${method}`).toBe('function')
      }
    }
  })

  it('admin/tournaments/[id] has no GET: the manage page loads through admin/tournaments/[id]/manage', () => {
    expect(runtimeMethods(modules['../../functions/api/admin/tournaments/[id].ts'])).toEqual(['DELETE', 'OPTIONS', 'PATCH'])
    expect(runtimeMethods(modules['../../functions/api/admin/tournaments/[id]/manage.ts'])).toContain('GET')
  })
})
