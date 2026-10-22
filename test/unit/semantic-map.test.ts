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
//
// WS01 step 24: the second map, scripts/codemods/semantic-colours.status.map.json
// (the status colours, the greys, the navy borders and tints, raw hex), is
// held to the same proof:
// - every class it writes, in every form the TSX files use, paints on the
//   plain :root the colour of the class it replaced: to the letter, or for
//   text-bad, which is red-600 written as the shadcn destructive, the same
//   oklch() numbers; with an opacity modifier, the colour every browser that
//   can mix colours paints is the same to the letter, and a token class's
//   fallback for one that cannot is put back by the block in src/index.css
//   to the tint the old class fell back to;
// - each written form, variants included, builds the selector and at-rules
//   its old form built; tailwind-merge reads it as it read the old one; and
//   no element's winning colour changes through CSS order;
// - the tree matches the map: --check finds nothing left, the kept classes
//   are the map's keep entries, and a text search agrees with the parser.
// The two classes step 24 changed by hand, the club map's loading note on
// its paper, build the rules and paint the colours of the classes they
// replaced too.
//
// WS01 step 25: the gold work, the third map
// (scripts/codemods/semantic-colours.gold.map.json, the gold hex text
// classes) and scripts/codemods/gold-ink.ts (text-lca-gold on a light ground
// to text-gold-ink), is held to the same proof: every class it writes, in
// every form the TSX files use, paints on the plain :root the colour of the
// class it replaced, builds the selector and at-rules its old form built,
// reads the same to tailwind-merge and wins no rival through CSS order; the
// club colour words' fallback var(--gold-ink) is brand gold there too; and
// the map's --check finds nothing left. The old hex classes are put together
// when the test runs, so Tailwind, which reads this file, builds no CSS for them.
// The two changes made by hand are held the same way: GOLD_BUTTON's navy
// words, text-brand-navy for text-lca-navy, paint and merge as before on
// every button that uses it, and a club's colour as words, through
// clubTextColor, paints on the plain :root what club.color || LCA.gold
// painted for every value a club can hold.
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { compile } from 'tailwindcss'
import { twMerge } from 'tailwind-merge'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  DEFAULT_MAP,
  STATUS_MAP,
  classStrings,
  loadMap,
  parseToken,
  planRewrite,
  takesOpacity,
  tokensOf,
  tsxFiles,
  withUtility,
  type ClassToken,
  type ColourMap,
} from '../../scripts/codemods/semantic-colours'
import { GOLD, GOLD_INK, GOLD_MAP } from '../../scripts/codemods/gold-ink'
import { indexCssRules, read, ROOT, rootTokens, stripComments, substitute } from './helpers/cssTokens'
import { classAttributes, exclusive, goldButton, jsxTree, merged, selfAndAncestors, type ClassAttribute, type JsxNode, type Piece } from './helpers/jsxClasses'
import { clubTextColor } from '../../src/areas/clubs/clubColors'
import { LCA } from '../../src/lib/brand'
import { escapeClass as escapeSelector, leafRules } from './helpers/tailwindRules'

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
    // Step 24's map moved the seven faint tints (/5 to /10 and /[0.03] to
    // /[0.06]) on to the ink; the hero photo's veil (/55), the navy buttons'
    // hover (/90) and the Exit button's hover on the gold banner (/10) stay.
    expect(forms.get('bg-brand-navy')).toEqual(new Set(['', '10', '55', '90']))
    expect(forms.get('text-ink')).toEqual(new Set(['', '80']))
    expect(forms.get('bg-surface')).toEqual(new Set(['', '90']))
    expect(forms.get('text-brand-navy')).toEqual(new Set(['']))
    expect(cases).toHaveLength(9)
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

// ── The status map (step 24) ───────────────────────────────────────────────

const statusMap = loadMap(STATUS_MAP)

/** Every utility the status map writes, with the one it replaces. */
const STATUS_PAIRS = new Map<string, string>()
for (const r of statusMap.rules) STATUS_PAIRS.set(r.to, r.from)
for (const s of statusMap.sites) STATUS_PAIRS.set(parseToken(s.to).utility, parseToken(s.from).utility)

/** A class as it was written before step 24: a written utility swapped back, everything else kept. */
const beforeStatus = (cls: string) => {
  const t = parseToken(cls)
  const old = STATUS_PAIRS.get(t.utility)
  return old ? withUtility(t, old) : cls
}

/** A class without its variants and ! mark: the utility and its opacity modifier. */
const bareForm = (cls: string) => {
  const t = parseToken(cls)
  return withUtility({ ...t, variants: '', bang: '' }, t.utility)
}

/** Every class the TSX files write with a utility the status map writes, as written. */
function statusForms(): string[] {
  const forms = new Set<string>()
  for (const file of tsxFiles(ROOT)) {
    for (const s of classStrings(file, read(file))) {
      for (const { token } of tokensOf(s.text)) if (STATUS_PAIRS.has(token.utility)) forms.add(token.text)
    }
  }
  return [...forms].sort()
}

/** The numbers of an oklch() colour, with its lightness as a fraction, or null. */
function oklch(colour: string): number[] | null {
  const m = colour.match(/^oklch\(([\d.]+)(%?) ([\d.]+) ([\d.]+)\)$/)
  return m ? [Number(m[1]) / (m[2] ? 100 : 1), Number(m[3]), Number(m[4])] : null
}

/** The same colour: the same text, or the same oklch() numbers written another way. */
function sameColour(a: string, b: string): boolean {
  if (a === b) return true
  const x = oklch(a)
  const y = oklch(b)
  return !!x && !!y && x.every((v, i) => Math.abs(v - y[i]) < 1e-9)
}

/**
 * The tint a hex colour mixed with transparent gives, as #rrggbbaa, which is
 * what the build writes for a browser that cannot mix colours; null for any
 * other value.
 */
