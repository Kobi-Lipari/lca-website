// test/unit/semantic-map.test.ts
//
// WS01 step 23: the reviewed map behind scripts/codemods/semantic-colours.ts
// and the TSX files it rewrote.
//
// - Every class the map writes gives, on the plain :root (newLook off),
//   exactly the colour of the class it replaced. Each pair is compiled by
//   Tailwind itself, over Tailwind's own theme (where white is defined) and
//   the two @theme blocks of src/index.css, and each var() is then replaced
//   from the legacy :root of src/index.css. Every form of every new class
//   the TSX files now use is checked, opacity modifiers included, plus the
//   plain form of every pair.
// - The brand navy stays #1a2744 in every look and in dark mode: only the
//   brand @theme block defines it, and bg-brand-navy reads it directly.
// - The tree matches the map: the codemod's check finds nothing left to
//   rewrite and every remaining text-lca-navy, bg-white and bg-lca-navy
//   covered by a keep entry with its reason, and a plain text search of the
//   TSX files finds no use the parser missed.
// - The codemod on a small fixture tree: what it rewrites (string literals,
//   cn() arguments, ternaries, consts, template text, variants, opacity
//   modifiers, the navy-on-gold rule, a site, commented-out code), what it
//   keeps, that a second run and --check find nothing to do, and the
//   problems that stop it before anything is written.
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { compile } from 'tailwindcss'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  DEFAULT_MAP,
  classStrings,
  loadMap,
  parseToken,
  planRewrite,
  takesOpacity,
  tokensOf,
  tsxFiles,
  withUtility,
  type ColourMap,
} from '../../scripts/codemods/semantic-colours'
import { indexCssRules, read, ROOT, rootTokens, stripComments, substitute } from './helpers/cssTokens'

const map = loadMap(DEFAULT_MAP)

// ── Compiling a class with Tailwind ────────────────────────────────────────

let build: (classes: string[]) => string
beforeAll(async () => {
  const css = stripComments(read('src/index.css'))
  const variant = css.match(/@custom-variant dark [^;]+;/)?.[0]
  const blocks = [...css.matchAll(/^@theme(?: inline)? \{[\s\S]*?^\}/gm)].map((m) => m[0])
  if (!variant || blocks.length !== 2) throw new Error('index.css should hold one dark variant and two @theme blocks')
  const theme = read('node_modules/tailwindcss/theme.css')
  const compiler = await compile(`${theme}\n${variant}\n${blocks.join('\n')}\n@tailwind utilities;`, {
    base: ROOT,
    loadStylesheet: async () => ({ content: '', base: ROOT, path: '' }),
  })
  build = (classes) => compiler.build(classes)
})

/** The legacy :root: every token the site reads while newLook is off. */
const legacy = rootTokens(indexCssRules(), { look: false, dark: false })

/** The text of a block opening at `open` (the index of its "{"), braces balanced. */
function blockAt(css: string, open: number): string {
  let depth = 0
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++
    else if (css[i] === '}' && --depth === 0) return css.slice(open + 1, i)
  }
  throw new Error('unbalanced braces')
}

