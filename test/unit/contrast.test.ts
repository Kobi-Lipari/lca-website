// Contrast of the new look's tokens (WS01 acceptance criterion 3, step 21).
//
// The WCAG 2.x formula is applied to the token values read out of
// src/index.css, as a browser resolves them, in each look newLook brings:
// base light, base dark, live, scholastic, heritage and heritage in dark
// mode. The focus ring must reach 3:1 on every ground it can sit on; ink,
// muted text, gold-toned text and status words 4.5:1; field borders 3:1.
// The formula itself is checked first against ratios the brief states.
//
// Step 24 adds every pair the status map writes: each place in the TSX files
// where words in a colour the map wrote sit on their ground, and each place
// where the map changed the ground under existing words (a tone tint, a
// faint ink tint), read with the TypeScript parser from the element and its
// ancestors. Each pair reaches 4.5:1 for words and 3:1 for an icon's fill in
// every look, the tints laid over the ground beneath them. On a muted panel
// or in a menu, the heritage looks are checked on the files the heritage
// pages load, the only place heritage is drawn; the scanner's move marks
// stand out from the card; and the checked check-in toggle keeps its white
// words at 4.5:1. Words on a ground that stays put in every look (a hex
// ground: the club map's paper, the urgent and info banners) reach 4.5:1 in
// every look too, whatever their colour, so words that follow the look
// cannot turn light on the paper in dark mode.
//
// The browser measures the same rings in test/a11y/tokens.spec.ts.
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { STATUS_MAP, classStrings, loadMap, parseToken, tokensOf, tsxFiles, type ClassToken } from '../../scripts/codemods/semantic-colours'
import { HERITAGE_ROUTES, routeScope } from '../../src/lib/themeScopes'
import { contrast, hexToRgb, indexCssRules, read, ROOT, rootTokens, scopeTokens } from './helpers/cssTokens'
import { exclusive, jsxTree, type JsxNode, type Piece } from './helpers/jsxClasses'

const rules = indexCssRules()

/** Each look under newLook, as the tokens a container in it sees. */
const LOOKS = {
  base: rootTokens(rules, { look: true, dark: false }),
  dark: rootTokens(rules, { look: true, dark: true }),
  live: scopeTokens(rules, { look: true, dark: false }, 'live'),
  'live in dark mode': scopeTokens(rules, { look: true, dark: true }, 'live'),
  scholastic: scopeTokens(rules, { look: true, dark: false }, 'scholastic'),
  heritage: scopeTokens(rules, { look: true, dark: false }, 'heritage'),
  'heritage in dark mode': scopeTokens(rules, { look: true, dark: true }, 'heritage'),
}

const GROUNDS = ['--ground', '--surface', '--surface-2', '--raised']
const STATUSES = ['open', 'soon', 'full', 'waitlist', 'closed', 'live', 'partner', 'lca']

const get = (tokens: Map<string, string>, name: string) => {
  const v = tokens.get(name)
  if (!v) throw new Error(`${name} is not set`)
  return v
}

describe('the WCAG formula', () => {
  it('gives the ratios the brief quotes', () => {
    expect(contrast('#c8a94a', '#ffffff')).toBeCloseTo(2.28, 2)
    expect(contrast('#866a1e', '#ffffff')).toBeCloseTo(5.13, 2)
    expect(contrast('#c8a94a', '#1a2744')).toBeCloseTo(6.51, 2)
    expect(contrast('#1a2744', '#fff')).toBeCloseTo(14.81, 2)
    expect(contrast('#ff4757', '#ffffff')).toBeCloseTo(3.34, 2)
    expect(contrast('#000', '#fff')).toBe(21)
  })
})

describe.each(Object.entries(LOOKS))('%s', (_look, tokens) => {
  it.each(GROUNDS)('the focus ring reaches 3:1 on %s', (ground) => {
    expect(contrast(get(tokens, '--focus'), get(tokens, ground))).toBeGreaterThanOrEqual(3)
  })

  it.each(GROUNDS)('ink and muted text reach 4.5:1 on %s', (ground) => {
    expect(contrast(get(tokens, '--ink'), get(tokens, ground))).toBeGreaterThanOrEqual(4.5)
    expect(contrast(get(tokens, '--ink-muted'), get(tokens, ground))).toBeGreaterThanOrEqual(4.5)
  })

  it.each(['--ground', '--surface'])('gold-toned text, ok and bad reach 4.5:1 on %s', (ground) => {
    expect(contrast(get(tokens, '--gold-ink'), get(tokens, ground))).toBeGreaterThanOrEqual(4.5)
    expect(contrast(get(tokens, '--ok'), get(tokens, ground))).toBeGreaterThanOrEqual(4.5)
    expect(contrast(get(tokens, '--bad'), get(tokens, ground))).toBeGreaterThanOrEqual(4.5)
  })

  it.each(['--ground', '--surface'])('field borders reach 3:1 on %s', (ground) => {
    expect(contrast(get(tokens, '--field'), get(tokens, ground))).toBeGreaterThanOrEqual(3)
  })

  it.each(STATUSES)('the %s status words reach 4.5:1 on their tint', (status) => {
    expect(contrast(get(tokens, `--status-${status}`), get(tokens, `--status-${status}-tint`))).toBeGreaterThanOrEqual(4.5)
  })

  it('gold on dark reaches 4.5:1 on navy', () => {
    expect(contrast(get(tokens, '--gold-on-dark'), '#1a2744')).toBeGreaterThanOrEqual(4.5)
  })
})

