// test/unit/route-audit.test.ts
// Guards against this repo's most repeated bug class: the site's API client
// calling a route that no file under functions/ actually serves.
//
// The client is src/lib/api.ts (now a barrel), the shared helpers in
// src/lib/http.ts and each area's src/areas/<area>/api.ts. The paths found
// across all of them must be the same set as before the client was split
// by area (fixtures/api-fetch-paths.json, taken from the unsplit api.ts), so
// a file left out of the scan cannot drop coverage unnoticed.
import { describe, expect, it } from 'vitest'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { collectRoutes } from './routes'

const ROOT = join(__dirname, '../..')
const FUNCTIONS_DIR = join(ROOT, 'functions')
const AREAS_DIR = join(ROOT, 'src/areas')
const PATHS_BEFORE_SPLIT = JSON.parse(readFileSync(join(__dirname, 'fixtures/api-fetch-paths.json'), 'utf8')) as string[]

/** Every file of the site's API client, relative to the repository root. */
const API_FILES = [
  'src/lib/api.ts',
  'src/lib/http.ts',
  ...readdirSync(AREAS_DIR)
    .filter((area) => existsSync(join(AREAS_DIR, area, 'api.ts')))
    .map((area) => `src/areas/${area}/api.ts`),
]

/** Extract '/api/...' fetch paths from a client file; '${expr}' → '*' */
function extractFetchPaths(source: string): string[] {
  const paths = new Set<string>()
  const regex = /fetch\(\s*[`'"](\/api\/[^`'"]*)[`'"]/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(source)) !== null) {
    let path = match[1]
    path = path.split('?')[0] // drop query strings
    path = path.replace(/\$\{[^}]*\}/g, '*') // template exprs → wildcard
    if (path.endsWith('/')) path = path.slice(0, -1)
    if (path) paths.add(path)
  }
  return [...paths]
}

function routeMatches(callSegments: string[], routeSegments: string[]): boolean {
  if (callSegments.length !== routeSegments.length) return false
  return callSegments.every((seg, i) => {
    const route = routeSegments[i]
    const isParam = route.startsWith('[') && route.endsWith(']')
    if (seg === '*') return isParam
    return isParam || seg === route
  })
}

describe('route audit: every API client fetch path has a serving file', () => {
  const routes = collectRoutes(FUNCTIONS_DIR)
  const fetchPaths = [...new Set(API_FILES.flatMap((file) => extractFetchPaths(readFileSync(join(ROOT, file), 'utf-8'))))].sort()

  it('scans the barrel, the shared helpers and all eight area modules', () => {
    expect(API_FILES).toHaveLength(10)
  })

  it('found a plausible number of paths (guard against regex rot)', () => {
    expect(fetchPaths.length).toBeGreaterThan(20)
  })

  it('found the same paths as the unsplit api.ts', () => {
    expect(fetchPaths).toEqual([...PATHS_BEFORE_SPLIT].sort())
  })

  for (const path of fetchPaths) {
    it(`${path} is served`, () => {
      const callSegments = path.replace(/^\//, '').split('/') // e.g. ['api','tournaments','*','remind']
      const matched = routes.some((r) => routeMatches(callSegments, r))
      expect(matched, `No file under functions/ serves ${path}`).toBe(true)
    })
  }
})