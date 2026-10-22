// routeScope and nestingProblem at their edges (WS01 step 22,
// src/lib/themeScopes.ts): odd spellings of an address, a query or hash that
// names another page, and every route in src/App.tsx.
import { describe, expect, it } from 'vitest'
import { HERITAGE_ROUTES, THEME_SCOPES, nestingProblem, routeScope, type ThemeScopeName } from '@/lib/themeScopes'
import { read } from './helpers/cssTokens'

describe('routeScope: spellings of an address', () => {
  it('ignores repeated trailing slashes, case, a query and a hash together', () => {
    for (const path of ['/about//', '/ABOUT/?a=1#top', '/Governance/Board/', '/governance/MINUTES?year=2025', '/champions/#x']) {
      expect(routeScope(path), path).toBe('heritage')
    }
  })

  it('reads only the path: a query or hash that names another page does not change the answer', () => {
    expect(routeScope('/about?next=/admin')).toBe('heritage')
    expect(routeScope('/meeting#/admin/clubs/fx-1')).toBe('heritage')
    expect(routeScope('/admin?return=/about')).toBe('base')
    expect(routeScope('/dashboard#/champions')).toBe('base')
    expect(routeScope('/?page=/about')).toBe('base')
  })

  it('a working address with a heritage word under it is still base', () => {
    for (const path of ['/admin/about', '/admin/governance/board', '/workspace/meeting', '/manage/champions', '/account/about', '/dashboard/champions']) {
      expect(routeScope(path), path).toBe('base')
    }
  })

  it('a heritage address nested under another page, or with a missing leading slash, is not heritage', () => {
    for (const path of ['/x/about', '/governance/board/minutes', 'about', 'champions', '/governance/', '/governance//board//']) {
      expect(routeScope(path), path).toBe('base')
    }
  })

  it('the empty address and the home page are base', () => {
    expect(routeScope('')).toBe('base')
    expect(routeScope('/')).toBe('base')
    expect(routeScope('///')).toBe('base')
  })

  it('answers the same for the same address every time and never throws on odd input', () => {
    for (const path of ['/%', '/about%2F', '/é', '?', '#', '/about\n', ' /about', '/about ']) {
      expect(() => routeScope(path), JSON.stringify(path)).not.toThrow()
      expect(routeScope(path)).toBe(routeScope(path))
    }
    // Whitespace is not trimmed: it is not the address React Router would match.
    expect(routeScope(' /about')).toBe('base')
    expect(routeScope('/about ')).toBe('base')
  })
})

describe('routeScope over the routes in src/App.tsx', () => {
  const routes = [...read('src/App.tsx').matchAll(/<Route\s+path="([^"]+)"/g)].map((m) => m[1].replace(/:\w+/g, 'fx-1'))

  it('answers base or heritage for every route, never live or scholastic', () => {
    expect(routes.length).toBeGreaterThan(30)
    for (const path of routes) expect(['base', 'heritage'], path).toContain(routeScope(path))
  })

  it('a wildcard or fixture route is base', () => {
    expect(routeScope('/some/unknown/page')).toBe('base')
    for (const name of ['base', 'heritage', 'scholastic', 'live']) expect(routeScope(`/__fixtures/${name}`), name).toBe('base')
  })

  it('every heritage page is registered once, as its own page', () => {
    for (const path of HERITAGE_ROUTES) {
      expect(routes.filter((r) => r === path), path).toHaveLength(1)
    }
  })
})

describe('nestingProblem: the messages and the chain', () => {
  it('names the chain, outermost first', () => {
    expect(nestingProblem(['scholastic'], 'live')).toContain('(scholastic > live)')
    expect(nestingProblem(['heritage', 'base'], 'scholastic')).toContain('(heritage > base > scholastic)')
  })

  it('a look inside itself is reported', () => {
    for (const scope of THEME_SCOPES) expect(nestingProblem([scope], scope), scope).not.toBeNull()
  })

  it('heritage anywhere inside live gets the live message, deep or not', () => {
    const deep: ThemeScopeName[][] = [['live'], ['base', 'live'], ['heritage', 'live'], ['live', 'scholastic']]
    for (const ancestors of deep) expect(nestingProblem(ancestors, 'heritage'), ancestors.join('>')).toMatch(/never renders inside the live look/)
  })

  it('base inside live, scholastic or base is reported but not as the heritage rule', () => {
    for (const outer of ['live', 'scholastic', 'base'] as const) {
      const problem = nestingProblem([outer], 'base')
      expect(problem, outer).toMatch(/one level only/)
      expect(problem, outer).not.toMatch(/never renders/)
    }
  })

  it('does not change the list it is given', () => {
    const ancestors: ThemeScopeName[] = ['heritage']
    nestingProblem(ancestors, 'live')
    expect(ancestors).toEqual(['heritage'])
  })
})
