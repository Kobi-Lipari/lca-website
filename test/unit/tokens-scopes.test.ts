// The look scopes in src/index.css, at their edges (WS01 step 21).
//
// An unknown data-theme value changes nothing, a scope keeps every token the
// base look defines (so no utility ever reads an undefined token inside it),
// and the three scopes differ from base only where the brief says they do.
import { describe, expect, it } from 'vitest'
import { indexCssRules, rootTokens, scopeTokens } from './helpers/cssTokens'

const rules = indexCssRules()
const LIGHT = { look: true, dark: false }
const DARK = { look: true, dark: true }
/** The shadcn variables, which follow the semantic tokens. */
const SHADCN = /^--(background|foreground|card|card-foreground|popover|popover-foreground|primary|primary-foreground|secondary|secondary-foreground|muted|muted-foreground|accent|accent-foreground|destructive|border|input|ring|chart-\d|sidebar.*|radius)$/
const THEMES = ['live', 'scholastic', 'heritage', '']

describe('scopes', () => {
  it.each([[LIGHT], [DARK]])('an unknown data-theme value is the base look (%j)', (state) => {
    const base = rootTokens(rules, state)
    for (const theme of ['Live', 'LIVE', 'news', 'heritage ', 'dark']) {
      const scoped = scopeTokens(rules, state, theme)
      for (const [name, value] of base) expect(scoped.get(name), `${theme} ${name}`).toBe(value)
    }
  })

  it.each(THEMES)('data-theme="%s" defines every token the base look does, light and dark', (theme) => {
    for (const state of [LIGHT, DARK]) {
      const base = rootTokens(rules, state)
      const scoped = scopeTokens(rules, state, theme)
      for (const name of base.keys()) expect(scoped.has(name), `${theme} ${name}`).toBe(true)
    }
  })

  it('heritage restyles the paper, the muted text, the borders and the gold ink among the semantic tokens, and leaves ink, status and the focus ring on base', () => {
    const base = rootTokens(rules, LIGHT)
    const heritage = scopeTokens(rules, LIGHT, 'heritage')
    const semantic = [...base.keys()].filter((k) => !SHADCN.test(k))
    const changed = semantic.filter((k) => heritage.get(k) !== base.get(k)).sort()
    expect(changed).toEqual(['--field', '--gold-ink', '--ground', '--hairline', '--ink-muted', '--raised', '--surface', '--surface-2'])
  })

  it('live is dark in a light and in a dark mode alike, and the two give the same tokens', () => {
    const light = scopeTokens(rules, LIGHT, 'live')
    const dark = scopeTokens(rules, DARK, 'live')
    for (const [name, value] of light) expect(dark.get(name), name).toBe(value)
  })

  it('the base gold ink is the one that reaches text contrast; brand gold is its fill only', () => {
    const base = rootTokens(rules, LIGHT)
    expect(base.get('--gold')).toBe('#c8a94a')
    expect(base.get('--gold-ink')).not.toBe(base.get('--gold'))
    expect(scopeTokens(rules, LIGHT, 'heritage').get('--gold-ink')).toBe('#705718')
  })
})
