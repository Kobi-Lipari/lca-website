// test/unit/routes.test.ts
// The route scan shared by the route audit and the contract coverage test
// (./routes.ts). The audit keeps its behaviour only if the scan names routes
// the way file routing does, and the coverage test is only as good as its
// reading of which methods a file exports.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { collectRouteFiles, collectRoutes, exportedMethods, fileMethods } from './routes'

const base = mkdtempSync(join(tmpdir(), 'routes-scan-'))
afterAll(() => rmSync(base, { recursive: true, force: true }))

function put(rel: string, text = 'export const x = 1') {
  mkdirSync(join(base, rel, '..'), { recursive: true })
  writeFileSync(join(base, rel), text)
}

put('api/tournaments.ts')
put('api/tournaments/[id].ts')
put('api/tournaments/[id]/remind.ts')
put('api/admin/index.ts')
put('api/admin/members/[id]/club.ts')
put('api/ignored.test.ts')
put('api/types.d.ts')
put('api/readme.md', '# not a handler')
put('utils/response.ts')

describe('collectRoutes', () => {
  it('names routes as file routing does: [id] params kept, index.ts takes its folder', () => {
    expect(collectRoutes(base).map((s) => s.join('/')).sort()).toEqual([
      'api/admin',
      'api/admin/members/[id]/club',
      'api/tournaments',
      'api/tournaments/[id]',
      'api/tournaments/[id]/remind',
      'utils/response',
    ])
  })

  it('skips .test.ts, .d.ts and non-TypeScript files', () => {
    const joined = collectRoutes(base).map((s) => s.join('/'))
    expect(joined).not.toContain('api/ignored.test')
    expect(joined).not.toContain('api/types.d')
    expect(joined).not.toContain('api/readme')
  })

  it('applies a prefix to every route', () => {
    expect(collectRoutes(join(base, 'api', 'tournaments'), ['api', 'tournaments']).map((s) => s.join('/')).sort())
      .toEqual(['api/tournaments/[id]', 'api/tournaments/[id]/remind'])
  })

  it('returns the same segments as collectRouteFiles, in the same order', () => {
    expect(collectRoutes(base)).toEqual(collectRouteFiles(base).map((r) => r.segments))
  })
})

describe('collectRoutes on the real functions folder', () => {
  const real = collectRoutes(join(__dirname, '../../functions')).map((s) => s.join('/'))

  it('finds the 88 handler files under api plus the page routes', () => {
    expect(real.filter((r) => r.startsWith('api/')).length).toBe(88)
    expect(real).toEqual(expect.arrayContaining(['tournaments/[id]', 'clubs/[id]', 'news/[slug]']))
  })

  it('serves the manage page from admin/tournaments/[id]/manage', () => {
    expect(real).toEqual(expect.arrayContaining(['api/admin/tournaments/[id]', 'api/admin/tournaments/[id]/manage']))
  })
})

describe('exportedMethods', () => {
  it('reads every declaration form', () => {
    expect(exportedMethods([
      'export const onRequestGet: PagesFunction<Env> = async () => x',
      'export let onRequestPost = f',
      'export var onRequestPut = f',
      'export async function onRequestPatch() {}',
      'export function onRequestDelete() {}',
      'export const onRequestHead = f',
    ].join('\n')).sort()).toEqual(['DELETE', 'GET', 'HEAD', 'PATCH', 'POST', 'PUT'])
  })

  it('reads a multi-line export list with renames', () => {
    expect(exportedMethods('export {\n  a as onRequestPatch,\n  b as onRequestGet,\n  helper,\n}').sort()).toEqual(['GET', 'PATCH'])
  })

  it('reports a bare onRequest as ALL', () => {
    expect(exportedMethods('export const onRequest = f')).toEqual(['ALL'])
    expect(exportedMethods('export async function onRequest() {}')).toEqual(['ALL'])
  })

  it('ignores a handler that is declared but not exported', () => {
    expect(exportedMethods('const onRequestGet = f\nasync function onRequestPost() {}')).toEqual([])
  })

  it('ignores names that only start like a method or are not methods', () => {
    expect(exportedMethods('export const onRequestFoo = f\nexport const onRequestGetAll = f\nexport const onRequestor = f')).toEqual([])
  })

  it('ignores an export written inside a line comment, a block comment or a string', () => {
    expect(exportedMethods('// export const onRequestPost = f\nexport const onRequestGet = f')).toEqual(['GET'])
    expect(exportedMethods('/*\nexport const onRequestDelete = f\n*/\nexport const onRequestGet = f')).toEqual(['GET'])
    expect(exportedMethods('  // export { a as onRequestPut }\nexport const onRequestGet = f')).toEqual(['GET'])
    expect(exportedMethods('const s = "export const onRequestPut = 1"')).toEqual([])
  })

  it('counts a method once however it is exported', () => {
    expect(exportedMethods('export const onRequestGet = f\nexport { g as onRequestGet }')).toEqual(['GET'])
  })

  it('reads a real file: functions/api/tournaments.ts', () => {
    expect(fileMethods(join(__dirname, '../../functions/api/tournaments.ts')).sort()).toEqual(['GET', 'OPTIONS'])
  })

  it('reads functions/api/admin/tournaments/[id].ts as OPTIONS, PATCH and DELETE only', () => {
    expect(fileMethods(join(__dirname, '../../functions/api/admin/tournaments/[id].ts')).sort()).toEqual(['DELETE', 'OPTIONS', 'PATCH'])
    expect(fileMethods(join(__dirname, '../../functions/api/admin/tournaments/[id]/manage.ts'))).toContain('GET')
  })
})
