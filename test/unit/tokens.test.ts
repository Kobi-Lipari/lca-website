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
//   data-look="new", and Geist Mono is named nowhere else.
//
// Contrast is in contrast.test.ts; the browser check is test/a11y/tokens.spec.ts.
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { compile } from 'tailwindcss'
import { describe, expect, it } from 'vitest'
import { contrast, indexCssRules, parseRules, read, ROOT, rootTokens, scopeTokens, specificity, stripComments, type RootState } from './helpers/cssTokens'

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
    expect(badge).toContain("gold: 'bg-lca-gold/20 text-[#7a5c00]'")
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
  it('every rule outside the legacy blocks, @theme and @layer base starts with :root[data-look="new"]', () => {
    for (const rule of rules) {
      if (rule.selector.startsWith('@theme')) continue
      if (rule.within.startsWith('@layer')) continue
      if (rule.selector === ':root' || rule.selector === '.dark') continue
      for (const sel of rule.selectors) {
        expect(sel.startsWith(':root[data-look="new"]'), `${rule.within} ${sel}`).toBe(true)
      }
    }
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
