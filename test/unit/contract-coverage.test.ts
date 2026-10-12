// test/unit/contract-coverage.test.ts
// Every endpoint either has a contract (domain/contracts/registry.ts), waits
// for one (./contracts-pending.ts, a list that only shrinks), or is left out
// on purpose (EXCLUDED below, with the reason). A new handler file with
// neither a contract nor a line anywhere fails here, so contract coverage
// can only grow.
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { CONTRACT_METHODS, contracts, type RouteContracts } from '../../domain/contracts/registry'
import { PENDING_CONTRACTS, PENDING_COUNT } from './contracts-pending'
import { collectRouteFiles, exportedMethods } from './routes'

const ROOT = join(__dirname, '../..')
const FUNCTIONS_DIR = join(ROOT, 'functions')
const CONTRACT_TESTS_DIR = join(ROOT, 'test/integration/contracts')

/**
 * Handlers left out of the contract list, keyed "METHOD /path" as served.
 * Page routes answer with the site's HTML, not JSON, so a zod contract has
 * nothing to check.
 */
const EXCLUDED: Record<string, string> = {
  'GET /tournaments/[id]':
    "Page route: serves the site's HTML with the event's link-preview tags in the head, not JSON.",
  'GET /clubs/[id]':
    "Page route: serves the site's HTML with the club's link-preview tags in the head, not JSON.",
  'GET /news/[slug]':
    "Page route: serves the site's HTML with the post's link-preview tags in the head, not JSON.",
}

/** Methods with no body to contract: handleOptions answers OPTIONS, and HEAD has no body. */
const NO_BODY = new Set(['OPTIONS', 'HEAD'])

/** Folders under functions/ that hold code, not routes. */
const NOT_ROUTES = new Set(['utils', 'db'])

interface Endpoint {
  /** "GET /api/tournaments": the method and the path as served. */
  id: string
  method: string
  /** The handler file, relative to the repo root. */
  file: string
}

interface Coverage {
  endpoints: Endpoint[]
  /** Files that export a bare onRequest, which answers every method. */
  catchAll: string[]
  registry: Record<string, RouteContracts>
  pending: readonly string[]
  excluded: Record<string, string>
}

/** Every handler method under a functions folder: functions/api and the page routes beside it. */
function listEndpoints(functionsDir: string): Pick<Coverage, 'endpoints' | 'catchAll'> {
  const endpoints: Endpoint[] = []
  const catchAll: string[] = []
  for (const { segments, file } of collectRouteFiles(functionsDir)) {
    if (segments.length === 0 || NOT_ROUTES.has(segments[0])) continue
    const rel = relative(functionsDir, file).split('\\').join('/')
    const repoFile = `functions/${rel}`
    const methods = exportedMethods(readFileSync(file, 'utf-8'))
    if (methods.includes('ALL')) catchAll.push(repoFile)
    for (const method of methods) {
      if (method === 'ALL' || NO_BODY.has(method)) continue
      endpoints.push({ id: `${method} /${segments.join('/')}`, method, file: repoFile })
    }
  }
  return { endpoints, catchAll }
}

const apiId = (method: string, route: string) => `${method} /api/${route}`

/** Everything wrong with the coverage, one plain sentence each; empty when it holds. */
function coverageProblems({ endpoints, catchAll, registry, pending, excluded }: Coverage): string[] {
  const problems: string[] = []
  const served = new Map(endpoints.map((e) => [e.id, e]))

  for (const file of catchAll) {
    problems.push(`${file} exports a bare onRequest; export one handler per method so each can carry a contract`)
  }

  const contracted = new Set<string>()
  for (const [route, methods] of Object.entries(registry)) {
    for (const method of Object.keys(methods)) {
      const id = apiId(method, route)
      if (!(CONTRACT_METHODS as readonly string[]).includes(method)) {
        problems.push(`registry: '${route}' lists ${method}, which takes no contract`)
      } else if (!served.has(id)) {
        problems.push(`registry: '${route}' has a ${method} contract, but no file under functions/api exports onRequest${method[0]}${method.slice(1).toLowerCase()} for it`)
      }
      contracted.add(id)
    }
  }

  const waiting = new Set<string>()
  for (const line of pending) {
    const m = /^([A-Z]+) (\S+)$/.exec(line)
    if (!m || !(CONTRACT_METHODS as readonly string[]).includes(m[1])) {
      problems.push(`contracts-pending: '${line}' is not "METHOD route"`)
      continue
    }
    const id = apiId(m[1], m[2])
    if (waiting.has(id)) problems.push(`contracts-pending: '${line}' is listed twice`)
    waiting.add(id)
    if (!served.has(id)) problems.push(`contracts-pending: '${line}' names no endpoint; take the line out and lower PENDING_COUNT`)
    if (contracted.has(id)) problems.push(`'${line}' has a contract and is still listed as pending; take its line out of contracts-pending.ts`)
  }

  for (const [id, reason] of Object.entries(excluded)) {
    if (!served.has(id)) problems.push(`EXCLUDED: '${id}' names no endpoint`)
    if (!reason.trim()) problems.push(`EXCLUDED: '${id}' gives no reason`)
    if (contracted.has(id)) problems.push(`'${id}' is both excluded and in the registry`)
    if (waiting.has(id)) problems.push(`'${id}' is both excluded and listed as pending`)
  }

  for (const e of endpoints) {
    if (contracted.has(e.id) || waiting.has(e.id) || e.id in excluded) continue
    problems.push(`${e.id} (${e.file}) has no contract: add one to domain/contracts/registry.ts with a contract test`)
  }
  return problems
}

