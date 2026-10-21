// The design tokens in src/index.css (WS01 step 21).
//
// - With newLook off (no data-look on <html>), every semantic token has the
//   value the site shows today: --focus is the very ring ring-ring/50 draws,
//   as Tailwind compiles it, and --font-mono-face is Tailwind's own
//   monospace stack, so the eighteen font-mono uses keep the device's font.
// - With newLook on, the base, dark, live, scholastic and heritage tokens are
//   the values of the brief and the Looks tile boards, the shadcn variables
//   point at them, and data-theme="" puts the base look back.
// - Nothing outside the legacy :root and .dark blocks applies without
//   data-look="new", and Geist Mono is named nowhere else. The one exception
//   (step 24) is the block for browsers that cannot mix colours, which gives
//   a token class with an opacity modifier the tint its old class fell back to.
// - The tone tokens (step 24): with newLook off each is exactly the Tailwind
//   colour it stands for; under the new look each is its tone's tint or
//   words in every look, and heritage restyles none of them. The scanner's
//   move marks and the check-in toggle's fill, which are not tags, are
//   exactly their Tailwind colours with newLook off too, and take values of
//   their own under the new look.
// - A printed page takes the light look (step 24): the dark look, the live
//   look and heritage in dark mode apply on screens only, so a sheet printed
//   from a dark device puts dark words on the white paper.
// - Light islands (step 24): the words and the veil on a ground that stays
//   light in every look are today's muted words and muted ground with
//   newLook off, and the light look's in every look and mode under it.
// - The gold words tokens (step 25): with newLook off each is the hex colour
//   the class it replaced spelled, and --gold-ink is brand gold, the colour
//   text-lca-gold paints; under the new look the dark gold words on a gold
//   tint are the soon tag's words on the light looks and brand gold on the
//   dark ones, and the light gold of a pill on a dark ground stays as it is
//   in every look.
//
// Contrast is in contrast.test.ts; the browser check is test/a11y/tokens.spec.ts.
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { compile } from 'tailwindcss'
import { describe, expect, it } from 'vitest'
import { contrast, indexCssRules, parseRules, read, ROOT, rootTokens, SCREEN_ONLY, scopeTokens, specificity, stripComments, type RootState } from './helpers/cssTokens'
import { HEX_TOKENS, TONE_FAMILY, TONE_TINT, TONE_WORDS, tailwindColour, toneTokens } from './helpers/tones'

/** The at-rule of the block for browsers that cannot mix colours. */
const NO_COLOR_MIX = '@supports not (color: color-mix(in lab, red, red))'

const css = read('src/index.css')
const rules = indexCssRules()
const TODAY: RootState = { look: false, dark: false }
const LIGHT: RootState = { look: true, dark: false }
const DARK: RootState = { look: true, dark: true }

/** The value a property has in Tailwind's default theme. */
const tailwindTheme = (name: string) => {
  const theme = read('node_modules/tailwindcss/theme.css')
  const m = theme.match(new RegExp(`${name}:\\s*([^;]+);`))
  if (!m) throw new Error(`${name} not in tailwindcss/theme.css`)
  return m[1].trim().replace(/\s+/g, ' ')
}

/** The block of one selector, taken whole. */
const block = (selector: string) => {
  const found = rules.filter((r) => r.selectors.includes(selector) && !r.within)
  if (found.length === 0) throw new Error(`no rule for ${selector}`)
  return found
}

const SEMANTIC = [
  '--ground', '--surface', '--surface-2', '--raised', '--ink', '--ink-muted', '--hairline', '--field',
  '--ok', '--bad', '--gold', '--gold-ink', '--gold-on-dark', '--focus', '--font-mono-face',
]
const STATUSES = ['open', 'soon', 'full', 'waitlist', 'closed', 'live', 'partner', 'lca']
const STATUS_TOKENS = STATUSES.flatMap((s) => [`--status-${s}`, `--status-${s}-tint`])

