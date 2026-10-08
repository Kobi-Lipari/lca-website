// test/unit/route-audit.test.ts
// Guards against this repo's most repeated bug class: api.ts calling a
// route that no file under functions/ actually serves.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { collectRoutes } from './routes'

const FUNCTIONS_DIR = join(__dirname, '../../functions')
const API_TS = join(__dirname, '../../src/lib/api.ts')

/** Extract '/api/...' fetch paths from api.ts; '${expr}' → '*' */
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

describe('route audit: every api.ts fetch path has a serving file', () => {
  const routes = collectRoutes(FUNCTIONS_DIR)
  const source = readFileSync(API_TS, 'utf-8')
  const fetchPaths = extractFetchPaths(source)

  it('found a plausible number of paths (guard against regex rot)', () => {
    expect(fetchPaths.length).toBeGreaterThan(20)
  })

  for (const path of fetchPaths) {
    it(`${path} is served`, () => {
      const callSegments = path.replace(/^\//, '').split('/') // e.g. ['api','tournaments','*','remind']
      const matched = routes.some((r) => routeMatches(callSegments, r))
      expect(matched, `No file under functions/ serves ${path}`).toBe(true)
    })
  }
})