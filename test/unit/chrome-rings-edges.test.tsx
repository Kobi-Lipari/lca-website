// @vitest-environment jsdom
//
// The chrome's own rings and the banners' ring on gold (WS02 step 3, the
// brief's AC19 for the banners and the frame), at their edges.
// test/unit/contrast.test.ts holds each ring's colour against its ground;
// this file holds what that leaves:
//
// - the colours the ring rules write out as hex are the tokens they stand
//   for: the gold of --gold-on-dark in the light look and in dark mode, and
//   the brand navy the gold banners write their words in; and the gold the
//   pins measure is the banners' own ground, --color-lca-gold
// - a printed page keeps the light look's ring on a light surface, as the
//   dark mode rule for it is for screens only
// - the ring as it is drawn on the gold: the dismiss button is drawn at 70
//   per cent opacity, ring and all, and its navy ring, laid over the gold at
//   that opacity, still reaches 3:1; nothing else between a control and the
//   gold ground is see-through
// - the skip link's ring and the main's are the ones the cascade picks for
//   them, outside every layer like the one ring, so no utility undoes them
// - the gold marker follows the ground a banner draws, in every tone and
//   size: on each banner drawn in bg-lca-gold, and on no other
import { cleanup, render, screen } from '@testing-library/react'
import { compile } from 'tailwindcss'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthContextValue } from '@/contexts/AuthContext'
import { applies, contrast, hexToRgb, indexCssRules, matchesRoot, ROOT, rootTokens, specificity, substitute, type CssRule, type RootState } from './helpers/cssTokens'

const api = vi.hoisted(() => ({ getAnnouncements: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/lib/api', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/api')>()), ...api }))

const { AnnouncementBanner } = await import('@/components/AnnouncementBanner')
const { ImpersonationBanner } = await import('@/components/ImpersonationBanner')
const { AuthContext } = await import('@/contexts/auth-context')

const rules = indexCssRules()
const LIGHT: RootState = { look: true, dark: false }
const DARK: RootState = { look: true, dark: true }
const get = (tokens: Map<string, string>, name: string) => {
  const value = tokens.get(name)
  if (value === undefined) throw new Error(`${name} is not set`)
  return value.toLowerCase()
}
/** The value a @theme block gives a name. */
function themeValue(name: string): string {
  const theme = rules.filter((r) => r.selector.startsWith('@theme') && r.decls.has(name))
  expect(theme, name).toHaveLength(1)
  return theme[0].decls.get(name)!.toLowerCase()
}

/**
 * The ring on an element marked data-ring-ground="value", as the cascade
 * gives it in this state of the page (printed or on a screen): the page's
 * own --focus, then each rule for that value that applies, by specificity
 * and then by place in the file.
 */
function ringOn(value: 'navy' | 'light' | 'gold', state: RootState): string {
  const page = rootTokens(rules, state)
  const own = new RegExp(`^(.+) \\[data-ring-ground="${value}"\\]$`)
  const hits = rules
    .filter((r) => applies(r, state.print) && r.decls.has('--focus'))
    .flatMap((r) => r.selectors.flatMap((s) => {
      const m = own.exec(s)
      return m && matchesRoot(m[1], state) ? [{ rule: r, spec: specificity(s) }] : []
    }))
    .sort((a, b) => a.spec - b.spec || a.rule.order - b.rule.order)
  let focus = get(page, '--focus')
  for (const { rule } of hits) focus = substitute(rule.decls.get('--focus')!, page).toLowerCase()
  return focus
}

