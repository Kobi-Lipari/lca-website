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
// - The heritage layout's route (step 31), read from src/App.tsx with the
//   TypeScript parser: one layout route with no path of its own holds
//   exactly the six heritage routes, written once in one constant, and no
//   other route, so no route can be given the heritage look without being
//   a heritage page; it is used only when themeHeritage is on, and with the
//   switch off the same six routes are listed among the rest. The check
//   fails on a planted copy of App.tsx that puts a working route, a redirect
//   or a seventh page inside the layout, or the layout round another route.
// - The nesting rule: base inside heritage is the one nesting allowed.
import ts from 'typescript'
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

/** What the heritage layout route of an App.tsx holds, read with the TypeScript parser. */
interface LayoutRoutes {
  /** Each <Route element={<HeritageLayout />}> in the file: whether it has a path, and the paths of the routes inside it. */
  layouts: Array<{ path: string | null; holds: string[]; redirects: number }>
  /** The paths of the routes outside every layout route, the constant the layout holds included where it is listed on its own. */
  outside: string[]
  /** How the layout route is chosen: the condition of the ?: that draws it, or null. */
  condition: string | null
  /** What that ?: draws when its condition is false. */
  otherwise: string | null
}

function layoutRoutes(source: string): LayoutRoutes {
  const sf = ts.createSourceFile('App.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const constants = new Map<string, ts.Node>()
  const visitConstants = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) constants.set(node.name.text, node.initializer)
    ts.forEachChild(node, visitConstants)
  }
  visitConstants(sf)

  const tagOf = (node: ts.Node) =>
    ts.isJsxElement(node) ? node.openingElement : ts.isJsxSelfClosingElement(node) ? node : null
  const attribute = (tag: ts.JsxOpeningLikeElement, name: string) =>
    tag.attributes.properties.find((p): p is ts.JsxAttribute => ts.isJsxAttribute(p) && p.name.getText() === name)
  const pathOf = (tag: ts.JsxOpeningLikeElement) => {
    const init = attribute(tag, 'path')?.initializer
    return init && ts.isStringLiteral(init) ? init.text : null
  }
  const isLayout = (tag: ts.JsxOpeningLikeElement) => {
    const init = attribute(tag, 'element')?.initializer
    return !!init && ts.isJsxExpression(init) && !!init.expression && /^<HeritageLayout\s*\/>$/.test(init.expression.getText())
  }
  const isRedirect = (tag: ts.JsxOpeningLikeElement) => /<Navigate\b/.test(attribute(tag, 'element')?.getText() ?? '')

  const out: LayoutRoutes = { layouts: [], outside: [], condition: null, otherwise: null }
  /** Walks the routes under a node, following a constant it names, into the layout or outside it. */
  const walk = (node: ts.Node, into: LayoutRoutes['layouts'][number] | null, seen: Set<string>) => {
    if (ts.isIdentifier(node) && constants.has(node.text) && (ts.isJsxExpression(node.parent) || ts.isConditionalExpression(node.parent)) && !seen.has(node.text)) {
      walk(constants.get(node.text)!, into, new Set([...seen, node.text]))
      return
    }
    const tag = tagOf(node)
    if (tag && tag.tagName.getText() === 'Route') {
      if (isLayout(tag)) {
        const layout = { path: pathOf(tag), holds: [] as string[], redirects: 0 }
        out.layouts.push(layout)
        if (ts.isJsxElement(node)) for (const child of node.children) walk(child, layout, seen)
        return
      }
      const path = pathOf(tag)
      if (path !== null) {
        if (into) {
          into.holds.push(path)
          if (isRedirect(tag)) into.redirects += 1
        } else out.outside.push(path)
      }
    }
    if (ts.isConditionalExpression(node) && /<Route element=\{<HeritageLayout/.test(node.whenTrue.getText())) {
      out.condition = node.condition.getText()
      out.otherwise = node.whenFalse.getText()
    }
    ts.forEachChild(node, (child) => walk(child, into, seen))
  }
  // The routes App draws, from its function: a constant counts where App draws it.
  const appFunction = sf.statements.find((s): s is ts.FunctionDeclaration => ts.isFunctionDeclaration(s) && s.name?.text === 'App')
  walk(appFunction ?? sf, null, new Set())
  return out
}

