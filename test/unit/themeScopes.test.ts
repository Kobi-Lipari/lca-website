// The looks and the pages they go on (WS01 step 22, src/lib/themeScopes.ts).
//
// - --gold-ink, parsed from src/index.css, is #705718 inside the heritage
//   scope and #866a1e in base, both on <html> and in a data-theme="" reset,
//   including a reset inside heritage. These are the light blocks under
//   data-look="new"; with newLook off no scope changes any token, and dark
//   mode puts brand gold back on the dark grounds.
// - The gold words tokens of step 25 in each scope: the dark gold of badges
//   on a gold tint is #705718 wherever the look is light and brand gold
//   wherever it is dark, the scholastic and live scopes keeping their own
//   whatever the device says, and the light gold of a pill on a dark ground
//   is #f0d07a everywhere.
// - The route-to-scope map: the heritage pages are exactly the six, every
//   working route in src/App.tsx (admin, workspace, club and tournament
//   tools, My LCA, account and the board inbox) is base, and the three old
//   addresses that redirect into the heritage set are base.
// - The nesting rule: base inside heritage is the one nesting allowed.
import { describe, expect, it } from 'vitest'
import { ALWAYS_BASE_PREFIXES, HERITAGE_ROUTES, THEME_SCOPES, dataThemeOf, isThemeScope, nestingProblem, routeScope } from '@/lib/themeScopes'
import { applies, indexCssRules, matchesScope, read, rootTokens, scopeTokens, specificity, substitute, type RootState } from './helpers/cssTokens'

const rules = indexCssRules()
const TODAY: RootState = { look: false, dark: false }
const LIGHT: RootState = { look: true, dark: false }
const DARK: RootState = { look: true, dark: true }

/**
 * The tokens on a data-theme="theme" container inside a container that has
 * `outer` (scopeTokens' answer for the outer one). The scope rules in
 * src/index.css are descendant selectors (":root[...] [data-theme=...]"), so
 * a container two levels down matches them exactly as one level down does.
 */
function nestedTokens(outer: Map<string, string>, state: RootState, theme: string): Map<string, string> {
  const own = rules
    .filter((r) => applies(r, state.print) && r.selectors.some((sel) => matchesScope(sel, state, theme)))
    .map((r) => ({ r, spec: Math.max(...r.selectors.filter((sel) => matchesScope(sel, state, theme)).map(specificity)) }))
    .sort((a, b) => a.spec - b.spec || a.r.order - b.r.order)
  const raw = new Map(outer)
  for (const { r } of own) for (const [k, v] of r.decls) if (k.startsWith('--')) raw.set(k, v)
  const out = new Map<string, string>()
  for (const [k, v] of raw) out.set(k, substitute(v, raw))
  return out
}

describe('--gold-ink in each scope (src/index.css)', () => {
  it('is #705718 inside heritage and #866a1e in base', () => {
    expect(scopeTokens(rules, LIGHT, 'heritage').get('--gold-ink')).toBe('#705718')
    expect(rootTokens(rules, LIGHT).get('--gold-ink')).toBe('#866a1e')
    expect(scopeTokens(rules, LIGHT, '').get('--gold-ink')).toBe('#866a1e')
  })

  it('a base reset inside heritage gives #866a1e back, and the heritage paper with it', () => {
    const heritage = scopeTokens(rules, LIGHT, 'heritage')
    const reset = nestedTokens(heritage, LIGHT, '')
    expect(reset.get('--gold-ink')).toBe('#866a1e')
    expect(reset.get('--ground')).toBe(rootTokens(rules, LIGHT).get('--ground'))
    expect(reset.get('--background')).toBe('#fff')
  })

  it('the scholastic scope keeps the base gold ink, and the live scope uses brand gold on its dark ground', () => {
    expect(scopeTokens(rules, LIGHT, 'scholastic').get('--gold-ink')).toBe('#866a1e')
    expect(scopeTokens(rules, LIGHT, 'live').get('--gold-ink')).toBe('#c8a94a')
  })

  it('in dark mode the base and heritage gold ink is brand gold, on the dark grounds', () => {
    expect(rootTokens(rules, DARK).get('--gold-ink')).toBe('#c8a94a')
    expect(scopeTokens(rules, DARK, 'heritage').get('--gold-ink')).toBe('#c8a94a')
  })

  it('with newLook off, no scope changes --gold-ink or any other token', () => {
    const today = rootTokens(rules, TODAY)
    for (const scope of THEME_SCOPES) {
      const scoped = scopeTokens(rules, TODAY, dataThemeOf(scope))
      for (const [name, value] of today) expect(scoped.get(name), `${scope} ${name}`).toBe(value)
    }
  })
})