const real = listEndpoints(FUNCTIONS_DIR)
const realCoverage: Coverage = {
  ...real,
  registry: contracts,
  pending: PENDING_CONTRACTS,
  excluded: EXCLUDED,
}

describe('contract coverage', () => {
  it('finds the handler files (guard against a scan that sees nothing)', () => {
    const apiFiles = new Set(real.endpoints.filter((e) => e.file.startsWith('functions/api/')).map((e) => e.file))
    expect(apiFiles.size).toBeGreaterThanOrEqual(88)
    expect(real.endpoints.map((e) => e.id)).toEqual(expect.arrayContaining([
      'GET /api/tournaments',
      'PATCH /api/admin/tournaments/[id]',
      'POST /api/registrations/batch',
      'GET /tournaments/[id]',
      'GET /clubs/[id]',
    ]))
    // OPTIONS is exported by most handlers but never needs a contract.
    expect(real.endpoints.some((e) => e.method === 'OPTIONS')).toBe(false)
  })

  it('gives every endpoint method a contract, a pending line or an exclusion, and no endpoint two of them', () => {
    expect(coverageProblems(realCoverage)).toEqual([])
  })

  it('pins the pending count, so the list can only shrink', () => {
    expect(PENDING_CONTRACTS.length).toBe(PENDING_COUNT)
  })

  it('excludes only the page routes outside functions/api, each with a reason', () => {
    const pageRoutes = real.endpoints.filter((e) => !e.file.startsWith('functions/api/'))
    expect(pageRoutes.map((e) => e.file).sort()).toEqual([
      'functions/clubs/[id].ts',
      'functions/news/[slug].ts',
      'functions/tournaments/[id].ts',
    ])
    expect(Object.keys(EXCLUDED).sort()).toEqual(pageRoutes.map((e) => e.id).sort())
    for (const reason of Object.values(EXCLUDED)) expect(reason).toMatch(/HTML/)
  })

  it('has a contract test for every contract', () => {
    const sources = readdirSync(CONTRACT_TESTS_DIR)
      .filter((f) => f.endsWith('.test.ts'))
      .map((f) => readFileSync(join(CONTRACT_TESTS_DIR, f), 'utf-8'))
      .join('\n')
    for (const [route, methods] of Object.entries(contracts)) {
      for (const method of Object.keys(methods)) {
        const reference = `contracts['${route}'].${method}`
        expect(sources.includes(reference), `no file in test/integration/contracts uses ${reference}`).toBe(true)
      }
    }
  })
})

