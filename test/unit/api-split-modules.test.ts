// test/unit/api-split-modules.test.ts
//
// K3c: the site's API client lives in src/areas/<area>/api.ts and
// src/lib/http.ts behind the barrel src/lib/api.ts. api-exports.test.ts shows
// the barrel exports the same names as before the split; this file shows the
// split itself is sound:
//
// - the committed map (scripts/moves/api-split.json) names every export in
//   the snapshot and the three private helpers, gives each to http or one of
//   the eight areas, and each real module declares exactly what the map gives
//   it, with the names the area modules have gained since the split
//   (fixtures/api-added-since-split.json), which the map and the snapshot,
//   the split's own record, leave out
// - the placement rules in REDESIGN_STATUS.md hold: the request helpers and
//   ApiError in http, the contract-derived types in events, and the two
//   answer types membership has gained since, the scan call in live, the
//   member export's helper private to membership
// - the modules import in one direction: nothing imports the barrel, http
//   imports no area, areas import one another only as types and without a
//   cycle, and the runtime import graph from the barrel has no cycle
// - the modules hold only declarations, so importing one has no side effect
// - calls through the barrel send what they sent before: the path, the sign-in
//   header, and ApiError for a failed or unreadable answer
// - a bundle of the barrel has no circular-import warning and no zod
//   (npm run check:bundle proves the same on the whole site build)
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import ts from 'typescript'
import { build } from 'vite'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { findZod } from '../../scripts/check-bundle'

const session = vi.hoisted(() => ({ token: null as string | null }))
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: session.token ? { access_token: session.token } : null } }) } },
}))

const ROOT = join(__dirname, '../..')
const SNAPSHOT = JSON.parse(readFileSync(join(__dirname, 'fixtures/api-exports.json'), 'utf8')) as string[]
const MAP = JSON.parse(readFileSync(join(ROOT, 'scripts/moves/api-split.json'), 'utf8')) as Record<string, string>
/** What the area modules gained after the split: the paths they call, and the names they export with the module that declares each. */
const ADDED = JSON.parse(readFileSync(join(__dirname, 'fixtures/api-added-since-split.json'), 'utf8')) as { paths: string[]; exports: Record<string, string> }
/** The split's map with the names added since, each to its module. */
const JOINED: Record<string, string> = { ...MAP, ...ADDED.exports }
const AREAS = ['events', 'registration', 'households', 'live', 'membership', 'clubs', 'admin', 'governance']
const PRIVATE_HELPERS = ['authHeaders', 'handleResponse', 'exportQuery']
const BARREL = 'src/lib/api.ts'
const HTTP = 'src/lib/http.ts'
const moduleOf = (target: string) => (target === 'http' ? HTTP : `src/areas/${target}/api.ts`)
const MODULES = ['http', ...AREAS].map(moduleOf)

const read = (file: string) => readFileSync(join(ROOT, file), 'utf8')
const parse = (file: string) => ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)

/** The names a module declares at the top level (imports and export lists left out). */
function declared(file: string): string[] {
  return parse(file).statements.flatMap((s) => {
    if (ts.isImportDeclaration(s) || ts.isExportDeclaration(s)) return []
    if (ts.isVariableStatement(s)) return s.declarationList.declarations.map((d) => d.name.getText())
    return [(s as ts.Node & { name?: ts.Identifier }).name?.text ?? `<${ts.SyntaxKind[s.kind]}>`]
  })
}

interface ImportInfo {
  specifier: string
  typeOnly: boolean
  /** True for `export ... from`. */
  reexport: boolean
}

function importsOf(file: string): ImportInfo[] {
  const out: ImportInfo[] = []
  for (const s of parse(file).statements) {
    if (ts.isImportDeclaration(s) && ts.isStringLiteral(s.moduleSpecifier)) {
      out.push({ specifier: s.moduleSpecifier.text, typeOnly: !!s.importClause?.isTypeOnly, reexport: false })
    } else if (ts.isExportDeclaration(s) && s.moduleSpecifier && ts.isStringLiteral(s.moduleSpecifier)) {
      out.push({ specifier: s.moduleSpecifier.text, typeOnly: s.isTypeOnly, reexport: true })
    }
  }
  return out
}