function mixedTint(value: string): string | null {
  const m = value.match(/^color-mix\(in (?:srgb|oklab), (#[0-9a-f]{6}) ([\d.]+)%, transparent\)$/i)
  return m ? `${m[1].toLowerCase()}${Math.round((Number(m[2]) / 100) * 255).toString(16).padStart(2, '0')}` : null
}

const NO_COLOR_MIX = '@supports not (color: color-mix(in lab, red, red))'

/**
 * The class rules of src/index.css for browsers that cannot mix colours, with
 * the at-rules around them. The block's one rule of another kind (step 26),
 * on :root, gives two status tints that are a mix on the plain :root their
 * fallback as tokens; it sets no class's colour, and tokens.test.ts checks it.
 */
const noMixRules = () => leafRules(stripComments(read('src/index.css'))).filter((r) => r.within.includes(NO_COLOR_MIX) && r.selector !== ':root')

/** The rules one class compiles to, with the at-rules around each and the class's own selector as written. */
function rulesOf(cls: string) {
  const own = `.${escapeSelector(cls)}`
  return leafRules(stripComments(build([cls]))).filter((r) => r.selector === own || r.selector.startsWith(`${own}:`) || r.selector.startsWith(`${own} `))
}

/** The same, with the class's own name written ".X" and every colour replaced from the legacy :root, to compare two classes by what they do. */
function behaviourOf(cls: string) {
  const css = build([cls])
  const vars = new Map(legacy)
  const root = css.indexOf(':root, :host {')
  if (root >= 0) {
    for (const m of blockAt(css, css.indexOf('{', root)).matchAll(/(--[\w-]+):\s*([^;]+);/g)) vars.set(m[1], m[2].trim())
  }
  const own = `.${escapeSelector(cls)}`
  return rulesOf(cls).map((r) => ({
    within: r.within,
    selector: r.selector.split(own).join('.X'),
    body: r.body.split('; ').map((d) => {
      const colon = d.indexOf(':')
      return `${d.slice(0, colon).trim()}: ${substitute(d.slice(colon + 1).trim(), vars)}`
    }).join('; '),
  }))
}

describe('the status map: every class it writes gives exactly the colour it replaced, with newLook off', () => {
  const forms = statusForms()
  const cases = [...new Set([...forms.map(bareForm), ...STATUS_PAIRS.keys()])].sort().map((now) => [beforeStatus(now), now] as const)

  it('each written utility replaces exactly one utility, and none is written by two rules', () => {
    const froms = new Map<string, Set<string>>()
    const add = (to: string, from: string) => froms.set(to, new Set([...(froms.get(to) ?? []), from]))
    for (const r of statusMap.rules) add(r.to, r.from)
    for (const s of statusMap.sites) add(parseToken(s.to).utility, parseToken(s.from).utility)
    for (const [to, set] of froms) expect([...set], to).toHaveLength(1)
    // Nothing the step 23 map writes is written again from another class.
    for (const to of STATUS_PAIRS.keys()) expect(PAIRS.has(to) && PAIRS.get(to) !== STATUS_PAIRS.get(to), to).toBe(false)
  })

  it('checks every form the TSX files use, variants and opacity modifiers included', () => {
    for (const form of ['text-ok', 'bg-ok-50', 'hover:bg-bad-50', 'border-brand-navy', 'border-brand-navy/30', 'hover:border-ink/40', 'focus:border-ink/50', 'bg-ink/[0.03]', 'bg-info-banner/15', 'accent-ink', 'ring-ink', 'fill-bad-500', 'text-facebook-link', 'bg-status-open-tint']) {
      expect(forms, form).toContain(form)
    }
    expect(cases.length).toBeGreaterThan(70)
  })

  it.each(cases)('%s and %s paint the same colour', (from, to) => {
    const was = paint(from)
    const now = paint(to)
    expect(now.property).toBe(was.property)
    // What every browser Tailwind 4 supports paints: the same colour. Only
    // text-bad, red-600 written as the shadcn destructive, differs in how it is written.
    expect(sameColour(now.supported, was.supported), `${now.supported} against ${was.supported}`).toBe(true)
    if (now.supported !== was.supported) expect([from, to]).toEqual(['text-red-600', 'text-bad'])
    expect(now.supported).not.toContain('var(')
    const { utility, modifier } = parseToken(to)
    if (!modifier || /^(bg|text|border)-brand-/.test(utility)) {
      expect(sameColour(now.fallback, was.fallback), `${now.fallback} against ${was.fallback}`).toBe(true)
      return
    }
    // A token class with a modifier falls back to its token at full strength;
    // the block in src/index.css gives it back the old class's tint (next test).
    expect(mixedTint(was.fallback), was.fallback).not.toBeNull()
    expect(now.fallback).toBe(substitute(`var(--${utility.replace(/^(bg|border|text)-/, '')})`, legacy))
  })

  it('every token class with a modifier gets its old tint back in a browser that cannot mix colours, in its own selector and media query', () => {
    const block = noMixRules()
    const tokenForms = forms.filter((f) => parseToken(f).modifier !== '' && !/-brand-/.test(parseToken(f).utility))
    expect(tokenForms).toEqual([
      'bg-info-banner/15', 'bg-ink/10', 'bg-ink/5', 'bg-ink/7', 'bg-ink/8', 'bg-ink/[0.03]', 'bg-ink/[0.04]', 'bg-ink/[0.06]',
      'border-ink/10', 'border-ink/15', 'border-ink/20', 'border-ink/40', 'focus:border-ink/50', 'hover:border-ink/30', 'hover:border-ink/40',
    ])
    for (const form of tokenForms) {
      const fallback = rulesOf(form).filter((r) => !r.within.some((w) => w.startsWith('@supports')))
      expect(fallback, form).toHaveLength(1)
      const back = block.filter((r) => r.selector === fallback[0].selector)
      expect(back, form).toHaveLength(1)
      expect(back[0].within.filter((w) => w !== NO_COLOR_MIX), form).toEqual(fallback[0].within)
      const property = fallback[0].body.split(':')[0]
      expect(back[0].body, form).toBe(`${property}: ${mixedTint(paint(bareForm(beforeStatus(form))).fallback)}`)
    }
    // And nothing else: the block holds one rule for each of these forms.
    expect(block).toHaveLength(tokenForms.length)
  })

  it('each written form, variants included, builds the selector and at-rules its old form built, and paints the same colour', () => {
    const differ: string[] = []
    const mixes = (r: { within: string[] }) => r.within.some((w) => w.startsWith('@supports'))
    for (const now of forms) {
      const was = beforeStatus(now)
      let a = behaviourOf(was)
      let b = behaviourOf(now)
      if (b.length === 0) differ.push(`${now} compiled to nothing`)
      const tokenModifier = parseToken(now).modifier !== '' && !/-brand-/.test(parseToken(now).utility)
      if (tokenModifier) {
        // A token class with a modifier writes a fallback (its token at full
        // strength, which the block above puts right) and the mix in
        // @supports. An arbitrary hex with a modifier (bg-[#1e4d7b]/15) wrote
        // the mix alone, so the mix is what to compare.
        const drop = <T extends { within: string[] }>(r: T): T => ({ ...r, within: r.within.filter((w) => !w.startsWith('@supports')) })
        b = b.filter(mixes).map(drop)
        a = (a.some(mixes) ? a.filter(mixes) : a).map(drop)
      }
      if (JSON.stringify(b.map((r) => [r.within, r.selector])) !== JSON.stringify(a.map((r) => [r.within, r.selector]))) differ.push(`${now}: ${JSON.stringify(b)} against ${JSON.stringify(a)}`)
      b.forEach((rule, i) => {
        const old = a[i]?.body ?? ''
        const [p, v] = [rule.body.split(': ')[0], rule.body.slice(rule.body.indexOf(': ') + 2)]
        if (!old.startsWith(`${p}: `) || !sameColour(v, old.slice(p.length + 2))) differ.push(`${now}: ${rule.body} against ${old}`)
      })
    }
    expect(differ).toEqual([])
  })
})

/** Rivals and look-alikes for the status map's classes: colours they meet in the files, and classes of other kinds that share a prefix. */
const STATUS_RIVALS = [
  'text-white', 'text-white/60', 'text-ink', 'text-muted-foreground', 'text-foreground', 'text-destructive', 'text-lca-gold',
  'text-xs', 'text-sm', 'text-[10px]', 'text-center',
  'bg-muted', 'bg-muted/40', 'bg-card', 'bg-background', 'bg-transparent', 'bg-lca-gold', 'bg-lca-gold/20', 'bg-brand-navy', 'bg-white/10', 'bg-cover',
  'border-border', 'border-transparent', 'border', 'border-2', 'border-b', 'border-dashed', 'border-lca-gold/40',
  'ring-2', 'ring-offset-2', 'ring-lca-gold', 'fill-none', 'accent-auto',
]

describe('the status map: tailwind-merge reads each written class exactly as it read the class it replaced', () => {
  it.each(statusForms())('%s, against every rival and look-alike, in either order', (now) => {
    const was = beforeStatus(now)
    for (const rival of STATUS_RIVALS) {
      const r = `${parseToken(now).variants}${rival}`
      for (const [first, second] of [[r, now], [now, r]] as const) {
        const result = twMerge(`${first} ${second}`).split(' ').map(beforeStatus).join(' ')
        const old = twMerge(`${first === now ? was : first} ${second === now ? was : second}`)
        expect(result, `${first} ${second}`).toBe(old)
      }
    }
  })
})

describe('the status map: no element changes its winning colour through CSS order', () => {
  interface Rival { where: string; a: string; b: string; pa: Piece; pb: Piece }

  /** Pairs in one className that set one colour property under the same variants, at least one written by the map, whose CSS order is not the order of the classes they replaced. */
  function flipped(attrs: ClassAttribute[], position: (u: string) => number, colourProperty: (u: string) => string | null): Rival[] {
    const out: Rival[] = []
    for (const attr of attrs) {
      const toks: Array<{ token: ClassToken; piece: Piece }> = attr.pieces.flatMap((piece) => tokensOf(piece.text).map(({ token }) => ({ token, piece })))
      for (let i = 0; i < toks.length; i++) {
        for (let j = i + 1; j < toks.length; j++) {
          const [x, y] = [toks[i], toks[j]]
          if (x.token.text === y.token.text) continue
          if (!STATUS_PAIRS.has(x.token.utility) && !STATUS_PAIRS.has(y.token.utility)) continue
          if (x.token.variants !== y.token.variants || x.token.bang !== y.token.bang) continue
          const [bx, by] = [bareForm(x.token.text), bareForm(y.token.text)]
          const prop = colourProperty(bx)
          if (!prop || prop !== colourProperty(by)) continue
          const now = Math.sign(position(bx) - position(by))
          const was = Math.sign(position(beforeStatus(bx)) - position(beforeStatus(by)))
          if (now !== was) out.push({ where: `${attr.file}:${attr.line}`, a: x.token.text, b: y.token.text, pa: x.piece, pb: y.piece })
        }
      }
    }
    return out
  }

  /** The flips in some className attributes, with every bare class built at once so their places in one stylesheet compare. */
  function flipsIn(attrs: ClassAttribute[]): Rival[] {
    const all = new Set<string>()
    for (const attr of attrs) for (const piece of attr.pieces) for (const { token } of tokensOf(piece.text)) {
      const bare = bareForm(token.text)
      all.add(bare)
      all.add(beforeStatus(bare))
    }
    const css = build([...all])
    const position = (u: string) => css.indexOf(`.${escapeSelector(u)} {`)
    // The colour property each bare class sets, read from the same stylesheet.
    const bodies = new Map<string, string>()
    for (const r of leafRules(stripComments(css))) if (!bodies.has(r.selector)) bodies.set(r.selector, r.body)
    const colourProperty = (u: string) =>
      bodies.get(`.${escapeSelector(u)}`)?.match(/^(color|background-color|border-color|outline-color|fill|stroke|accent-color|--tw-ring-color):/)?.[1] ?? null
    return flipped(attrs, position, colourProperty)
  }
  const unsettled = (f: Rival) => !exclusive(f.pa, f.pb) && !merged(f.pa, f.pb)

  it('the check finds a planted pair, and knows that cn() and exclusive branches settle one', () => {
    // text-emerald-800 sorted before text-muted-foreground; text-ok sorts after it.
    const planted = [
      "import { cn } from '@/lib/utils'",
      'export function Planted({ on }: { on: boolean }) {',
      '  return (',
      '    <div>',
      '      <p className="text-muted-foreground text-ok">plain</p>',
      "      <p className={cn('text-muted-foreground', on && 'text-ok')}>merged</p>",
      "      <p className={on ? 'text-muted-foreground' : 'text-ok'}>exclusive</p>",
      '    </div>',
      '  )',
      '}',
    ].join('\n')
    const flips = flipsIn(classAttributes('src/pages/Planted.tsx', planted))
    expect(flips.map((f) => f.where)).toEqual([5, 6, 7].map((n) => `src/pages/Planted.tsx:${n}`))
    expect(flips.filter(unsettled).map((f) => f.where)).toEqual(['src/pages/Planted.tsx:5'])
  })

  it('every rival pair whose order the move changed is settled by cn() or never applies together', () => {
    const flips = flipsIn(tsxFiles(ROOT).flatMap((file) => classAttributes(file)))
    expect(flips.filter(unsettled).map((f) => `${f.where} ${f.a} / ${f.b}`)).toEqual([])
    // Those that did change order sit in cn(), where tailwind-merge keeps the later one, as it did before.
    for (const f of flips.filter((x) => !exclusive(x.pa, x.pb))) {
      expect(twMerge(`${f.a} ${f.b}`).split(' ').map(beforeStatus).join(' ')).toBe(twMerge(`${beforeStatus(f.a)} ${beforeStatus(f.b)}`))
    }
  }, 60_000)
})

describe('the status map: the TSX files match it', () => {
  const plan = planRewrite(ROOT, statusMap, 'check')

  it('the codemod finds nothing left to rewrite and no problem', () => {
    expect(plan.problems).toEqual([])
    expect(plan.edits).toEqual([])
  })

  it('the classes it keeps are its keep entries: the light tones on navy, StatusBadge\'s tones and dot (kept in step 26), the check-in toggle\'s hover line, the print page\'s row rules and the external-event dots', () => {
    const byFile = new Map<string, string[]>()
    for (const k of plan.kept) byFile.set(k.file, [...(byFile.get(k.file) ?? []), k.token])
    expect(Object.fromEntries([...byFile].map(([f, t]) => [f, t.sort()]))).toEqual({
      'src/components/ImpersonationBanner.tsx': ['hover:bg-brand-navy/10'],
      'src/components/StatusBadge.tsx': [
        'bg-blue-50', 'bg-blue-500/20', 'bg-emerald-100', 'bg-emerald-500', 'bg-emerald-500/20', 'bg-red-100', 'bg-red-500/20',
        'border-blue-200', 'text-blue-200', 'text-blue-800', 'text-emerald-300', 'text-emerald-800', 'text-red-300', 'text-red-700',
      ],
      'src/pages/TournamentDetailPage.tsx': ['bg-blue-500/20', 'bg-emerald-500/20', 'bg-emerald-500/20', 'text-blue-200', 'text-emerald-300', 'text-emerald-300'],
      'src/pages/TournamentManagePage.tsx': [
        'bg-emerald-500/20', 'bg-green-500/20', 'bg-red-500/20', 'hover:border-emerald-600/50',
        'text-emerald-300', 'text-green-300', 'text-red-300',
      ],
      // The rating and score on the pairing sheet take text-quiet-600: a printed page takes the light look.
      'src/pages/TournamentPrintPage.tsx': ['border-gray-300', 'border-gray-300'],
      'src/pages/TournamentsPage.tsx': ['bg-slate-400', 'bg-slate-400', 'bg-slate-500'],
    })
    for (const k of plan.kept) expect(k.reason.length, k.token).toBeGreaterThan(40)
    // Since step 26 every StatusBadge entry names its one string, so the
    // ratchet checks the file like any other, and none waits for a later step.
    const badge = statusMap.keep.filter((k) => k.file === 'src/components/StatusBadge.tsx')
    expect(badge).toHaveLength(14)
    for (const k of badge) {
      expect(k.contains, k.class).toBeDefined()
      expect(k.reason, k.class).not.toMatch(/step 2[6-9]|step 3\d/)
    }
  })

  it('keeps nothing in every file: each keep entry names its file, and each light tone on navy and its tint the one string it sits in', () => {
    // A keep entry with no file would let the class through in any page, a
    // light red word on a white card included, in this check. (The ratchet,
    // raw-colours.test.ts, credits a keep entry only where it names its one
    // string, and counts the rest in its allowlist.)
    for (const k of statusMap.keep) expect(k.file, `${k.class} ${k.reason}`).toBeDefined()
    // The light words and their 20 per cent tints on the navy heroes and StatusBadge's navy surface (StatusDot's opaque dot is StatusBadge's own).
    const lightWords = /^(text-(emerald|red|green)-300|text-blue-200)$/
    const tintUnder = /^bg-(emerald|red|blue|green)-500$/
    const onNavy = statusMap.keep.filter((k) => lightWords.test(k.class) || (tintUnder.test(k.class) && k.opacity !== 'none'))
    expect(onNavy.map((k) => k.file).sort()).toEqual([
      ...Array(6).fill('src/components/StatusBadge.tsx'),
      ...Array(6).fill('src/pages/TournamentDetailPage.tsx'),
      ...Array(6).fill('src/pages/TournamentManagePage.tsx'),
    ])
    for (const k of onNavy) {
      expect(k.contains, `${k.file} ${k.class}`).toBeDefined()
      expect(k.opacity, `${k.file} ${k.class}`).toEqual(k.class.startsWith('bg-') ? ['20'] : 'none')
    }
    // Each names one string of its file that holds the class (the codemod's check above would report any other count).
    const named = new Set(onNavy.map((k) => `${k.file} ${k.contains}`))
    expect(named.size).toBe(9)
  })

  it('a plain text search of the TSX files finds exactly the uses of its watched classes the parser keeps', () => {
    const watched = new RegExp(`(?<![\\w-])(${statusMap.watch.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?=$|[\\s'"\`/!])`, 'g')
    const byText = new Map<string, number>()
    for (const file of tsxFiles(ROOT)) {
      const n = (read(file).match(watched) ?? []).length
      if (n > 0) byText.set(file, n)
    }
    const byParser = new Map<string, number>()
    for (const k of plan.kept) if (statusMap.watch.includes(parseToken(k.token).utility)) byParser.set(k.file, (byParser.get(k.file) ?? 0) + 1)
    expect(byText).toEqual(byParser)
  })
})

describe('the status map: the block for browsers that cannot mix colours changes nothing else on an element', () => {
  // The block in src/index.css sits outside Tailwind's cascade layers, so in
  // a browser that reads it each of its rules wins over every Tailwind
  // utility on the same element, whatever its specificity or variant. It
  // puts back exactly the tint the old class fell back to only while nothing
  // else on the element sets the same colour and should win: a class with a
  // state or breakpoint the block's class lacks (hover:, focus-visible:,
  // md:, aria-invalid:), or one with the same variants that the CSS order
  // let win before (unless cn() keeps just one of the two). A component that
  // brings classes of its own, such as a shadcn Button or Input, could hide
  // such a rival, so the block's classes sit only on plain elements and on
  // Link, which adds none.

  /** A class as a selector of the block writes it, read back: ".hover\:border-ink\/30:hover" is hover:border-ink/30. */
  function classOfSelector(selector: string): string {
    let out = ''
    for (let i = 1; i < selector.length; i++) {
      if (selector[i] === '\\') out += selector[++i]
      else if (selector[i] === ':') break
      else out += selector[i]
    }
    return out
  }

  const block = noMixRules().map((r) => ({ cls: classOfSelector(r.selector), property: r.body.split(':')[0], selector: r.selector }))

  it('reads each rule of the block as a class and the colour property it sets', () => {
    const classes = block.map((b) => b.cls)
    expect(classes).toContain('bg-ink/[0.03]')
    expect(classes).toContain('hover:border-ink/40')
    expect(classes).toContain('focus:border-ink/50')
    expect(new Set(block.map((b) => b.property))).toEqual(new Set(['background-color', 'border-color']))
    // Outside every layer: no @layer around any of them.
    for (const rule of noMixRules()) expect(rule.within.filter((w) => w.startsWith('@layer')), rule.selector).toEqual([])
  })

  /** Each element that holds a class of the block, with the classes its className can hold beside it. */
  function holders(nodes: JsxNode[]) {
    const byClass = new Map(block.map((b) => [b.cls, b]))
    const out: Array<{ node: JsxNode; own: { token: ClassToken; piece: Piece }; rivals: Array<{ token: ClassToken; piece: Piece }> }> = []
    for (const node of nodes) {
      const toks = node.pieces.flatMap((piece) => tokensOf(piece.text).map(({ token }) => ({ token, piece })))
      for (const own of toks) {
        if (!byClass.has(own.token.text)) continue
        out.push({ node, own, rivals: toks.filter((t) => t.token.text !== own.token.text && !exclusive(t.piece, own.piece)) })
      }
    }
    return out
  }

  /** The problems: rivals the block's rule would now beat, and components that could hide one. */
  function overridden(nodes: JsxNode[]): string[] {
    const found = holders(nodes)
    // Every class beside a block class, built once, to read the colour property each sets.
    const bare = [...new Set(found.flatMap((h) => h.rivals.map((r) => bareForm(r.token.text))))]
    const css = build(bare)
    const bodies = new Map<string, string>()
    for (const r of leafRules(stripComments(css))) if (!r.within.some((w) => w.startsWith('@supports')) && !bodies.has(r.selector)) bodies.set(r.selector, r.body)
    const propertyOf = (cls: string) => bodies.get(`.${escapeSelector(bareForm(cls))}`)?.match(/^(background-color|border-color):/)?.[1] ?? null
    const byClass = new Map(block.map((b) => [b.cls, b]))
    const problems: string[] = []
    for (const { node, own, rivals } of found) {
      const where = `${node.file}:${node.line} <${node.tag}> ${own.token.text}`
      if (/^[A-Z]/.test(node.tag) && node.tag !== 'Link') problems.push(`${where}: on a component, whose own classes could set the same colour`)
      const mine = byClass.get(own.token.text)!
      for (const r of rivals) {
        if (propertyOf(r.token.text) !== mine.property) continue
        const theirs = byClass.get(r.token.text)
        // A rival in the block too wins by its own selector where it has a state the class lacks.
        if (theirs && r.token.variants !== '' && own.token.variants === '') continue
        // A rival with no variant, beside a block class with one (hover:), loses in that state, as it should.
        if (r.token.variants === '' && own.token.variants !== '') continue
        // Same variants inside one cn(): tailwind-merge keeps only the later.
        if (r.token.variants === own.token.variants && merged(r.piece, own.piece)) continue
        problems.push(`${where} would beat ${r.token.text}`)
      }
    }
    return problems
  }

  it('finds a planted rival, a planted component, and lets a hover form and cn() through', () => {
    const planted = [
      "import { cn } from '@/lib/utils'",
      "import { Button } from '@/components/ui/button'",
      'export function Planted({ on }: { on: boolean }) {',
      '  return (',
      '    <div>',
      '      <p className="border border-ink/20 focus-visible:border-ring">a</p>',
      '      <p className="bg-ink/5 bg-muted">b</p>',
      '      <Button className="bg-ink/5">c</Button>',
      '      <p className="border border-border hover:border-ink/40">d</p>',
      "      <p className={cn('bg-ink/5', on && 'bg-muted')}>e</p>",
      "      <p className={on ? 'bg-ink/5' : 'bg-muted'}>f</p>",
      '    </div>',
      '  )',
      '}',
    ].join('\n')
    const nodes = jsxTree('src/pages/Planted.tsx', planted)
    expect(overridden(nodes)).toEqual([
      'src/pages/Planted.tsx:6 <p> border-ink/20 would beat focus-visible:border-ring',
      'src/pages/Planted.tsx:7 <p> bg-ink/5 would beat bg-muted',
      'src/pages/Planted.tsx:8 <Button> bg-ink/5: on a component, whose own classes could set the same colour',
    ])
  })

  it('on the site, no element holds a class of the block beside a colour it would wrongly beat, or on a component', () => {
    const nodes = tsxFiles(ROOT).flatMap((file) => jsxTree(file))
    expect(holders(nodes).length).toBeGreaterThan(40)
    expect(overridden(nodes)).toEqual([])
  }, 60_000)
})

// ── Changed by hand (step 24) ──────────────────────────────────────────────

describe('the club map\'s loading note, changed by hand, paints what it painted with newLook off', () => {
  // The club map's paper (bg-[#f2efe6]) stays light in every look, so the
  // words on it and the veil laid over it while the map loads take tokens
  // that stay as the light look draws them (tokens.test.ts holds their
  // values, contrast.test.ts their contrast on the paper). No map writes
  // them: the words in LCAMap.tsx sit in a string ("text-sm" and the colour)
  // that no site could name alone.
  const HAND = [
    ['text-muted-foreground', 'text-muted-on-light'],
    ['bg-muted/30', 'bg-veil-on-light/30'],
  ] as const

  it.each(HAND)('%s and %s build the same rules, and paint the same colour in every browser, fallback included', (was, now) => {
    expect(behaviourOf(now)).toEqual(behaviourOf(was))
    expect(behaviourOf(now).length).toBeGreaterThan(0)
    expect(paint(now)).toEqual(paint(was))
    expect(paint(now).supported).not.toContain('var(')
  })

  it('tailwind-merge reads each as it read the class it replaced', () => {
    for (const [was, now] of HAND) {
      for (const rival of STATUS_RIVALS) {
        const back = (cls: string) => (cls === now ? was : cls)
        for (const [first, second] of [[rival, now], [now, rival]] as const) {
          expect(twMerge(`${first} ${second}`).split(' ').map(back).join(' '), `${first} ${second}`).toBe(twMerge(`${back(first)} ${back(second)}`))
        }
      }
    }
  })

  it('only the two loading notes on the club map\'s paper use them, each with no other colour beside it', () => {
    const users = tsxFiles(ROOT).flatMap((file) => jsxTree(file)).filter((n) => n.classes.some((c) => HAND.some(([, now]) => c === now)))
    expect(users.map((n) => `${n.file} ${n.classes.join(' ')}`)).toEqual([
      'src/areas/clubs/components/ClubLocationPicker.tsx absolute inset-0 flex items-center justify-center text-sm text-muted-on-light',
      'src/areas/clubs/components/LCAMap.tsx absolute inset-0 flex items-center justify-center bg-veil-on-light/30',
      'src/areas/clubs/components/LCAMap.tsx text-sm text-muted-on-light',
    ])
    for (const n of users) expect(selfAndAncestors(n).some((a) => a.classes.includes('bg-[#f2efe6]')), `${n.file}:${n.line}`).toBe(true)
  })
})

// ── The gold work (step 25) ────────────────────────────────────────────────

const goldMap = loadMap(GOLD_MAP)
/** A gold hex text class, put together when the test runs. */
const goldHex = (hex: string) => ['text-[#', hex, ']'].join('')

/** Every utility the gold work writes, with the one it replaces: the gold map's rules, and text-lca-gold to text-gold-ink on a light ground. */
const GOLD_PAIRS = new Map<string, string>([[GOLD_INK, GOLD], ...goldMap.rules.map((r) => [r.to, r.from] as [string, string])])

/** A class as it was written before step 25: a written utility swapped back, everything else kept. */
const beforeGold = (cls: string) => {
  const t = parseToken(cls)
  const old = GOLD_PAIRS.get(t.utility)
  return old ? withUtility(t, old) : cls
}

/** Every class the TSX files write with a utility the gold work writes, as written. */
function goldForms(): string[] {
  const forms = new Set<string>()
  for (const file of tsxFiles(ROOT)) {
    for (const s of classStrings(file, read(file))) {
      for (const { token } of tokensOf(s.text)) if (GOLD_PAIRS.has(token.utility)) forms.add(token.text)
    }
  }
  return [...forms].sort()
}

describe('the gold work: every class it writes gives exactly the colour it replaced, with newLook off', () => {
  const forms = goldForms()
  const cases = [...new Set([...forms.map(bareForm), ...GOLD_PAIRS.keys()])].sort().map((now) => [beforeGold(now), now] as const)

  it('the gold map moves the three gold hex text classes, one rule each, with no site or keep entry, and gold-ink.ts moves text-lca-gold', () => {
    expect(Object.fromEntries(GOLD_PAIRS)).toEqual({
      'text-gold-ink': 'text-lca-gold',
      'text-gold-ink-badge': goldHex('7a5c00'),
      'text-gold-on-dark-badge': goldHex('f0d07a'),
      'text-gold-ink-badge-club': goldHex('8a6d1f'),
    })
    expect([...goldMap.watch].sort()).toEqual(goldMap.rules.map((r) => r.from).sort())
    expect(goldMap.sites).toEqual([])
    expect(goldMap.keep).toEqual([])
    // Each rule takes the plain class only, and a variant rides along (the add-seat pill's hover).
    for (const r of goldMap.rules) expect(r.opacity, r.id).toBe('none')
    // Nothing the earlier maps write is written again.
    for (const to of GOLD_PAIRS.keys()) expect(PAIRS.has(to) || STATUS_PAIRS.has(to), to).toBe(false)
  })

  it('checks every form the TSX files use: the four written utilities, the hover form included, and no opacity modifier', () => {
    expect(forms).toEqual(['hover:text-gold-ink-badge', 'text-gold-ink', 'text-gold-ink-badge', 'text-gold-ink-badge-club', 'text-gold-on-dark-badge'])
    // No form has an opacity modifier, so the block for browsers that cannot mix colours needs no line for them.
    for (const f of forms) expect(parseToken(f).modifier, f).toBe('')
    expect(cases).toHaveLength(4)
  })

  it.each(cases)('%s and %s paint the same colour, in every browser', (from, to) => {
    const was = paint(from)
    const now = paint(to)
    expect(now).toEqual(was)
    expect(now.property).toBe('color')
    expect(now.supported).not.toContain('var(')
    expect(now.supported).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('each written form, variants included, builds the selector and at-rules its old form built, and paints the same colour', () => {
    for (const now of forms) {
      const b = behaviourOf(now)
      expect(b.length, now).toBeGreaterThan(0)
      expect(b, now).toEqual(behaviourOf(beforeGold(now)))
    }
  })

  it('a club colour\'s words, brand gold until the club picks its own, take var(--gold-ink), which is brand gold on the plain :root', () => {
    expect(substitute('var(--gold-ink)', legacy)).toBe('#c8a94a')
    expect(read('src/lib/brand.ts')).toContain("gold: '#c8a94a'")
    expect(read('src/areas/clubs/clubColors.ts')).toContain("? 'var(--gold-ink)' : color")
  })
})

/** Rivals and look-alikes for the gold work's classes: the colours they meet in the files, and classes of other kinds that share a prefix. */
const GOLD_RIVALS = [
  'text-white', 'text-white/60', 'text-ink', 'text-ink/80', 'text-muted-foreground', 'text-foreground', 'text-lca-gold', 'text-ok-700', 'text-brand-navy',
  'text-xs', 'text-sm', 'text-[10px]', 'text-[11px]', 'text-center', 'text-left',
  'bg-lca-gold/20', 'bg-lca-gold/15', 'border-lca-gold/40', 'font-medium', 'fill-none',
]

describe('the gold work: tailwind-merge reads each written class exactly as it read the class it replaced', () => {
  it.each(goldForms())('%s, against every rival and look-alike, in either order', (now) => {
    const was = beforeGold(now)
    for (const rival of GOLD_RIVALS) {
      const r = `${parseToken(now).variants}${rival}`
      for (const [first, second] of [[r, now], [now, r]] as const) {
        const result = twMerge(`${first} ${second}`).split(' ').map((c) => (c === now ? was : c)).join(' ')
        const old = twMerge(`${first === now ? was : first} ${second === now ? was : second}`)
        expect(result, `${first} ${second}`).toBe(old)
      }
    }
  })
})

describe('the gold work: no element changes its winning colour through CSS order', () => {
  it('every pair of colours on one element under the same variants, one of them written by the gold work, keeps its order, or is settled by cn() or never applies together', () => {
    const attrs = tsxFiles(ROOT).flatMap((file) => classAttributes(file))
    const all = new Set<string>()
    for (const attr of attrs) for (const piece of attr.pieces) for (const { token } of tokensOf(piece.text)) {
      all.add(bareForm(token.text))
      all.add(beforeGold(bareForm(token.text)))
    }
    const css = build([...all])
    const position = (u: string) => css.indexOf(`.${escapeSelector(u)} {`)
    const bodies = new Map<string, string>()
    for (const r of leafRules(stripComments(css))) if (!bodies.has(r.selector)) bodies.set(r.selector, r.body)
    const colourProperty = (u: string) => bodies.get(`.${escapeSelector(u)}`)?.match(/^(color|background-color|border-color|fill|stroke):/)?.[1] ?? null
    const checked: string[] = []
    const unsettled: string[] = []
    for (const attr of attrs) {
      const toks = attr.pieces.flatMap((piece) => tokensOf(piece.text).map(({ token }) => ({ token, piece })))
      for (let i = 0; i < toks.length; i++) {
        for (let j = i + 1; j < toks.length; j++) {
          const [x, y] = [toks[i], toks[j]]
          if (x.token.text === y.token.text) continue
          if (!GOLD_PAIRS.has(x.token.utility) && !GOLD_PAIRS.has(y.token.utility)) continue
          if (x.token.variants !== y.token.variants || x.token.bang !== y.token.bang) continue
          const [bx, by] = [bareForm(x.token.text), bareForm(y.token.text)]
          const prop = colourProperty(bx)
          if (!prop || prop !== colourProperty(by)) continue
          checked.push(`${attr.file}:${attr.line} ${x.token.text} / ${y.token.text}`)
          const now = Math.sign(position(bx) - position(by))
          const was = Math.sign(position(beforeGold(bx)) - position(beforeGold(by)))
          if (now !== was && !exclusive(x.piece, y.piece) && !merged(x.piece, y.piece)) unsettled.push(`${attr.file}:${attr.line} ${x.token.text} / ${y.token.text}`)
        }
      }
    }
    // The pairs there are: the results count's dark gold or green, in the two branches of one ternary.
    expect(checked.length).toBeGreaterThan(0)
    expect(unsettled).toEqual([])
  }, 60_000)
})

describe('the gold map: the TSX files match it', () => {
  const plan = planRewrite(ROOT, goldMap, 'check')

  it('the codemod finds nothing left to rewrite, keeps nothing and has no problem', () => {
    expect(plan.problems).toEqual([])
    expect(plan.edits).toEqual([])
    expect(plan.kept).toEqual([])
  })

  it('a plain text search of the TSX files finds none of its watched classes, so none hides in prose or JSX text', () => {
    const left = tsxFiles(ROOT).filter((file) => goldMap.watch.some((w) => read(file).toLowerCase().includes(w.toLowerCase())))
    expect(left).toEqual([])
  })
})

// ── GOLD_BUTTON and a club's colour as words, changed by hand (step 25) ────

describe('GOLD_BUTTON paints what it painted before step 25, with newLook off', () => {
  // Step 25 moved GOLD_BUTTON's words (src/lib/brand.ts) from text-lca-navy
  // to text-brand-navy, the same #1a2744, which stays navy in every look as
  // navy words on a gold fill must. Not a TSX file, so no map moved it. Each
  // class of the string paints on the plain :root what the class it replaced
  // painted and builds the same rules, and tailwind-merge gives every button
  // that uses it the same classes over each Button variant, with the classes
  // its own className adds. The old class name is put together when the test
  // runs, so Tailwind, which reads this file, builds no CSS for it.
  const NAVY_WORDS = ['text-lca', '-navy'].join('')
  const now = goldButton()
  const swapBack = (classes: string) => classes.split(' ').map((c) => (c === 'text-brand-navy' ? NAVY_WORDS : c)).join(' ')
  const before = swapBack(now)
  const button = read('src/components/ui/button.tsx')
  const base = button.match(/const buttonVariants = cva\(\s*"([^"]+)"/)![1]
  const variantBlock = button.slice(button.indexOf('variant: {'), button.indexOf('size: {'))
  const variants = [...variantBlock.matchAll(/^\s+(default|outline|secondary|ghost|destructive|link):\s*"([^"]+)"/gm)].map((m) => [m[1], m[2]] as const)

  it('differs from the string step 24 left only in its navy words', () => {
    expect(now.split(' ')).toContain('text-brand-navy')
    expect(now.split(' ')).not.toContain(NAVY_WORDS)
    const diff = before.split(' ').filter((c, i) => c !== now.split(' ')[i])
    expect(diff).toEqual([NAVY_WORDS])
  })

  it('each of its colour classes paints on the plain :root the colour of the class it replaced, and builds the same rules', () => {
    const pairs = now.split(' ').map((c, i) => [before.split(' ')[i], c] as const)
    for (const [was, is] of pairs) {
      if (!/^(?:[\w-]+:)*(?:bg|text)-(?:lca|brand)-/.test(is)) continue
      expect(behaviourOf(is), is).toEqual(behaviourOf(was))
    }
    expect(paint('text-brand-navy')).toEqual(paint(NAVY_WORDS))
    expect(paint('text-brand-navy').supported).toBe('#1a2744')
  })

  it('tailwind-merge gives every button that uses it the same classes as before, over each Button variant', () => {
    expect(variants.map(([name]) => name)).toEqual(['default', 'outline', 'secondary', 'ghost', 'destructive', 'link'])
    const users = tsxFiles(ROOT).flatMap((file) => classAttributes(file)).filter((a) => a.pieces.some((p) => p.text === now))
    expect(users.length).toBeGreaterThan(10)
    for (const attr of users) {
      const own = attr.pieces.map((p) => p.text).join(' ')
      for (const [name, variant] of variants) {
        const merged = twMerge(`${base} ${variant} ${own}`)
        const old = twMerge(`${base} ${variant} ${swapBack(own)}`)
        expect(swapBack(merged), `${attr.file}:${attr.line} over ${name}`).toBe(old)
        // The navy words win over the variant's own words, as before.
        expect(merged.split(' '), `${attr.file}:${attr.line} over ${name}`).toContain('text-brand-navy')
      }
    }
  })
})

describe('a club\'s colour as words paints what it painted before step 25, with newLook off', () => {
  // The club pages drew a club's words (an officer's title, a news date, the
  // contact link, the initials on /clubs, the name in the admin's preview)
  // in club.color || LCA.gold. Since step 25 they take clubTextColor, which
  // gives var(--gold-ink) for brand gold or no colour. On the plain :root
  // that is brand gold, so for every value a club can hold the words paint
  // what they painted; under the new look brand gold becomes the dark gold
  // on the light looks, and a colour the club chose stays its own.
  const old = (color: string | null | undefined) => color || LCA.gold
  const values: Array<string | null | undefined> = [null, undefined, '', LCA.gold, LCA.gold.toUpperCase(), '#1e4d7b', '#9b1c1c', '#ffffff', 'rgb(30, 77, 123)']

  it.each(values.map((v) => [String(v), v] as const))('%s paints the colour it painted', (_, value) => {
    expect(substitute(clubTextColor(value), legacy).toLowerCase()).toBe(old(value).toLowerCase())
  })

  it('under the new look brand gold or no colour becomes the gold-ink of the look, and a chosen colour is drawn as given', () => {
    const rules = indexCssRules()
    const light = rootTokens(rules, { look: true, dark: false })
    const dark = rootTokens(rules, { look: true, dark: true })
    for (const value of [null, '', LCA.gold, LCA.gold.toUpperCase()]) {
      expect(substitute(clubTextColor(value), light), String(value)).toBe('#866a1e')
      expect(substitute(clubTextColor(value), dark), String(value)).toBe('#c8a94a')
    }
    expect(substitute(clubTextColor('#1e4d7b'), light)).toBe('#1e4d7b')
  })

  it('the five places a club\'s colour is words read it through clubTextColor, and its fills and borders keep the club\'s colour', () => {
    const detail = read('src/pages/ClubDetailPage.tsx')
    expect(detail.match(/style=\{\{ color: textColor \}\}/g)).toHaveLength(3)
    expect(read('src/pages/ClubsPage.tsx').match(/style=\{\{ color: clubTextColor\(club\.color\) \}\}/g)).toHaveLength(1)
    const admin = read('src/pages/AdminClubPage.tsx')
    expect(admin).toContain('color: clubTextColor(color),')
    // The preview's tint, border and dot stay the club's colour.
    expect(admin).toContain('backgroundColor: `${color}15`')
    expect(admin).toContain('borderColor: `${color}40`')
  })
})