describe('gold is never the text colour on a light ground', () => {
  it('in every light look, gold-toned text is not brand gold, which is 2.28:1 on white', () => {
    for (const look of ['base', 'scholastic', 'heritage'] as const) {
      const tokens = LOOKS[look]
      expect(get(tokens, '--gold-ink'), look).not.toBe('#c8a94a')
      expect(contrast(get(tokens, '--gold'), get(tokens, '--ground'))).toBeLessThan(3)
    }
  })
})

describe('the focus ring inside a navy band', () => {
  it('turns gold, which reaches 3:1 on the navy of today\'s header, footer and heroes', () => {
    expect(contrast(get(LOOKS.base, '--gold-on-dark'), '#1a2744')).toBeGreaterThanOrEqual(3)
    // The navy ring would vanish there.
    expect(contrast(get(LOOKS.base, '--focus'), '#1a2744')).toBe(1)
  })
})

// ── The pairs the status map writes (step 24) ─────────────────────────────

const statusMap = loadMap(STATUS_MAP)
/** Every utility the status map writes. */
const WRITTEN = new Set([...statusMap.rules.map((r) => r.to), ...statusMap.sites.map((s) => parseToken(s.to).utility)])

/** A colour (a token as var(--x), or a fixed hex) and the opacity it is drawn at. */
interface Layer {
  colour: string
  alpha: number
  /** A ground the status map wrote. */
  written?: boolean
  /** A hex ground, which stays put in every look. */
  fixed?: boolean
}

const opacity = (modifier: string) => (modifier === '' ? 1 : modifier.startsWith('[') ? Number(modifier.slice(1, -1)) : Number(modifier) / 100)

/** Grounds that follow the look, as their tokens. */
const LOOK_GROUND: Record<string, string> = {
  'bg-card': '--surface', 'bg-background': '--ground', 'bg-surface': '--surface', 'bg-surface-2': '--surface-2', 'bg-muted': '--surface-2',
  'bg-secondary': '--surface-2', 'bg-accent': '--surface-2', 'bg-popover': '--raised', 'bg-ground': '--ground', 'bg-raised': '--raised', 'bg-ink': '--ink',
}
/** Grounds that stay put in every look. */
const FIXED_GROUND: Record<string, string> = { 'bg-white': '#ffffff', 'bg-lca-gold': '#c8a94a', 'bg-brand-navy': '#1a2744', 'bg-black': '#000000' }
/** Words that follow the look, as their tokens under the new look. */
const LOOK_WORDS: Record<string, string> = { 'text-ink': '--ink', 'text-foreground': '--ink', 'text-card-foreground': '--ink', 'text-muted-foreground': '--ink-muted' }

/** The ground a class paints: a layer, 'unknown' for a picture or gradient, or null for none. */
function groundOf(t: ClassToken): Layer | 'unknown' | null {
  const u = t.utility
  if (!u.startsWith('bg-') || u === 'bg-transparent') return null
  if (/^bg-(gradient|linear|radial|conic)/.test(u)) return 'unknown'
  const alpha = opacity(t.modifier)
  const written = WRITTEN.has(u)
  if (LOOK_GROUND[u]) return { colour: `var(${LOOK_GROUND[u]})`, alpha, written }
  if (FIXED_GROUND[u]) return { colour: FIXED_GROUND[u], alpha, written }
  if (written || u.startsWith('bg-status-')) return { colour: `var(--${u.slice(3)})`, alpha, written }
  // Size, position and the like paint no colour; any other colour is not one this check can place.
  return /^bg-(cover|contain|center|top|bottom|left|right|no-repeat|repeat|fixed|local|scroll|clip-|origin-|blend-|none|auto)/.test(u) ? null : 'unknown'
}

/** The words colour a class gives, if the map wrote it or the ground under it. */
function wordsOf(t: ClassToken): (Layer & { icon: boolean; written: boolean }) | null {
  if (t.variants !== '') return null
  const u = t.utility
  if ((u.startsWith('text-') || u.startsWith('fill-')) && WRITTEN.has(u)) {
    return { colour: `var(--${u.replace(/^(text|fill)-/, '')})`, alpha: opacity(t.modifier), icon: u.startsWith('fill-'), written: true }
  }
  if (LOOK_WORDS[u]) return { colour: `var(${LOOK_WORDS[u]})`, alpha: opacity(t.modifier), icon: false, written: false }
  return null
}

const own = (n: JsxNode, piece?: Piece) => n.pieces
  .filter((p) => !piece || p === piece || !exclusive(p, piece))
  .flatMap((p) => tokensOf(p.text).map(({ token }) => token))
  .filter((t) => t.variants === '' && t.bang === '')