/** Where a '@/...' or relative specifier points in the repository, or null for a package or '@domain'. */
function resolveSrc(from: string, spec: string): string | null {
  const base = spec.startsWith('@/') ? `src/${spec.slice(2)}` : spec.startsWith('.') ? join(dirname(from), spec) : null
  if (!base) return null
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')]) {
    if (/\.tsx?$/.test(candidate) && existsSync(join(ROOT, candidate))) return candidate
  }
  return null
}

describe('the committed map', () => {
  it('names every export in the snapshot and the three private helpers, and nothing else, and with the names added since the split names those too', () => {
    expect(Object.keys(MAP).sort()).toEqual([...SNAPSHOT, ...PRIVATE_HELPERS].sort())
    expect(Object.keys(JOINED).sort()).toEqual([...SNAPSHOT, ...Object.keys(ADDED.exports), ...PRIVATE_HELPERS].sort())
  })

  it('takes no name the split already placed into the names added since, and gives each added name to one of the eight areas', () => {
    expect(Object.keys(ADDED.exports).filter((name) => name in MAP || SNAPSHOT.includes(name))).toEqual([])
    expect(Object.entries(ADDED.exports).filter(([, target]) => !AREAS.includes(target))).toEqual([])
  })

  it('gives each name to http or one of the eight areas', () => {
    const bad = Object.entries(JOINED).filter(([, target]) => target !== 'http' && !AREAS.includes(target))
    expect(bad).toEqual([])
    for (const target of ['http', ...AREAS]) expect(Object.values(MAP).filter((t) => t === target).length, target).toBeGreaterThan(0)
  })

  it('matches the real modules: each declares exactly the names the map gives it, with the names added since the split', () => {
    for (const target of ['http', ...AREAS]) {
      const mapped = Object.entries(JOINED).filter(([, t]) => t === target).map(([name]) => name).sort()
      expect(declared(moduleOf(target)).sort(), moduleOf(target)).toEqual(mapped)
    }
  })

  it('puts the request helpers and the error class in http', () => {
    for (const name of ['authHeaders', 'handleResponse', 'ApiError']) expect(MAP[name], name).toBe('http')
  })

  it('puts the contract-derived types with the events module, which keeps their type-only contract import, and the two answer types added since with membership, which takes them the same way', () => {
    for (const name of ['ApiTournamentSection', 'ApiSchedule', 'ApiRoundScheduleItem', 'ApiTournamentListItem', 'ApiTournamentDetail']) {
      expect(MAP[name], name).toBe('events')
    }
    const contracts = importsOf(moduleOf('events')).filter((i) => i.specifier === '@domain/contracts')
    expect(contracts).toEqual([{ specifier: '@domain/contracts', typeOnly: true, reexport: false }])
    // Membership's answers to the creation endpoints, added since the split, are the contracts' own types.
    for (const name of ['ApiTournamentCreation', 'ApiPayoutRequest']) expect(JOINED[name], name).toBe('membership')
    expect(importsOf(moduleOf('membership')).filter((i) => i.specifier.startsWith('@domain/'))).toEqual([{ specifier: '@domain/contracts', typeOnly: true, reexport: false }])
    const membership = read(moduleOf('membership'))
    expect(membership).toContain("import type { EmailChoicesResponse, PayoutRequestResponse, TournamentCreationResponse, UnsubscribeLinkResponse, UnsubscribeResponse } from '@domain/contracts'")
    expect(membership).toMatch(/export type ApiTournamentCreation = TournamentCreationResponse\b/)
    expect(membership).toMatch(/export type ApiPayoutRequest = PayoutRequestResponse\b/)
    for (const file of MODULES.filter((f) => f !== moduleOf('events') && f !== moduleOf('membership'))) {
      expect(importsOf(file).filter((i) => i.specifier.startsWith('@domain/')), file).toEqual([])
    }
  })

  it('puts the scan call in live, with the RawScan type import and nowhere else', () => {
    expect(MAP.scanScoresheet).toBe('live')
    const holders = MODULES.filter((f) => importsOf(f).some((i) => i.specifier === '@/lib/scanner/types'))
    expect(holders).toEqual([moduleOf('live')])
    expect(importsOf(moduleOf('live')).find((i) => i.specifier === '@/lib/scanner/types')?.typeOnly).toBe(true)
    // Any call that fetches a scan or scoresheet route sits in live.
    for (const file of MODULES.filter((f) => f !== moduleOf('live'))) {
      expect(read(file), file).not.toMatch(/fetch\(\s*[`'"]\/api\/(scan|scoresheet)/)
    }
    expect(read(moduleOf('live'))).toMatch(/fetch\(\s*'\/api\/scan'/)
  })

  it('keeps the member export helper private to membership, used only there', () => {
    expect(MAP.exportQuery).toBe('membership')
    expect(SNAPSHOT).not.toContain('exportQuery')
    for (const file of MODULES) {
      const uses = (read(file).match(/\bexportQuery\b/g) ?? []).length
      if (file === moduleOf('membership')) expect(uses, file).toBe(3)
      else expect(uses, file).toBe(0)
    }
    expect(read(moduleOf('membership'))).not.toMatch(/export\s+(async\s+)?function\s+exportQuery/)
  })

  it('exports the two request helpers from http by name and from no area module', () => {
    const http = parse(HTTP)
    const lists = http.statements.filter((s): s is ts.ExportDeclaration => ts.isExportDeclaration(s) && !s.moduleSpecifier)
    expect(lists).toHaveLength(1)
    expect((lists[0].exportClause as ts.NamedExports).elements.map((e) => e.name.text)).toEqual(['authHeaders', 'handleResponse'])
    for (const area of AREAS) {
      const text = read(moduleOf(area))
      expect(text, area).not.toMatch(/\b(async\s+)?function\s+(authHeaders|handleResponse)\b/)
    }
  })
})

describe('the modules import in one direction', () => {
  it('only names what a module may import', () => {
    const allowed = (file: string, i: ImportInfo): boolean => {
      if (file === HTTP) return i.specifier === '@/lib/supabase'
      if (i.specifier === '@/lib/http') return !i.typeOnly
      if (i.specifier === '@domain/contracts') return i.typeOnly
      if (i.specifier === '@/lib/scanner/types') return i.typeOnly
      return /^@\/areas\/\w+\/api$/.test(i.specifier) && i.typeOnly && i.specifier !== `@/areas/${file.split('/')[2]}/api`
    }
    const stray = MODULES.flatMap((file) => importsOf(file).filter((i) => !allowed(file, i)).map((i) => `${file}: ${i.typeOnly ? 'import type' : 'import'} '${i.specifier}'`))
    expect(stray).toEqual([])
    for (const file of MODULES) expect(importsOf(file).some((i) => i.reexport), file).toBe(false)
  })

  it('never imports the barrel, by alias or by relative path', () => {
    for (const file of MODULES) {
      for (const i of importsOf(file)) expect(resolveSrc(file, i.specifier), `${file} -> ${i.specifier}`).not.toBe(BARREL)
    }
  })

  it('the area-to-area edges are the documented ones, all type-only, with no cycle', () => {
    const documented: Record<string, string[]> = { events: ['registration', 'live'], membership: ['registration', 'households'], clubs: ['membership'] }
    const edges = new Map<string, string[]>()
    for (const area of AREAS) {
      const to = importsOf(moduleOf(area)).filter((i) => /^@\/areas\/\w+\/api$/.test(i.specifier))
      expect(to.every((i) => i.typeOnly), area).toBe(true)
      edges.set(area, to.map((i) => i.specifier.split('/')[2]))
      for (const target of edges.get(area)!) expect(documented[area] ?? [], `${area} -> ${target}`).toContain(target)
    }
    const state = new Map<string, 'open' | 'done'>()
    const visit = (a: string, path: string[]): void => {
      expect(state.get(a), `cycle: ${[...path, a].join(' -> ')}`).not.toBe('open')
      if (state.get(a) === 'done') return
      state.set(a, 'open')
      for (const next of edges.get(a) ?? []) visit(next, [...path, a])
      state.set(a, 'done')
    }
    for (const area of AREAS) visit(area, [])
  })

  it('has no runtime import cycle through the barrel, the modules or what they import', () => {
    const api = new Set([BARREL, ...MODULES])
    const state = new Map<string, 'open' | 'done'>()
    const cycles: string[] = []
    const visit = (file: string, path: string[]): void => {
      if (state.get(file) === 'done') return
      if (state.get(file) === 'open') {
        const loop = [...path.slice(path.indexOf(file)), file]
        if (loop.some((f) => api.has(f))) cycles.push(loop.join(' -> '))
        return
      }
      state.set(file, 'open')
      for (const i of importsOf(file)) {
        if (i.typeOnly) continue
        const next = resolveSrc(file, i.specifier)
        if (next) visit(next, [...path, file])
      }
      state.set(file, 'done')
    }
    visit(BARREL, [])
    expect(cycles).toEqual([])
    // The walk reached the whole client, and src/lib/supabase beyond it.
    for (const file of [HTTP, ...AREAS.map(moduleOf), 'src/lib/supabase.ts']) expect(state.get(file), file).toBe('done')
  })

  it('imports no server code, zod or database package', () => {
    for (const file of [BARREL, ...MODULES]) {
      for (const i of importsOf(file)) expect(i.specifier, file).not.toMatch(/^(zod|drizzle-orm|hono)|functions\/|\/db\/|schema/)
    }
  })

  it('leaves the area index files as they were: none imports an api module', () => {
    for (const area of AREAS) {
      const index = `src/areas/${area}/index.ts`
      expect(existsSync(join(ROOT, index)), index).toBe(true)
      for (const i of importsOf(index)) {
        expect(resolveSrc(index, i.specifier), `${index} -> ${i.specifier}`).not.toBe(moduleOf(area))
        expect(i.specifier, index).not.toMatch(/\/api$|lib\/http$/)
      }
    }
  })

  it('has no area folder holding an api.ts the map does not know', () => {
    const found = readdirSync(join(ROOT, 'src/areas')).filter((a) => existsSync(join(ROOT, 'src/areas', a, 'api.ts'))).sort()
    expect(found).toEqual([...AREAS].sort())
  })
})

describe('the modules hold declarations only', () => {
  it('has no top-level statement that runs when the module loads', () => {
    for (const file of MODULES) {
      const kinds = parse(file).statements.map((s) => ts.SyntaxKind[s.kind])
      const bad = kinds.filter((k) => !['ImportDeclaration', 'FunctionDeclaration', 'ClassDeclaration', 'InterfaceDeclaration', 'TypeAliasDeclaration', 'ExportDeclaration'].includes(k))
      expect(bad, file).toEqual([])
    }
  })

  it('starts each module with its header comment, then its imports', () => {
    for (const file of MODULES) {
      const text = read(file)
      expect(text.startsWith(`// ${file}\n`), file).toBe(true)
      expect(text, file).toMatch(/\nimport /)
    }
  })
})

describe('calls through the barrel send what they sent before', () => {
  const calls = vi.fn()
  afterEach(() => {
    calls.mockReset()
    vi.unstubAllGlobals()
    session.token = null
  })

  const answer = (body: unknown, status = 200) => {
    calls.mockImplementation(async () => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status }))
    vi.stubGlobal('fetch', calls)
  }
  const sent = () => {
    const [url, init] = calls.mock.calls[0] as [string, RequestInit | undefined]
    return { url, init: init ?? {}, headers: (init?.headers ?? {}) as Record<string, string> }
  }

  it('reaches the same path from every area, signed in', async () => {
    const api = await import('@/lib/api')
    session.token = 'tok-1'
    const cases: Array<[string, () => Promise<unknown>, string, unknown]> = [
      ['events', () => api.getTournaments(), '/api/tournaments', { tournaments: [] }],
      ['registration', () => api.getTournamentReminderStatus('t1'), '/api/tournaments/t1/remind', { opted_in: true }],
      ['households', () => api.getMyChildren(), '/api/me/children?tournamentId=', { children: [] }],
      ['membership', () => api.getMe(), '/api/me', { member: {}, registrations: [], directedTournaments: [] }],
      ['clubs', () => api.getClubs(), '/api/clubs', { clubs: [] }],
      ['admin', () => api.getMyTickets(), '/api/support', { tickets: [] }],
      ['governance', () => api.getBoardSeats(), '/api/board/seats', { seats: [] }],
    ]
    for (const [area, call, path, body] of cases) {
      calls.mockClear()
      answer(body)
      await call()
      expect(calls, area).toHaveBeenCalledTimes(1)
      expect(sent().url, area).toBe(path)
    }
  })

  it('sends the bearer token and the JSON content type when signed in, and neither token nor stray header when not', async () => {
    const { getMe } = await import('@/lib/api')
    session.token = 'tok-2'
    answer({ member: {}, registrations: [], directedTournaments: [] })
    await getMe()
    expect(sent().headers).toEqual({ 'Content-Type': 'application/json', Authorization: 'Bearer tok-2' })

    calls.mockClear()
    session.token = null
    answer({ member: {}, registrations: [], directedTournaments: [] })
    await getMe()
    expect(sent().headers).toEqual({ 'Content-Type': 'application/json' })
  })

  it('asks what the member may create and sends a payout request, signed in, to the two paths added since the split', async () => {
    const { getTournamentCreation, requestPayoutAccount, ApiError } = await import('@/lib/api')
    expect([...ADDED.paths].sort()).toEqual([
      '/api/admin/mail/newsletter', '/api/admin/mail/newsletter/stop', '/api/admin/mail/newsletter/test', '/api/mail/preferences/*', '/api/mail/unsubscribe/*',
      '/api/me/media-manager', '/api/me/payout-request', '/api/me/tournament-creation',
    ])
    session.token = 'tok-5'
    const grant = { grant: 'standing_director', canCreate: true, canChargeFees: true, clubId: null }
    answer(grant)
    expect(await getTournamentCreation()).toEqual(grant)
    expect(sent().url).toBe('/api/me/tournament-creation')
    expect(sent().init.method).toBeUndefined()
    expect(sent().init.body).toBeUndefined()
    expect(sent().headers).toEqual({ 'Content-Type': 'application/json', Authorization: 'Bearer tok-5' })

    const ticket = { ticket: { id: 'k1', kind: 'payout_request', status: 'open' }, created: true }
    for (const [tournamentId, body] of [['t1', '{"tournamentId":"t1"}'], [null, '{"tournamentId":null}'], [undefined, '{}']] as const) {
      calls.mockClear()
      answer(ticket, 201)
      expect(await requestPayoutAccount(tournamentId), String(tournamentId)).toEqual(ticket)
      expect(sent().url).toBe('/api/me/payout-request')
      expect(sent().init.method).toBe('POST')
      expect(sent().init.body, String(tournamentId)).toBe(body)
      expect(sent().headers).toEqual({ 'Content-Type': 'application/json', Authorization: 'Bearer tok-5' })
    }

    // A refusal reads as ApiError with the server's words, as every call's does.
    answer({ error: 'Not available yet.' }, 403)
    const refused = await requestPayoutAccount().then(() => null, (e: unknown) => e)
    expect(refused).toBeInstanceOf(ApiError)
    expect(refused).toMatchObject({ message: 'Not available yet.', status: 403 })
  })

  it('reads the tournament list signed out, as every page has, and signed in only when asked', async () => {
    const { getTournaments } = await import('@/lib/api')
    session.token = 'tok-6'
    answer({ tournaments: [{ id: 't1' }] })
    expect(await getTournaments()).toEqual([{ id: 't1' }])
    expect(calls.mock.calls[0]).toEqual(['/api/tournaments'])

    calls.mockClear()
    answer({ tournaments: [] })
    await getTournaments({ signedIn: false })
    expect(calls.mock.calls[0]).toEqual(['/api/tournaments'])

    calls.mockClear()
    answer({ tournaments: [] })
    await getTournaments({ signedIn: true })
    expect(sent().url).toBe('/api/tournaments')
    expect(sent().headers).toEqual({ 'Content-Type': 'application/json', Authorization: 'Bearer tok-6' })
  })

  it('sends a scan as a POST of the photo with its own content type and the token', async () => {
    const { scanScoresheet } = await import('@/lib/api')
    session.token = 'tok-3'
    answer({ scan: { rows: [] }, scansLeftToday: 4 })
    const photo = new Blob(['x'], { type: 'image/png' })
    const result = await scanScoresheet(photo)
    expect(result).toEqual({ scan: { rows: [] }, scansLeftToday: 4 })
    const { url, init, headers } = sent()
    expect(url).toBe('/api/scan')
    expect(init.method).toBe('POST')
    expect(init.body).toBe(photo)
    expect(headers).toEqual({ 'Content-Type': 'image/png', Authorization: 'Bearer tok-3' })
  })

  it('builds the member export query in membership: type, who, children, then the list format', async () => {
    const { adminExportEmailList, adminExportMembers } = await import('@/lib/api')
    session.token = 'tok-4'
    answer('a@x.org\n\nb@x.org\n')
    expect(await adminExportEmailList({ type: 'full', who: 'lapsed', children: true })).toEqual(['a@x.org', 'b@x.org'])
    expect(sent().url).toBe('/api/admin/members/export?type=emails&who=lapsed&children=1&format=list')

    calls.mockClear()
    calls.mockImplementation(async () => new Response('csv', { status: 200, headers: { 'Content-Disposition': 'attachment; filename="m.csv"', 'X-Row-Count': '7' } }))
    vi.stubGlobal('fetch', calls)
    const file = await adminExportMembers({ type: 'full', who: 'current' })
    expect(sent().url).toBe('/api/admin/members/export?type=full&who=current')
    expect(file.filename).toBe('m.csv')
    expect(file.count).toBe(7)
  })

  it('throws ApiError with the server message and status, the same class from the barrel and from http', async () => {
    const barrel = await import('@/lib/api')
    const http = await import('@/lib/http')
    expect(barrel.ApiError).toBe(http.ApiError)
    answer({ error: 'Sign in again.' }, 401)
    const failure = await barrel.getMe().then(() => null, (e: unknown) => e)
    expect(failure).toBeInstanceOf(http.ApiError)
    expect(failure).toBeInstanceOf(Error)
    expect(failure).toMatchObject({ name: 'ApiError', message: 'Sign in again.', status: 401 })
  })

  it('names the status when a failure has no error field or is not JSON, and says so when a good answer is not JSON', async () => {
    const { getClubs, ApiError } = await import('@/lib/api')
    answer({}, 500)
    await expect(getClubs()).rejects.toMatchObject({ message: 'Request failed (500)', status: 500 })
    answer('<html>Bad gateway</html>', 502)
    const gateway = await getClubs().catch((e: unknown) => e)
    expect(gateway).toBeInstanceOf(ApiError)
    expect(gateway).toMatchObject({ message: 'Request failed (502)', status: 502 })
    answer('<html>Hello</html>', 200)
    await expect(getClubs()).rejects.toMatchObject({ message: 'The server returned an unreadable response.', status: 200 })
  })

  it('does not put the private helpers on the barrel', async () => {
    const barrel: Record<string, unknown> = await import('@/lib/api')
    for (const name of ['authHeaders', 'handleResponse', 'exportQuery']) expect(barrel[name], name).toBeUndefined()
  })
})

describe('a bundle of the barrel', () => {
  it('has no circular-import warning, no zod, and carries the calls of all eight areas', async () => {
    const work = mkdtempSync(join(tmpdir(), 'api-bundle-'))
    const src = join(work, 'src')
    const out = join(work, 'assets')
    mkdirSync(src, { recursive: true })
    const page = join(src, 'page.ts')
    writeFileSync(page, "export * from '@/lib/api'\n")
    const warnings: Array<{ code?: string; message: string }> = []
    await build({
      configFile: false,
      logLevel: 'silent',
      root: src,
      resolve: { alias: { '@domain': join(ROOT, 'domain'), '@': join(ROOT, 'src') } },
      build: {
        outDir: out,
        emptyOutDir: true,
        minify: true,
        lib: { entry: page, formats: ['es'], fileName: () => 'page.js' },
        rollupOptions: { onwarn: (w) => warnings.push({ code: w.code, message: w.message }) },
      },
    })
    expect(warnings.filter((w) => w.code === 'CIRCULAR_DEPENDENCY')).toEqual([])
    expect(findZod(out)).toEqual([])
    const code = readFileSync(join(out, 'page.js'), 'utf8')
    for (const path of ['/api/tournaments', '/api/me/children', '/api/me', '/api/clubs', '/api/support', '/api/board/seats', '/api/scan']) {
      expect(code, path).toContain(path)
    }
    expect(code).toContain('ApiError')
  }, 60_000)
})