describe('contract coverage fails when it should', () => {
  // A copy of a functions folder: the real tournaments list handler plus one
  // new endpoint nobody has written a contract for.
  const base = mkdtempSync(join(tmpdir(), 'contract-coverage-'))
  const scratch = join(base, 'functions')
  afterAll(() => rmSync(base, { recursive: true, force: true }))

  const write = (dir: string, rel: string, text: string) => {
    mkdirSync(join(dir, rel, '..'), { recursive: true })
    writeFileSync(join(dir, rel), text)
  }
  write(scratch, 'api/tournaments.ts', readFileSync(join(FUNCTIONS_DIR, 'api/tournaments.ts'), 'utf-8'))
  write(scratch, 'api/new-thing/[id].ts', [
    'export const onRequestOptions: PagesFunction = async () => new Response(null)',
    'export const onRequestGet: PagesFunction = async () => Response.json({ ok: true })',
  ].join('\n'))
  write(scratch, 'utils/helper.ts', 'export const helper = 1')

  // The scratch folder holds only the tournaments list, so only its contract applies.
  const scratchRegistry = { tournaments: contracts.tournaments }
  const synthetic = (overrides: Partial<Coverage> = {}): string[] =>
    coverageProblems({ ...listEndpoints(scratch), registry: scratchRegistry, pending: [], excluded: {}, ...overrides })

  it('sees the synthetic handler on disk', () => {
    expect(statSync(join(scratch, 'api/new-thing/[id].ts')).isFile()).toBe(true)
    expect(listEndpoints(scratch).endpoints.map((e) => e.id).sort()).toEqual(['GET /api/new-thing/[id]', 'GET /api/tournaments'])
  })

  it('fails for a new handler file with no contract and no pending line', () => {
    expect(synthetic()).toEqual([
      'GET /api/new-thing/[id] (functions/api/new-thing/[id].ts) has no contract: add one to domain/contracts/registry.ts with a contract test',
    ])
    // A pending line is the only other way through, and it is pinned.
    expect(synthetic({ pending: ['GET new-thing/[id]'] })).toEqual([])
  })

  it('fails when a contracted route is still listed as pending', () => {
    expect(synthetic({ pending: ['GET new-thing/[id]', 'GET tournaments'] })).toEqual([
      "'GET tournaments' has a contract and is still listed as pending; take its line out of contracts-pending.ts",
    ])
  })

  it('fails when a registry entry names a method the file does not export', () => {
    const registry = { ...scratchRegistry, tournaments: { ...contracts.tournaments, POST: contracts.tournaments.GET } }
    expect(synthetic({ registry, pending: ['GET new-thing/[id]'] })).toEqual([
      "registry: 'tournaments' has a POST contract, but no file under functions/api exports onRequestPost for it",
    ])
    expect(coverageProblems({ ...realCoverage, registry: { ...contracts, 'admin/tournaments/[id]': { GET: contracts.tournaments.GET } } }))
      .toContain("registry: 'admin/tournaments/[id]' has a GET contract, but no file under functions/api exports onRequestGet for it")
  })

  it('fails when an endpoint is both excluded and pending or contracted', () => {
    expect(synthetic({ pending: ['GET new-thing/[id]'], excluded: { 'GET /api/new-thing/[id]': 'reason' } }))
      .toEqual(["'GET /api/new-thing/[id]' is both excluded and listed as pending"])
    expect(synthetic({ pending: ['GET new-thing/[id]'], excluded: { 'GET /api/tournaments': 'reason' } }))
      .toEqual(["'GET /api/tournaments' is both excluded and in the registry"])
  })

  it('fails for a pending line or an exclusion that names no endpoint', () => {
    expect(synthetic({ pending: ['GET new-thing/[id]', 'DELETE gone'] }))
      .toEqual(["contracts-pending: 'DELETE gone' names no endpoint; take the line out and lower PENDING_COUNT"])
    expect(synthetic({ pending: ['GET new-thing/[id]'], excluded: { 'GET /gone': 'reason' } }))
      .toEqual(["EXCLUDED: 'GET /gone' names no endpoint"])
  })

  it('fails for a handler that exports a bare onRequest', () => {
    const other = join(base, 'catch-all')
    write(other, 'api/any.ts', 'export const onRequest: PagesFunction = async () => new Response(null)')
    const found = listEndpoints(other)
    expect(found.endpoints).toEqual([])
    expect(coverageProblems({ ...found, registry: {}, pending: [], excluded: {} }))
      .toEqual(['functions/api/any.ts exports a bare onRequest; export one handler per method so each can carry a contract'])
  })
})

describe('exportedMethods', () => {
  it('reads declared and listed handler exports', () => {
    expect(exportedMethods([
      'export const onRequestGet: PagesFunction<Env> = async () => x',
      'export async function onRequestPost() {}',
      'const del = () => x',
      'export { del as onRequestDelete, helper }',
      "export { renewalExpiry } from '../../utils/membershipActivation'",
      'export const onRequestOptions = () => handleOptions()',
    ].join('\n')).sort()).toEqual(['DELETE', 'GET', 'OPTIONS', 'POST'])
  })
})