/**
 * The stacks of grounds an element can sit on, top first, each ending on an
 * opaque ground or, where no ancestor in its file paints one, open (the page
 * or a card below it). null when a picture or gradient is part of one.
 */
function stacks(node: JsxNode | null, piece?: Piece, ground: (t: ClassToken) => Layer | 'unknown' | null = groundOf): Layer[][] | null {
  if (!node) return [[]]
  const grounds = own(node, piece).map(ground).filter((g) => g !== null)
  if (grounds.includes('unknown')) return null
  if (grounds.length === 0) return stacks(node.parent, undefined, ground)
  const out: Layer[][] = []
  for (const g of grounds as Layer[]) {
    if (g.alpha >= 1) {
      out.push([g])
      continue
    }
    const under = stacks(node.parent, undefined, ground)
    if (!under) return null
    for (const s of under) out.push([g, ...s])
  }
  return out
}

interface Pair {
  where: string
  words: string
  icon: boolean
  /** The words colour, then the grounds top first. */
  layers: [Layer & { icon: boolean }, ...Layer[]]
  /** Whether the stack is open at the bottom (the page or a card). */
  open: boolean
  /** Whether the map wrote the words, or only the ground under them. */
  written: boolean
}

/**
 * A disabled control's faded words: WCAG leaves the text of an inactive
 * control out of its contrast rule (the bye a family entry can no longer take).
 */
const inactive = (piece: Piece) => /(^|\s)cursor-not-allowed(\s|$)/.test(piece.text)

/**
 * Every pair the status map writes, or puts a ground it wrote under, in the
 * TSX files: each element's words on the grounds it can sit on, read from
 * the element and its ancestors in its file; and, for the class strings an
 * element reads from an object of strings (a badge per status), each
 * string's words on the ground the same string gives, or on the page.
 */
function writtenPairs(): Pair[] {
  const out: Pair[] = []
  const add = (where: string, token: ClassToken, words: NonNullable<ReturnType<typeof wordsOf>>, s: Layer[]) => {
    if (!words.written && !s.some((l) => l.written)) return
    const open = s.length === 0 || s[s.length - 1].alpha < 1
    out.push({ where, words: token.text, icon: words.icon, layers: [words, ...s], open, written: words.written })
  }
  for (const file of tsxFiles(ROOT)) {
    for (const node of jsxTree(file)) {
      for (const piece of node.pieces) {
        if (inactive(piece)) continue
        for (const { token } of tokensOf(piece.text)) {
          const words = wordsOf(token)
          if (!words) continue
          for (const s of stacks(node, piece) ?? []) add(`${file}:${node.line} <${node.tag}>`, token, words, s)
        }
      }
    }
    const source = read(file)
    for (const str of classStrings(file, source)) {
      if (str.kind !== 'code') continue
      const tokens = tokensOf(str.text).map(({ token }) => token)
      const grounds = tokens.filter((t) => t.variants === '' && t.bang === '').map(groundOf).filter((g) => g !== null)
      if (grounds.includes('unknown')) continue
      const line = source.slice(0, str.start).split('\n').length
      for (const token of tokens) {
        const words = wordsOf(token)
        if (!words || !words.written) continue
        const stacksHere = grounds.length > 0 ? (grounds as Layer[]).map((g) => [g]) : [[]]
        for (const s of stacksHere) add(`${file}:${line} (string)`, token, words, s)
      }
    }
  }
  return out
}