describe('the colours the ring rules write out', () => {
  it('are the tokens they stand for: the gold of --gold-on-dark in both modes, and the navy the gold banners write their words in', () => {
    for (const state of [LIGHT, DARK]) {
      const tokens = rootTokens(rules, state)
      expect(ringOn('navy', state), `dark ${state.dark}`).toBe(get(tokens, '--gold-on-dark'))
    }
    expect(ringOn('light', DARK)).toBe(get(rootTokens(rules, DARK), '--gold-on-dark'))
    // The gold banners write their words in text-brand-navy; their ring is that navy, in both modes.
    const brandNavy = themeValue('--color-brand-navy')
    for (const state of [LIGHT, DARK]) expect(ringOn('gold', state)).toBe(brandNavy)
    expect(ringOn('light', LIGHT)).toBe(brandNavy)
  })

  it('are measured by the pins against the banners\' own gold, --color-lca-gold, which no look changes', () => {
    const gold = themeValue('--color-lca-gold')
    expect(gold).toBe('#c8a94a')
    // The gold ground's ring against that gold, and what dark mode's own ring would have been on it.
    for (const state of [LIGHT, DARK]) expect(contrast(ringOn('gold', state), gold)).toBeGreaterThanOrEqual(3)
    expect(contrast(get(rootTokens(rules, DARK), '--focus'), gold)).toBeLessThan(1.1)
  })

  it('leave a printed page the light look\'s ring on a light surface, as the dark mode rule for it is for screens only', () => {
    const printed: RootState = { look: true, dark: true, print: true }
    expect(ringOn('light', printed)).toBe(get(rootTokens(rules, printed), '--focus'))
    expect(ringOn('light', printed)).toBe(ringOn('light', LIGHT))
    expect(ringOn('light', DARK)).not.toBe(ringOn('light', printed))
  })
})

// ── The ring as it is drawn on the gold ───────────────────────────────────

/** The opacity a class list gives an element: its plain opacity-N class, or 1. Hover and other states are not the focused look. */
function opacityOf(el: Element): number {
  const plain = [...el.classList].filter((c) => /^opacity-\d+$/.test(c))
  expect(plain.length, el.outerHTML.slice(0, 80)).toBeLessThanOrEqual(1)
  return plain.length ? Number(plain[0].slice('opacity-'.length)) / 100 : 1
}

/** A colour laid over another at an opacity, as the browser draws it. */
function over(top: string, alpha: number, ground: string): string {
  const [a, b] = [hexToRgb(top), hexToRgb(ground)]
  return `#${a.map((v, i) => Math.round(v * alpha + b[i] * (1 - alpha)).toString(16).padStart(2, '0')).join('')}`
}

const GOLD_ANNOUNCEMENT = {
  id: 'fx-ann-gold', tone: 'gold', size: 'default', message: 'Registration for the Fixture Open closes Friday, October 23 at 7:00 PM.',
  linkUrl: '/tournaments', linkLabel: 'More about the Fixture Open',
}

beforeEach(() => {
  sessionStorage.clear()
  api.getAnnouncements.mockReset()
})
afterEach(cleanup)

