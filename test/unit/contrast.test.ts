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
// Step 25 adds every pair the gold work writes: text-gold-ink (which took
// text-lca-gold's place on the light grounds) and the three gold words
// tokens, each on the grounds read from its element and ancestors, the gold
// tint in its own string included, and on the navy wherever
// scripts/codemods/gold-ink.ts, the reading test/unit/goldText.test.ts places
// every gold token with, settles one (a wrapper component that paints navy
// around what it is given, a component drawn on navy under another name), so
// the guard and these ratios read one ground. Icons need 3:1 and words 4.5:1,
// held apart, since gold-ink words on a gold tint of 20 per cent or more fall
// below 4.5:1 in the light look while an icon there passes. The light gold of
// a pill is measured on the dark ground it is drawn on: the navy, or the
// lightest the home page hero's darkened photo gets, worked out from the
// hero's filter and veils. The hero is the one ground marked
// data-ground="dark" with no navy of its own, and what it holds is measured
// over its photo, never taken for navy. The brand gold step 25 keeps is read
// again with the reader of test/unit/helpers/jsxClasses.ts, found on a ground
// that stays dark and measured there, the hover forms on their hover veils,
// and brand gold words planted on the photo fall below 4.5:1 there; the LCA
// pill on /tournaments, the dark spot run's one failure at step 24, is
// measured in dark mode; and each gold token planted on the wrong ground is
// found failing, so the check of the pairs is not blind to a regression.
//
// The browser measures the same rings in test/a11y/tokens.spec.ts.
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { groundOf as groundUnder, parseFile, readTree, type Tree } from '../../scripts/codemods/gold-ink'
import { STATUS_MAP, classStrings, loadMap, parseToken, tokensOf, tsxFiles, type ClassToken } from '../../scripts/codemods/semantic-colours'
import { HERITAGE_ROUTES, routeScope } from '../../src/lib/themeScopes'
import { applies, contrast, hexToRgb, indexCssRules, matchesRoot, read, ROOT, rootTokens, scopeTokens, specificity, substitute } from './helpers/cssTokens'
import { GOLD_ALLOWLIST } from './fixtures/goldAllowlist'
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

// ── The chrome's own rings (WS02 step 3) ──────────────────────────────────
//
// The new header, the phone's app bar, the round-state strip and the footer,
// the light surfaces they open and the banners' gold ground mark themselves
// with data-ring-ground (navy, light or gold), and the rules for it in
// src/index.css set --focus there. Each ring is read as a browser works it
// out, on the element that carries the value, and held to 3:1 against the
// ground right next to it (the ring is drawn 2px outside the control), in
// the light look and in dark mode. The round-state strip is drawn in the
// live look, whose ring the looks above already hold to 3:1 on its grounds
// (LOOKS, live and live in dark mode), so it needs no pair of its own.

type RingGround = 'navy' | 'light' | 'gold'

/**
 * The ring on an element marked data-ring-ground="value": the page's own
 * --focus, then each rule for that value the page's state matches, by
 * specificity and then by place in the file, as the cascade takes them.
 */
function chromeRing(value: RingGround, dark: boolean): string {
  const state = { look: true, dark }
  const page = rootTokens(rules, state)
  const own = new RegExp(`^(.+) \\[data-ring-ground="${value}"\\]$`)
  const hits = rules
    .filter((r) => applies(r) && r.decls.has('--focus'))
    .flatMap((r) => r.selectors.flatMap((s) => {
      const m = own.exec(s)
      return m && matchesRoot(m[1], state) ? [{ rule: r, spec: specificity(s) }] : []
    }))
    .sort((a, b) => a.spec - b.spec || a.rule.order - b.rule.order)
  let focus = get(page, '--focus')
  for (const { rule } of hits) focus = substitute(rule.decls.get('--focus')!, page)
  return focus
}

/** The navy of the header, the app bar and the footer, the same in both modes (the brief's table). */
const CHROME_NAVY = '#1a2744'
/** The current rows of the light surfaces in the light look: the sheet's and the About menu's. */
const SHEET_ROW = '#fbfaf6'
const ABOUT_ROW = '#f3eedc'
/** The banners' opaque gold. */
const GOLD_GROUND = '#c8a94a'