/** A hex colour as [r, g, b]. */
const rgb = (hex: string) => hexToRgb(hex)
const toHex = (c: number[]) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`
/** `top` at `alpha` laid over `under`. */
const over = (top: string, alpha: number, under: string) => toHex(rgb(top).map((v, i) => v * alpha + rgb(under)[i] * (1 - alpha)))

function ratio(pair: Pair, tokens: Map<string, string>, base: string): number {
  const resolve = (c: string) => (c.startsWith('var(') ? get(tokens, c.slice(4, -1)) : c)
  const [words, ...grounds] = pair.layers
  let ground = base
  for (const g of [...grounds].reverse()) ground = g.alpha >= 1 ? resolve(g.colour) : over(resolve(g.colour), g.alpha, ground)
  const fg = words.alpha >= 1 ? resolve(words.colour) : over(resolve(words.colour), words.alpha, ground)
  return contrast(fg, ground)
}

describe('every pair the status map writes reaches its ratio in every look (step 24)', () => {
  const pairs = writtenPairs()

  it('finds the pairs: words the map wrote, and the words on a ground it wrote', () => {
    expect(pairs.filter((p) => p.written).length).toBeGreaterThan(150)
    const has = (file: string, words: string, ground: string) =>
      pairs.some((p) => p.where.startsWith(file) && p.words === words && p.layers.slice(1).some((l) => l.colour === ground))
    // A green badge, a note's words on its tint, the member strip's ink on the ok tint,
    // a chip's ink on the faint ink tint, and the Scheduled tag on its own tint.
    expect(has('src/areas/admin/components/AuditLogPanel.tsx', 'text-ok', 'var(--ok-100)')).toBe(true)
    expect(has('src/pages/ContactPage.tsx', 'text-ok-700', 'var(--ok-50)')).toBe(true)
    expect(has('src/pages/MembershipPage.tsx', 'text-ink', 'var(--ok-50)')).toBe(true)
    expect(has('src/pages/TournamentsPage.tsx', 'text-ink', 'var(--ink)')).toBe(true)
    expect(has('src/areas/admin/components/AdminAnnouncementPanel.tsx', 'text-info-banner', 'var(--info-banner)')).toBe(true)
    // Words on the page or a card, with no ground of their own in the file.
    expect(pairs.some((p) => p.words === 'text-ok-700' && p.open)).toBe(true)
    expect(pairs.some((p) => p.words === 'text-facebook-link')).toBe(true)
  })

  it.each(Object.entries(LOOKS))('%s: words reach 4.5:1 and an icon\'s fill 3:1, on the page and on a card where the ground is open', (_look, tokens) => {
    const failing: string[] = []
    for (const pair of pairs) {
      const bases = pair.open ? ['--ground', '--surface'] : ['--ground']
      for (const base of bases) {
        const r = ratio(pair, tokens, get(tokens, base))
        if (r < (pair.icon ? 3 : 4.5)) failing.push(`${pair.where} ${pair.words} on ${pair.layers.slice(1).map((l) => `${l.colour}${l.alpha < 1 ? `@${l.alpha}` : ''}`).join(' over ') || 'the page'}${pair.open ? ` over ${base}` : ''}: ${r.toFixed(2)}:1`)
      }
    }
    expect(failing).toEqual([])
  })
})

// ── Where else the written words can stand (step 24) ───────────────────────

/** Where an import names a file under src, or null for a package or anything else. */
function resolveModule(from: string, spec: string): string | null {
  const base = spec.startsWith('@/') ? `src/${spec.slice(2)}` : spec.startsWith('.') ? join(dirname(from), spec) : null
  if (!base) return null
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]) {
    if (/\.tsx?$/.test(candidate) && existsSync(join(ROOT, candidate))) return candidate
  }
  return null
}

/** Every file under src the given files load when they run (imports, re-exports and import(), not import type), themselves included. */
function runtimeClosure(entries: string[]): Set<string> {
  const seen = new Set<string>()
  const walk = (file: string) => {
    if (seen.has(file)) return
    seen.add(file)
    const sf = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
    const visit = (node: ts.Node) => {
      let spec: string | undefined
      if (ts.isImportDeclaration(node) && !node.importClause?.isTypeOnly && ts.isStringLiteral(node.moduleSpecifier)) spec = node.moduleSpecifier.text
      else if (ts.isExportDeclaration(node) && !node.isTypeOnly && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) spec = node.moduleSpecifier.text
      else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments.length > 0 && ts.isStringLiteral(node.arguments[0])) spec = node.arguments[0].text
      const target = spec === undefined ? null : resolveModule(file, spec)
      if (target) walk(target)
      ts.forEachChild(node, visit)
    }
    visit(sf)
  }
  for (const entry of entries) walk(entry)
  return seen
}

/** The page file each heritage route draws, read from src/App.tsx: its <Route> and the lazy import of its page. */
function heritagePages(): string[] {
  const app = read('src/App.tsx')
  return HERITAGE_ROUTES.map((route) => {
    const page = app.match(new RegExp(`<Route path="${route}" element=\\{<(\\w+) />\\}`))?.[1]
    const spec = page ? app.match(new RegExp(`const ${page} = lazy\\(\\(\\) => import\\('([^']+)'\\)`))?.[1] : undefined
    const file = spec ? resolveModule('src/App.tsx', spec) : null
    if (!file) throw new Error(`no page found for ${route} in src/App.tsx`)
    return file
  })
}

