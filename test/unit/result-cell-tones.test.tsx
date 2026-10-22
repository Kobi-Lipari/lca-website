// @vitest-environment jsdom
//
// test/unit/result-cell-tones.test.tsx
//
// The colours of a crosstable's result cell and its key (WS01 step 27), in
// every look: today's (newLook off, where the fixture page draws the cell)
// and each look newLook brings (base light and dark, live, scholastic and
// heritage, light and dark). The classes are read from the cell as it is
// drawn, not written out here, and each is turned into the token it reads.
//
// - A win, a loss and a draw put their words on their own tint, and every
//   other cell (a forfeit, a bye, a round not played, a game in play) its
//   words on the surface: each reaches 4.5:1, the ratio 13px words need.
//   The mark of the colour played is drawn in the words' colour, so it
//   reaches the 3:1 a shape needs with them.
// - The words of a win and a loss stay green and red in every look: they
//   read the ok and bad tokens, not the status words, which in the live look
//   turn gold for a full event (index.css). So the live look's loss is never
//   gold, and a win, a loss and a draw never share a colour.
// - The key's words and letters reach 4.5:1 on the page and on a card.
//
// test/unit/contrast.test.ts holds the ok and bad pairs among the pairs the
// status map writes, in the new looks; the draw's ink on its tint, the
// outline's words and today's look are held here.
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ResultCell, ResultLegend, type ResultCellProps } from '@/components/ResultCell'
import { contrast, indexCssRules, rootTokens, scopeTokens } from './helpers/cssTokens'

afterEach(cleanup)

const rules = indexCssRules()
/** The tokens a container sees, in today's look and in each look newLook brings. */
const LOOKS: Record<string, Map<string, string>> = {
  today: rootTokens(rules, { look: false, dark: false }),
  base: rootTokens(rules, { look: true, dark: false }),
  'base in dark mode': rootTokens(rules, { look: true, dark: true }),
  live: scopeTokens(rules, { look: true, dark: false }, 'live'),
  'live in dark mode': scopeTokens(rules, { look: true, dark: true }, 'live'),
  scholastic: scopeTokens(rules, { look: true, dark: false }, 'scholastic'),
  heritage: scopeTokens(rules, { look: true, dark: false }, 'heritage'),
  'heritage in dark mode': scopeTokens(rules, { look: true, dark: true }, 'heritage'),
}
const NEW_LOOKS = Object.keys(LOOKS).filter((name) => name !== 'today')

/** An oklch() colour, as the plain :root writes today's tones, in sRGB hex. */
function oklchToHex(value: string): string {
  const m = value.match(/^oklch\(([\d.]+)(%?) ([\d.]+) ([\d.]+)\)$/)
  if (!m) throw new Error(`${value} is not an oklch() colour`)
  const L = Number(m[1]) / (m[2] ? 100 : 1)
  const C = Number(m[3])
  const h = (Number(m[4]) * Math.PI) / 180
  const a = C * Math.cos(h)
  const b = C * Math.sin(h)
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const mm = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  const linear = [
    4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * s,
  ]
  const gamma = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)
  return `#${linear.map((c) => Math.round(Math.min(1, Math.max(0, gamma(c))) * 255).toString(16).padStart(2, '0')).join('')}`
}

/** A token's colour in a look, as hex. */
function colour(look: Map<string, string>, token: string): string {
  const value = look.get(token)
  if (!value) throw new Error(`${token} is not set`)
  if (/^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(value)) return value
  return oklchToHex(value)
}

/** The token a colour class reads: bg-ok-50 reads --ok-50, text-muted-foreground reads --muted-foreground. */
const tokenOf = (cls: string) => `--${cls.replace(/^(bg|text)-/, '')}`

/** The ground and words classes a drawn element carries (sizes such as text-[13px] and text-xs are not colours). */
function coloursOf(el: Element): { ground: string; words: string } {
  const classes = (el.getAttribute('class') ?? '').split(/\s+/)
  const grounds = classes.filter((c) => /^bg-[a-z]/.test(c))
  const words = classes.filter((c) => /^text-[a-z]/.test(c) && !/^text-(xs|sm|base|lg|xl|\d)/.test(c) && !/^text-(left|right|center)$/.test(c))
  expect(grounds, el.outerHTML).toHaveLength(1)
  expect(words, el.outerHTML).toHaveLength(1)
  return { ground: grounds[0], words: words[0] }
}

