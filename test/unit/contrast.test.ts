// Contrast of the new look's tokens (WS01 acceptance criterion 3, step 21).
//
// The WCAG 2.x formula is applied to the token values read out of
// src/index.css, as a browser resolves them, in each look newLook brings:
// base light, base dark, live, scholastic, heritage and heritage in dark
// mode. The focus ring must reach 3:1 on every ground it can sit on; ink,
// muted text, gold-toned text and status words 4.5:1; field borders 3:1.
// The formula itself is checked first against ratios the brief states.
//
// The browser measures the same rings in test/a11y/tokens.spec.ts.
import { describe, expect, it } from 'vitest'
import { contrast, indexCssRules, rootTokens, scopeTokens } from './helpers/cssTokens'

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