describe('the words the status map writes, on a muted panel or in a menu (step 24)', () => {
  // The pairs above whose ground is open stand on whatever the page puts
  // under them, and that is not only the page or a card: shadcn's muted,
  // secondary and accent grounds (a muted panel, a table head, a hovered
  // menu item) are --surface-2, and a popover or menu is --raised. The step
  // 24 brief names --surface-2 as a ground the status words were never
  // checked on.
  //
  // The heritage look is drawn only on its six pages (HERITAGE_ROUTES in
  // src/lib/themeScopes.ts), so in heritage only the files those pages load
  // can stand on its muted panel, the Looks-1 inset #ece4d0. The ok and bad
  // words, which heritage does not restyle, read below 4.5:1 there (the last
  // test of this block), so a page heritage draws must not put them on it
  // until that is settled.
  const open = writtenPairs().filter((p) => p.open)
  const heritageFiles = runtimeClosure(heritagePages())
  const drawnIn = (look: string) => (pair: Pair) => !look.startsWith('heritage') || heritageFiles.has(pair.where.split(':')[0])

  it('finds the open pairs: words with no ground of their own in their file', () => {
    expect(open.length).toBeGreaterThan(50)
    expect(open.some((p) => p.words === 'text-ok')).toBe(true)
    expect(open.some((p) => p.words === 'text-bad')).toBe(true)
  })

  it('finds the files the heritage pages load: the six pages, the governance pieces and the shared ones they use, and no working page', () => {
    expect(heritagePages()).toEqual([
      'src/pages/AboutPage.tsx',
      'src/pages/BoardPage.tsx',
      'src/pages/BylawsPage.tsx',
      'src/pages/MinutesPage.tsx',
      'src/pages/AnnualMeetingPage.tsx',
      'src/pages/ChampionsPage.tsx',
    ])
    for (const file of ['src/areas/governance/components/GovLayout.tsx', 'src/areas/governance/components/OfficerPhoto.tsx', 'src/components/PageHero.tsx', 'src/components/ui/button.tsx']) {
      expect(heritageFiles, file).toContain(file)
    }
    for (const file of ['src/pages/AdminPage.tsx', 'src/pages/TournamentManagePage.tsx', 'src/components/FacebookFeed.tsx', 'src/areas/membership/components/UscfSearchInput.tsx']) {
      expect(heritageFiles, file).not.toContain(file)
    }
    // How an import resolves: the @/ alias, a relative path, and a package, which is no file under src.
    expect(resolveModule('src/pages/AboutPage.tsx', '@/components/PageHero')).toBe('src/components/PageHero.tsx')
    expect(resolveModule('src/areas/governance/components/GovLayout.tsx', './OfficerPhoto')).toBe('src/areas/governance/components/OfficerPhoto.tsx')
    expect(resolveModule('src/pages/AboutPage.tsx', 'react')).toBeNull()
    // GovLayout's document icon is an open pair the heritage rows check.
    expect(open.filter(drawnIn('heritage')).map((p) => `${p.where.split(':')[0]} ${p.words}`)).toContain('src/areas/governance/components/GovLayout.tsx fill-bad-500')
  })

  it.each(Object.entries(LOOKS))('%s: words reach 4.5:1 and an icon\'s fill 3:1 on a muted panel (--surface-2) and in a menu (--raised)', (look, tokens) => {
    // One line per words class and ground, with how many places and the first of them.
    const failing = new Map<string, string[]>()
    for (const pair of open.filter(drawnIn(look))) {
      for (const base of ['--surface-2', '--raised']) {
        const r = ratio(pair, tokens, get(tokens, base))
        if (r >= (pair.icon ? 3 : 4.5)) continue
        const key = `${pair.words} on ${pair.layers.slice(1).map((l) => `${l.colour}@${l.alpha}`).join(' over ') || 'nothing of its own'} over ${base} (${get(tokens, base)}): ${r.toFixed(2)}:1`
        failing.set(key, [...(failing.get(key) ?? []), pair.where])
      }
    }
    expect([...failing].map(([k, where]) => `${k}, ${where.length} place(s), such as ${where[0]}`).sort()).toEqual([])
  })

  it('heritage: the ok and bad words read below 4.5:1 on the inset ground, the gap recorded for step 31 to settle before the heritage look is turned on', () => {
    // Heritage restyles grounds and gold-ink only, so its words stay the
    // base look's: --ok #047857 and --bad #c0362c read 4.33:1 and 4.36:1 on
    // the inset #ece4d0 (and the Facebook link blue 4.14:1), though they
    // reach 4.5:1 on its paper and card. No file a heritage page loads puts
    // them on a muted panel today (the test above). Settling it, with a
    // darker ok and bad for heritage or a lighter inset, is K's call; once
    // it is made this test fails, and the heritage rows above can take every
    // file again.
    const h = LOOKS.heritage
    expect(get(h, '--surface-2')).toBe('#ece4d0')
    expect(contrast(get(h, '--ok'), get(h, '--surface-2'))).toBeLessThan(4.5)
    expect(contrast(get(h, '--bad'), get(h, '--surface-2'))).toBeLessThan(4.5)
    for (const ground of ['--ground', '--surface']) {
      expect(contrast(get(h, '--ok'), get(h, ground)), ground).toBeGreaterThanOrEqual(4.5)
      expect(contrast(get(h, '--bad'), get(h, ground)), ground).toBeGreaterThanOrEqual(4.5)
    }
    // In every other look they reach 4.5:1 on the muted panel too.
    for (const [look, tokens] of Object.entries(LOOKS).filter(([look]) => look !== 'heritage')) {
      expect(contrast(get(tokens, '--ok'), get(tokens, '--surface-2')), look).toBeGreaterThanOrEqual(4.5)
      expect(contrast(get(tokens, '--bad'), get(tokens, '--surface-2')), look).toBeGreaterThanOrEqual(4.5)
    }
  })
})

// ── Words on a ground that stays put (step 24) ────────────────────────────