/** One cell of each kind, as the crosstable draws them. */
const KINDS: Array<[string, ResultCellProps]> = [
  ['a win', { code: 'W', opponent: 17, color: 'white' }],
  ['a loss', { code: 'L', opponent: 3, color: 'black' }],
  ['a draw', { code: 'D', opponent: 8, color: 'white' }],
  ['a forfeit won', { code: 'X', opponent: 20 }],
  ['a forfeit lost', { code: 'F', opponent: 7 }],
  ['a full-point bye', { code: 'B' }],
  ['a half-point bye', { code: 'H' }],
  ['a round not played', { code: 'U' }],
  ['a game in play', { code: '', opponent: 6, color: 'black' }],
]

function tone(props: ResultCellProps) {
  const { container } = render(<ResultCell {...props} />)
  const box = container.querySelector('[data-slot="result-cell"]')!
  const found = { ...coloursOf(box), mark: box.querySelector('svg circle') }
  cleanup()
  return found
}

describe('the converter of today\'s oklch() tones', () => {
  it('gives the greys the browser draws for them (the ones components.spec.ts reads from axe)', () => {
    expect(oklchToHex('oklch(0.556 0 0)')).toBe('#737373')
    expect(oklchToHex('oklch(0.97 0 0)')).toBe('#f5f5f5')
    expect(oklchToHex('oklch(1 0 0)')).toBe('#ffffff')
  })
})

describe.each(Object.entries(LOOKS))('%s', (_look, tokens) => {
  it.each(KINDS)('%s: its words reach 4.5:1 on its ground', (name, props) => {
    const { ground, words } = tone(props)
    const ratio = contrast(colour(tokens, tokenOf(words)), colour(tokens, tokenOf(ground)))
    expect(ratio, `${name}: ${words} on ${ground}`).toBeGreaterThanOrEqual(4.5)
  })

  it('the key\'s words and letters reach 4.5:1 on the page and on a card', () => {
    const { container } = render(<ResultLegend />)
    const legend = container.querySelector('[data-slot="result-legend"]')!
    const letter = legend.querySelector('li span')!
    const classes = (el: Element) => (el.getAttribute('class') ?? '').split(/\s+/).filter((c) => /^text-[a-z]/.test(c) && !/^text-(xs|sm)$/.test(c))
    for (const words of [...classes(legend), ...classes(letter)]) {
      for (const ground of ['--ground', '--surface']) {
        expect(contrast(colour(tokens, tokenOf(words)), colour(tokens, ground)), `${words} on ${ground}`).toBeGreaterThanOrEqual(4.5)
      }
    }
  })
})

describe('the mark is drawn in the words\' colour, so it carries their contrast', () => {
  it.each(KINDS.filter(([, p]) => p.color))('%s', (_name, props) => {
    const { mark } = tone(props)
    expect(mark).not.toBeNull()
    const paint = mark!.getAttribute('fill') === 'none' ? mark!.getAttribute('stroke') : mark!.getAttribute('fill')
    expect(paint).toBe('currentColor')
  })
})

describe('a win and a loss keep their own colours in every look', () => {
  it.each(NEW_LOOKS)('%s: the win\'s words are the ok colour and the loss\'s the bad colour, never the status words', (look) => {
    const tokens = LOOKS[look]
    const win = colour(tokens, tokenOf(tone(KINDS[0][1]).words))
    const loss = colour(tokens, tokenOf(tone(KINDS[1][1]).words))
    const draw = colour(tokens, tokenOf(tone(KINDS[2][1]).words))
    expect(win).toBe(colour(tokens, '--ok'))
    expect(loss).toBe(colour(tokens, '--bad'))
    expect(new Set([win, loss, draw]).size).toBe(3)
    // In the live look a full event's words are gold; a loss must not take them.
    if (look.startsWith('live')) expect(loss).not.toBe(colour(tokens, '--status-full'))
  })

  it('today: the win, the loss and the draw are three colours too', () => {
    const tokens = LOOKS.today
    const words = KINDS.slice(0, 3).map(([, p]) => colour(tokens, tokenOf(tone(p).words)))
    expect(new Set(words).size).toBe(3)
  })
})
