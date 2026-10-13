// The token utilities in src/index.css, compiled by Tailwind itself (WS01 step 21).
//
// The brief names the utilities new code reaches the tokens through: text-ink,
// text-ink-muted, bg-ground, bg-surface, bg-surface-2, border-hairline, bg-gold,
// text-gold-ink, text-gold-on-dark and the status utilities. Each must compile,
// and must read its token where it is used (var(--ink), not a copied value),
// so a scope or the dark class changes it. font-mono must read --font-mono-face,
// ring-focus must read --focus, and the dark variant must match .dark on <html>
// as well as inside it.
import { compile } from 'tailwindcss'
import { beforeAll, describe, expect, it } from 'vitest'
import { read, ROOT, stripComments } from './helpers/cssTokens'

/** The part of index.css Tailwind needs to build utilities: the variant and both @theme blocks. */
function themeSource(): string {
  const css = stripComments(read('src/index.css'))
  const variant = css.match(/@custom-variant dark [^;]+;/)?.[0]
  const blocks = [...css.matchAll(/^@theme(?: inline)? \{[\s\S]*?^\}/gm)].map((m) => m[0])
  if (!variant || blocks.length !== 2) throw new Error('index.css should hold one dark variant and two @theme blocks')
  return `${variant}\n${blocks.join('\n')}\n@tailwind utilities;`
}

let build: (classes: string[]) => string
beforeAll(async () => {
  const compiler = await compile(themeSource(), { base: ROOT, loadStylesheet: async () => ({ content: '', base: ROOT, path: '' }) })
  build = (classes) => compiler.build(classes)
})

/** The declarations the rule for one class holds. */
function rule(css: string, className: string): string {
  const escaped = className.replace(/[:/]/g, '\\$&')
  const at = css.indexOf(`.${escaped}`)
  if (at < 0) throw new Error(`${className} did not compile`)
  const end = css.indexOf('}', at)
  return css.slice(at, end + 1).replace(/\s+/g, ' ')
}

const STATUSES = ['open', 'soon', 'full', 'waitlist', 'closed', 'live', 'partner', 'lca']

describe('the colour utilities the brief names', () => {
  it.each([
    ['text-ink', 'color: var(--ink)'],
    ['text-ink-muted', 'color: var(--ink-muted)'],
    ['bg-ground', 'background-color: var(--ground)'],
    ['bg-surface', 'background-color: var(--surface)'],
    ['bg-surface-2', 'background-color: var(--surface-2)'],
    ['bg-raised', 'background-color: var(--raised)'],
    ['border-hairline', 'border-color: var(--hairline)'],
    ['bg-gold', 'background-color: var(--gold)'],
    ['text-gold-ink', 'color: var(--gold-ink)'],
    ['text-gold-on-dark', 'color: var(--gold-on-dark)'],
    ['text-ok', 'color: var(--ok)'],
    ['text-bad', 'color: var(--bad)'],
  ])('%s reads its token where it is used', (name, declaration) => {
    expect(rule(build([name]), name)).toContain(declaration)
  })

  it.each(STATUSES)('the %s status words and tint utilities exist', (status) => {
    const out = build([`text-status-${status}`, `bg-status-${status}-tint`])
    expect(rule(out, `text-status-${status}`)).toContain(`color: var(--status-${status})`)
    expect(rule(out, `bg-status-${status}-tint`)).toContain(`background-color: var(--status-${status}-tint)`)
  })

  it('an opacity step on a token utility mixes the token in, so it still follows the scope', () => {
    const out = rule(build(['bg-gold/20']), 'bg-gold/20')
    expect(out).toContain('var(--gold)')
    expect(out).not.toContain('#c8a94a')
  })
})

describe('the focus ring and the dark variant', () => {
  it('ring-focus reads --focus', () => {
    expect(rule(build(['focus-visible:ring-focus']), 'focus-visible:ring-focus')).toContain('--tw-ring-color: var(--focus)')
  })

  it('dark: matches .dark on <html> itself and anything inside it', () => {
    const out = build(['dark:bg-surface']).replace(/\s+/g, ' ')
    expect(out).toContain(':where(.dark, .dark *)')
    expect(out).toContain('background-color: var(--surface)')
  })
})

describe('the font utilities', () => {
  it('font-mono reads --font-mono-face, so it is the device stack until the new look names Geist Mono', () => {
    expect(rule(build(['font-mono']), 'font-mono')).toContain('font-family: var(--font-mono-face)')
  })

  it('font-sans stays Geist, and font-accent is Instrument Serif', () => {
    const out = build(['font-sans', 'font-accent'])
    expect(rule(out, 'font-sans')).toContain("font-family: 'Geist Variable', sans-serif")
    expect(rule(out, 'font-accent')).toContain("font-family: 'Instrument Serif', Georgia, serif")
  })
})
