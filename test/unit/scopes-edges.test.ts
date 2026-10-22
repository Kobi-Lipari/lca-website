// test/unit/scopes-edges.test.ts
//
// The edges of WS01 acceptance criterion 1 and the close of WS01 (step 32),
// read without a browser:
//
// - The matrix, test/a11y/scopes.spec.ts, against what it stands for. Its
//   pages are the ones the criterion names in docs/redesign/REDESIGN_SPEC.md,
//   each a route of src/App.tsx, the tournament page on seeded events whose
//   state the page needs (the finished one with games, so its pairings are
//   published, and the open one, open for entries); the three it reads on the
//   heritage layout's scope div are exactly the three of the nine the layout
//   draws, on the build that turns themeHeritage on; its five readings are
//   the ones the stylesheet calls for (live has one ground on any device,
//   heritage a ground of its own on each, scholastic none for dark), each
//   look's ground in the spec is the token the stylesheet gives it, both
//   widths and the suite's tags are read, nothing is turned off or left out,
//   and it holds the 52 tests and 104 cells the records give it.
// - test/a11y/known-violations.json keeps exactly today's nine findings with
//   every switch off, and none for the build with the switches on.
// - Every rule src/index.css gives step 32 waits for the new look.
// - The records against the tree: Checkpoint D lists the 24 switches
//   src/lib/features.ts had when the checkpoint was recorded, each still a
//   switch there (whether one is on is test/unit/features.test.ts's to hold,
//   so turning a switch on or adding one leaves this record true), and For K
//   names the four WS01 added; every test file a row of the acceptance table
//   names is in the tree, and every row names one; each follow-up the close
//   of WS01 lists is there once, with the workstream that owns it, and the
//   limits the caps entry gives are the server's.
// - The files of these edges hold no dash and name no tool.
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { FEATURES } from '@/lib/features'
import { A11Y_VARIANTS } from '../a11y/global-setup'
import { hexToRgb, indexCssRules, rootTokens, scopeTokens } from './helpers/cssTokens'

const ROOT = resolve(__dirname, '../..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')

const matrix = read('test/a11y/scopes.spec.ts')
const app = read('src/App.tsx')
const seed = read('scripts/seed/fixtures.sql')
const status = read('REDESIGN_STATUS.md')
const statusLines = status.split('\n')