describe('the legacy tokens: newLook off', () => {
  const today = rootTokens(rules, TODAY)
  const legacyRoot = rules.find((r) => r.selector === ':root')!

  it('the plain :root block comes first and the stock .dark block after it, as baseline checks expect', () => {
    const rootAt = css.search(/^:root \{/m)
    const darkAt = css.search(/^\.dark \{/m)
    expect(rootAt).toBeGreaterThan(0)
    expect(darkAt).toBeGreaterThan(rootAt)
    // No new-look block sits between them.
    expect(css.slice(rootAt, darkAt)).not.toContain('data-look')
    // The stock values the baseline was recorded with are unchanged.
    expect(legacyRoot.decls.get('--background')).toBe('oklch(1 0 0)')
    expect(legacyRoot.decls.get('--foreground')).toBe('oklch(0.145 0 0)')
    expect(legacyRoot.decls.get('--border')).toBe('oklch(0.922 0 0)')
    expect(legacyRoot.decls.get('--muted-foreground')).toBe('oklch(0.556 0 0)')
    expect(legacyRoot.decls.get('--ring')).toBe('oklch(0.708 0 0)')
    expect(block('.dark')[0].decls.get('--ring')).toBe('oklch(0.556 0 0)')
  })

  it('defines every semantic and status token on the plain :root, so every utility works everywhere', () => {
    for (const name of [...SEMANTIC, ...STATUS_TOKENS]) expect(legacyRoot.decls.has(name), name).toBe(true)
    // And every token utility in @theme inline names a token defined there.
    const inline = rules.find((r) => r.selector === '@theme inline')!
    for (const [prop, value] of inline.decls) {
      const named = value.match(/^var\((--[\w-]+)\)$/)?.[1]
      if (!named || !prop.startsWith('--color-') || prop.startsWith('--color-sidebar') || prop.startsWith('--color-chart')) continue
      expect(today.has(named), `${prop} reads ${named}`).toBe(true)
    }
  })

  it('gives the semantic tokens the values today\'s shadcn and brand variables hold', () => {
    expect(today.get('--ground')).toBe(legacyRoot.decls.get('--background'))
    expect(today.get('--raised')).toBe(legacyRoot.decls.get('--popover'))
    expect(today.get('--surface')).toBe('#fff')
    expect(legacyRoot.decls.get('--card')).toBe('oklch(1 0 0)') // the same white
    expect(today.get('--surface-2')).toBe(legacyRoot.decls.get('--muted'))
    expect(today.get('--ink-muted')).toBe(legacyRoot.decls.get('--muted-foreground'))
    expect(today.get('--hairline')).toBe(legacyRoot.decls.get('--border'))
    expect(today.get('--field')).toBe(legacyRoot.decls.get('--input'))
    expect(today.get('--bad')).toBe(legacyRoot.decls.get('--destructive'))
    const brand = rules.find((r) => r.selector === '@theme')!
    expect(today.get('--ink')).toBe('#1a2744')
    expect(today.get('--ink')).toBe(brand.decls.get('--color-lca-navy'))
    for (const gold of ['--gold', '--gold-ink', '--gold-on-dark']) {
      expect(today.get(gold), gold).toBe('#c8a94a')
      expect(today.get(gold)).toBe(brand.decls.get('--color-lca-gold'))
    }
  })

  it('gives the status tokens the light tones StatusBadge draws today', () => {
    const badge = read('src/components/StatusBadge.tsx')
    expect(badge).toContain("emerald: 'bg-emerald-100 text-emerald-800'")
    expect(badge).toContain("red: 'bg-red-100 text-red-700'")
    expect(badge).toContain("blue: 'border border-blue-200 bg-blue-50 text-blue-800'")
    // The gold tone's words moved to the gold-ink-badge token in step 25,
    // whose plain value is the hex the tone spelled before (the gold words
    // tokens below); --status-soon has that hex too.
    expect(badge).toContain("gold: 'bg-lca-gold/20 text-gold-ink-badge'")
    expect(today.get('--gold-ink-badge')).toBe(today.get('--status-soon'))
    expect(today.get('--ok')).toBe(tailwindTheme('--color-emerald-800'))
    expect(today.get('--status-open')).toBe(tailwindTheme('--color-emerald-800'))
    expect(today.get('--status-open-tint')).toBe(tailwindTheme('--color-emerald-100'))
    for (const s of ['full', 'waitlist', 'live']) {
      expect(today.get(`--status-${s}`), s).toBe(tailwindTheme('--color-red-700'))
      expect(today.get(`--status-${s}-tint`), s).toBe(tailwindTheme('--color-red-100'))
    }
    expect(today.get('--status-partner')).toBe(tailwindTheme('--color-blue-800'))
    expect(today.get('--status-partner-tint')).toBe(tailwindTheme('--color-blue-50'))
    expect(today.get('--status-soon')).toBe('#7a5c00')
    expect(today.get('--status-soon-tint')).toBe('color-mix(in oklab, #c8a94a 20%, transparent)')
    expect(today.get('--status-closed')).toBe(legacyRoot.decls.get('--muted-foreground'))
    expect(today.get('--status-closed-tint')).toBe(legacyRoot.decls.get('--muted'))
  })

  it('--focus is exactly the ring ring-ring/50 draws, as Tailwind compiles it', async () => {
    const compiler = await compile('@theme inline { --color-ring: var(--ring); } @tailwind utilities;', {
      base: ROOT,
      loadStylesheet: async () => ({ content: '', base: ROOT, path: '' }),
    })
    const out = compiler.build(['focus-visible:ring-ring/50'])
    const mixed = out.match(/--tw-ring-color:\s*(color-mix\([^;]+\));/)?.[1]
    expect(mixed).toBe('color-mix(in oklab, var(--ring) 50%, transparent)')
    expect(legacyRoot.decls.get('--focus')).toBe(mixed)
    expect(today.get('--focus')).toBe('color-mix(in oklab, oklch(0.708 0 0) 50%, transparent)')
  })

  it('--font-mono-face is Tailwind\'s own monospace stack, and font-mono reads it', () => {
    expect(today.get('--font-mono-face')).toBe(tailwindTheme('--font-mono'))
    expect(today.get('--font-mono-face')).toMatch(/^ui-monospace, .*monospace$/)
    const inline = rules.find((r) => r.selector === '@theme inline')!
    expect(inline.decls.get('--font-mono')).toBe('var(--font-mono-face)')
    // The sans face is unchanged.
    expect(inline.decls.get('--font-sans')).toBe("'Geist Variable', sans-serif")
  })

  it('the Button reads --focus for its glow, so with newLook off it draws today\'s ring', () => {
    const button = read('src/components/ui/button.tsx')
    expect(button).toContain('focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-focus ')
    expect(button).not.toContain('ring-ring/50')
    const inline = rules.find((r) => r.selector === '@theme inline')!
    expect(inline.decls.get('--color-focus')).toBe('var(--focus)')
    // The Badge keeps its full-strength ring-ring, which points at --focus under the new look.
    const badge = read('src/components/ui/badge.tsx')
    expect(badge).toContain('focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2')
  })
})

describe('the gate: nothing new applies without data-look="new"', () => {
  it('every rule outside the legacy blocks, @theme, @layer base and the no-colour-mix block starts with :root[data-look="new"]', () => {
    for (const rule of rules) {
      if (rule.selector.startsWith('@theme')) continue
      if (rule.within.startsWith('@layer')) continue
      if (rule.within === NO_COLOR_MIX) continue
      if (rule.selector === ':root' || rule.selector === '.dark') continue
      for (const sel of rule.selectors) {
        expect(sel.startsWith(':root[data-look="new"]'), `${rule.within} ${sel}`).toBe(true)
      }
    }
  })

  it('the no-colour-mix block only gives a token class with an opacity modifier a plain #rrggbbaa tint', () => {
    // What each rule's tint is, and that it is the old class's fallback, is
    // semantic-map.test.ts's to check; here, that the block can do nothing else.
    const block = rules.filter((r) => r.within === NO_COLOR_MIX)
    expect(block.length).toBeGreaterThan(0)
    for (const rule of block) {
      expect(rule.selectors, rule.selector).toHaveLength(1)
      // One class: a token utility with an escaped opacity modifier, perhaps a hover or focus variant.
      expect(rule.selector).toMatch(/^\.(?:(?:hover|focus)\\:)?(?:bg|border)-[a-z-]+\\\/(?:\d+|\\\[0\\\.\d+\\\])(?::hover|:focus)?$/)
      expect([...rule.decls.keys()]).toHaveLength(1)
      const [[property, value]] = [...rule.decls]
      expect(['background-color', 'border-color'], rule.selector).toContain(property)
      expect(value, rule.selector).toMatch(/^#[0-9a-f]{8}$/)
    }
    // The hover forms sit inside @media (hover: hover), as Tailwind's own hover utilities do.
    const hover = stripComments(css).match(/@media \(hover: hover\) \{\s*@supports not \(color: color-mix\(in lab, red, red\)\) \{([^}]*\}[^}]*)\}/)?.[1] ?? ''
    for (const rule of block.filter((r) => r.selector.endsWith(':hover'))) expect(hover, rule.selector).toContain(rule.selector)
  })

  it('the dark variant matches .dark on <html> itself as well as inside it', () => {
    expect(stripComments(css)).toContain('@custom-variant dark (&:where(.dark, .dark *));')
  })

  it('the base layer is unchanged', () => {
    const base = rules.filter((r) => r.within === '@layer base')
    expect(base.map((r) => r.selector)).toEqual(['*', 'body', 'html'])
    expect(stripComments(css)).toMatch(/@apply border-border outline-ring\/50;/)
    expect(stripComments(css)).toMatch(/@apply bg-background text-foreground;/)
  })
})

describe('the new look: newLook on', () => {
  const base = rootTokens(rules, LIGHT)
  const dark = rootTokens(rules, DARK)

  it('base is Looks-3 Minimal: navy ink, white and #f7f8fa surfaces, #e5e7ed borders, #5b6478 muted', () => {
    expect(Object.fromEntries(SEMANTIC.map((k) => [k, base.get(k)]))).toEqual({
      '--ground': '#fff',
      '--surface': '#fff',
      '--surface-2': '#f7f8fa',
      '--raised': '#fff',
      '--ink': '#1a2744',
      '--ink-muted': '#5b6478',
      '--hairline': '#e5e7ed',
      '--field': '#7c8496',
      '--ok': '#047857',
      '--bad': '#c0362c',
      '--gold': '#c8a94a',
      '--gold-ink': '#866a1e',
      '--gold-on-dark': '#c8a94a',
      '--focus': '#1a2744',
      '--font-mono-face': "'Geist Mono Variable', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
    })
  })

  it('the base status tags are the Looks-3 tile\'s', () => {
    const tags = Object.fromEntries(STATUSES.map((s) => [s, [base.get(`--status-${s}`), base.get(`--status-${s}-tint`)]]))
    expect(tags).toEqual({
      open: ['#047857', '#e8f5ef'],
      soon: ['#705718', '#fbf7e9'],
      full: ['#c0362c', '#fdeeec'],
      waitlist: ['#c0362c', '#fdeeec'],
      closed: ['#5b6478', '#f7f8fa'],
      live: ['#fff', '#c0362c'],
      partner: ['#1a2744', '#eef1f6'],
      lca: ['#fff', '#1a2744'],
    })
  })

  it('dark is the Looks-3 dark palette', () => {
    expect(dark.get('--ground')).toBe('#0b1220')
    expect(dark.get('--surface')).toBe('#111a2c')
    expect(dark.get('--raised')).toBe('#1a2744')
    expect(dark.get('--ink')).toBe('#e8ecf4')
    expect(dark.get('--ink-muted')).toBe('#9aa6bf')
    expect(dark.get('--gold')).toBe('#c8a94a')
    expect(dark.get('--gold-ink')).toBe('#c8a94a')
    expect(dark.get('--field')).toBe('#5f6d89')
    expect(dark.get('--ok')).toBe('#3ecf8e')
    expect(dark.get('--bad')).toBe('#ff6b6b')
    expect(dark.get('--focus')).toBe('#c8a94a')
    expect(dark.get('--hairline')).toBe('rgb(255 255 255 / 8%)')
  })

  it('the shadcn variables point at the tokens, and outrank the stock .dark block', () => {
    for (const [tokens, ground, ink] of [[base, '#fff', '#1a2744'], [dark, '#0b1220', '#e8ecf4']] as const) {
      expect(tokens.get('--background')).toBe(ground)
      expect(tokens.get('--foreground')).toBe(ink)
      expect(tokens.get('--card')).toBe(tokens.get('--surface'))
      expect(tokens.get('--popover')).toBe(tokens.get('--raised'))
      expect(tokens.get('--muted-foreground')).toBe(tokens.get('--ink-muted'))
      expect(tokens.get('--border')).toBe(tokens.get('--hairline'))
      expect(tokens.get('--input')).toBe(tokens.get('--field'))
      expect(tokens.get('--ring')).toBe(tokens.get('--focus'))
      expect(tokens.get('--destructive')).toBe(tokens.get('--bad'))
    }
    // No stock grey survives the new dark look in a variable the shadcn components read.
    const stockDark = block('.dark')[0]
    for (const name of stockDark.decls.keys()) {
      if (name.startsWith('--chart-')) continue
      expect(dark.get(name), name).not.toBe(stockDark.decls.get(name))
    }
  })

  it('live is Looks-7 Broadcast, dark in either mode, with gold focus', () => {
    for (const state of [LIGHT, DARK]) {
      const live = scopeTokens(rules, state, 'live')
      expect(live.get('--ground')).toBe('#070b14')
      expect(live.get('--surface')).toBe('#0e1526')
      expect(live.get('--raised')).toBe('#1a2744')
      expect(live.get('--ink')).toBe('#f3f5f9')
      expect(live.get('--ink-muted')).toBe('#8e9ab2')
      expect(live.get('--gold')).toBe('#c8a94a')
      expect(live.get('--gold-hi')).toBe('#e5c768')
      expect(live.get('--live')).toBe('#ff4757')
      expect(live.get('--win')).toBe('#34d399')
      expect(live.get('--loss')).toBe('#ff6b6b')
      expect(live.get('--draw')).toBe('#a7b0c2')
      expect(live.get('--focus')).toBe('#c8a94a')
      expect(live.get('--background')).toBe('#070b14')
      expect(live.get('--foreground')).toBe('#f3f5f9')
      expect(live.get('--status-live')).toBe('#070b14')
      expect(live.get('--status-live-tint')).toBe('#ff4757')
    }
  })

  it('scholastic is Looks-6: cream ground, navy ink, the tile\'s section hues, base status tags', () => {
    const schol = scopeTokens(rules, LIGHT, 'scholastic')
    expect(schol.get('--ground')).toBe('#fffaf1')
    expect(schol.get('--ink')).toBe('#1a2744')
    expect(schol.get('--ink-muted')).toBe('#4f5b75')
    expect(schol.get('--gold-ink')).toBe('#866a1e')
    expect(schol.get('--gold-tile')).toBe('#fdf1cc')
    expect([schol.get('--coral'), schol.get('--coral-tile')]).toEqual(['#b23e1a', '#ffe4da'])
    expect([schol.get('--mint'), schol.get('--mint-tile')]).toEqual(['#1f7a55', '#dcf5e9'])
    expect([schol.get('--sky'), schol.get('--sky-tile')]).toEqual(['#2563c9', '#e3eeff'])
    expect([schol.get('--grape'), schol.get('--grape-tile')]).toEqual(['#6a3fc1', '#eee6ff'])
    expect(schol.get('--focus')).toBe('#1a2744')
    expect(schol.get('--background')).toBe('#fffaf1')
    for (const name of STATUS_TOKENS) expect(schol.get(name), name).toBe(base.get(name))
  })

  it('heritage is Looks-1: paper, card, inset, hairline, field border and --gold-ink #705718, nothing else restyled', () => {
    const heritage = scopeTokens(rules, LIGHT, 'heritage')
    expect(heritage.get('--ground')).toBe('#f7f3e8')
    expect(heritage.get('--surface')).toBe('#fffdf8')
    expect(heritage.get('--surface-2')).toBe('#ece4d0')
    expect(heritage.get('--ink')).toBe('#1a2744')
    expect(heritage.get('--ink-muted')).toBe('#5e5a52')
    expect(heritage.get('--hairline')).toBe('#d8cdb4')
    expect(heritage.get('--field')).toBe('#857d6b')
    expect(heritage.get('--gold-ink')).toBe('#705718')
    expect(heritage.get('--baize')).toBe('#2d5a45')
    expect(heritage.get('--claret')).toBe('#8a2b38')
    expect(base.get('--gold-ink')).toBe('#866a1e')
    // Heritage never restyles the focus ring or the status tags.
    expect(heritage.get('--focus')).toBe(base.get('--focus'))
    for (const name of STATUS_TOKENS) expect(heritage.get(name), name).toBe(base.get(name))
  })

  it('heritage under .dark keeps the Minimal dark grounds', () => {
    const heritageDark = scopeTokens(rules, DARK, 'heritage')
    for (const name of ['--ground', '--surface', '--surface-2', '--raised', '--ink', '--ink-muted', '--hairline', '--field', '--gold-ink', '--focus']) {
      expect(heritageDark.get(name), name).toBe(dark.get(name))
    }
    expect(heritageDark.get('--background')).toBe('#0b1220')
  })

  it('data-theme="" is the base look again, light and dark', () => {
    for (const [state, root] of [[LIGHT, base], [DARK, dark]] as const) {
      const reset = scopeTokens(rules, state, '')
      for (const name of [...SEMANTIC, ...STATUS_TOKENS, '--background', '--foreground', '--ring']) {
        expect(reset.get(name), name).toBe(root.get(name))
      }
    }
  })

  it('a scope with newLook off changes nothing', () => {
    const today = rootTokens(rules, TODAY)
    for (const theme of ['live', 'scholastic', 'heritage', '']) {
      const scoped = scopeTokens(rules, TODAY, theme)
      for (const [name, value] of today) expect(scoped.get(name), `${theme} ${name}`).toBe(value)
    }
  })
})

describe('a printed page takes the light look (step 24)', () => {
  // Paper is white, and a browser prints no background unless asked, so the
  // dark look's light words would print light on white: the dark muted
  // #9aa6bf at 2.45:1 and the dark ink #e8ecf4 at 1.18:1, as on the print
  // page's pairing sheet and crosstable printed from a dark device.
  const PRINT_LIGHT: RootState = { look: true, dark: false, print: true }
  const PRINT_DARK: RootState = { look: true, dark: true, print: true }
  const light = rootTokens(rules, LIGHT)

  it('the dark look, the live look and heritage in dark mode apply on screens only, and nothing else does', () => {
    expect(rules.filter((r) => r.within === SCREEN_ONLY).map((r) => r.selectors)).toEqual([
      [':root[data-look="new"].dark', ':root[data-look="new"].dark [data-theme=""]'],
      [':root[data-look="new"] [data-theme="live"]'],
      [':root[data-look="new"].dark [data-theme="heritage"]'],
    ])
    // No other rule of the new look names .dark or the live look, and only a screen-only rule sets a dark colour scheme.
    for (const rule of rules.filter((r) => r.within !== SCREEN_ONLY)) {
      for (const sel of rule.selectors.filter((s) => s.includes('data-look'))) expect(sel).not.toMatch(/\.dark|\[data-theme="live"\]/)
      expect(rule.decls.get('color-scheme'), rule.selector).not.toBe('dark')
    }
  })

  it('printed, the page has the light look\'s tokens on a light or a dark device', () => {
    expect(rootTokens(rules, PRINT_DARK)).toEqual(light)
    expect(rootTokens(rules, PRINT_LIGHT)).toEqual(light)
    // Heritage, scholastic and the base look inside a scope print as they look on a light device.
    for (const theme of ['heritage', 'scholastic', '']) {
      expect(scopeTokens(rules, PRINT_DARK, theme), theme).toEqual(scopeTokens(rules, LIGHT, theme))
    }
    // The live look, dark on every screen, prints in the base light look.
    const live = scopeTokens(rules, PRINT_DARK, 'live')
    for (const [name, value] of light) expect(live.get(name), name).toBe(value)
    expect([live.get('--ground'), live.get('--ink'), live.get('--live')]).toEqual(['#fff', '#1a2744', undefined])
  })

  it('printed, the words on the print page\'s sheets are dark on the white paper', () => {
    // The crosstable's ink and muted words, and the rating and score beside each name on the pairing sheet (text-quiet-600).
    const printed = rootTokens(rules, PRINT_DARK)
    for (const name of ['--ink', '--ink-muted', '--quiet-600']) {
      expect(contrast(printed.get(name)!, '#ffffff'), name).toBeGreaterThanOrEqual(4.5)
    }
    expect(printed.get('--quiet-600')).toBe('#5b6478')
    // On the screen the dark look keeps its light words, which would print far below 4.5:1.
    const screen = rootTokens(rules, DARK)
    expect(contrast(screen.get('--quiet-600')!, '#ffffff')).toBeCloseTo(2.45, 2)
    expect(contrast(screen.get('--ink')!, '#ffffff')).toBeCloseTo(1.18, 2)
  })

  it('with newLook off, a printed page is today\'s look, as on a screen', () => {
    expect(rootTokens(rules, { look: false, dark: false, print: true })).toEqual(rootTokens(rules, TODAY))
  })
})

describe('the tone tokens (step 24)', () => {
  const tones = toneTokens(rules)
  const today = rootTokens(rules, TODAY)
  const inline = rules.find((r) => r.selector === '@theme inline')!

  it('are the shades the step 24 map writes, each named for its tone, its Tailwind colour where it is not the tone\'s own, and its step', () => {
    expect(tones.map((t) => t.name.slice(2))).toEqual([
      'ok-50', 'ok-100', 'ok-200', 'ok-500', 'ok-600', 'ok-700', 'ok-900', 'ok-950',
      'ok-green-50', 'ok-green-100', 'ok-green-200', 'ok-green-500', 'ok-green-600', 'ok-green-700', 'ok-green-800',
      'bad-50', 'bad-100', 'bad-200', 'bad-500', 'bad-700', 'bad-800', 'bad-900',
      'warn-50', 'warn-100', 'warn-200', 'warn-300', 'warn-600', 'warn-700', 'warn-800', 'warn-900', 'warn-950',
      'warn-yellow-50', 'warn-yellow-100', 'warn-yellow-200', 'warn-yellow-700', 'warn-yellow-800',
      'info-50', 'info-100', 'info-200', 'info-800',
      'info-purple-100', 'info-purple-800',
      'quiet-100', 'quiet-600',
    ])
    // A tone's own Tailwind colour, and no tone named after a Tailwind colour, which would shadow it.
    expect(TONE_FAMILY).toEqual({ ok: 'emerald', bad: 'red', warn: 'amber', info: 'blue', quiet: 'gray' })
    const theme = read('node_modules/tailwindcss/theme.css')
    for (const tone of Object.keys(TONE_FAMILY)) expect(theme, tone).not.toMatch(new RegExp(`--color-${tone}-\\d`))
  })

  it('with newLook off, each is exactly the Tailwind colour it replaced, as Tailwind\'s theme writes it', () => {
    for (const t of tones) expect(today.get(t.name), t.name).toBe(tailwindColour(t.family, t.step))
    // text-ok is emerald-800 and text-bad red-600 (written as the shadcn destructive), so they need no step token.
    expect(today.get('--ok')).toBe(tailwindColour('emerald', 800))
    expect(tones.some((t) => t.name === '--ok-800' || t.name === '--bad-600')).toBe(false)
  })

  it('the two hex colours the pages used have a token each, at that colour with newLook off', () => {
    for (const [name, { legacy }] of Object.entries(HEX_TOKENS)) expect(today.get(name), name).toBe(legacy)
  })

  it('every tone token has a utility that reads it where it is used', () => {
    for (const name of [...tones.map((t) => t.name), ...Object.keys(HEX_TOKENS)]) {
      expect(inline.decls.get(`--color-${name.slice(2)}`), name).toBe(`var(${name})`)
    }
  })

  const LOOKS: Array<[string, Map<string, string>]> = [
    ['base', rootTokens(rules, LIGHT)],
    ['dark', rootTokens(rules, DARK)],
    ['live', scopeTokens(rules, LIGHT, 'live')],
    ['live in dark mode', scopeTokens(rules, DARK, 'live')],
    ['scholastic', scopeTokens(rules, LIGHT, 'scholastic')],
    ['scholastic in dark mode', scopeTokens(rules, DARK, 'scholastic')],
    ['heritage', scopeTokens(rules, LIGHT, 'heritage')],
    ['heritage in dark mode', scopeTokens(rules, DARK, 'heritage')],
    ['base inside a scope', scopeTokens(rules, DARK, '')],
  ]

  it.each(LOOKS)('under the new look (%s), each shade is its tone\'s tint up to step 300 and its words from 400', (_, tokens) => {
    for (const t of tones) {
      const want = t.role === 'tint' ? TONE_TINT[t.tone] : TONE_WORDS[t.tone]
      expect(tokens.get(t.name), t.name).toBe(tokens.get(want))
      expect(tokens.get(t.name), t.name).toMatch(/^#[0-9a-f]{3,6}$/)
    }
    expect(tokens.get('--info-banner')).toBe(tokens.get('--status-partner'))
  })

  it('takes the Looks-3 status tag colours: ok is the open tag, bad the full tag with --bad for its words, warn soon, info partner, quiet closed', () => {
    const base = rootTokens(rules, LIGHT)
    const dark = rootTokens(rules, DARK)
    const pair = (tokens: Map<string, string>, prefix: string) => [tokens.get(`--${prefix}-700`) ?? tokens.get(`--${prefix}-600`), tokens.get(`--${prefix}-100`)]
    expect(pair(base, 'ok')).toEqual(['#047857', '#e8f5ef'])
    expect(pair(base, 'bad')).toEqual(['#c0362c', '#fdeeec'])
    expect(pair(base, 'warn')).toEqual(['#705718', '#fbf7e9'])
    expect([base.get('--info-800'), base.get('--info-100')]).toEqual(['#1a2744', '#eef1f6'])
    expect(pair(base, 'quiet')).toEqual(['#5b6478', '#f7f8fa'])
    expect(pair(dark, 'ok')).toEqual(['#3ecf8e', '#0d2b22'])
    expect(pair(dark, 'bad')).toEqual(['#ff6b6b', '#3a1619'])
    expect(pair(dark, 'warn')).toEqual(['#c8a94a', '#2a2412'])
    expect([dark.get('--info-800'), dark.get('--info-100')]).toEqual(['#e8ecf4', '#1a2744'])
    expect(pair(dark, 'quiet')).toEqual(['#9aa6bf', '#1a2744'])
  })

  it('heritage restyles no tone, as it restyles no status tag', () => {
    for (const [state, root] of [[LIGHT, rootTokens(rules, LIGHT)], [DARK, rootTokens(rules, DARK)]] as const) {
      const heritage = scopeTokens(rules, state, 'heritage')
      for (const name of [...tones.map((t) => t.name), ...Object.keys(HEX_TOKENS)]) expect(heritage.get(name), name).toBe(root.get(name))
    }
  })

  it('the Facebook link blue keeps #1668d8 on the light looks and takes a lighter blue on the dark ones', () => {
    const value = (tokens: Map<string, string>) => tokens.get('--facebook-link')
    expect(LOOKS.map(([look, tokens]) => [look, value(tokens)])).toEqual([
      ['base', '#1668d8'],
      ['dark', '#4599ff'],
      ['live', '#4599ff'],
      ['live in dark mode', '#4599ff'],
      ['scholastic', '#1668d8'],
      ['scholastic in dark mode', '#1668d8'],
      ['heritage', '#1668d8'],
      ['heritage in dark mode', '#4599ff'],
      ['base inside a scope', '#4599ff'],
    ])
  })

  it('the tone aliases sit in one new-look block that names every scope, so a shade follows the scope it is in', () => {
    // The tone shades and the info banner's blue; --ok-fill, a fixed fill, is not a shade (next tests).
    const aliased = new Set([...tones.map((t) => t.name), '--info-banner'])
    const blocks = rules.filter((r) => !r.within && [...r.decls.keys()].some((k) => aliased.has(k)))
    expect(blocks.map((b) => b.selectors)).toEqual([[':root'], [':root[data-look="new"]', ':root[data-look="new"] [data-theme]']])
    for (const [name, value] of blocks[1].decls) expect(value, name).toMatch(/^var\(--[\w-]+\)$/)
  })

  // Not status tags: the scanner's move marks, which must stand out from the
  // card (contrast.test.ts measures them), and the solid green of a checked
  // check-in toggle under white words.
  const NOT_TAGS = { '--mark-warn': ['amber', 200], '--mark-ok': ['emerald', 200], '--ok-fill': ['emerald', 600] } as const

  it('the marks and the check-in fill are, with newLook off, exactly the Tailwind colours they replaced, and each has a utility', () => {
    for (const [name, [family, step]] of Object.entries(NOT_TAGS)) {
      expect(today.get(name), name).toBe(tailwindColour(family, step))
      expect(inline.decls.get(`--color-${name.slice(2)}`), name).toBe(`var(${name})`)
    }
    // None is a tone shade, which would have to follow the tone's tint or words.
    for (const name of Object.keys(NOT_TAGS)) expect(tones.some((t) => t.name === name), name).toBe(false)
  })

  it('under the new look the marks are a highlighter on the light looks and a quarter of their words over the card on the dark ones, and the check-in fill is #047857 everywhere', () => {
    expect(LOOKS.map(([look, tokens]) => [look, tokens.get('--mark-warn'), tokens.get('--mark-ok'), tokens.get('--ok-fill')])).toEqual([
      ['base', '#fee685', '#bcf7db', '#047857'],
      ['dark', '#3f3e34', '#1c4745', '#047857'],
      ['live', '#3d3a2f', '#184543', '#047857'],
      ['live in dark mode', '#3d3a2f', '#184543', '#047857'],
      ['scholastic', '#fee685', '#bcf7db', '#047857'],
      ['scholastic in dark mode', '#fee685', '#bcf7db', '#047857'],
      ['heritage', '#fee685', '#bcf7db', '#047857'],
      ['heritage in dark mode', '#3f3e34', '#1c4745', '#047857'],
      ['base inside a scope', '#3f3e34', '#1c4745', '#047857'],
    ])
    // The dark marks are the gold and the ok green at a quarter over the card, rounded to the nearest hex.
    const quarter = (colour: string, card: string) => {
      const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
      return `#${rgb(colour).map((c, i) => Math.round(c * 0.25 + rgb(card)[i] * 0.75).toString(16).padStart(2, '0')).join('')}`
    }
    for (const tokens of [rootTokens(rules, DARK), scopeTokens(rules, LIGHT, 'live')]) {
      expect(quarter(tokens.get('--gold')!, tokens.get('--surface')!)).toBe(tokens.get('--mark-warn'))
      expect(quarter(tokens.get('--ok')!, tokens.get('--surface')!)).toBe(tokens.get('--mark-ok'))
    }
  })

  it('heritage restyles neither the marks nor the check-in fill', () => {
    for (const [state, root] of [[LIGHT, rootTokens(rules, LIGHT)], [DARK, rootTokens(rules, DARK)]] as const) {
      const heritage = scopeTokens(rules, state, 'heritage')
      for (const name of Object.keys(NOT_TAGS)) expect(heritage.get(name), name).toBe(root.get(name))
    }
  })
})

describe('light islands (step 24)', () => {
  // A ground that stays light in every look, such as the club map's paper
  // (bg-[#f2efe6]), keeps the words on it dark: words that followed the look
  // would turn light on it in dark mode. contrast.test.ts measures them on the paper.
  const today = rootTokens(rules, TODAY)
  const legacyRoot = rules.find((r) => r.selector === ':root')!
  const inline = rules.find((r) => r.selector === '@theme inline')!
  const ISLAND = { '--muted-on-light': '#5b6478', '--veil-on-light': '#f7f8fa' }

  it('with newLook off, the words and the veil are the muted words and muted ground the map\'s loading note drew', () => {
    expect(today.get('--muted-on-light')).toBe(legacyRoot.decls.get('--muted-foreground'))
    expect(today.get('--veil-on-light')).toBe(legacyRoot.decls.get('--muted'))
    for (const name of Object.keys(ISLAND)) expect(inline.decls.get(`--color-${name.slice(2)}`), name).toBe(`var(${name})`)
  })

  it('under the new look they are the light look\'s muted words and muted ground, in every look, in dark mode and printed', () => {
    const base = rootTokens(rules, LIGHT)
    expect([base.get('--ink-muted'), base.get('--surface-2')]).toEqual(Object.values(ISLAND))
    const looks: Array<[string, Map<string, string>]> = [
      ['base', base],
      ['dark', rootTokens(rules, DARK)],
      ['printed from a dark device', rootTokens(rules, { look: true, dark: true, print: true })],
      ...(['live', 'scholastic', 'heritage', ''] as const).flatMap((theme): Array<[string, Map<string, string>]> => [
        [`${theme || 'base inside a scope'}`, scopeTokens(rules, LIGHT, theme)],
        [`${theme || 'base inside a scope'} in dark mode`, scopeTokens(rules, DARK, theme)],
      ]),
    ]
    for (const [look, tokens] of looks) {
      for (const [name, value] of Object.entries(ISLAND)) expect(tokens.get(name), `${look} ${name}`).toBe(value)
    }
    // Only the base block of the new look sets them: no dark, scope or screen-only rule restyles an island.
    const setting = rules.filter((r) => Object.keys(ISLAND).some((k) => r.decls.has(k)))
    expect(setting.map((r) => [r.within, r.selectors])).toEqual([
      ['', [':root']],
      ['', [':root[data-look="new"]', ':root[data-look="new"] [data-theme=""]']],
    ])
  })
})

describe('the gold words tokens (step 25)', () => {
  // Step 25 moved the gold text the pages spelled as hex colours to three
  // tokens, each at that very hex on the plain :root, so nothing changes with
  // newLook off: --gold-ink-badge (the dark gold words of badges, pills and
  // notes on a gold tint, and four labels and counts), --gold-ink-badge-club
  // (a club page's Upcoming badge, a shade lighter) and --gold-on-dark-badge
  // (a pill's words over navy or the home page hero's darkened photo). The
  // hex values are written without the class around them, so Tailwind, which
  // reads this file, builds no CSS for the old classes.
  const today = rootTokens(rules, TODAY)
  const legacyRoot = rules.find((r) => r.selector === ':root' && !r.within)!
  const inline = rules.find((r) => r.selector === '@theme inline')!
  const brand = rules.find((r) => r.selector === '@theme')!
  const LEGACY: Record<string, string> = { '--gold-ink-badge': '#7a5c00', '--gold-ink-badge-club': '#8a6d1f', '--gold-on-dark-badge': '#f0d07a' }
  const LOOKS: Array<[string, Map<string, string>]> = [
    ['base', rootTokens(rules, LIGHT)],
    ['dark', rootTokens(rules, DARK)],
    ['live', scopeTokens(rules, LIGHT, 'live')],
    ['live in dark mode', scopeTokens(rules, DARK, 'live')],
    ['scholastic', scopeTokens(rules, LIGHT, 'scholastic')],
    ['scholastic in dark mode', scopeTokens(rules, DARK, 'scholastic')],
    ['heritage', scopeTokens(rules, LIGHT, 'heritage')],
    ['heritage in dark mode', scopeTokens(rules, DARK, 'heritage')],
    ['base inside a scope', scopeTokens(rules, DARK, '')],
    ['printed from a dark device', rootTokens(rules, { look: true, dark: true, print: true })],
  ]

  it('with newLook off, each is the hex colour the class it replaced painted, and --gold-ink is brand gold, as text-lca-gold paints', () => {
    for (const [name, hex] of Object.entries(LEGACY)) {
      expect(legacyRoot.decls.get(name), name).toBe(hex)
      expect(today.get(name), name).toBe(hex)
    }
    // text-lca-gold on a light ground became text-gold-ink, the same colour on the plain :root.
    expect(today.get('--gold-ink')).toBe(brand.decls.get('--color-lca-gold'))
    // The club badge keeps its own shade: the other badges' token would change it.
    expect(today.get('--gold-ink-badge-club')).not.toBe(today.get('--gold-ink-badge'))
  })

  it('each has a utility in the @theme inline block that reads it where it is used', () => {
    for (const name of Object.keys(LEGACY)) expect(inline.decls.get(`--color-${name.slice(2)}`), name).toBe(`var(${name})`)
  })

  it('under the new look the badge words are the soon tag\'s words on the light looks and brand gold on the dark ones, the club badge\'s the same', () => {
    expect(LOOKS.map(([look, t]) => [look, t.get('--gold-ink-badge'), t.get('--gold-ink-badge-club')])).toEqual([
      ['base', '#705718', '#705718'],
      ['dark', '#c8a94a', '#c8a94a'],
      ['live', '#c8a94a', '#c8a94a'],
      ['live in dark mode', '#c8a94a', '#c8a94a'],
      ['scholastic', '#705718', '#705718'],
      ['scholastic in dark mode', '#705718', '#705718'],
      ['heritage', '#705718', '#705718'],
      ['heritage in dark mode', '#c8a94a', '#c8a94a'],
      ['base inside a scope', '#c8a94a', '#c8a94a'],
      ['printed from a dark device', '#705718', '#705718'],
    ])
    // On the light looks that is the Looks-3 soon tag's words, and heritage's own gold ink.
    for (const [look, t] of LOOKS.filter(([look]) => ['base', 'scholastic'].includes(look))) expect(t.get('--gold-ink-badge'), look).toBe(t.get('--status-soon'))
    expect(scopeTokens(rules, LIGHT, 'heritage').get('--gold-ink-badge')).toBe(scopeTokens(rules, LIGHT, 'heritage').get('--gold-ink'))
  })

  it('--gold-on-dark-badge is #f0d07a in every look and mode, printed too, and only the plain :root sets it', () => {
    for (const [look, t] of LOOKS) expect(t.get('--gold-on-dark-badge'), look).toBe('#f0d07a')
    const setting = rules.filter((r) => r.decls.has('--gold-on-dark-badge'))
    expect(setting.map((r) => [r.within, r.selectors])).toEqual([['', [':root']]])
  })

  it('the new look sets the badge words in each block that sets --gold-ink but heritage\'s, which restyles --gold-ink alone and passes the rest on', () => {
    const blocks = (name: string) => rules.filter((r) => r.decls.has(name) && r.selector !== ':root').map((r) => [r.within, r.selectors])
    expect(blocks('--gold-ink-badge')).toEqual([
      ['', [':root[data-look="new"]', ':root[data-look="new"] [data-theme=""]']],
      [SCREEN_ONLY, [':root[data-look="new"].dark', ':root[data-look="new"].dark [data-theme=""]']],
      [SCREEN_ONLY, [':root[data-look="new"] [data-theme="live"]']],
      ['', [':root[data-look="new"] [data-theme="scholastic"]']],
    ])
    expect(blocks('--gold-ink-badge-club')).toEqual(blocks('--gold-ink-badge'))
    const goldInk = blocks('--gold-ink').filter(([, selectors]) => !(selectors as string[]).some((s) => s.includes('heritage')))
    expect(goldInk).toEqual(blocks('--gold-ink-badge'))
  })
})

describe('focus and motion under the new look', () => {
  const focus = rules.find((r) => r.selector === ':root[data-look="new"] :focus-visible')
  it(':focus-visible is a 2px --focus line with a 2px gap, and the shadcn glow is off while it shows', () => {
    expect(focus).toBeDefined()
    expect(focus!.within).toBe('')
    expect(focus!.decls.get('outline')).toBe('2px solid var(--focus)')
    expect(focus!.decls.get('outline-offset')).toBe('2px')
    expect(focus!.decls.get('--tw-ring-shadow')).toBe('0 0 #0000')
    expect(focus!.decls.get('--tw-ring-offset-shadow')).toBe('0 0 #0000')
    const navy = rules.find((r) => r.selectors.includes(':root[data-look="new"] .bg-lca-navy :focus-visible'))
    expect(navy?.decls.get('outline-color')).toBe('var(--gold-on-dark)')
  })

  it('turns the ring gold inside a navy band, by either navy class, and inside anything marked data-ground="dark"', () => {
    const gold = rules.filter((r) => r.decls.get('outline-color') === 'var(--gold-on-dark)')
    expect(gold).toHaveLength(1)
    expect(gold[0].within).toBe('')
    // Step 23 moved the bands to bg-brand-navy; bg-lca-navy is the same navy.
    expect(gold[0].selectors).toEqual([
      ':root[data-look="new"] .bg-lca-navy :focus-visible',
      ':root[data-look="new"] .bg-brand-navy :focus-visible',
      ':root[data-look="new"] [data-ground="dark"] :focus-visible',
    ])
  })

  it('gives the controls of a menu inside a navy band the look\'s own ring back, at 3:1 or more on the menu', () => {
    // Step 23: the state filter in the /tournaments hero opens a bg-popover menu inside the bg-brand-navy hero.
    const gold = rules.find((r) => r.decls.get('outline-color') === 'var(--gold-on-dark)')!
    const back = rules.filter((r) => r.decls.get('outline-color') === 'var(--focus)')
    expect(back).toHaveLength(1)
    expect(back[0].within).toBe('')
    expect(back[0].selectors).toEqual(gold.selectors.map((s) => s.replace(/ :focus-visible$/, ' .bg-popover :focus-visible')))
    // One class more than the gold rule, and after it, so it wins inside the menu.
    for (const s of back[0].selectors) expect(specificity(s), s).toBe(specificity(gold.selectors[0]) + 1)
    expect(back[0].order).toBeGreaterThan(gold.order)
    // The menu is --popover, which the new look points at --raised: navy on #fff, gold on #1a2744 in dark mode.
    for (const [state, focus, ground] of [[LIGHT, '#1a2744', '#fff'], [DARK, '#c8a94a', '#1a2744']] as const) {
      const t = rootTokens(rules, state)
      expect([t.get('--focus'), t.get('--popover')]).toEqual([focus, ground])
      expect(contrast(focus, ground)).toBeGreaterThanOrEqual(3)
    }
  })

  it('reduced motion zeroes every transition and animation', () => {
    const motion = rules.filter((r) => r.within === '@media (prefers-reduced-motion: reduce)')
    expect(motion).toHaveLength(1)
    expect(motion[0].selectors).toEqual([':root[data-look="new"] *', ':root[data-look="new"] *::before', ':root[data-look="new"] *::after'])
    expect(motion[0].decls.get('animation-duration')).toBe('0s !important')
    expect(motion[0].decls.get('animation-iteration-count')).toBe('1 !important')
    expect(motion[0].decls.get('transition-duration')).toBe('0s !important')
    expect(motion[0].decls.get('transition-delay')).toBe('0s !important')
  })
})

describe('fonts', () => {
  /** Every TSX and CSS file under src. */
  const sources = (dir: string): string[] =>
    readdirSync(join(ROOT, dir)).flatMap((name) => {
      const path = join(dir, name)
      return statSync(join(ROOT, path)).isDirectory() ? sources(path) : /\.(tsx?|css)$/.test(name) ? [path] : []
    })

  it('loads Geist Mono and Instrument Serif 400, pinned exactly', () => {
    const imports = [...stripComments(css).matchAll(/@import "([^"]+)";/g)].map((m) => m[1])
    expect(imports).toEqual([
      'tailwindcss',
      'tw-animate-css',
      'shadcn/tailwind.css',
      '@fontsource-variable/geist',
      '@fontsource-variable/geist-mono',
      '@fontsource/instrument-serif/400.css',
    ])
    const pkg = JSON.parse(read('package.json'))
    expect(pkg.dependencies['@fontsource-variable/geist-mono']).toBe('5.3.0')
    expect(pkg.dependencies['@fontsource/instrument-serif']).toBe('5.3.0')
    const inline = rules.find((r) => r.selector === '@theme inline')!
    expect(inline.decls.get('--font-accent')).toBe("'Instrument Serif', Georgia, serif")
  })

  it('Geist Mono is the only monospace face, named only in the new look\'s --font-mono-face', () => {
    const faces = parseRules(read('node_modules/@fontsource-variable/geist-mono/index.css'))
      .filter((r) => r.selector === '@font-face')
      .map((r) => r.decls.get('font-family'))
    expect(new Set(faces)).toEqual(new Set(["'Geist Mono Variable'"]))
    const naming = rules.filter((r) => [...r.decls.values()].some((v) => v.includes('Geist Mono')))
    expect(naming.map((r) => r.selectors)).toEqual([[':root[data-look="new"]', ':root[data-look="new"] [data-theme=""]']])
    // No component names a monospace face of its own: font-mono is the only way in.
    const named = sources('src')
      .filter((file) => file !== join('src', 'index.css'))
      .filter((file) => /Geist Mono|JetBrains|Courier New|Menlo|ui-monospace|font-\[[^\]]*mono/i.test(read(file)))
    expect(named).toEqual([])
  })
})