describe('the ring as it is drawn on the gold', () => {
  it('Tailwind writes opacity-70 as the 70 per cent the dismiss button is drawn at', async () => {
    const compiler = await compile('@tailwind utilities;', { base: ROOT, loadStylesheet: async () => ({ content: '', base: ROOT, path: '' }) })
    expect(compiler.build(['opacity-70']).replace(/\s+/g, ' ')).toContain('.opacity-70 { opacity: 70%; }')
  })

  it('every control on the gold, the dismiss button at its 70 per cent included, rings navy at 3:1 or more over the gold, in both modes', async () => {
    api.getAnnouncements.mockResolvedValue({ announcements: [GOLD_ANNOUNCEMENT] })
    const auth = {
      impersonating: { id: 'fx-m-p5', fullName: 'Riley Fixture', email: 'riley.fixture@example.org' }, exitImpersonation: async () => {},
    } as unknown as AuthContextValue
    render(
      <AuthContext.Provider value={auth}>
        <ImpersonationBanner />
        <AnnouncementBanner />
      </AuthContext.Provider>,
    )
    await screen.findByText(GOLD_ANNOUNCEMENT.message, { exact: false })
    const controls = [
      screen.getByRole('button', { name: 'Exit' }),
      screen.getByRole('link', { name: GOLD_ANNOUNCEMENT.linkLabel }),
      screen.getByRole('button', { name: `Dismiss: ${GOLD_ANNOUNCEMENT.linkLabel}` }),
    ]
    const gold = themeValue('--color-lca-gold')
    const drawn: Record<string, number> = {}
    for (const control of controls) {
      const ground = control.closest('[data-ring-ground="gold"]')!
      expect(ground.classList.contains('bg-lca-gold')).toBe(true)
      // Everything from the control up to its gold ground, the control itself first; the ground's own opacity counts as well.
      let alpha = 1
      for (let el: Element | null = control; el && el !== ground.parentElement; el = el.parentElement) alpha *= opacityOf(el)
      const name = control.getAttribute('aria-label') ?? control.textContent ?? ''
      for (const state of [LIGHT, DARK]) {
        const ring = over(ringOn('gold', state), alpha, gold)
        drawn[`${name}, dark ${state.dark}`] = Math.round(contrast(ring, gold) * 100) / 100
        expect(contrast(ring, gold), `${name}, dark ${state.dark}`).toBeGreaterThanOrEqual(3)
      }
    }
    // The dismiss button alone is see-through, and its ring with it.
    expect(drawn).toEqual({
      'Exit, dark false': 6.51, 'Exit, dark true': 6.51,
      'More about the Fixture Open, dark false': 6.51, 'More about the Fixture Open, dark true': 6.51,
      'Dismiss: More about the Fixture Open, dark false': expect.any(Number), 'Dismiss: More about the Fixture Open, dark true': expect.any(Number),
    })
    expect(drawn['Dismiss: More about the Fixture Open, dark false']).toBeLessThan(6.51)
  })
})

// ── The skip link's ring and the main's, in the cascade ───────────────────

/** Specificity as ids, then classes, attributes and pseudo-classes, then types, written as one number. */
function cssSpecificity(selector: string): number {
  const body = selector.replace(/:where\([^)]*\)/g, '').replace(/::[\w-]+/g, '')
  const ids = (body.match(/#[\w-]+/g) ?? []).length
  const classes = (body.match(/\.[\w-]+|\[[^\]]*\]|:[\w-]+/g) ?? []).length
  const types = (body.replace(/\[[^\]]*\]/g, '').match(/(?:^|[\s>+~])[a-z][\w-]*/gi) ?? []).length
  return ids * 10_000 + classes * 100 + types
}