describe('the chrome\'s own rings, set by data-ring-ground (WS02 step 3)', () => {
  it('gives the navy chrome the gold ring, at 3:1 or more on its navy, in the light look and in dark mode', () => {
    for (const dark of [false, true]) {
      expect(chromeRing('navy', dark), `dark ${dark}`).toBe('#c8a94a')
      expect(chromeRing('navy', dark)).toBe(get(dark ? LOOKS.dark : LOOKS.base, '--gold-on-dark'))
      expect(contrast(chromeRing('navy', dark), CHROME_NAVY)).toBeGreaterThanOrEqual(3)
    }
  })

  it('gives each light surface the look\'s own ring back: navy on white and on the current rows in the light look', () => {
    const ring = chromeRing('light', false)
    expect(ring).toBe(get(LOOKS.base, '--focus'))
    for (const ground of [get(LOOKS.base, '--raised'), SHEET_ROW, ABOUT_ROW]) {
      expect(contrast(ring, ground), ground).toBeGreaterThanOrEqual(3)
    }
  })

  it('and gold on the navy of dark mode\'s light surfaces, on --raised and on a row with a tenth of white over it', () => {
    const ring = chromeRing('light', true)
    expect(ring).toBe(get(LOOKS.dark, '--focus'))
    const raised = get(LOOKS.dark, '--raised')
    expect(raised).toBe('#1a2744')
    for (const ground of [raised, over('#ffffff', 0.1, raised)]) {
      expect(contrast(ring, ground), ground).toBeGreaterThanOrEqual(3)
    }
  })

  it('gives the banners\' gold ground a navy ring in both modes, where the dark mode ring alone would be gold on gold', () => {
    for (const dark of [false, true]) {
      expect(chromeRing('gold', dark), `dark ${dark}`).toBe('#1a2744')
      expect(contrast(chromeRing('gold', dark), GOLD_GROUND)).toBeGreaterThanOrEqual(3)
    }
    // What a control on the gold ground drew before: the look's own ring, gold on gold in dark mode.
    expect(get(LOOKS.dark, '--focus')).toBe(GOLD_GROUND)
    expect(contrast(get(LOOKS.dark, '--focus'), GOLD_GROUND)).toBe(1)
  })

  it('sets the colour by --focus alone, so the one ring draws it, and the rules wait for the new look', () => {
    const marked = rules.filter((r) => r.selectors.some((s) => s.includes('[data-ring-ground')))
    expect(marked.length).toBe(3)
    for (const r of marked) {
      expect([...r.decls.keys()], r.selector).toEqual(['--focus'])
      for (const s of r.selectors) expect(s.startsWith(':root[data-look="new"]'), s).toBe(true)
    }
    // Without the new look none of them applies, and the ring is today's.
    for (const value of ['navy', 'light', 'gold'] as const) {
      const own = new RegExp(`^(.+) \\[data-ring-ground="${value}"\\]$`)
      for (const r of marked) for (const s of r.selectors) {
        const m = own.exec(s)
        if (m) expect(matchesRoot(m[1], { look: false, dark: true }), s).toBe(false)
      }
    }
  })

  it('leaves the navy band rule and its menu exception as they were, for the page heroes', () => {
    const gold = rules.filter((r) => r.decls.get('outline-color') === 'var(--gold-on-dark)')
    expect(gold.map((r) => r.selectors)).toEqual([[
      ':root[data-look="new"] .bg-lca-navy :focus-visible',
      ':root[data-look="new"] .bg-brand-navy :focus-visible',
      ':root[data-look="new"] [data-ground="dark"] :focus-visible',
    ]])
    const back = rules.filter((r) => r.decls.get('outline-color') === 'var(--focus)')
    expect(back.map((r) => r.selectors)).toEqual([gold[0].selectors.map((s) => s.replace(/ :focus-visible$/, ' .bg-popover :focus-visible'))])
    // The chrome's rules come after both, and set no colour outright, so the band rule keeps the heroes' ring.
    const chrome = rules.filter((r) => r.selectors.some((s) => s.includes('[data-ring-ground')))
    for (const r of chrome) expect(r.order).toBeGreaterThan(back[0].order)
  })

  it('draws the skip link\'s ring inside its own edge, on its own ground, at 3:1 or more in both modes', () => {
    const skip = rules.filter((r) => r.selectors.includes(':root[data-look="new"] [data-skip-link]:focus-visible'))
    expect(skip).toHaveLength(1)
    // Inside the edge, with a gap of the link's own ground beyond the 2px line.
    expect(parseFloat(skip[0].decls.get('outline-offset') ?? '0')).toBeLessThanOrEqual(-4)
    for (const tokens of [LOOKS.base, LOOKS.dark]) {
      expect(contrast(get(tokens, '--focus'), get(tokens, '--raised'))).toBeGreaterThanOrEqual(3)
    }
    // The main it moves the focus to is a landmark, not a control, and draws no ring.
    const main = rules.filter((r) => r.selectors.includes(':root[data-look="new"] #main-content:focus-visible'))
    expect(main.map((r) => r.decls.get('outline'))).toEqual(['none'])
  })

  it('is carried by the two banners and by the chrome\'s parts built so far: since WS02 step 5 the new header and its two menus, and since WS02 step 6 the app bar, the Menu sheet and the notice of the bars\' own boundary', () => {
    const carriers = tsxFiles(ROOT).filter((file) => read(file).includes('data-ring-ground'))
    expect(carriers.sort()).toEqual([
      'src/components/AnnouncementBanner.tsx',
      'src/components/ImpersonationBanner.tsx',
      'src/components/layout/AboutMenu.tsx',
      'src/components/layout/MobileAppBar.tsx',
      'src/components/layout/MobileMenu.tsx',
      'src/components/layout/MyLcaMenu.tsx',
      'src/components/layout/OnDemand.tsx',
      'src/components/layout/SiteHeader.tsx',
    ])
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
  // or text-ok. Since step 26 StatusBadge's status path writes each status's
  // words beside its own tint, one string per status, and a FilterChip that
  // is on takes the soon pair. This holds every text-status class in the site
  // to that, and the fixture pages, which draw the looks' own swatches, are
  // left out.
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
      'src/areas/events/components/AgendaList.tsx:88 text-status-open',
      'src/components/StatusBadge.tsx:59 text-status-open',
      'src/components/StatusBadge.tsx:60 text-status-soon',
      'src/components/StatusBadge.tsx:61 text-status-full',
      'src/components/StatusBadge.tsx:62 text-status-waitlist',
      'src/components/StatusBadge.tsx:63 text-status-closed',
      'src/components/StatusBadge.tsx:64 text-status-live',
      'src/components/StatusBadge.tsx:65 text-status-partner',
      'src/components/StatusBadge.tsx:66 text-status-lca',
      'src/components/ui/filter-chip.tsx:63 text-status-soon',
      'src/pages/TournamentDetailPage.tsx:831 text-status-open',
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

// ── The pairs the gold work writes (step 25) ──────────────────────────────

/** The utilities the gold work writes, and the token each reads. */
const GOLD_WORDS: Record<string, string> = {
  'text-gold-ink': '--gold-ink',
  'text-gold-ink-badge': '--gold-ink-badge',
  'text-gold-ink-badge-club': '--gold-ink-badge-club',
  'text-gold-on-dark-badge': '--gold-on-dark-badge',
}
const NAVY_BAND = '#1a2744'
/**
 * The home page hero's darkened photo at its lightest, as [r, g, b]: a white
 * pixel through the photo's filter (grayscale 35 per cent, brightness 0.55,
 * contrast 1.05), the brand navy at 55 per cent laid over it with
 * mix-blend-multiply, and the black gradient at its lightest, 10 per cent at
 * the top. HERO_PHOTO is the same as a hex colour.
 */
const HERO_PHOTO_RGB = (() => {
  const white = 255
  const filtered = ((white / 255) * 0.55 - 0.5) * 1.05 * 255 + 0.5 * 255
  const multiplied = hexToRgb(NAVY_BAND).map((c) => 0.45 * filtered + 0.55 * filtered * (c / 255))
  return multiplied.map((c) => c * 0.9)
})()
const HERO_PHOTO = toHex(HERO_PHOTO_RGB)
/** The branch FilterDropdown and MultiSelectDropdown take when their caller says they are drawn on navy. */
const ON_NAVY = "on === 'navy'"

/** The icon components a file can draw: the names it imports from lucide-react, and an icon held in a variable or a prop. */
function iconNames(source: string): Set<string> {
  const names = new Set<string>()
  for (const m of source.matchAll(/import\s*\{([^}]*)\}\s*from\s*'lucide-react'/g)) for (const n of m[1].split(',')) if (n.trim()) names.add(n.trim().split(/\s+as\s+/).pop()!)
  return names
}
const isIcon = (node: JsxNode, icons: Set<string>) => icons.has(node.tag) || /(?:^|\.)icon$/i.test(node.tag) || /Icon$/.test(node.tag)

/** A ground that stays navy: a navy fill, an inline navy, or PageHero, whose ground is navy. */
function staysDark(n: JsxNode): boolean {
  return (
    own(n).some((t) => t.modifier === '' && (t.utility === 'bg-brand-navy' || t.utility === 'bg-lca-navy')) ||
    /backgroundColor:\s*(LCA\.navy|NAVY|['"]#1a2744['"])\s*[,}]/.test(n.style) ||
    n.tag === 'PageHero'
  )
}

/**
 * The dark ground an element is drawn on: the navy, or the home page hero's
 * darkened photo. data-ground="dark" marks a dark ground for the focus ring,
 * not a colour, so on an element with no navy of its own it is the photo,
 * measured over its lightest (HERO_PHOTO), never the navy.
 */
type DarkGround = 'navy' | 'photo'

/** The dark ground an element sits on, up its ancestors or wherever its component is drawn (the same at every place); null for none. */
function darkGroundOf(n: JsxNode, all: JsxNode[], depth = 0): DarkGround | null {
  let top = n
  for (let a: JsxNode | null = n; a; a = a.parent) {
    if (staysDark(a)) return 'navy'
    if (a.ground === 'dark') return 'photo'
    top = a
  }
  if (!top.component || depth > 4) return null
  const uses = all.filter((u) => u.tag === top.component)
  const kinds = new Set(uses.map((u) => darkGroundOf(u, all, depth + 1)))
  return uses.length > 0 && kinds.size === 1 ? [...kinds][0] : null
}

/**
 * The ground scripts/codemods/gold-ink.ts settles under an element, the
 * reading the gold guard places every gold token with: navy or light, or
 * null where it settles none, or where the element is not one it can tell
 * apart (two of its tag start on the line).
 */
function settledGround(tree: Tree, node: JsxNode): 'navy' | 'light' | null {
  const els = tree.files.get(node.file)?.elements.filter((e) => e.line === node.line && e.tag === node.tag) ?? []
  if (els.length !== 1) return null
  const v = groundUnder(tree, els[0])
  return v.ground === 'unplaced' ? null : v.ground
}

/** The dark ground an element sits on: the navy wherever that reading settles one, none where it settles a light ground, and otherwise what this reader finds, the home hero's photo among them. */
function darkOf(tree: Tree, node: JsxNode, all: JsxNode[]): DarkGround | null {
  const settled = settledGround(tree, node)
  return settled === 'navy' ? 'navy' : settled === 'light' ? null : darkGroundOf(node, all)
}

interface GoldPair extends Pair {
  /** The dark ground it is drawn on, which an open stack ends on: the navy or the hero's photo; null for neither. */
  dark: DarkGround | null
  /**
   * The grounds an open stack can end on besides the page and a card: a page
   * draws on its own ground, while a shared component can be drawn on a
   * muted panel or in a menu as well, and so can anything a menu holds.
   */
  anywhere: boolean
}

/** What a menu or popover draws: its own raised ground. */
const MENU = /^(?:Select|Popover|DropdownMenu)Content$/

/** Every pair the gold work writes in one file: each element's gold words or icon on the grounds it can sit on, and each class string no element reads (a badge in an object of strings) on its own grounds. */
function goldPairsOf(file: string, source: string, nodes: JsxNode[], all: JsxNode[], tree: Tree = GOLD_TREE): GoldPair[] {
  const out: GoldPair[] = []
  const icons = iconNames(source)
  const read = new Set<string>()
  for (const node of nodes) {
    for (const piece of node.pieces) {
      if (inactive(piece)) continue
      for (const { token } of tokensOf(piece.text)) {
        const name = GOLD_WORDS[token.utility]
        // The resting colour, and the hover colour, which is words too while the pointer is on them.
        if (!name || !['', 'hover:'].includes(token.variants)) continue
        read.add(piece.text)
        const icon = isIcon(node, icons)
        // The branch a component takes on navy is on navy; its other branch is not, wherever the component is drawn today.
        const dark: DarkGround | null = piece.conditions.includes(ON_NAVY) ? 'navy' : piece.conditions.includes(`!(${ON_NAVY})`) ? null : darkOf(tree, node, all)
        const anywhere = !file.startsWith('src/pages/') || selfAndAncestorsOf(node).some((a) => MENU.test(a.tag))
        for (const s of stacks(node, piece) ?? []) {
          const open = s.length === 0 || s[s.length - 1].alpha < 1
          out.push({ where: `${file}:${node.line} <${node.tag}>`, words: token.text, icon, layers: [{ colour: `var(${name})`, alpha: opacity(token.modifier), icon }, ...s], open, written: true, dark, anywhere })
        }
      }
    }
  }
  for (const str of classStrings(file, source)) {
    if (str.kind !== 'code' || read.has(str.text)) continue
    const tokens = tokensOf(str.text).map(({ token }) => token)
    const grounds = tokens.filter((t) => t.variants === '' && t.bang === '').map(groundOf).filter((g) => g !== null)
    if (grounds.includes('unknown')) continue
    for (const token of tokens) {
      const name = GOLD_WORDS[token.utility]
      if (!name || token.variants !== '') continue
      const layers = grounds as Layer[]
      const open = layers.length === 0 || layers[layers.length - 1].alpha < 1
      out.push({ where: `${file}:${source.slice(0, str.start).split('\n').length} (string)`, words: token.text, icon: false, layers: [{ colour: `var(${name})`, alpha: 1, icon: false }, ...layers], open, written: true, dark: null, anywhere: true })
    }
  }
  return out
}

const ALL_NODES = tsxFiles(ROOT).flatMap((f) => jsxTree(f))
/** The TSX files under src as scripts/codemods/gold-ink.ts reads them. */
const GOLD_TREE = readTree(ROOT)
const goldPairs = (): GoldPair[] => tsxFiles(ROOT).flatMap((file) => goldPairsOf(file, read(file), ALL_NODES.filter((n) => n.file === file), ALL_NODES))

/** The bases an open stack can end on: the navy or the hero's photo for a dark one, else the page and a card, and for what can be drawn anywhere a muted panel and a menu too. */
const basesOf = (pair: GoldPair) =>
  !pair.open
    ? ['--ground']
    : pair.dark === 'navy'
      ? [NAVY_BAND]
      : pair.dark === 'photo'
        ? [HERO_PHOTO]
        : pair.anywhere
          ? ['--ground', '--surface', '--surface-2', '--raised']
          : ['--ground', '--surface']

/** The element and its ancestors, nearest first. */
function selfAndAncestorsOf(node: JsxNode): JsxNode[] {
  const out: JsxNode[] = []
  for (let n: JsxNode | null = node; n; n = n.parent) out.push(n)
  return out
}

/** The ratio a gold pair reaches in a look, on each base it can end on. */
function goldRatios(pair: GoldPair, tokens: Map<string, string>): Array<[string, number]> {
  return basesOf(pair).map((base) => [base, ratio(pair, tokens, base.startsWith('#') ? base : get(tokens, base))])
}

describe('every pair the gold work writes reaches its ratio in every look (step 25)', () => {
  const pairs = goldPairs()
  const heritageFiles = runtimeClosure(heritagePages())

  it('finds the pairs: gold-ink icons on the light grounds, the badges\' words on their tints, the pills on navy', () => {
    const icons = pairs.filter((p) => p.words === 'text-gold-ink' && p.icon)
    expect(new Set(icons.map((p) => p.where)).size).toBeGreaterThanOrEqual(80)
    // Gold-ink words: the word beside the News page's pin, under the new look.
    expect(pairs.filter((p) => p.words === 'text-gold-ink' && !p.icon).map((p) => p.where.split(':')[0])).toEqual(['src/pages/NewsPage.tsx'])
    const has = (file: string, words: string, tint: number) =>
      pairs.some((p) => p.where.startsWith(file) && p.words === words && p.layers.slice(1).some((l) => l.colour === '#c8a94a' && Math.abs(l.alpha - tint) < 1e-9))
    expect(has('src/components/StatusBadge.tsx', 'text-gold-ink-badge', 0.2)).toBe(true)
    expect(has('src/pages/TournamentsPage.tsx', 'text-gold-ink-badge', 0.18)).toBe(true)
    expect(has('src/pages/ClubDetailPage.tsx', 'text-gold-ink-badge-club', 0.15)).toBe(true)
    expect(has('src/components/PageHero.tsx', 'text-gold-on-dark-badge', 0.15)).toBe(true)
    // The light gold of a pill is drawn on a dark ground every time: the navy, or the home page hero's photo.
    const pills = pairs.filter((p) => p.words === 'text-gold-on-dark-badge')
    expect(new Set(pills.map((p) => p.where.split(':')[0]))).toEqual(new Set(['src/components/PageHero.tsx', 'src/pages/ContactPage.tsx', 'src/components/FilterDropdown.tsx', 'src/components/MultiSelectDropdown.tsx', 'src/pages/HomePage.tsx']))
    for (const p of pills) expect(p.dark !== null || !p.open, p.where).toBe(true)
    expect(pills.filter((p) => p.dark === 'photo').map((p) => p.where.split(':')[0])).toEqual(['src/pages/HomePage.tsx'])
  })

  it.each(Object.entries(LOOKS))('%s: icons reach 3:1 and words 4.5:1, on every ground they can sit on', (look, tokens) => {
    const failing = new Map<string, string[]>()
    for (const pair of pairs) {
      // Heritage is drawn only on its six pages, so in heritage only the files they load can stand on its grounds.
      if (look.startsWith('heritage') && !heritageFiles.has(pair.where.split(':')[0])) continue
      for (const [base, r] of goldRatios(pair, tokens)) {
        if (r >= (pair.icon ? 3 : 4.5)) continue
        const key = `${pair.words}${pair.icon ? ' (an icon)' : ''} on ${pair.layers.slice(1).map((l) => `${l.colour}@${l.alpha}`).join(' over ') || 'nothing of its own'} over ${base}: ${r.toFixed(2)}:1`
        failing.set(key, [...(failing.get(key) ?? []), pair.where])
      }
    }
    expect([...failing].map(([k, where]) => `${k}, ${where.length} place(s), such as ${where[0]}`).sort()).toEqual([])
  })

  it('in heritage, the files the heritage pages load hold their gold: the champions\' label and icons, the board\'s icons and link', () => {
    const inHeritage = pairs.filter((p) => heritageFiles.has(p.where.split(':')[0]))
    expect(new Set(inHeritage.map((p) => p.where.split(':')[0]))).toEqual(new Set(['src/pages/AnnualMeetingPage.tsx', 'src/pages/BoardPage.tsx', 'src/pages/ChampionsPage.tsx', 'src/components/PageHero.tsx']))
    for (const [look, tokens] of Object.entries(LOOKS).filter(([look]) => look.startsWith('heritage'))) {
      for (const pair of inHeritage) for (const [base, r] of goldRatios(pair, tokens)) expect(r, `${look} ${pair.where} ${pair.words} over ${base}`).toBeGreaterThanOrEqual(pair.icon ? 3 : 4.5)
    }
  })
})

describe('gold icons and gold words are held to different ratios (step 25)', () => {
  // The planted page puts gold-ink on a gold tint of 20 per cent, once as an
  // icon and once as words: the icon passes at 3:1, the words fail at 4.42:1,
  // and the badge token passes as words at the same tint.
  const planted = (cls: string, tag: string) => [
    "import { Bell } from 'lucide-react'",
    'export function Planted() {',
    `  return <div className="bg-card"><p className="bg-lca-gold/20">{${tag === 'Bell' ? `<Bell className="${cls}" />` : `<span className="${cls}">Words</span>`}}</p></div>`,
    '}',
  ].join('\n')
  const pairsFor = (source: string) => {
    const nodes = jsxTree('src/pages/Planted.tsx', source)
    return goldPairsOf('src/pages/Planted.tsx', source, nodes, nodes)
  }
  const base = LOOKS.base

  it('a gold-ink icon on a 20 per cent gold tint passes at 3:1', () => {
    const [pair] = pairsFor(planted('size-4 text-gold-ink', 'Bell'))
    expect(pair.icon).toBe(true)
    expect(ratio(pair, base, get(base, '--surface'))).toBeCloseTo(4.42, 2)
    expect(ratio(pair, base, get(base, '--surface'))).toBeGreaterThanOrEqual(3)
  })

  it('gold-ink words on the same tint fail at 4.5:1, and the badge token passes there', () => {
    const [words] = pairsFor(planted('text-xs text-gold-ink', 'span'))
    expect(words.icon).toBe(false)
    expect(ratio(words, base, get(base, '--surface'))).toBeLessThan(4.5)
    const [badge] = pairsFor(planted('text-xs text-gold-ink-badge', 'span'))
    expect(ratio(badge, base, get(base, '--surface'))).toBeGreaterThanOrEqual(4.5)
    // On a tint of 25 per cent gold-ink words fall to 4.26:1.
    const quarter: GoldPair = { ...words, layers: [words.layers[0], { colour: '#c8a94a', alpha: 0.25 }, ...words.layers.slice(2)] }
    expect(ratio(quarter, base, get(base, '--surface'))).toBeCloseTo(4.26, 2)
  })

  it('gold-ink on navy fails even as an icon, which is why brand gold stays there', () => {
    expect(contrast(get(base, '--gold-ink'), NAVY_BAND)).toBeCloseTo(2.89, 2)
    expect(contrast(get(base, '--gold-ink'), NAVY_BAND)).toBeLessThan(3)
    expect(contrast('#c8a94a', NAVY_BAND)).toBeCloseTo(6.51, 2)
  })
})

describe('the home page hero\'s pill over its darkened photo (step 25)', () => {
  // The pill sits on a 20 per cent gold tint over the hero photo, which the
  // hero darkens: a CSS filter (grayscale 35 per cent, brightness 0.55,
  // contrast 1.05), the brand navy at 55 per cent laid over it with
  // mix-blend-multiply, and a black gradient of 70 per cent at the bottom to
  // 10 per cent at the top. Over the lightest the photo can get (a white
  // pixel under the top of the gradient, HERO_PHOTO) the light gold #f0d07a
  // still reaches 4.5:1, where brand gold would not, so the pill keeps its
  // light gold.
  const ground = toHex(HERO_PHOTO_RGB.map((c, i) => 0.2 * hexToRgb('#c8a94a')[i] + 0.8 * c))

  it('the hero is the one ground marked data-ground="dark" with no navy of its own, and is drawn with the filter and veils its photo is worked out from', () => {
    expect(ALL_NODES.filter((n) => n.ground === 'dark' && !staysDark(n)).map((n) => n.file)).toEqual(['src/pages/HomePage.tsx'])
    const home = read('src/pages/HomePage.tsx')
    for (const piece of ["filter: 'grayscale(35%) brightness(0.55) contrast(1.05)'", 'bg-brand-navy/55 mix-blend-multiply', 'to-black/10']) expect(home, piece).toContain(piece)
    expect(HERO_PHOTO).toBe('#40444c')
    // The pill is read on the photo, not the navy.
    const pills = goldPairs().filter((p) => p.where.startsWith('src/pages/HomePage.tsx:') && p.words === 'text-gold-on-dark-badge')
    expect(pills).toHaveLength(1)
    expect(pills[0].dark).toBe('photo')
    expect(basesOf(pills[0])).toEqual([HERO_PHOTO])
  })

  it('the light gold reaches 4.5:1 over the lightest the photo gets, and brand gold falls to about 3.1:1', () => {
    const pill = LOOKS.base.get('--gold-on-dark-badge')!
    expect(pill).toBe('#f0d07a')
    expect(contrast(pill, ground)).toBeGreaterThanOrEqual(4.5)
    expect(contrast('#c8a94a', ground)).toBeLessThan(3.5)
    // The token is the same in every look, so the pill reads the same in each.
    for (const [look, tokens] of Object.entries(LOOKS)) expect(tokens.get('--gold-on-dark-badge'), look).toBe(pill)
  })
})

// ── The brand gold step 25 keeps (step 25) ────────────────────────────────

/** Brand gold as a text class. */
const BRAND_GOLD_TEXT = ['text-lca', '-gold'].join('')

/**
 * The grounds a state form of a words class shows on: the element's own
 * grounds under the same variants (a white veil on hover), which take the
 * place of its resting ground, as a second background colour does.
 */
function stateLayers(node: JsxNode, piece: Piece, variants: string): Layer[] {
  return node.pieces
    .filter((p) => p === piece || !exclusive(p, piece))
    .flatMap((p) => tokensOf(p.text).map(({ token }) => token))
    .filter((t) => t.variants === variants && t.bang === '')
    .map(groundOf)
    .filter((g): g is Layer => g !== null && g !== 'unknown')
}

interface KeptGold {
  where: string
  words: string
  icon: boolean
  alpha: number
  /** The dark ground it sits on, as test/unit/helpers/jsxClasses.ts reads it: the navy, the hero's photo, or null for neither. */
  dark: DarkGround | null
  /** The stacks it can sit on, top first, or null when a ground this reader cannot place is part of one. */
  stacks: Layer[][] | null
  /** A string no element reads (a tone in an object of strings), which an allowlist entry places on navy. */
  string: boolean
}

/** Every brand gold text class left in the TSX files (or the files given), read with the other reader: each element's, and each string no element reads. */
function keptGold(files = tsxFiles(ROOT), sourceOf: (file: string) => string = read, nodes: JsxNode[] = ALL_NODES): KeptGold[] {
  const out: KeptGold[] = []
  for (const file of files) {
    const source = sourceOf(file)
    const icons = iconNames(source)
    const readStrings = new Set<string>()
    for (const node of nodes.filter((n) => n.file === file)) {
      for (const piece of node.pieces) {
        for (const { token } of tokensOf(piece.text)) {
          if (token.utility !== BRAND_GOLD_TEXT) continue
          readStrings.add(piece.text)
          // A state form with a ground of its own state shows on that ground, over what is under the element.
          const state = token.variants === '' ? [] : stateLayers(node, piece, token.variants)
          const under = state.length > 0 ? stacks(node.parent) : stacks(node, piece)
          out.push({
            where: `${file}:${node.line} <${node.tag}>`,
            words: token.text,
            icon: isIcon(node, icons),
            alpha: opacity(token.modifier),
            dark: darkGroundOf(node, nodes),
            stacks: under && under.map((s) => [...state, ...s]),
            string: false,
          })
        }
      }
    }
    for (const str of classStrings(file, source)) {
      if (str.kind !== 'code' || readStrings.has(str.text)) continue
      const tokens = tokensOf(str.text).map(({ token }) => token)
      const grounds = tokens.filter((t) => t.variants === '' && t.bang === '').map(groundOf).filter((g) => g !== null)
      for (const token of tokens) {
        if (token.utility !== BRAND_GOLD_TEXT) continue
        out.push({
          where: `${file}:${source.slice(0, str.start).split('\n').length} (string)`,
          words: token.text,
          icon: false,
          alpha: opacity(token.modifier),
          dark: null,
          stacks: grounds.includes('unknown') ? null : [grounds as Layer[]],
          string: true,
        })
      }
    }
  }
  return out
}

/** The kept uses that fall below 4.5:1 as words or 3:1 as an icon in a look, each over the tints between it and its open stack's base: the navy, or the hero's photo for a use drawn on it. */
function keptFailures(kept: KeptGold[], tokens: Map<string, string>, gold: string): string[] {
  const failing: string[] = []
  for (const k of kept) {
    for (const s of k.stacks ?? []) {
      const open = s.length === 0 || s[s.length - 1].alpha < 1
      const pair: Pair = { where: k.where, words: k.words, icon: k.icon, layers: [{ colour: gold, alpha: k.alpha, icon: k.icon }, ...s], open, written: false }
      const base = !open ? get(tokens, '--ground') : k.dark === 'photo' ? HERO_PHOTO : NAVY_BAND
      const r = ratio(pair, tokens, base)
      if (r < (k.icon ? 3 : 4.5)) failing.push(`${k.where} ${k.words}${k.icon ? ' (an icon)' : ''} on ${s.map((l) => `${l.colour}@${l.alpha}`).join(' over ') || (k.dark === 'photo' ? 'the hero\'s photo' : 'the navy')}: ${r.toFixed(2)}:1`)
    }
  }
  return failing
}

describe('the brand gold step 25 keeps reaches its ratio on the ground it is kept on, in every look (step 25)', () => {
  // scripts/codemods/gold-ink.ts keeps text-lca-gold wherever it reads the
  // ground as navy or dark. This reads the same uses with the other reader,
  // test/unit/helpers/jsxClasses.ts, and measures them: each element's use
  // sits on a ground that stays dark (a navy fill, an inline navy or
  // PageHero, on the element, an ancestor or wherever its component is
  // drawn), and the two strings no element reads are the allowlist's,
  // measured on their own tint over the navy. Brand gold and the navy are
  // fixed in every look, so each use, over the tints between it and the navy
  // (a hover form on the hover veil of its own element, which takes the place
  // of its resting veil), reaches 4.5:1 as words and 3:1 as an icon in every
  // look. A ground marked data-ground="dark" with no navy of its own is the
  // home page hero's darkened photo, and a use there would be measured over
  // its lightest, where brand gold words read 4.29:1 and fail.
  const kept = keptGold()
  const gold = BRAND.decls.get('--color-lca-gold')

  it('finds every use the guard keeps: brand gold on the navy header, footer and heroes, and the allowlist\'s two strings', () => {
    expect(gold).toBe('#c8a94a')
    // The 53 the guard counts: 51 placed on navy or a dark ground, and the allowlist's 2.
    expect(kept).toHaveLength(53)
    const files = new Set(kept.map((k) => k.where.split(':')[0]))
    expect(files.size).toBe(21)
    for (const file of ['src/components/layout/Navbar.tsx', 'src/components/layout/Footer.tsx', 'src/components/PageHero.tsx', 'src/pages/ClubDetailPage.tsx', 'src/pages/TournamentsPage.tsx']) expect(files, file).toContain(file)
    expect(kept.filter((k) => k.string).map((k) => k.where.split(':')[0]).sort()).toEqual(GOLD_ALLOWLIST.flatMap((e) => Array.from({ length: e.count }, () => e.file)).sort())
    // The forms the header uses: hover forms and the one /90.
    expect(kept.some((k) => k.words === `hover:${BRAND_GOLD_TEXT}`)).toBe(true)
    expect(kept.some((k) => k.words === `${BRAND_GOLD_TEXT}/90`)).toBe(true)
  })

  it('this reader too finds every element\'s use on a ground that stays dark, and can measure each', () => {
    expect(kept.filter((k) => !k.string && !k.dark).map((k) => `${k.where} ${k.words}`)).toEqual([])
    expect(kept.filter((k) => k.stacks === null || k.stacks.length === 0).map((k) => `${k.where} ${k.words}`)).toEqual([])
  })

  it.each(Object.entries(LOOKS))('%s: brand gold reaches 4.5:1 as words and 3:1 as an icon, on navy and every tint over it', (_look, tokens) => {
    expect(keptFailures(kept, tokens, gold!)).toEqual([])
  })

  it('finds brand gold words planted on the home page hero\'s darkened photo on the photo, not the navy, where they fall below 4.5:1 in every look', () => {
    // The hero's shape: data-ground="dark" on the outer element, with the
    // navy veil a sibling of the words, not an ancestor.
    const source = [
      'export function Planted() {',
      '  return (',
      '    <div className="relative overflow-hidden" style={{ height: 420 }} data-ground="dark">',
      '      <div className="absolute inset-0 bg-brand-navy/55 mix-blend-multiply" />',
      `      <p className="text-sm ${BRAND_GOLD_TEXT}">Louisiana's chess community since 1915</p>`,
      '    </div>',
      '  )',
      '}',
    ].join('\n')
    const nodes = jsxTree('src/pages/Planted.tsx', source)
    const planted = keptGold(['src/pages/Planted.tsx'], () => source, nodes)
    expect(planted.map((k) => [k.words, k.dark])).toEqual([[BRAND_GOLD_TEXT, 'photo']])
    for (const [look, tokens] of Object.entries(LOOKS)) {
      expect(keptFailures(planted, tokens, gold!), look).toEqual([`src/pages/Planted.tsx:5 <p> ${BRAND_GOLD_TEXT} on the hero's photo: 4.29:1`])
    }
    // Taken for the navy, as the reading did before, the same words would pass at 6.51:1.
    expect(contrast(gold!, NAVY_BAND)).toBeCloseTo(6.51, 2)
  })

  it('the tightest it gets is words on a 20 per cent gold tint over the navy, which still reach 4.5:1', () => {
    const tinted: Pair = { where: 'planted', words: BRAND_GOLD_TEXT, icon: false, layers: [{ colour: '#c8a94a', alpha: 1, icon: false }, { colour: '#c8a94a', alpha: 0.2 }], open: true, written: false }
    expect(ratio(tinted, LOOKS.base, NAVY_BAND)).toBeCloseTo(4.52, 2)
    // On the white veil of a hovered menu row, and at 90 per cent on the navy.
    const veil: Pair = { ...tinted, layers: [{ colour: '#c8a94a', alpha: 1, icon: false }, { colour: '#ffffff', alpha: 0.1 }] }
    expect(ratio(veil, LOOKS.base, NAVY_BAND)).toBeGreaterThanOrEqual(4.5)
    const faded: Pair = { ...tinted, layers: [{ colour: '#c8a94a', alpha: 0.9, icon: false }] }
    expect(ratio(faded, LOOKS.base, NAVY_BAND)).toBeGreaterThanOrEqual(4.5)
  })
})

describe('the LCA pill on /tournaments in dark mode (step 25)', () => {
  // The one colour-contrast failure the dark spot run had left at step 24:
  // the LCA pill of the tournaments banner, its words on an 18 per cent gold
  // tint inside the banner's 10 per cent gold tint over the page. As
  // #7a5c00 the words read under 2:1 on the dark ground. As
  // text-gold-ink-badge they are brand gold in dark mode and reach 4.5:1 on
  // every ground the page can give, and stay the dark gold of the light look
  // on a light device.
  const pill = goldPairs().filter((p) => p.where.startsWith('src/pages/TournamentsPage.tsx:646 '))

  it('is the pill the pages draw: badge words on 18 per cent gold over the banner\'s 10 per cent, with the page under it', () => {
    expect(pill).toHaveLength(1)
    expect(pill[0].words).toBe('text-gold-ink-badge')
    expect(pill[0].icon).toBe(false)
    expect(pill[0].layers.slice(1)).toEqual([{ colour: '#c8a94a', alpha: 0.18, written: false }, { colour: '#c8a94a', alpha: 0.1, written: false }])
    expect(pill[0].open).toBe(true)
  })

  it('reaches 4.5:1 in dark mode on each ground it can sit on, where the old dark gold read under 2:1', () => {
    for (const [base, r] of goldRatios(pill[0], LOOKS.dark)) expect(r, base).toBeGreaterThanOrEqual(4.5)
    const before: Pair = { ...pill[0], layers: [{ colour: ['#7a', '5c00'].join(''), alpha: 1, icon: false }, ...pill[0].layers.slice(1)] }
    expect(ratio(before, LOOKS.dark, get(LOOKS.dark, '--ground'))).toBeLessThan(2)
    // On a light device it keeps 4.5:1 too.
    for (const [base, r] of goldRatios(pill[0], LOOKS.base)) expect(r, base).toBeGreaterThanOrEqual(4.5)
  })
})

describe('the check of the gold pairs catches a gold token on the wrong ground (step 25)', () => {
  // test/unit/goldText.test.ts holds every gold token to its kind of ground
  // with the reading of scripts/codemods/gold-ink.ts. The pairs above measure
  // each on the grounds they read, so these plant each on the wrong ground
  // and find the pair failing too: the badges' dark gold words on the navy,
  // where the light look's #705718 reads about 2.2:1, and the pill's light
  // gold on a card, about 1.5:1; and a badge passed into a wrapper component
  // that paints navy, which only the codemod's reading follows.
  const pairsFor = (body: string) => {
    const source = `export function Planted() {\n  return (\n    <main>\n      ${body}\n    </main>\n  )\n}\n`
    const nodes = jsxTree('src/pages/Planted.tsx', source)
    return goldPairsOf('src/pages/Planted.tsx', source, nodes, nodes)
  }
  const worst = (pairs: GoldPair[], tokens: Map<string, string>) => Math.min(...pairs.flatMap((p) => goldRatios(p, tokens).map(([, r]) => r)))

  it.each([
    ['the badge words on a navy band', '<section className="bg-brand-navy"><span className="text-xs text-gold-ink-badge">Words</span></section>', 2.16],
    ['the club badge\'s words on a navy band', '<section className="bg-brand-navy"><span className="text-xs text-gold-ink-badge-club">Words</span></section>', 2.16],
    ['gold-ink words on a navy band', '<section className="bg-brand-navy"><span className="text-xs text-gold-ink">Words</span></section>', 2.89],
    ['the pill\'s light gold on a card', '<div className="bg-card"><span className="text-xs text-gold-on-dark-badge">Words</span></div>', 1.5],
  ])('%s fails in the light look', (_, body, about) => {
    const pairs = pairsFor(body)
    expect(pairs.length).toBeGreaterThan(0)
    const r = worst(pairs, LOOKS.base)
    expect(r).toBeLessThan(3)
    expect(r).toBeCloseTo(about, 1)
  })

  it('a badge\'s words on a navy band are found on the navy when the component is drawn there', () => {
    const pairs = pairsFor('<section className="bg-brand-navy"><Tag /></section>')
    expect(pairs).toEqual([])
    const source = 'function Tag() {\n  return <span className="text-xs text-gold-ink-badge">Words</span>\n}\nexport function Planted() {\n  return <section className="bg-brand-navy"><Tag /></section>\n}\n'
    const nodes = jsxTree('src/pages/Planted.tsx', source)
    const found = goldPairsOf('src/pages/Planted.tsx', source, nodes, nodes)
    expect(found).toHaveLength(1)
    expect(found[0].dark).toBe('navy')
    expect(worst(found, LOOKS.base)).toBeLessThan(3)
  })

  it('a badge\'s words passed into a wrapper component that paints navy are measured on the navy, where the guard places them', () => {
    const band = "import type { ReactNode } from 'react'\nexport function Band({ children }: { children: ReactNode }) {\n  return <section className=\"bg-brand-navy px-4\">{children}</section>\n}\n"
    const user = "import { Band } from '@/components/Band'\nexport function Planted() {\n  return <Band><span className=\"text-xs text-gold-ink-badge\">Opens soon</span></Band>\n}\n"
    const files: Record<string, string> = { 'src/components/Band.tsx': band, 'src/pages/Planted.tsx': user }
    const tree: Tree = { root: '', files: new Map(Object.entries(files).map(([f, s]) => [f, parseFile(f, s)])) }
    const nodes = Object.entries(files).flatMap(([f, s]) => jsxTree(f, s))
    const mine = nodes.filter((n) => n.file === 'src/pages/Planted.tsx')
    const found = goldPairsOf('src/pages/Planted.tsx', user, mine, nodes, tree)
    expect(found).toHaveLength(1)
    expect(found[0].dark).toBe('navy')
    expect(worst(found, LOOKS.base)).toBeCloseTo(2.16, 1)
    // Read by this reader alone, the same words were measured on the page, at 6.85:1.
    const alone = goldPairsOf('src/pages/Planted.tsx', user, mine, nodes, { root: '', files: new Map() })
    expect(alone[0].dark).toBeNull()
    expect(worst(alone, LOOKS.base)).toBeCloseTo(6.85, 1)
  })
})