const INLINE = rules.find((r) => r.selector === '@theme inline')!
const BRAND = rules.find((r) => r.selector === '@theme')!
/** The token a colour utility's name reads through the @theme inline block ("muted-on-light" reads --muted-on-light), or null. */
const inlineToken = (name: string) => INLINE.decls.get(`--color-${name}`)?.match(/^var\((--[\w-]+)\)$/)?.[1] ?? null

/** A ground for the check below: what groundOf places, and also a hex ground (fixed) and any token ground. */
function anyGroundOf(t: ClassToken): Layer | 'unknown' | null {
  const placed = groundOf(t)
  if (placed !== 'unknown') return placed
  const alpha = opacity(t.modifier)
  const hex = t.utility.match(/^bg-\[(#[0-9a-f]{6})\]$/i)
  if (hex) return { colour: hex[1].toLowerCase(), alpha, fixed: true }
  const token = inlineToken(t.utility.slice(3))
  return token ? { colour: `var(${token})`, alpha } : 'unknown'
}

/** The colour any words class paints: a token, read where it is used, a brand colour, white or a hex colour; null for none. */
function anyWordsOf(t: ClassToken): (Layer & { icon: boolean }) | null {
  if (t.variants !== '' || !t.utility.startsWith('text-')) return null
  const name = t.utility.slice(5)
  const alpha = opacity(t.modifier)
  const hex = name.match(/^\[(#[0-9a-f]{6})\]$/i)
  if (hex) return { colour: hex[1].toLowerCase(), alpha, icon: false }
  if (name === 'white') return { colour: '#ffffff', alpha, icon: false }
  const brand = BRAND.decls.get(`--color-${name}`)
  if (brand) return { colour: brand, alpha, icon: false }
  const token = inlineToken(name)
  return token ? { colour: `var(${token})`, alpha, icon: false } : null
}

/**
 * Every place words sit on a hex ground, which stays put in every look: each
 * element's words on the stacks of grounds it can sit on that end on one,
 * and each class string (a tone of an object of strings) whose own opaque
 * ground is one.
 */
function fixedGroundPairs(): Pair[] {
  const out: Pair[] = []
  const add = (where: string, words: string, colour: Layer & { icon: boolean }, s: Layer[]) => {
    const bottom = s[s.length - 1]
    if (bottom?.fixed && bottom.alpha >= 1) out.push({ where, words, icon: false, layers: [colour, ...s], open: false, written: false })
  }
  for (const file of tsxFiles(ROOT)) {
    for (const node of jsxTree(file)) {
      for (const piece of node.pieces) {
        if (inactive(piece)) continue
        for (const { token } of tokensOf(piece.text)) {
          const words = anyWordsOf(token)
          if (!words) continue
          for (const s of stacks(node, piece, anyGroundOf) ?? []) add(`${file}:${node.line} <${node.tag}>`, token.text, words, s)
        }
      }
    }
    const source = read(file)
    for (const str of classStrings(file, source)) {
      if (str.kind !== 'code') continue
      const tokens = tokensOf(str.text).map(({ token }) => token)
      const grounds = tokens.filter((t) => t.variants === '' && t.bang === '').map(anyGroundOf).filter((g): g is Layer => g !== null && g !== 'unknown')
      const line = source.slice(0, str.start).split('\n').length
      for (const token of tokens) {
        const words = anyWordsOf(token)
        if (words) for (const g of grounds) add(`${file}:${line} (string)`, token.text, words, [g])
      }
    }
  }
  return out
}

describe('words on a ground that stays put in every look reach 4.5:1 in every look (step 24)', () => {
  // A hex ground follows no look: the club map's paper (#f2efe6) stays
  // light, and the urgent and info banners (#9b1c1c, #1e4d7b) stay dark. So
  // the words on one, and any veil laid over it, must hold in every look and
  // mode: muted words that followed the look would read 2.13:1 on the paper
  // in dark mode, and 1.09:1 under a muted veil that followed it too. The
  // map's loading notes take text-muted-on-light and bg-veil-on-light/30, which
  // stay as the light look draws them.
  const pairs = fixedGroundPairs()

  it('finds them: the club map\'s loading notes on its paper, under the veil on the clubs map, and the banners\' words', () => {
    const found = pairs.map((p) => `${p.where.split(':')[0]} ${p.words} on ${p.layers.slice(1).map((l) => `${l.colour}${l.alpha < 1 ? `@${l.alpha}` : ''}`).join(' over ')}`)
    expect(found).toContain('src/areas/clubs/components/ClubLocationPicker.tsx text-muted-on-light on #f2efe6')
    expect(found).toContain('src/areas/clubs/components/LCAMap.tsx text-muted-on-light on var(--veil-on-light)@0.3 over #f2efe6')
    expect(found).toContain('src/components/AnnouncementBanner.tsx text-white on #9b1c1c')
    expect(found).toContain('src/components/AnnouncementBanner.tsx text-white on #1e4d7b')
  })

  it('places the words and grounds a page could use, and would catch muted words that follow the look on the paper', () => {
    const t = (cls: string) => parseToken(cls)
    expect(anyWordsOf(t('text-muted-on-light'))?.colour).toBe('var(--muted-on-light)')
    expect(anyWordsOf(t('text-brand-navy'))?.colour).toBe('#1a2744')
    expect(anyWordsOf(t('text-white/80'))).toEqual({ colour: '#ffffff', alpha: 0.8, icon: false })
    expect(anyWordsOf(t('text-sm'))).toBeNull()
    expect(anyGroundOf(t('bg-veil-on-light/30'))).toEqual({ colour: 'var(--veil-on-light)', alpha: 0.3 })
    // Today's loading note in dark mode, had it kept the classes that follow the look.
    const pair = (words: string, ...grounds: Layer[]): Pair => ({ where: 'planted', words, icon: false, layers: [{ ...anyWordsOf(t(words))!, icon: false }, ...grounds], open: false, written: false })
    const paper = anyGroundOf(t('bg-[#f2efe6]')) as Layer
    const muted = anyGroundOf(t('bg-muted/30')) as Layer
    expect(ratio(pair('text-muted-foreground', paper), LOOKS.dark, '#000000')).toBeCloseTo(2.13, 2)
    expect(ratio(pair('text-muted-foreground', muted, paper), LOOKS.dark, '#000000')).toBeCloseTo(1.09, 2)
  })

  it.each(Object.entries(LOOKS))('%s: each reaches 4.5:1', (_look, tokens) => {
    const failing = pairs
      .map((p) => ({ p, r: ratio(p, tokens, '#000000') }))
      .filter(({ r }) => r < 4.5)
      .map(({ p, r }) => `${p.where} ${p.words} on ${p.layers.slice(1).map((l) => `${l.colour}${l.alpha < 1 ? `@${l.alpha}` : ''}`).join(' over ')}: ${r.toFixed(2)}:1`)
    expect(failing).toEqual([])
  })
})

// ── The scanner's marks and the check-in toggle (step 24) ──────────────────

describe('the scanner\'s move marks stand out from the card, with their words at 4.5:1 (step 24)', () => {
  // The marks on a move to check and a move that was fixed are not status
  // tags: each has to stand out from the card the moves sit on, where the
  // tag tints (#fbf7e9 and #e8f5ef) would read 1.07:1 and 1.12:1. So they
  // take mark colours of their own, at least 1.2:1 against the card and the
  // page, about what amber-200 and emerald-200 read against white today
  // (1.24:1 and 1.28:1). The scanner is drawn in the base look only, light
  // or dark.
  const MARKS = [['--mark-warn', 'text-warn-950'], ['--mark-ok', 'text-ok-950']] as const

  it('the scanner page is drawn in the base look', () => {
    expect(routeScope('/scanner')).toBe('base')
  })

  it.each([['base', LOOKS.base], ['dark', LOOKS.dark]] as const)('%s: each mark reads at least 1.2:1 against the card and the page, where its tag tint does not', (_look, tokens) => {
    for (const [mark] of MARKS) {
      for (const ground of ['--surface', '--ground']) {
        expect(contrast(get(tokens, mark), get(tokens, ground)), `${mark} on ${ground}`).toBeGreaterThanOrEqual(1.2)
      }
    }
    expect(contrast(get(tokens, '--status-soon-tint'), get(tokens, '--surface'))).toBeLessThan(1.2)
    expect(contrast(get(tokens, '--status-open-tint'), get(tokens, '--surface'))).toBeLessThan(1.2)
  })

  it.each(Object.entries(LOOKS))('%s: the words on each mark reach 4.5:1', (_look, tokens) => {
    for (const [mark, words] of MARKS) {
      expect(contrast(get(tokens, tokenOf(words)), get(tokens, mark)), `${words} on ${mark}`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('the pages put a mark under its own words or under no words at all (the legend\'s swatch)', () => {
    const found: string[] = []
    for (const file of tsxFiles(ROOT)) {
      for (const s of classStrings(file, read(file))) {
        const utilities = tokensOf(s.text).map(({ token }) => token.utility)
        for (const [mark, words] of MARKS) {
          const bg = `bg-${mark.slice(2)}`
          if (!utilities.includes(bg)) continue
          found.push(`${file} ${bg}`)
          const text = utilities.filter((u) => /^text-/.test(u) && !/^text-(xs|sm|base|lg|xl|\d?xl|left|center|right)$/.test(u))
          expect(text.every((u) => u === words), `${file}: ${s.text}`).toBe(true)
        }
      }
    }
    expect(found.sort()).toEqual([
      'src/pages/ScannerPage.tsx bg-mark-ok',
      'src/pages/ScannerPage.tsx bg-mark-ok',
      'src/pages/ScannerPage.tsx bg-mark-warn',
      'src/pages/ScannerPage.tsx bg-mark-warn',
    ])
  })
})

describe('the checked check-in toggle keeps its white words at 4.5:1 (step 24)', () => {
  // White on emerald-600 is 3.67:1. --ok-fill is emerald-600 with newLook
  // off and #047857 under the new look, in every look and in dark mode,
  // where the ok words colour would be too light under white.
  it.each(Object.entries(LOOKS))('%s: white on the fill reaches 4.5:1, and the fill stands out from the card at 3:1, as a control\'s state should', (_look, tokens) => {
    expect(contrast('#ffffff', get(tokens, '--ok-fill'))).toBeGreaterThanOrEqual(4.5)
    expect(contrast(get(tokens, '--ok-fill'), get(tokens, '--surface'))).toBeGreaterThanOrEqual(3)
  })

  it('every fill of it carries white words', () => {
    const found: string[] = []
    for (const file of tsxFiles(ROOT)) {
      for (const s of classStrings(file, read(file))) {
        const utilities = tokensOf(s.text).map(({ token }) => token.utility)
        if (!utilities.includes('bg-ok-fill')) continue
        found.push(file)
        expect(utilities, s.text).toContain('text-white')
      }
    }
    expect(found).toEqual(['src/pages/TournamentManagePage.tsx'])
  })
})

/** The token a colour utility reads where it is used: text-ok-700 reads --ok-700, fill-bad-500 --bad-500. */
const tokenOf = (utility: string) => `--${utility.replace(/^(text|fill|bg)-/, '')}`

describe('every tint the status map writes, under every words colour that can sit on it (step 24)', () => {
  // A note, a badge or a hover lays a tone's tint under words: its own
  // tone's words, the ink and muted words already there, and, since a hover
  // tint (hover:bg-bad-50) or a reused note can meet any tone, another
  // tone's words. Each tint is checked under each of them, in every look.
  const words = [...WRITTEN].filter((u) => /^(text|fill)-/.test(u) && !u.startsWith('text-status-')).sort()
  const tints = [...WRITTEN].filter((u) => /^bg-.*-(50|100|200|300|tint)$/.test(u)).sort()

  it('takes the tone tints and the words the map writes', () => {
    expect(tints).toContain('bg-ok-50')
    expect(tints).toContain('bg-bad-50')
    expect(tints).toContain('bg-quiet-100')
    expect(tints).toContain('bg-status-open-tint')
    expect(tints.every((t) => !/-(500|600|700|800|900|950)$/.test(t))).toBe(true)
    expect(words).toContain('text-bad')
    expect(words).toContain('text-facebook-link')
    expect(words).toContain('fill-bad-500')
  })

  it.each(Object.entries(LOOKS))('%s: each reaches 4.5:1 for words and 3:1 for an icon\'s fill', (_look, tokens) => {
    const failing: string[] = []
    for (const tint of tints) {
      const ground = get(tokens, tokenOf(tint))
      for (const w of [...words, 'text-ink', 'text-muted-foreground']) {
        const colour = w === 'text-ink' ? get(tokens, '--ink') : w === 'text-muted-foreground' ? get(tokens, '--ink-muted') : get(tokens, tokenOf(w))
        const r = contrast(colour, ground)
        if (r < (w.startsWith('fill-') ? 3 : 4.5)) failing.push(`${w} (${colour}) on ${tint} (${ground}): ${r.toFixed(2)}:1`)
      }
    }
    expect(failing).toEqual([])
  })
})

describe('a status tag\'s words sit on their own tint (step 24)', () => {
  // The status tokens are built as pairs: under the new look --status-live
  // and --status-lca are white in the base look and --status-lca is the dark
  // ground in dark mode, so their words on a page or a card would vanish.
  // The step 24 map writes text-status-open only on the two Open pills,
  // beside bg-status-open-tint; red or green words on a page take text-bad
  // or text-ok. This holds every text-status class in the site to that, and
  // the fixture pages, which draw the looks' own swatches, are left out.
  const files = tsxFiles(ROOT).filter((f) => !f.startsWith('src/pages/fixtures/'))

  it('every text-status class shares its string with its own opaque tint, under the same variants', () => {
    const found: string[] = []
    const lonely: string[] = []
    for (const file of files) {
      const source = read(file)
      for (const s of classStrings(file, source)) {
        const tokens = tokensOf(s.text).map(({ token }) => token)
        for (const t of tokens) {
          const m = t.utility.match(/^text-status-([a-z]+)$/)
          if (!m) continue
          const where = `${file}:${source.slice(0, s.start).split('\n').length} ${t.text}`
          found.push(where)
          const tint = tokens.some((g) => g.utility === `bg-status-${m[1]}-tint` && g.modifier === '' && g.variants === t.variants)
          if (!tint || t.modifier !== '') lonely.push(where)
        }
      }
    }
    expect(found).toEqual([
      'src/areas/events/components/AgendaList.tsx:87 text-status-open',
      'src/pages/TournamentDetailPage.tsx:822 text-status-open',
    ])
    expect(lonely).toEqual([])
  })

  it('under the new look, the live and LCA words would vanish on a page, which is why they never stand alone', () => {
    const base = LOOKS.base
    expect(contrast(get(base, '--status-live'), get(base, '--surface'))).toBe(1)
    expect(contrast(get(base, '--status-lca'), get(base, '--surface'))).toBe(1)
    expect(contrast(get(LOOKS.dark, '--status-lca'), get(LOOKS.dark, '--ground'))).toBe(1)
  })
})