/** Every problem with how an App.tsx gives the heritage layout its routes. */
function layoutProblems(source: string): string[] {
  const found = layoutRoutes(source)
  const problems: string[] = []
  if (found.layouts.length !== 1) problems.push(`${found.layouts.length} heritage layout routes`)
  for (const layout of found.layouts) {
    if (layout.path !== null) problems.push(`the layout route has a path of its own: ${layout.path}`)
    if (layout.redirects > 0) problems.push(`the layout holds ${layout.redirects} redirect(s)`)
    const extra = layout.holds.filter((p) => !HERITAGE_ROUTES.includes(p))
    const missing = HERITAGE_ROUTES.filter((p) => !layout.holds.includes(p))
    if (extra.length > 0) problems.push(`the layout holds routes that are not heritage pages: ${extra.join(', ')}`)
    if (missing.length > 0) problems.push(`the layout lacks: ${missing.join(', ')}`)
    if (layout.holds.length !== new Set(layout.holds).size) problems.push('the layout holds a route twice')
    for (const p of layout.holds) if (routeScope(p.replace(/:\w+/g, 'fx-1')) !== 'heritage') problems.push(`${p} inside the layout resolves to ${routeScope(p)}`)
  }
  if (found.condition !== 'FEATURES.themeHeritage') problems.push(`the layout route is chosen by ${found.condition ?? 'nothing'}`)
  return problems
}

describe('the heritage layout\'s routes in src/App.tsx (step 31)', () => {
  const app = read('src/App.tsx')

  it('one layout route, with no path of its own, holds exactly the six heritage routes and nothing else', () => {
    expect(layoutProblems(app)).toEqual([])
    const { layouts } = layoutRoutes(app)
    expect([...layouts[0].holds].sort()).toEqual([...HERITAGE_ROUTES].sort())
  })

  it('is drawn only when themeHeritage is on; with it off the same six routes are listed with the rest, written once', () => {
    const found = layoutRoutes(app)
    expect(found.condition).toBe('FEATURES.themeHeritage')
    expect(found.otherwise).toBe('HERITAGE_PAGES')
    // Each of the six is written once in the file, inside the one constant both branches draw.
    for (const path of HERITAGE_ROUTES) expect(APP_ROUTES.filter((p) => p === path), path).toHaveLength(1)
    // Outside the layout every route is base: the working routes, the redirects and the rest.
    const outside = found.outside.filter((p) => !HERITAGE_ROUTES.includes(p))
    expect(outside.length).toBe(APP_ROUTES.length - HERITAGE_ROUTES.length)
    for (const path of outside) expect(routeScope(filled(path)), path).toBe('base')
  })

  it('fails on a planted App.tsx that gives the layout a working route, a redirect, a seventh page or another route\'s place', () => {
    const into = (route: string) => app.replace('<Route path="/meeting" element={<AnnualMeetingPage />} />', `<Route path="/meeting" element={<AnnualMeetingPage />} />\n    ${route}`)
    expect(into('<Route path="/admin/:section" element={<AdminPage />} />')).not.toBe(app)
    expect(layoutProblems(into('<Route path="/admin/:section" element={<AdminPage />} />'))).toEqual([
      'the layout holds routes that are not heritage pages: /admin/:section',
      '/admin/:section inside the layout resolves to base',
    ])
    expect(layoutProblems(into('<Route path="/workspace" element={<WorkspacePage />} />'))).toContain('the layout holds routes that are not heritage pages: /workspace')
    expect(layoutProblems(into('<Route path="/dashboard" element={<DashboardPage />} />'))).toContain('/dashboard inside the layout resolves to base')
    expect(layoutProblems(into('<Route path="/news" element={<NewsPage />} />'))).toContain('the layout holds routes that are not heritage pages: /news')
    expect(layoutProblems(into('<Route path="/state-champions" element={<Navigate to="/champions" replace />} />'))).toContain('the layout holds 1 redirect(s)')
    expect(layoutProblems(into('<Route path="/about" element={<AboutPage />} />'))).toContain('the layout holds a route twice')
    expect(layoutProblems(app.replace('<Route path="/champions" element={<ChampionsPage />} />', ''))).toEqual(['the layout lacks: /champions'])
    expect(layoutProblems(app.replace('<Route element={<HeritageLayout />}>', '<Route path="/about" element={<HeritageLayout />}>'))).toContain('the layout route has a path of its own: /about')
    expect(layoutProblems(app.replace('FEATURES.themeHeritage ?', 'true ?'))).toEqual(['the layout route is chosen by true'])
    // A layout route written round the working routes, beside the right one.
    const second = app.replace('{/* ── Protected ── */}', '<Route element={<HeritageLayout />}><Route path="/dashboard" element={<DashboardPage />} /></Route>\n            {/* ── Protected ── */}')
    expect(layoutProblems(second)).toEqual(expect.arrayContaining(['2 heritage layout routes', 'the layout lacks: /about, /governance/board, /governance/bylaws, /governance/minutes, /meeting, /champions']))
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
