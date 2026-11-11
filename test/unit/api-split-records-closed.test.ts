// test/unit/api-split-records-closed.test.ts
//
// WS01's split of the site's API client is recorded in three files, closed
// history that no later step edits: the paths the unsplit src/lib/api.ts
// fetched (test/unit/fixtures/api-fetch-paths.json), the names it exported
// (test/unit/fixtures/api-exports.json) and where the split sent each name
// (scripts/moves/api-split.json). What the area modules have gained since
// goes in test/unit/fixtures/api-added-since-split.json alone (WS08 step 8),
// which the route audit and the split's module tests join to the three.
// Held here: each of the three is, value for value, what the split wrote,
// read as JSON so that its spacing may change and nothing else; and the
// added fixture keeps its form, so that a later call joins it the same way:
// two keys, paths sorted and each once, each fetched by exactly one area
// module, the one its names are given to, and never by the shared helpers
// or the barrel; names sorted, each declared by the module the fixture
// gives it and by no other.
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '../..')
const read = (file: string) => readFileSync(join(ROOT, file), 'utf8')
const json = (file: string) => JSON.parse(read(file)) as unknown
/** A file's value as JSON, hashed, so that its spacing and line endings do not count. */
const valueHash = (file: string) => createHash('sha256').update(JSON.stringify(json(file))).digest('hex')

const AREAS = ['events', 'registration', 'households', 'live', 'membership', 'clubs', 'admin', 'governance']
const ADDED_FILE = 'test/unit/fixtures/api-added-since-split.json'
const ADDED = json(ADDED_FILE) as { paths: string[]; exports: Record<string, string> }

/**
 * The paths a file fetches, as the route audit reads them: the first argument of each fetch, a string or a template up
 * to its query, each `${...}` in it read as `*`, as the route audit reads a token in a path (WS16 step 5's two link
 * calls are the first added paths that carry one).
 */
function fetchedPaths(file: string): string[] {
  const text = read(file)
  return [...text.matchAll(/fetch\(\s*(['"`])(\/api\/[^'"`?]*)/g)].map((m) => m[2].replace(/\$\{[^}]*\}/g, '*').replace(/\/$/, ''))
}
/** The names a module declares for export, its own declarations only. */
function declared(file: string): string[] {
  return [...read(file).matchAll(/^export\s+(?:async\s+)?(?:function|const|interface|type|class|let)\s+([A-Za-z0-9_]+)/gm)].map((m) => m[1])
}

describe('the split\'s three records, as WS01 wrote them', () => {
  it.each([
    ['test/unit/fixtures/api-fetch-paths.json', 77, 'df02709870b42d15397c92fd582d09ffc9377048bf9135f9248f8a2aa3446c9b'],
    ['test/unit/fixtures/api-exports.json', 182, '57059d2598b10ca9e727a6b41963842649cf9690bd70bac7a2482fe601009bc4'],
    ['scripts/moves/api-split.json', 185, '49171ec46c18906d6719e72e4c05d093ebf801baae77b6dff3c8449a80c393f8'],
  ] as const)('%s holds its %i entries, value for value', (file, size, hash) => {
    const value = json(file)
    expect(Array.isArray(value) ? value.length : Object.keys(value as object).length).toBe(size)
    expect(valueHash(file)).toBe(hash)
  })

  it('none of them holds a path or a name the added fixture holds', () => {
    const paths = json('test/unit/fixtures/api-fetch-paths.json') as string[]
    const names = json('test/unit/fixtures/api-exports.json') as string[]
    const map = json('scripts/moves/api-split.json') as Record<string, string>
    for (const path of ADDED.paths) expect(paths, path).not.toContain(path)
    for (const name of Object.keys(ADDED.exports)) {
      expect(names, name).not.toContain(name)
      expect(Object.hasOwn(map, name), name).toBe(false)
    }
  })
})

describe('the fixture of what the area modules have gained since the split', () => {
  it('has the two keys and no other, its paths sorted and each once, its names sorted', () => {
    expect(Object.keys(json(ADDED_FILE) as object)).toEqual(['paths', 'exports'])
    expect(ADDED.paths).toEqual([...new Set(ADDED.paths)].sort())
    expect(Object.keys(ADDED.exports)).toEqual(Object.keys(ADDED.exports).sort())
    for (const path of ADDED.paths) expect(path, path).toMatch(/^\/api\/[a-z0-9/*-]+$/)
  })

  it('gives each name to one of the eight areas, a module that declares it, and no other module declares it', () => {
    for (const [name, area] of Object.entries(ADDED.exports)) {
      expect(AREAS, name).toContain(area)
      const owners = AREAS.filter((a) => declared(`src/areas/${a}/api.ts`).includes(name))
      expect(owners, name).toEqual([area])
      expect(declared('src/lib/http.ts'), name).not.toContain(name)
    }
  })

  it('has each path fetched by exactly one area module, one its names are given to, and never by the shared helpers or the barrel', () => {
    const modules = [...new Set(Object.values(ADDED.exports))]
    for (const path of ADDED.paths) {
      const fetching = AREAS.filter((a) => fetchedPaths(`src/areas/${a}/api.ts`).includes(path))
      expect(fetching, path).toHaveLength(1)
      expect(modules, path).toContain(fetching[0])
      expect(fetchedPaths('src/lib/http.ts'), path).not.toContain(path)
      expect(fetchedPaths('src/lib/api.ts'), path).not.toContain(path)
    }
  })

  it('names, for each path, a call the barrel hands to the site', async () => {
    const barrel = read('src/lib/api.ts')
    for (const area of new Set(Object.values(ADDED.exports))) expect(barrel, area).toContain(`'@/areas/${area}/api'`)
  })
})