/** The text of a constant in the matrix, from its name to the bracket that closes its value. */
function constant(name: string): string {
  const at = matrix.indexOf(`const ${name}`)
  const equals = at < 0 ? -1 : matrix.indexOf(' = ', at)
  if (equals < 0) return ''
  const start = matrix.slice(equals).search(/[[{]/) + equals
  const open = matrix[start]
  const close = open === '[' ? ']' : '}'
  let depth = 0
  for (let i = start; i < matrix.length; i++) {
    if (matrix[i] === open) depth++
    else if (matrix[i] === close && --depth === 0) return matrix.slice(at, i + 1)
  }
  return ''
}

/** The pages of the matrix: route, and whether the heritage layout draws it. */
const PAGES = [...constant('PAGES').matchAll(/\{ route: '([^']+)', heritage: (true|false),/g)].map((m) => ({ route: m[1], heritage: m[2] === 'true' }))
/** The readings of the matrix. */
const LOOKS = [...constant('LOOKS').matchAll(/\{ name: '([^']+)', scheme: '(light|dark)', theme: '(base|live|heritage)' \}/g)].map((m) => ({ name: m[1], scheme: m[2], theme: m[3] }))

/** The nine pages acceptance criterion 1 names, as the brief writes them. */
function criterionOne(): { routes: string[]; detail: boolean } {
  const line = read('docs/redesign/REDESIGN_SPEC.md').split('\n').find((l) => l.startsWith('1. axe reports zero serious or critical violations on')) ?? ''
  return { routes: [...line.matchAll(/`(\/[^`]*)`/g)].map((m) => m[1]), detail: line.includes('a tournament detail page') }
}

/** Every path a Route of src/App.tsx gives, as a pattern that matches a URL path. */
const ROUTES = [...app.matchAll(/<Route path="([^"]+)"/g)].map((m) => m[1])
const routeOf = (path: string) => ROUTES.find((r) => new RegExp(`^${r.replace(/:[a-z]+/gi, '[^/]+')}$`).test(path))

/** An rgb() colour as the browser computes it, from a hex token. */
const rgbOf = (hex: string) => `rgb(${hexToRgb(hex).join(', ')})`

describe('the AC1 matrix reads what the criterion names', () => {
  it('reads every page acceptance criterion 1 names, the tournament page on seeded events, and every page it reads is a route of the site', () => {
    const named = criterionOne()
    expect(named.routes).toEqual(['/', '/tournaments', '/clubs', '/membership', '/scholastic', '/about', '/governance/minutes', '/champions'])
    expect(named.detail).toBe(true)
    const visited = PAGES.map((p) => p.route)
    for (const route of named.routes) expect(visited, route).toContain(route)
    const details = visited.filter((r) => !named.routes.includes(r))
    expect(details.length).toBeGreaterThan(0)
    for (const r of details) expect(r, 'the detail page is read on a seeded event').toMatch(/^\/tournaments\/fx-t-[a-z]+$/)
    for (const r of visited) expect(routeOf(r), `${r} is a route of src/App.tsx`).toBeDefined()
    expect(details.map(routeOf)).toEqual(details.map(() => '/tournaments/:id'))
    expect(new Set(visited).size).toBe(visited.length)
  })

  it('reads on the heritage layout\'s scope div the three pages of the nine the layout draws, on the build that turns themeHeritage on', () => {
    const heritagePages = app.slice(app.indexOf('const HERITAGE_PAGES = ('), app.indexOf('function App()'))
    const drawnInLayout = [...heritagePages.matchAll(/<Route path="([^"]+)"/g)].map((m) => m[1])
    expect(drawnInLayout).toHaveLength(6)
    expect(app).toContain('{FEATURES.themeHeritage ? <Route element={<HeritageLayout />}>{HERITAGE_PAGES}</Route> : HERITAGE_PAGES}')
    const expected = PAGES.filter((p) => drawnInLayout.includes(p.route)).map((p) => p.route)
    expect(expected).toEqual(['/about', '/governance/minutes', '/champions'])
    expect(PAGES.filter((p) => p.heritage).map((p) => p.route)).toEqual(expected)
    // The layout's scope is the div the matrix sets, and the matrix's build draws it.
    const layout = read('src/layouts/HeritageLayout.tsx')
    expect(layout).toContain('scope="heritage"')
    expect(layout).toContain('data-layout="heritage"')
    expect(matrix).toContain('main.querySelector(\'[data-layout="heritage"]\')')
    const on = A11Y_VARIANTS.find((v) => v.name === 'a11y-on')
    expect(on?.flags.split(',')).toEqual(['newLook', 'themeHeritage'])
    expect(matrix).toMatch(/const ON = 'a11y-on'/)
  })

  it('reads the tournament page on the finished event, whose games are seeded, and on the open one, open for entries', () => {
    const tournament = (id: string) => {
      const at = seed.indexOf(`'${id}', '`)
      return at < 0 ? '' : seed.slice(at, seed.indexOf(');', at))
    }
    expect(PAGES.map((p) => p.route).filter((r) => r.startsWith('/tournaments/'))).toEqual(['/tournaments/fx-t-done', '/tournaments/fx-t-open'])
    expect(tournament('fx-t-done')).toMatch(/'completed', 'closed'/)
    expect(seed.match(/\('fx-g-\d+-\d+', 'fx-t-done',/g)?.length).toBeGreaterThan(0)
    expect(tournament('fx-t-open')).toMatch(/'upcoming', 'A made-up two-day event/)
    expect(tournament('fx-t-open')).toMatch(/\n {2}'open', datetime\('now', '-10 days'\)/)
    // The open event's sections are objects with fees, the registration card's choices.
    expect(tournament('fx-t-open')).toContain('"name":"Under 1600"')
  })

  it('reads the four looks five ways, as the stylesheet calls for: live has one ground on any device, heritage one on each, scholastic none for dark', () => {
    expect(LOOKS).toEqual([
      { name: 'light', scheme: 'light', theme: 'base' },
      { name: 'dark', scheme: 'dark', theme: 'base' },
      { name: 'live', scheme: 'light', theme: 'live' },
      { name: 'heritage', scheme: 'light', theme: 'heritage' },
      { name: 'heritage on a dark device', scheme: 'dark', theme: 'heritage' },
    ])
    const rules = indexCssRules()
    const ground = (theme: string, dark: boolean) =>
      theme === 'base' ? rootTokens(rules, { look: true, dark }).get('--background') : scopeTokens(rules, { look: true, dark }, theme).get('--background')
    expect(ground('live', false)).toBe(ground('live', true))
    expect(rules.some((r) => r.selectors.includes(':root[data-look="new"] [data-theme="live"]') && r.decls.get('color-scheme') === 'dark')).toBe(true)
    expect(ground('heritage', false)).not.toBe(ground('heritage', true))
    expect(ground('base', false)).not.toBe(ground('base', true))
    expect(ground('scholastic', false)).toBe(ground('scholastic', true))
    expect(rules.some((r) => r.selectors.some((s) => s.includes('.dark [data-theme="scholastic"]')))).toBe(false)
  })

  it('checks each look against the ground the stylesheet gives it', () => {
    const rules = indexCssRules()
    const grounds = constant('GROUNDS')
    const pair = (theme: string) => grounds.match(new RegExp(`${theme}: \\{ light: '([^']+)', dark: '([^']+)' \\}`))?.slice(1, 3)
    const token = (theme: string, dark: boolean) =>
      rgbOf(theme === 'base' ? (rootTokens(rules, { look: true, dark }).get('--background') as string) : (scopeTokens(rules, { look: true, dark }, theme).get('--background') as string))
    for (const theme of ['base', 'live', 'heritage']) expect(pair(theme), theme).toEqual([token(theme, false), token(theme, true)])
    expect(constant('FIXTURE')).toContain(`ground: '${token('scholastic', false)}'`)
    // The check runs before axe, and a wrong ground fails the test.
    expect(matrix).toContain('if (worn.ground !== GROUNDS[look.theme][look.scheme]) wrong.push(')
    expect(matrix).toContain('expect(wrong, \'the look is not the one asked for\').toEqual([])')
  })

  it('reads both widths and the fixture page with the tags every browser spec carries, and turns nothing off', () => {
    expect(matrix).toContain('const WIDTHS = [1280, 390] as const')
    const tags = (text: string) => text.match(/const AXE_TAGS = (\[[^\]]*\])/)?.[1]
    const ours = tags(matrix)
    expect(ours).toBe('[\'wcag2a\', \'wcag2aa\', \'wcag21a\', \'wcag21aa\', \'wcag22aa\']')
    for (const spec of ['smoke', 'dark-spot', 'heritage', 'components', 'chess-data', 'brand', 'home']) expect(tags(read(`test/a11y/${spec}.spec.ts`)), spec).toBe(ours)
    // The whole page is read: no rule turned off, no part left out or singled out, no list of known findings.
    for (const banned of ['disableRules', '.exclude(', '.include(', 'test.only', 'test.fixme', 'describe.skip', 'page.goto(']) expect(matrix, banned).not.toContain(banned)
    expect(matrix).not.toMatch(/(import|require|readFileSync|json\()[^\n]*known-violations/)
    expect(matrix.match(/test\.skip\(/g)).toHaveLength(2)
    expect(matrix.match(/test\.skip\(testInfo\.project\.name !== ON, /g)).toHaveLength(2)
    expect(matrix.match(/new AxeBuilder\(\{ page \}\)\.withTags\(AXE_TAGS\)\.analyze\(\)/g)).toHaveLength(2)
    // Every finding fails, whatever its impact: no filter on impact before the assertion.
    expect(matrix).not.toMatch(/impact === '(serious|critical)'/)
    // The fixture page is a route of the a11y build, with a scholastic fixture.
    expect(constant('FIXTURE')).toContain('route: \'/__fixtures/scholastic\'')
    expect(app).toContain('<Route path="/__fixtures/:name" element={<ScopeFixturePage />} />')
    expect(read('src/pages/fixtures/ScopeFixturePage.tsx')).toMatch(/scholastic: 'scholastic',/)
    expect(matrix).toContain('for (const scheme of [\'light\', \'dark\'] as const)')
  })

  it('holds 52 tests and 104 cells, as the AC1 row and the step 32 block say', () => {
    expect(PAGES).toHaveLength(10)
    expect(LOOKS).toHaveLength(5)
    const tests = PAGES.length * LOOKS.length + 2
    expect(tests).toBe(52)
    const ac1 = statusLines.find((l) => l.startsWith('| AC1 |')) ?? ''
    expect(ac1).toContain(`${tests} tests`)
    expect(ac1).toContain(`${PAGES.length * LOOKS.length * 2} cells`)
    expect(ac1).toContain(`each of the ${tests * 2} cells`)
    expect(status).toContain(`\`test/a11y/scopes.spec.ts\` (${tests} tests on each build;`)
  })
})

describe('test/a11y/known-violations.json after the sweep', () => {
  it('keeps exactly the nine findings today\'s site has with every switch off, adds none, and lists none for the build with the switches on', () => {
    const known = JSON.parse(read('test/a11y/known-violations.json')) as { violations: Array<Record<string, string>> }
    expect(known.violations.map((v) => [v.project, v.route, v.rule, v.selector, v.impact])).toEqual([
      ['a11y-off', '/', 'color-contrast', '.gap-2.text-sm.flex > .text-muted-foreground', 'serious'],
      ['a11y-off', '/', 'color-contrast', '.justify-between.py-3[href$="fx-t-quads"] > .min-w-0 > .text-\\[11px\\].text-muted-foreground', 'serious'],
      ['a11y-off', '/', 'color-contrast', 'a[href$="fx-club-north"] > .min-w-0 > .text-\\[11px\\].text-muted-foreground', 'serious'],
      ['a11y-off', '/', 'target-size', '.w-5', 'serious'],
      ['a11y-off', '/', 'target-size', 'button[aria-label="Slide 1"]', 'serious'],
      ['a11y-off', '/', 'target-size', 'button[aria-label="Slide 2"]', 'serious'],
      ['a11y-off', '/', 'target-size', 'button[aria-label="Slide 3"]', 'serious'],
      ['a11y-off', '/', 'target-size', 'button[aria-label="Slide 4"]', 'serious'],
      ['a11y-off', '/', 'target-size', 'button[aria-label="Slide 5"]', 'serious'],
    ])
  })
})

describe('the sweep\'s rules in src/index.css', () => {
  /** Each rule whose comment names step 32: the comment and the rule after it. */
  function stepRules(): Array<{ comment: string; selectors: string[]; body: string }> {
    const css = read('src/index.css')
    const out: Array<{ comment: string; selectors: string[]; body: string }> = []
    // One comment, then the rule right after it: the comment may hold no end of a comment.
    for (const m of css.matchAll(/\/\*((?:(?!\*\/)[\s\S])*)\*\/\s*([^{}/]+)\{([^{}]*)\}/g)) {
      if (!/step 32/.test(m[1])) continue
      out.push({ comment: m[1], selectors: m[2].split(',').map((s) => s.trim()), body: m[3].trim() })
    }
    return out
  }

  it('each waits for the new look: every selector of every rule step 32 wrote starts with :root[data-look="new"]', () => {
    const rules = stepRules()
    expect(rules.map((r) => r.selectors)).toEqual([[':root[data-look="new"] p > a.text-lca-gold'], [':root[data-look="new"] .bg-popover.overflow-y-auto > button:focus-visible']])
    for (const r of rules) for (const s of r.selectors) expect(s.startsWith(':root[data-look="new"] '), s).toBe(true)
    expect(rules.map((r) => r.body)).toEqual(['text-decoration-line: underline;', 'outline-offset: -2px;'])
    // Neither sits inside a media query or a layer that could carry it to the flag-off look by another road.
    for (const r of indexCssRules().filter((rule) => rule.selectors.some((s) => s.includes('a.text-lca-gold') || s.includes('.bg-popover.overflow-y-auto')))) {
      for (const s of r.selectors) expect(s.startsWith(':root[data-look="new"] '), s).toBe(true)
    }
  })
})

describe('the records against the tree', () => {
  /** A bullet and the lines under it that are indented further, from the first line that starts with `start` after `after`. */
  function bullet(start: string, after: string): string {
    const from = statusLines.findIndex((l) => l.startsWith(after))
    const at = statusLines.findIndex((l, i) => i >= from && l.startsWith(start))
    if (from < 0 || at < 0) return ''
    return statusLines[at]
  }
  const CHECKPOINT = '### Checkpoint D: steps 20 to 32'
  /**
   * The switches of src/lib/features.ts when checkpoint D was recorded, in the
   * file's order, every one of them off then. The record describes that
   * moment, so it is read against this list and not against the switches as
   * they stand later: K turning a switch on, or a later workstream adding one,
   * leaves the record of this merge true. Whether a switch is on is held by
   * test/unit/features.test.ts, not here.
   */
  const SWITCHES_AT_THE_MERGE = [
    'clubTournaments', 'tournamentQuickFilters', 'externalTags', 'newLook', 'themeHeritage', 'themeScholastic', 'newNav', 'siteSearch',
    'homeSearch', 'eventStrip', 'eventStripLive', 'liveMarker', 'newHome', 'homeResults', 'homeChampions', 'homeLive', 'homeWeek',
    'homeRecap', 'homeFeatured', 'newTournaments', 'newEventPage', 'festivals', 'householdCheckout', 'membershipRequirementSwitch',
  ]

  it('Checkpoint D lists the 24 switches src/lib/features.ts had when it was recorded, each still a switch there', () => {
    const line = bullet('  - Every switch in `src/lib/features.ts` is off', CHECKPOINT)
    const listed = [...line.slice(0, line.indexOf(', each `false`')).matchAll(/`([a-zA-Z]+)`/g)].map((m) => m[1])
    expect(listed).toEqual(SWITCHES_AT_THE_MERGE)
    expect(line).toContain(`is off, all ${SWITCHES_AT_THE_MERGE.length}:`)
    // A subset check, as in test/unit/features.test.ts: later work adds its own switches.
    expect(Object.keys(FEATURES)).toEqual(expect.arrayContaining(SWITCHES_AT_THE_MERGE))
  })

  it('For K names each switch WS01 added, and each is a switch of src/lib/features.ts', () => {
    const forK = bullet('- **For K, on a preview, switch by switch.**', CHECKPOINT)
    for (const name of ['newLook', 'themeHeritage', 'themeScholastic', 'membershipRequirementSwitch']) {
      expect(Object.keys(FEATURES), name).toContain(name)
      expect(forK, name).toMatch(new RegExp(`\`${name}\`(, with \`newLook\`)?:`))
    }
  })

  it('every test file a row of the acceptance table names is in the tree, and every row names one', () => {
    const rows = statusLines.filter((l) => /^\| (AC\d+|K\d[a-g]?|T\d) \|/.test(l))
    expect(rows).toHaveLength(34)
    for (const row of rows) {
      const id = row.split(' | ')[0].slice(2)
      const tests = [...row.matchAll(/`(test\/[^`\s*]+\.(?:ts|tsx|json))`/g)].map((m) => m[1])
      expect(tests.length, `${id} names a test file`).toBeGreaterThan(0)
      for (const file of tests) expect(existsSync(join(ROOT, file)), `${id}: ${file}`).toBe(true)
    }
  })

  /** The follow-ups, one entry to a line. */
  const followUps = status.slice(status.indexOf('### Follow-ups'), status.indexOf('\n## WS02')).split('\n').filter((l) => l.startsWith('- **'))
  const heading = (l: string) => l.slice(4, l.indexOf('**', 4))

  it.each([
    ['the JSON columns and the 0053 triggers', /JSON columns/, ['`tournaments.sections`', '`round_schedule`', '0053 triggers']],
    ['the section on each game', /tournament_games\.section_id/, ['(WS07)']],
    ['per-section caps, holds and the family limit', /Caps, holds and the family limit/, ['WS06', '`tournament_sections.cap`', '15 minutes']],
    ['the schedule picker', /^Schedules in WS06 and WS08/, ['WS06 adds the schedule picker']],
    ['the contracts still pending', /^Contracts as endpoints change/, ['`PENDING_COUNT`', 'WS02 to WS15']],
    ['the pages to thin', /^Pages to thin in WS05, WS06 and WS08/, ['WS05', 'WS06', 'WS08']],
    ['ScrollPanel on the long screens', /^ScrollPanel on the long screens/, ['WS06 and WS08', 'event setup form']],
    ['the email preview\'s logo', /^The email preview's logo/, ['`src/pages/AdminEmailPage.tsx`', 'WS08']],
    ['the AC9 live check', /^AC9 live check\.$/, ['first push', 'Record the result here']],
    ['the e2e specs once WS06 and WS07 exist', /test\.fixme/, ['WS06', 'WS07', '`.github/workflows/e2e-preview.yml`']],
  ] as const)('the close of WS01 lists %s once, with its owner', (_what, pattern, pieces) => {
    const entries = followUps.filter((l) => pattern.test(heading(l)))
    expect(entries.map(heading)).toHaveLength(1)
    for (const piece of pieces) expect(entries[0], piece).toContain(piece)
  })

  it('the caps entry gives the limits the server holds today, and nothing checks a section\'s cap yet', () => {
    const caps = followUps.find((l) => heading(l).startsWith('Caps, holds and the family limit')) ?? ''
    const entries = read('functions/api/registrations/batch.ts').match(/const MAX_ENTRIES = (\d+)/)?.[1]
    const children = read('functions/api/me/children.ts').match(/const MAX_CHILDREN = (\d+)/)?.[1]
    expect(caps).toContain(`one order holds up to ${entries} players`)
    expect(caps).toContain(`a family list up to ${children} profiles`)
    expect(read('functions/db/schema.ts')).toMatch(/\bcap: integer\(\),/)
    expect(caps).toContain('checked by nothing yet')
  })
})

describe('the files of these edges', () => {
  /** The names of the tools such a file must not mention, split up so this file does not mention them either. */
  const TOOLS = new RegExp(`\\b(${['cla' + 'ude', 'anthr' + 'opic', 'chat' + 'gpt', 'open' + 'ai', 'copi' + 'lot', 'l' + 'lm', 'co-authored' + '-by'].join('|')})\\b`, 'i')
  /** An en dash or an em dash, written by code so this file holds neither. */
  const DASHES = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`)

  it.each(['test/a11y/scopes-edges.spec.ts', 'test/unit/scopes-edges.test.ts', 'test/unit/sweep-fixes-edges.test.tsx'])('%s has no em dash, no en dash and no reference to a tool that wrote it', (file) => {
    const text = read(file)
    expect(text).not.toMatch(DASHES)
    expect(text).not.toMatch(TOOLS)
    expect(text).not.toMatch(/\bAI\b/)
    expect(text).not.toMatch(/\bUSCF\b/)
  })
})
