// test/unit/api-exports.test.ts
//
// K3c: the site's API client was split by area (scripts/split-api.ts with
// scripts/moves/api-split.json) without changing what an importer of
// '@/lib/api' sees.
//
// - the names '@/lib/api' exports, types included, as the TypeScript checker
//   resolves them through the barrel, equal the snapshot taken from the
//   unsplit file (fixtures/api-exports.json)
// - each of those names is exported by exactly one of src/lib/http.ts and the
//   eight src/areas/<area>/api.ts modules, and each module exports only names
//   from the snapshot, apart from the request helpers http.ts shares with
//   the areas, which the barrel does not re-export
// - at run time the barrel hands back the very functions the area modules
//   define, so a vi.mock of '@/lib/api' that spreads the original still works
// - no area module imports '@/lib/api', and http.ts imports nothing from an area
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({ supabase: { auth: { getSession: async () => ({ data: { session: null } }) } } }))

const ROOT = join(__dirname, '../..')
const SNAPSHOT = JSON.parse(readFileSync(join(__dirname, 'fixtures/api-exports.json'), 'utf8')) as string[]
const AREAS = ['events', 'registration', 'households', 'live', 'membership', 'clubs', 'admin', 'governance']
const HTTP = 'src/lib/http.ts'
const BARREL = 'src/lib/api.ts'
const MODULES = [HTTP, ...AREAS.map((a) => `src/areas/${a}/api.ts`)]
/** The helpers http.ts exports for the area modules; private in the unsplit file, so not on '@/lib/api'. */
const HTTP_HELPERS = ['authHeaders', 'handleResponse']

function program() {
  const config = ts.getParsedCommandLineOfConfigFile(join(ROOT, 'tsconfig.app.json'), {}, {
    ...ts.sys,
    onUnRecoverableConfigFileDiagnostic: (d) => {
      throw new Error(ts.flattenDiagnosticMessageText(d.messageText, '\n'))
    },
  })
  if (!config) throw new Error('tsconfig.app.json could not be read')
  const p = ts.createProgram({ rootNames: [BARREL, ...MODULES].map((f) => join(ROOT, f)), options: { ...config.options, noEmit: true } })
  const checker = p.getTypeChecker()
  const exportsOf = (file: string) => {
    const sf = p.getSourceFile(join(ROOT, file))
    const symbol = sf && checker.getSymbolAtLocation(sf)
    if (!symbol) throw new Error(`${file} is not a module`)
    return checker.getExportsOfModule(symbol).map((s) => s.name).sort()
  }
  return { exportsOf, sourceFile: (file: string) => p.getSourceFile(join(ROOT, file))! }
}

const { exportsOf, sourceFile } = program()

function specifiers(file: string): string[] {
  const out: string[] = []
  for (const s of sourceFile(file).statements) {
    if ((ts.isImportDeclaration(s) || ts.isExportDeclaration(s)) && s.moduleSpecifier && ts.isStringLiteral(s.moduleSpecifier)) out.push(s.moduleSpecifier.text)
  }
  return out
}

describe("'@/lib/api' exports what it did before the split", () => {
  it('the snapshot is the unsplit file: 182 names, ApiError among them', () => {
    expect(SNAPSHOT).toHaveLength(182)
    expect(new Set(SNAPSHOT).size).toBe(SNAPSHOT.length)
    expect(SNAPSHOT).toContain('ApiError')
    expect(SNAPSHOT).not.toContain('authHeaders')
  })

  it('the barrel exports exactly the snapshot, types included', () => {
    expect(exportsOf(BARREL)).toEqual([...SNAPSHOT].sort())
  })

  it('each name is exported by exactly one module', () => {
    const owners = new Map<string, string[]>()
    for (const file of MODULES) for (const name of exportsOf(file)) owners.set(name, [...(owners.get(name) ?? []), file])
    const notOnce = SNAPSHOT.filter((name) => owners.get(name)?.length !== 1).map((name) => `${name}: ${(owners.get(name) ?? []).join(', ') || 'none'}`)
    expect(notOnce).toEqual([])
    const beyond = [...owners.keys()].filter((name) => !SNAPSHOT.includes(name)).sort()
    expect(beyond).toEqual(HTTP_HELPERS)
    for (const name of HTTP_HELPERS) expect(owners.get(name)).toEqual([HTTP])
  })

  it('every area has a module with something in it', () => {
    for (const area of AREAS) expect(exportsOf(`src/areas/${area}/api.ts`).length, area).toBeGreaterThan(0)
  })

  it('the barrel hands back the functions the modules define', async () => {
    const barrel: Record<string, unknown> = await import('@/lib/api')
    const modules: Array<Record<string, unknown>> = [
      await import('@/lib/http'),
      await import('@/areas/events/api'),
      await import('@/areas/registration/api'),
      await import('@/areas/households/api'),
      await import('@/areas/live/api'),
      await import('@/areas/membership/api'),
      await import('@/areas/clubs/api'),
      await import('@/areas/admin/api'),
      await import('@/areas/governance/api'),
    ]
    const values = Object.keys(barrel).sort()
    expect(values.length).toBeGreaterThan(100)
    for (const name of values) {
      expect(SNAPSHOT, name).toContain(name)
      const from = modules.filter((m) => name in m)
      expect(from, name).toHaveLength(1)
      expect(barrel[name], name).toBe(from[0][name])
    }
    for (const name of HTTP_HELPERS) expect(name in barrel, name).toBe(false)
  })
})

describe('the modules import in one direction', () => {
  it('no area module imports the barrel', () => {
    for (const area of AREAS) {
      const file = `src/areas/${area}/api.ts`
      expect(specifiers(file).filter((s) => s === '@/lib/api' || /(^|\/)lib\/api$/.test(s)), file).toEqual([])
    }
  })

  it('http.ts imports nothing from an area or the barrel', () => {
    expect(specifiers(HTTP).filter((s) => s.includes('areas/') || s === '@/lib/api' || s === './api')).toEqual([])
  })

  it('the area index files do not re-export api.ts', () => {
    for (const area of AREAS) {
      const file = `src/areas/${area}/index.ts`
      const text = readFileSync(join(ROOT, file), 'utf8')
      expect(text, file).not.toMatch(/from\s+['"](\.\/api|@\/areas\/\w+\/api|@\/lib\/api)['"]/)
    }
  })

  it('the barrel holds nothing but export-from lines', () => {
    const statements = sourceFile(BARREL).statements
    expect(statements.every((s) => ts.isExportDeclaration(s) && s.moduleSpecifier !== undefined)).toBe(true)
  })
})