/** Whether a compound selector (no spaces) holds for the element: its tag, its attributes and its states. */
function compoundHolds(compound: string, tag: string, attributes: string[], states: string[]): boolean {
  const parts = compound.match(/^[a-z][\w-]*|\*|#[\w-]+|\.[\w-]+|\[[^\]]*\]|:[\w-]+/gi) ?? []
  if (parts.join('') !== compound) return false
  return parts.every((p) => p === '*' || p === tag || attributes.includes(p) || states.includes(p))
}

/**
 * The value the cascade gives a focused element of the frame (outside every
 * band, inside <html> alone) for an outline property: the rules that apply
 * on a screen, whose selector is the page's root and then one compound the
 * element meets, by specificity and then by place in the file.
 */
function outlineFor(property: string, tag: string, attributes: string[], state: RootState): { value: string; rule: CssRule } | null {
  const hits = rules
    .filter((r) => applies(r) && r.decls.has(property))
    .flatMap((r) => r.selectors.flatMap((s) => {
      const parts = s.split(' ')
      return parts.length === 2 && matchesRoot(parts[0], state) && compoundHolds(parts[1], tag, attributes, [':focus-visible', ':focus'])
        ? [{ rule: r, spec: cssSpecificity(s) }]
        : []
    }))
    .sort((a, b) => a.spec - b.spec || a.rule.order - b.rule.order)
  const last = hits.at(-1)
  return last ? { value: last.rule.decls.get(property)!, rule: last.rule } : null
}

describe('the skip link\'s ring and the main\'s, as the cascade gives them', () => {
  it('the skip link, focused, is drawn in the one ring, 2 pixels wide, with its offset of -4 pixels, outside every layer', () => {
    for (const state of [LIGHT, DARK]) {
      const outline = outlineFor('outline', 'a', ['[data-skip-link]'], state)
      const offset = outlineFor('outline-offset', 'a', ['[data-skip-link]'], state)
      expect(outline?.value).toBe('2px solid var(--focus)')
      expect(offset?.value).toBe('-4px')
      expect(offset?.rule.within).toBe('')
      expect(offset?.rule.selectors).toEqual([':root[data-look="new"] [data-skip-link]:focus-visible'])
    }
    // The helper the other pins use counts it above the one ring as well.
    expect(specificity(':root[data-look="new"] [data-skip-link]:focus-visible')).toBeGreaterThan(specificity(':root[data-look="new"] :focus-visible'))
  })

  it('the main, focused by the skip link, draws no ring, and any other focused control keeps the one ring and its 2 pixel gap', () => {
    for (const state of [LIGHT, DARK]) {
      const main = outlineFor('outline', 'main', ['#main-content'], state)
      expect(main?.value).toBe('none')
      expect(main?.rule.within).toBe('')
      expect(outlineFor('outline', 'button', [], state)?.value).toBe('2px solid var(--focus)')
      expect(outlineFor('outline-offset', 'button', [], state)?.value).toBe('2px')
      expect(outlineFor('outline-offset', 'a', [], state)?.value).toBe('2px')
    }
    // With the new look off, nothing of this applies.
    expect(outlineFor('outline', 'main', ['#main-content'], { look: false, dark: false })).toBeNull()
    expect(outlineFor('outline-offset', 'a', ['[data-skip-link]'], { look: false, dark: false })).toBeNull()
  })

  it('the skip link\'s ring, drawn inside its edge on its own ground, reaches 3:1 in both modes', () => {
    for (const state of [LIGHT, DARK]) {
      const tokens = rootTokens(rules, state)
      expect(contrast(get(tokens, '--focus'), get(tokens, '--raised')), `dark ${state.dark}`).toBeGreaterThanOrEqual(3)
    }
    // The 2 pixel line ends 2 pixels inside the edge, so the link's own ground lies outside it too.
    const width = 2
    const offset = Number.parseFloat(outlineFor('outline-offset', 'a', ['[data-skip-link]'], LIGHT)!.value)
    expect(-offset - width).toBeGreaterThan(0)
  })
})

// ── The gold marker follows the ground ───────────────────────────────────

describe('the gold marker follows the ground a banner draws', () => {
  const TONES = ['gold', 'navy', 'urgent', 'info', 'teal', 'Gold', '']
  const SIZES = ['default', 'compact', 'jumbo']

  it('in every tone and size, on each banner drawn in bg-lca-gold and on no other', async () => {
    const announcements = TONES.flatMap((tone, i) => SIZES.map((size, j) => ({
      id: `fx-ann-${i}-${j}`, tone, size, message: `Fixture notice ${i}-${j}, drawn in ${tone || 'no tone'} at ${size}.`,
      linkUrl: '/tournaments', linkLabel: `Read notice ${i}-${j}`,
    })))
    api.getAnnouncements.mockResolvedValue({ announcements })
    render(<AnnouncementBanner />)
    await screen.findByText(announcements[0].message, { exact: false })
    const seen: string[] = []
    for (const a of announcements) {
      const box = screen.getByText(a.message, { exact: false }).closest('div')!
      const onGold = box.classList.contains('bg-lca-gold')
      expect(box.getAttribute('data-ring-ground'), `${a.tone} at ${a.size}`).toBe(onGold ? 'gold' : null)
      // A tone the banner knows draws its own ground; any other is drawn gold.
      expect(onGold, `${a.tone} at ${a.size}`).toBe(!['navy', 'urgent', 'info'].includes(a.tone))
      if (onGold) seen.push(a.tone)
      // The controls sit inside the marked box.
      expect(box.contains(screen.getByRole('link', { name: a.linkLabel }))).toBe(true)
      expect(box.contains(screen.getByRole('button', { name: `Dismiss: ${a.linkLabel}` }))).toBe(true)
    }
    expect([...new Set(seen)].sort()).toEqual(['', 'Gold', 'gold', 'teal'])
  })
})