describe('the gold words tokens in each scope (step 25)', () => {
  const BADGE = ['--gold-ink-badge', '--gold-ink-badge-club']

  it('the dark gold of badges is #705718 in base, heritage and scholastic, and brand gold in live and in dark mode', () => {
    const heritage = scopeTokens(rules, LIGHT, 'heritage')
    for (const name of BADGE) {
      expect(rootTokens(rules, LIGHT).get(name), name).toBe('#705718')
      expect(scopeTokens(rules, LIGHT, '').get(name), name).toBe('#705718')
      expect(heritage.get(name), name).toBe('#705718')
      expect(scopeTokens(rules, LIGHT, 'scholastic').get(name), name).toBe('#705718')
      expect(scopeTokens(rules, LIGHT, 'live').get(name), name).toBe('#c8a94a')
      expect(rootTokens(rules, DARK).get(name), name).toBe('#c8a94a')
      expect(scopeTokens(rules, DARK, 'heritage').get(name), name).toBe('#c8a94a')
      // Scholastic is light in dark mode too, and live dark on a light device:
      // each sets its own, so neither takes the device's from <html>.
      expect(scopeTokens(rules, DARK, 'scholastic').get(name), name).toBe('#705718')
      // A base reset inside heritage gives the base value back.
      expect(nestedTokens(heritage, LIGHT, '').get(name), name).toBe('#705718')
    }
  })

  it('the light gold of a pill on a dark ground is #f0d07a in every scope, light and dark', () => {
    for (const state of [LIGHT, DARK]) {
      expect(rootTokens(rules, state).get('--gold-on-dark-badge')).toBe('#f0d07a')
      for (const scope of THEME_SCOPES) expect(scopeTokens(rules, state, dataThemeOf(scope)).get('--gold-on-dark-badge'), scope).toBe('#f0d07a')
    }
  })

  it('with newLook off, no scope changes them: they are the hex colours the pages spelled before', () => {
    const today = rootTokens(rules, TODAY)
    expect([today.get('--gold-ink-badge'), today.get('--gold-ink-badge-club'), today.get('--gold-on-dark-badge')]).toEqual(['#7a5c00', '#8a6d1f', '#f0d07a'])
    for (const scope of THEME_SCOPES) {
      const scoped = scopeTokens(rules, TODAY, dataThemeOf(scope))
      for (const name of [...BADGE, '--gold-on-dark-badge']) expect(scoped.get(name), `${scope} ${name}`).toBe(today.get(name))
    }
  })
})

describe('the looks', () => {
  it('names four looks, and base is the data-theme="" reset', () => {
    expect(THEME_SCOPES).toEqual(['base', 'heritage', 'live', 'scholastic'])
    expect(THEME_SCOPES.map(dataThemeOf)).toEqual(['', 'heritage', 'live', 'scholastic'])
    expect(THEME_SCOPES.every(isThemeScope)).toBe(true)
    for (const bad of ['', 'Base', 'dark', 'news', 'constructor', undefined, null, 3]) expect(isThemeScope(bad), String(bad)).toBe(false)
  })

  it('every look but base has a data-theme block in src/index.css', () => {
    const css = read('src/index.css')
    for (const scope of THEME_SCOPES.filter((s) => s !== 'base')) {
      expect(css, scope).toContain(`:root[data-look="new"] [data-theme="${scope}"]`)
    }
    expect(css).toContain(':root[data-look="new"] [data-theme=""]')
  })
})

/** Every route path in src/App.tsx. */
const APP_ROUTES = [...read('src/App.tsx').matchAll(/<Route\s+path="([^"]+)"/g)].map((m) => m[1])
/** The routes that only redirect, from <Navigate to=...>. */
const REDIRECTS = [...read('src/App.tsx').matchAll(/<Route\s+path="([^"]+)"\s+element=\{<Navigate to="([^"]+)"/g)].map((m) => ({ from: m[1], to: m[2] }))
/** A route path with each :param filled in, as a visitor's address would be. */
const filled = (path: string) => path.replace(/:\w+/g, 'fx-1')

