// test/unit/la-places-reach.test.ts
//
// The place file of Suggest a club and Start a club (WS09's thirtieth step)
// is read by the server alone, and by one path: the public endpoint through
// the lookup. This holds it by following imports, not only by reading the
// first ones: from every file of the site (src/) and every file of the
// daily-emails worker (workers/), through relative paths and the two
// aliases, none reaches the place file, the parish table or the lookup, so
// neither the site's scripts nor the worker's bundle can carry them. And the
// public endpoint does reach them, through the lookup and nothing else.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '../..')
const EXTENSIONS = ['.ts', '.tsx', '/index.ts', '/index.tsx', '.js', '.mjs']
const HELD = ['domain/clubs/laPlaces.ts', 'domain/clubs/parishRegions.ts', 'functions/utils/clubs/places.ts']

function filesUnder(dir: string): string[] {
  if (!existsSync(join(ROOT, dir))) return []
  return readdirSync(join(ROOT, dir)).flatMap((name) => {
    const path = join(dir, name)
    if (name === 'node_modules' || name === 'dist') return []
    return statSync(join(ROOT, path)).isDirectory() ? filesUnder(path) : /\.(ts|tsx|js|mjs)$/.test(name) ? [path] : []
  })
}

/** The file an import names, as a path from the root, or null for a package or a file that is not there. */
function resolveImport(from: string, spec: string): string | null {
  let base: string
  if (spec.startsWith('.')) base = join(dirname(from), spec)
  else if (spec.startsWith('@/')) base = join('src', spec.slice(2))
  else if (spec.startsWith('@domain/')) base = join('domain', spec.slice(8))
  else return null
  for (const ext of ['', ...EXTENSIONS]) {
    const candidate = `${base}${ext}`
    if (existsSync(join(ROOT, candidate)) && statSync(join(ROOT, candidate)).isFile()) return candidate
  }
  return null
}

const IMPORT = /(?:^|\n)\s*(?:import|export)\s[^'"\n]*?from\s+['"]([^'"]+)['"]|(?:^|\n)\s*import\s+['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g

function importsOf(file: string): string[] {
  const text = readFileSync(join(ROOT, file), 'utf8')
  const found: string[] = []
  for (const m of text.matchAll(IMPORT)) {
    const resolved = resolveImport(file, m[1] ?? m[2] ?? m[3])
    if (resolved) found.push(resolved)
  }
  return found
}

/** Every file reached from the entries, the entries among them. */
function reach(entries: string[]): Set<string> {
  const seen = new Set<string>()
  const queue = [...entries]
  while (queue.length > 0) {
    const file = queue.pop()!
    if (seen.has(file)) continue
    seen.add(file)
    queue.push(...importsOf(file))
  }
  return seen
}

describe('what reaches the place file', () => {
  it('reads each of the place files in the tree', () => {
    for (const file of HELD) expect(existsSync(join(ROOT, file)), file).toBe(true)
  })

  it('is reached by no file of the site, however many imports away', () => {
    const reached = reach(filesUnder('src'))
    for (const file of HELD) expect(reached.has(file), file).toBe(false)
    // The walk saw the site: the page of this step and the domain files it takes in.
    expect(reached.has('src/pages/SuggestClubPage.tsx')).toBe(true)
    expect(reached.has('domain/clubs/newClub.ts')).toBe(true)
  })

  it('is reached by no file of the daily-emails worker, however many imports away', () => {
    const entries = filesUnder('workers')
    expect(entries.length).toBeGreaterThan(0)
    const reached = reach(entries)
    for (const file of HELD) expect(reached.has(file), file).toBe(false)
  })

  it('is reached from the public endpoint, through the lookup, and the parish table the script reads is not', () => {
    const reached = reach(['functions/api/clubs/reports.ts'])
    expect(reached.has('functions/utils/clubs/places.ts')).toBe(true)
    expect(reached.has('domain/clubs/laPlaces.ts')).toBe(true)
    expect(reached.has('domain/clubs/parishRegions.ts')).toBe(false)
  })

  it('is reached from no other endpoint of the server', () => {
    const others = filesUnder('functions/api').filter((file) => file !== 'functions/api/clubs/reports.ts')
    const reached = reach(others)
    for (const file of HELD) expect(reached.has(file), file).toBe(false)
  })

  it('is reached from none of the server\'s helpers outside the lookup\'s own caller', () => {
    const helpers = filesUnder('functions/utils').filter((file) => file !== 'functions/utils/clubs/places.ts')
    const reached = reach(helpers)
    expect(reached.has('domain/clubs/laPlaces.ts')).toBe(false)
    expect(reached.has('domain/clubs/parishRegions.ts')).toBe(false)
  })
})