const escapeClass = (name: string) => name.replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`)

/**
 * What a colour class paints with newLook off: the declaration every
 * supported browser uses (inside @supports when Tailwind writes one) and the
 * fallback before it, each with var() replaced from the legacy :root and the
 * theme variables Tailwind emitted.
 */
function paint(className: string): { property: string; supported: string; fallback: string } {
  const css = build([className])
  const vars = new Map(legacy)
  const root = css.indexOf(':root, :host {')
  if (root >= 0) {
    for (const m of blockAt(css, css.indexOf('{', root)).matchAll(/(--[\w-]+):\s*([^;]+);/g)) vars.set(m[1], m[2].trim())
  }
  const at = css.indexOf(`.${escapeClass(className)} {`)
  if (at < 0) throw new Error(`${className} did not compile`)
  const body = blockAt(css, css.indexOf('{', at))
  const supports = body.indexOf('@supports')
  const plain = (supports < 0 ? body : body.slice(0, supports)).match(/([\w-]+):\s*([^;]+);/)
  if (!plain) throw new Error(`${className} has no declaration`)
  const inner = supports < 0 ? null : blockAt(body, body.indexOf('{', supports)).match(/([\w-]+):\s*([^;]+);/)
  return {
    property: plain[1],
    fallback: substitute(plain[2].trim(), vars),
    supported: substitute((inner ? inner[2] : plain[2]).trim(), vars),
  }
}

// ── The pairs the map writes ───────────────────────────────────────────────

/** Every utility the map writes, with the utility it replaces. */
const PAIRS = new Map<string, string>()
for (const r of map.rules) PAIRS.set(r.to, r.from)
for (const s of map.sites) PAIRS.set(parseToken(s.to).utility, parseToken(s.from).utility)

/** Every form (opacity modifier) of each written utility the TSX files now use. */
function formsInTree(): Map<string, Set<string>> {
  const forms = new Map<string, Set<string>>([...PAIRS.keys()].map((u) => [u, new Set([''])]))
  for (const file of tsxFiles(ROOT)) {
    for (const s of classStrings(file, read(file))) {
      for (const { token } of tokensOf(s.text)) forms.get(token.utility)?.add(token.modifier)
    }
  }
  return forms
}

describe('every class the map writes gives exactly the colour it replaced, with newLook off', () => {
  it('each written utility replaces exactly one utility: the four the map writes', () => {
    expect(Object.fromEntries(PAIRS)).toEqual({
      'text-brand-navy': 'text-lca-navy',
      'text-ink': 'text-lca-navy',
      'bg-surface': 'bg-white',
      'bg-brand-navy': 'bg-lca-navy',
    })
  })

  const forms = formsInTree()
  const cases = [...forms].flatMap(([to, mods]) => [...mods].sort().map((m) => [PAIRS.get(to)!, to, m] as const))

  it('checks every form the TSX files use, opacity modifiers included', () => {
    expect(forms.get('bg-brand-navy')).toEqual(new Set(['', '5', '7', '8', '10', '55', '90', '[0.03]', '[0.04]', '[0.06]']))
    expect(forms.get('text-ink')).toEqual(new Set(['', '80']))
    expect(forms.get('bg-surface')).toEqual(new Set(['', '90']))
    expect(forms.get('text-brand-navy')).toEqual(new Set(['']))
    expect(cases).toHaveLength(15)
  })

  // Tailwind gives a colour class with an opacity modifier a fallback before
  // its @supports (color: color-mix(in lab, red, red)) branch, for browsers
  // that cannot mix colours: Safari 15.4 to 16.1, which reads the oklch()
  // colours of the plain :root, and older ones such as Chrome 109. A brand
  // colour, a literal in the @theme block, falls back to its worked-out sRGB
  // tint, exactly as the class it replaced did. A token utility can only fall
  // back to its token at full strength. So the navy tints keep the brand navy
  // (on a tint, full strength would put navy text on solid navy), and only
  // these two token forms are used, where full strength raises the contrast:
  // navy text at 100 rather than 80 per cent, and a solid white ground under
  // the scanner's dark remove icon rather than 90 per cent white.
  const FULL_STRENGTH_FALLBACK = new Map([
    ['text-ink/80', 'navy text, full strength rather than 80 per cent'],
    ['bg-surface/90', 'the white ground of the scanner remove button, solid rather than 90 per cent'],
  ])

  it('uses a token class with an opacity modifier only where its full-strength fallback raises the contrast', () => {
    const tokenForms = cases.filter(([, to, m]) => m !== '' && !/^(bg|text)-brand-/.test(to)).map(([, to, m]) => `${to}/${m}`)
    expect(tokenForms.sort()).toEqual([...FULL_STRENGTH_FALLBACK.keys()].sort())
  })

  it.each(cases)('%s and %s with modifier "%s" paint the same colour', (from, to, modifier) => {
    const was = paint(modifier ? `${from}/${modifier}` : from)
    const now = paint(modifier ? `${to}/${modifier}` : to)
    expect(now.property).toBe(was.property)
    // What every browser Tailwind 4 supports paints: the same colour, to the letter.
    expect(now.supported).toBe(was.supported)
    expect(now.supported).not.toContain('var(')
    if (!modifier) {
      expect(now.fallback).toBe(was.fallback)
      return
    }
    // The fallback before @supports, for browsers that cannot mix colours: a
    // brand colour keeps the sRGB tint the old class had, to the letter; the
    // two token forms above fall back to the token at full strength.
    if (to.startsWith('bg-brand-') || to.startsWith('text-brand-')) {
      expect(now.fallback).toBe(was.fallback)
    } else {
      expect(FULL_STRENGTH_FALLBACK.has(`${to}/${modifier}`), `${to}/${modifier}`).toBe(true)
      expect(was.fallback).toMatch(/^color-mix\(in srgb, #[0-9a-f]+ [\d.]+%, transparent\)$/)
      expect(now.fallback).toBe(substitute(`var(--${to.replace(/^(bg|text)-/, '')})`, legacy))
    }
  })

  it('the plain forms resolve to the values the brief names: navy #1a2744 and white #fff', () => {
    expect(paint('text-ink').supported).toBe('#1a2744')
    expect(paint('text-brand-navy').supported).toBe('#1a2744')
    expect(paint('bg-brand-navy').supported).toBe('#1a2744')
    expect(paint('bg-surface').supported).toBe('#fff')
    expect(paint('bg-white').supported).toBe('#fff')
  })
})

describe('the brand navy stays navy in every look', () => {
  const rules = indexCssRules()

  it('is defined once, in the brand @theme block, as the same navy as lca-navy', () => {
    const brand = rules.filter((r) => r.selector === '@theme')
    expect(brand).toHaveLength(1)
    expect(brand[0].decls.get('--color-brand-navy')).toBe('#1a2744')
    expect(brand[0].decls.get('--color-brand-navy')).toBe(brand[0].decls.get('--color-lca-navy'))
    const elsewhere = rules.filter((r) => r.selector !== '@theme' && [...r.decls.keys()].some((k) => k.startsWith('--color-brand')))
    expect(elsewhere).toEqual([])
  })

  it('bg-brand-navy and text-brand-navy read it directly, so no look, scope or dark block can change them', () => {
    expect(build(['bg-brand-navy'])).toMatch(/\.bg-brand-navy \{\s*background-color: var\(--color-brand-navy\);/)
    expect(build(['text-brand-navy'])).toMatch(/\.text-brand-navy \{\s*color: var\(--color-brand-navy\);/)
    // No rule anywhere, new look, dark, live, scholastic or heritage, sets it.
    for (const rule of rules) expect(rule.decls.has('--color-brand-navy') && rule.selector !== '@theme', rule.selector).toBe(false)
  })
})

describe('the TSX files match the map', () => {
  const plan = planRewrite(ROOT, map, 'check')

  it('the codemod finds nothing left to rewrite and no problem', () => {
    expect(plan.problems).toEqual([])
    expect(plan.edits).toEqual([])
  })

  it('no text-lca-navy or bg-lca-navy is left, and every bg-white left is a keep entry with its reason', () => {
    const left = plan.kept.map((k) => parseToken(k.token))
    expect(left.every((t) => t.utility === 'bg-white')).toBe(true)
    const opaque = plan.kept.filter((k) => parseToken(k.token).modifier === '')
    expect(opaque.map((k) => k.file).sort()).toEqual([
      'src/pages/AccountSecurityPage.tsx',
      'src/pages/AdminClubPage.tsx',
      'src/pages/ClubDetailPage.tsx',
      'src/pages/ClubsPage.tsx',
      'src/pages/WorkspacePage.tsx',
    ])
    for (const k of plan.kept) expect(k.reason.length, k.token).toBeGreaterThan(40)
    expect(plan.kept.filter((k) => parseToken(k.token).modifier !== '')).toHaveLength(34)
  })

  it('a plain text search of the TSX files finds exactly the uses the parser keeps, so none hides in prose or JSX text', () => {
    const byText = new Map<string, number>()
    for (const file of tsxFiles(ROOT)) {
      const n = (read(file).match(/(?<![\w-])(text-lca-navy|bg-white|bg-lca-navy)(?![\w-])/g) ?? []).length
      if (n > 0) byText.set(file, n)
    }
    const byParser = new Map<string, number>()
    for (const k of plan.kept) byParser.set(k.file, (byParser.get(k.file) ?? 0) + 1)
    expect(byText).toEqual(byParser)
  })
})

// ── The codemod on a fixture tree ──────────────────────────────────────────

describe('scripts/codemods/semantic-colours.ts', () => {
  const work = mkdtempSync(join(tmpdir(), 'semantic-colours-'))
  afterAll(() => rmSync(work, { recursive: true, force: true }))
  let n = 0

  const FIXTURE_MAP: ColourMap = {
    watch: ['text-lca-navy', 'bg-white', 'bg-lca-navy'],
    rules: [
      { id: 'navy-on-gold', from: 'text-lca-navy', opacity: 'none', when: { sameString: ['bg-lca-gold'] }, to: 'text-brand-navy', reason: 'navy on gold' },
      { id: 'ink', from: 'text-lca-navy', opacity: 'any', to: 'text-ink', reason: 'ink' },
      { id: 'surface', from: 'bg-white', opacity: 'none', to: 'bg-surface', reason: 'surface' },
      { id: 'navy-ground', from: 'bg-lca-navy', opacity: 'none', to: 'bg-brand-navy', reason: 'navy ground' },
      { id: 'navy-hover', from: 'bg-lca-navy', opacity: ['90'], to: 'bg-brand-navy', reason: 'navy hover' },
      { id: 'navy-tint', from: 'bg-lca-navy', opacity: 'translucent', to: 'bg-brand-navy', reason: 'navy tint' },
    ],
    sites: [{ file: 'src/pages/Fixture.tsx', contains: 'rounded-full', from: 'text-lca-navy', to: 'text-brand-navy', reason: 'the chip sits on gold' }],
    keep: [
      { class: 'bg-white', opacity: 'translucent', reason: 'a veil on navy' },
      { file: 'src/pages/Fixture.tsx', contains: 'logo-mat', class: 'bg-white', opacity: 'none', reason: 'a logo mat' },
    ],
  }

  const FIXTURE = [
    "import { cn } from '@/lib/utils'",
    '',
    "const goldButton = 'bg-lca-gold font-semibold text-lca-navy hover:bg-lca-gold/90'",
    '',
    'export function Fixture({ on }: { on: boolean }) {',
    '  return (',
    '    <section className="border-b bg-lca-navy text-white">',
    '      <h1 className="text-lca-navy hover:text-lca-navy [&_a]:text-lca-navy">Title</h1>',
    '      <p className="text-lca-navy/80">Muted</p>',
    "      <span className={cn('rounded-full bg-lca-gold/20 text-lca-navy', on && 'bg-lca-navy text-white')}>Chip</span>",
    "      <a className={on ? 'bg-lca-gold text-lca-navy' : 'border text-lca-navy'}>Link</a>",
    "      <div className={`p-4 bg-white ${on ? 'ring-1' : ''}`}>Card</div>",
    '      <div className="bg-white/10 hover:bg-white/20">Veil</div>',
    '      <div className="rounded bg-lca-navy/[0.04] hover:bg-lca-navy/90">Tint</div>',
    '      <img className="logo-mat bg-white" alt="" />',
    '      <button className={goldButton}>Go</button>',
    '      {/* <p className="font-medium text-lca-navy">Commented out</p> */}',
    '    </section>',
    '  )',
    '}',
    '// The old text-lca-navy class, named in prose with no quotes, stays as written.',
    '',
  ].join('\n')

  const EXPECTED = [
    "import { cn } from '@/lib/utils'",
    '',
    "const goldButton = 'bg-lca-gold font-semibold text-brand-navy hover:bg-lca-gold/90'",
    '',
    'export function Fixture({ on }: { on: boolean }) {',
    '  return (',
    '    <section className="border-b bg-brand-navy text-white">',
    '      <h1 className="text-ink hover:text-ink [&_a]:text-ink">Title</h1>',
    '      <p className="text-ink/80">Muted</p>',
    "      <span className={cn('rounded-full bg-lca-gold/20 text-brand-navy', on && 'bg-brand-navy text-white')}>Chip</span>",
    "      <a className={on ? 'bg-lca-gold text-brand-navy' : 'border text-ink'}>Link</a>",
    "      <div className={`p-4 bg-surface ${on ? 'ring-1' : ''}`}>Card</div>",
    '      <div className="bg-white/10 hover:bg-white/20">Veil</div>',
    '      <div className="rounded bg-brand-navy/[0.04] hover:bg-brand-navy/90">Tint</div>',
    '      <img className="logo-mat bg-white" alt="" />',
    '      <button className={goldButton}>Go</button>',
    '      {/* <p className="font-medium text-ink">Commented out</p> */}',
    '    </section>',
    '  )',
    '}',
    '// The old text-lca-navy class, named in prose with no quotes, stays as written.',
    '',
  ].join('\n')

  /** A fresh fixture root with these files and this map; returns its folder. */
  function tree(files: Record<string, string>, colourMap: unknown = FIXTURE_MAP): string {
    const root = join(work, `t${n++}`)
    for (const [path, text] of Object.entries({ ...files, 'map.json': JSON.stringify(colourMap, null, 2) })) {
      mkdirSync(dirname(join(root, path)), { recursive: true })
      writeFileSync(join(root, path), text)
    }
    return root
  }

  const run = (root: string, ...args: string[]) =>
    spawnSync(process.execPath, ['--no-warnings', '--experimental-strip-types', 'scripts/codemods/semantic-colours.ts', '--root', root, '--map', join(root, 'map.json'), ...args], {
      cwd: ROOT,
      encoding: 'utf8',
    })

  const fixtureFile = (root: string) => readFileSync(join(root, 'src/pages/Fixture.tsx'), 'utf8')

  it('rewrites class strings, keeps what the map keeps, and leaves prose alone', () => {
    const root = tree({ 'src/pages/Fixture.tsx': FIXTURE })
    const r = run(root)
    expect(r.status, r.stdout + r.stderr).toBe(0)
    expect(fixtureFile(root)).toBe(EXPECTED)
    expect(r.stdout).toContain('14 rewrites in 1 files, 3 kept, 1 files searched')
    expect(r.stdout).toContain('17 (in a comment): text-lca-navy -> text-ink (ink)')
    expect(r.stdout).toContain('10: text-lca-navy -> text-brand-navy (site)')
  })

  it('a second run and --check find nothing to do', () => {
    const root = tree({ 'src/pages/Fixture.tsx': FIXTURE })
    expect(run(root).status).toBe(0)
    const again = run(root)
    expect(again.status).toBe(0)
    expect(again.stdout).toContain('0 rewrites in 0 files, 3 kept')
    expect(fixtureFile(root)).toBe(EXPECTED)
    const check = run(root, '--check')
    expect(check.status, check.stdout).toBe(0)
    expect(check.stdout).toContain('Problems: 0')
  })

  it('--dry-run prints the plan and writes nothing; --check on an unconverted tree fails', () => {
    const root = tree({ 'src/pages/Fixture.tsx': FIXTURE })
    const dry = run(root, '--dry-run')
    expect(dry.status).toBe(0)
    expect(dry.stdout).toContain('Plan (dry run, nothing written): 14 rewrites')
    expect(fixtureFile(root)).toBe(FIXTURE)
    const check = run(root, '--check')
    expect(check.status).toBe(1)
    expect(check.stdout).toContain('left to rewrite: text-lca-navy -> text-ink (ink)')
    expect(fixtureFile(root)).toBe(FIXTURE)
  })

  it('stops, writing nothing, on a watched class with no rule or keep entry', () => {
    const noSurface = { ...FIXTURE_MAP, rules: FIXTURE_MAP.rules.filter((r) => r.id !== 'surface') }
    const root = tree({ 'src/pages/Fixture.tsx': FIXTURE }, noSurface)
    const r = run(root)
    expect(r.status).toBe(1)
    expect(r.stdout).toContain('src/pages/Fixture.tsx:12 bg-white has no rule or keep entry in the map')
    expect(r.stderr).toContain('Nothing was written.')
    expect(fixtureFile(root)).toBe(FIXTURE)
  })

  it('stops on a class that runs into a ${} substitution, or sits in a string with an escape', () => {
    const joined = tree({ 'src/pages/Fixture.tsx': FIXTURE.replace('`p-4 bg-white ${', '`p-4 bg-white${') })
    const r = run(joined)
    expect(r.status).toBe(1)
    expect(r.stdout).toContain('bg-white runs into a ${} substitution')
    const escaped = tree({ 'src/pages/Fixture.tsx': FIXTURE.replace("'border text-lca-navy'", "'border\\ttext-lca-navy'") })
    const e = run(escaped)
    expect(e.status).toBe(1)
    expect(e.stdout).toContain('is in a string with an escape in it')
  })

  it('stops when a site names more than one string, or a keep entry matches nothing', () => {
    const twice = tree({ 'src/pages/Fixture.tsx': FIXTURE.replace('className="rounded bg-lca-navy', 'className="rounded-full bg-lca-navy') })
    const r = run(twice)
    expect(r.status).toBe(1)
    expect(r.stdout).toContain('2 strings contain "rounded-full"; a site names exactly one')
    // The mat turned translucent, so the veil entry keeps it and the mat's own entry matches nothing.
    const stale = tree({ 'src/pages/Fixture.tsx': FIXTURE.replace('logo-mat bg-white', 'logo-mat bg-white/90') })
    const s = run(stale)
    expect(s.status).toBe(1)
    expect(s.stdout).toContain('the keep entry for bg-white matches nothing')
  })

  it('refuses a map entry without a reason, and a site whose contains holds the token it rewrites', () => {
    const noReason = tree({ 'src/pages/Fixture.tsx': FIXTURE }, { ...FIXTURE_MAP, rules: [{ ...FIXTURE_MAP.rules[0], reason: '' }] })
    const r = run(noReason)
    expect(r.status).toBe(1)
    expect(r.stderr).toContain('Stopped: the map cannot be used.')
    expect(r.stderr).toContain('rules[0] (navy-on-gold): a reason is needed')
    const badSite = tree({ 'src/pages/Fixture.tsx': FIXTURE }, { ...FIXTURE_MAP, sites: [{ ...FIXTURE_MAP.sites[0], contains: 'rounded-full bg-lca-gold/20 text-lca-navy' }] })
    expect(run(badSite).stderr).toContain('contains must not hold the token it rewrites')
  })
})

describe('class tokens', () => {
  // A class name no page uses, put together when the test runs: Tailwind reads
  // this file for class names as it reads the pages, and would otherwise build
  // CSS for each of these into the site.
  const c = (...parts: string[]) => parts.join('')

  it('splits a class into its variants, ! mark, utility and opacity modifier', () => {
    const hoverTint = c('md:hover:', 'bg-lca-navy', '/[0.03]')
    expect(parseToken(hoverTint)).toEqual({ text: hoverTint, variants: 'md:hover:', bang: '', utility: 'bg-lca-navy', modifier: '[0.03]' })
    expect(parseToken('[&_a]:text-lca-navy')).toMatchObject({ variants: '[&_a]:', utility: 'text-lca-navy', modifier: '' })
    expect(parseToken(c('!', 'bg-white'))).toMatchObject({ bang: 'start', utility: 'bg-white' })
    expect(parseToken(c('bg-white/10', '!'))).toMatchObject({ bang: 'end', utility: 'bg-white', modifier: '10' })
  })

  it('writes a token back with only its utility changed', () => {
    for (const [from, utility, to] of [
      ['hover:bg-lca-navy/90', 'bg-brand-navy', 'hover:bg-brand-navy/90'],
      ['[&_a]:text-lca-navy', 'text-ink', '[&_a]:text-ink'],
      [c('!', 'bg-white'), 'bg-surface', c('!', 'bg-surface')],
      [c('bg-white/10', '!'), 'bg-surface', c('bg-surface', '/10', '!')],
    ]) expect(withUtility(parseToken(from), utility)).toBe(to)
  })

  it('takes the opacity forms a rule names', () => {
    expect(takesOpacity('none', '')).toBe(true)
    expect(takesOpacity('none', '10')).toBe(false)
    expect(takesOpacity('translucent', '')).toBe(false)
    expect(takesOpacity('translucent', '[0.04]')).toBe(true)
    expect(takesOpacity('any', '80')).toBe(true)
    expect(takesOpacity(['90'], '90')).toBe(true)
    expect(takesOpacity(['90'], '10')).toBe(false)
  })
})