describe('routeScope: the route-to-scope map', () => {
  it('the heritage set is exactly the six pages', () => {
    expect([...HERITAGE_ROUTES].sort()).toEqual(['/about', '/champions', '/governance/board', '/governance/bylaws', '/governance/minutes', '/meeting'])
    for (const path of HERITAGE_ROUTES) expect(routeScope(path), path).toBe('heritage')
  })

  it('of the routes in src/App.tsx, exactly the six resolve to heritage, and each of the six is a page there', () => {
    expect(APP_ROUTES.length).toBeGreaterThan(30)
    const heritage = APP_ROUTES.filter((path) => routeScope(filled(path)) === 'heritage')
    expect(heritage.sort()).toEqual([...HERITAGE_ROUTES].sort())
    const redirects = new Set(REDIRECTS.map((r) => r.from))
    for (const path of HERITAGE_ROUTES) expect(redirects.has(path), path).toBe(false)
  })

  it('no admin, workspace, manage, dashboard, account or board inbox route resolves to heritage', () => {
    const working = APP_ROUTES.filter((path) => ALWAYS_BASE_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`)))
    // The working routes the app has today, so a new one is covered by a prefix or fails here.
    expect(working.sort()).toEqual([
      '/account/security',
      '/admin',
      '/admin/:section',
      '/admin/clubs/:id',
      '/admin/tournaments/:id',
      '/board/inbox',
      '/dashboard',
      '/manage/club',
      '/workspace',
    ])
    for (const path of working) expect(routeScope(filled(path)), path).toBe('base')
  })

  it('a working address stays base however it is written, and whatever follows it', () => {
    for (const path of [
      '/admin/tournaments/fx-t-1',
      '/ADMIN',
      '/admin/',
      '/workspace?tab=events',
      '/manage/tournaments',
      '/dashboard#family',
      '/account/security/',
      '/board/inbox/thread-1',
    ]) {
      expect(routeScope(path), path).toBe('base')
    }
  })

  it('a heritage page stays heritage with a trailing slash, a query, a hash or capitals, as React Router matches it', () => {
    for (const path of ['/about/', '/About', '/governance/bylaws?section=4', '/champions#2025', '/MEETING']) {
      expect(routeScope(path), path).toBe('heritage')
    }
  })

  it('the three old addresses that redirect into the heritage set resolve to base, since they draw nothing', () => {
    const intoHeritage = REDIRECTS.filter((r) => HERITAGE_ROUTES.includes(r.to))
    expect(intoHeritage).toEqual([
      { from: '/governance', to: '/governance/board' },
      { from: '/state-champions', to: '/champions' },
      { from: '/governance/rules', to: '/governance/bylaws' },
    ])
    for (const { from } of intoHeritage) expect(routeScope(from), from).toBe('base')
  })

  it('anything else is base, including pages under a heritage address and look-alikes', () => {
    for (const path of ['/', '', '/tournaments', '/scholastic', '/membership', '/donate', '/about-us', '/champions/2025', '/governance/board/fx-1', '/meetings', '/board', '/administrator', '/__fixtures/heritage']) {
      expect(routeScope(path), path).toBe('base')
    }
  })
})

describe('nestingProblem: scopes nest one level only', () => {
  it('any look with no look around it is allowed', () => {
    for (const scope of THEME_SCOPES) expect(nestingProblem([], scope), scope).toBeNull()
  })

  it('base inside heritage is the one nesting allowed', () => {
    expect(nestingProblem(['heritage'], 'base')).toBeNull()
    const allowed = THEME_SCOPES.flatMap((outer) => THEME_SCOPES.map((inner) => [outer, inner] as const)).filter(([o, i]) => nestingProblem([o], i) === null)
    expect(allowed).toEqual([['heritage', 'base']])
  })

  it('heritage inside live is reported as such', () => {
    expect(nestingProblem(['live'], 'heritage')).toMatch(/heritage look never renders inside the live look/)
    expect(nestingProblem(['live', 'base'], 'heritage')).toMatch(/never renders inside the live look/)
  })

  it('a second level is reported, even under base inside heritage', () => {
    expect(nestingProblem(['heritage', 'base'], 'base')).toMatch(/one level only/)
    expect(nestingProblem(['heritage', 'base'], 'heritage')).toMatch(/one level only/)
    expect(nestingProblem(['heritage', 'base'], 'live')).toMatch(/one level only/)
  })
})
