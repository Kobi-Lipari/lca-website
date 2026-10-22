// @vitest-environment jsdom
//
// The heritage look's two ornaments (WS01 step 31): ThickThinRule
// (src/components/ThickThinRule.tsx) and Seal (src/components/Seal.tsx).
//
// - The rule is the board's 6px box, a 3px line over a 1px one, or the
//   reverse to close a section; in the look's ink on a light ground, which
//   follows the look and turns light in dark mode, and in brand gold on a
//   navy band. It is decoration, hidden from screen readers.
// - The seal is the decided board's: a navy disc and two rings of brand
//   gold, the gold only as the seal's line, with the rook drawn by LcaMark
//   inside the seal's own SVG, so the path stays in LcaMark.tsx; the group
//   around the mark gives it its colour and the mark has none of its own.
//   It adds no words, and it is decoration, never focused.
// - Neither moves, and neither names a raw colour: both colour through the
//   tokens and the brand colours of src/index.css.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Seal } from '@/components/Seal'
import { ThickThinRule } from '@/components/ThickThinRule'

afterEach(cleanup)

const ROOT = join(__dirname, '../..')
const source = (file: string) => readFileSync(join(ROOT, file), 'utf8')
const classesOf = (el: Element) => (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean)
const ROOK = source('public/favicon.svg').match(/<path[^>]* d="([^"]+)"/)![1]

describe('ThickThinRule', () => {
  it('opens a section on a light ground: a 6px box, 3px on top and 1px below, in the look\'s ink, hidden from screen readers', () => {
    const { container } = render(<ThickThinRule />)
    const rule = container.firstElementChild!
    expect(container.children).toHaveLength(1)
    expect(rule.tagName).toBe('DIV')
    expect(rule.getAttribute('aria-hidden')).toBe('true')
    expect(rule.getAttribute('data-slot')).toBe('thick-thin-rule')
    expect(rule.childNodes).toHaveLength(0)
    expect(classesOf(rule)).toEqual(expect.arrayContaining(['h-1.5', 'border-t-[3px]', 'border-b', 'border-ink']))
    expect(classesOf(rule).filter((c) => /lca-gold|brand-navy/.test(c))).toEqual([])
  })

  it('closes a section the other way round, and on a navy band is brand gold', () => {
    const close = render(<ThickThinRule edge="close" />).container.firstElementChild!
    expect(classesOf(close)).toEqual(expect.arrayContaining(['border-t', 'border-b-[3px]', 'border-ink']))
    expect(classesOf(close)).not.toContain('border-t-[3px]')
    cleanup()
    const navy = render(<ThickThinRule on="navy" />).container.firstElementChild!
    expect(classesOf(navy)).toEqual(expect.arrayContaining(['border-t-[3px]', 'border-b', 'border-lca-gold']))
    expect(classesOf(navy)).not.toContain('border-ink')
  })

  it('takes a class for its place, such as its margin', () => {
    const rule = render(<ThickThinRule className="mb-8" />).container.firstElementChild!
    expect(classesOf(rule)).toContain('mb-8')
  })
})

describe('Seal', () => {
  it('is an SVG hidden from screen readers and never focused, with no words of its own', () => {
    const { container } = render(<Seal />)
    const seal = container.firstElementChild as SVGSVGElement
    expect(seal.tagName.toLowerCase()).toBe('svg')
    expect(seal.getAttribute('data-slot')).toBe('seal')
    expect(seal.getAttribute('aria-hidden')).toBe('true')
    expect(seal.getAttribute('focusable')).toBe('false')
    expect(seal.getAttribute('role')).toBeNull()
    expect(seal.querySelectorAll('text, title, desc')).toHaveLength(0)
    expect(seal.textContent).toBe('')
    expect(classesOf(seal)).toEqual(expect.arrayContaining(['size-16']))
  })

  it('draws a navy disc inside two rings of brand gold, the gold only as the seal\'s line', () => {
    const seal = render(<Seal />).container.firstElementChild!
    const circles = [...seal.querySelectorAll('circle')]
    expect(circles).toHaveLength(3)
    expect(classesOf(circles[0])).toEqual(['fill-brand-navy'])
    for (const ring of circles.slice(1)) {
      expect(classesOf(ring)).toEqual(['stroke-lca-gold'])
      expect(ring.getAttribute('fill')).toBe('none')
    }
    expect(circles.map((c) => Number(c.getAttribute('r')))).toEqual([49, 45.5, 30])
  })

  it('draws the rook through LcaMark inside its own SVG: the favicon\'s one path, coloured by the group around it, with no colour of its own', () => {
    const seal = render(<Seal />).container.firstElementChild!
    const mark = seal.querySelector('[data-slot="lca-mark"]')!
    expect(mark.tagName.toLowerCase()).toBe('svg')
    expect(mark.getAttribute('aria-hidden')).toBe('true')
    expect(mark.getAttribute('fill')).toBe('currentColor')
    expect(classesOf(mark).filter((c) => /^(?:text|fill|stroke)-/.test(c))).toEqual([])
    expect(classesOf(mark)).toContain('size-full')
    const paths = [...seal.querySelectorAll('path')]
    expect(paths).toHaveLength(1)
    expect(paths[0].getAttribute('d')).toBe(ROOK)
    const group = mark.parentElement!
    expect(group.tagName.toLowerCase()).toBe('g')
    expect(classesOf(group)).toEqual(['text-white'])
    expect(group.getAttribute('transform')).toBe('translate(32.3 32) scale(0.34)')
    // The path is written in LcaMark.tsx alone.
    expect(source('src/components/Seal.tsx')).not.toContain(ROOK.slice(0, 30))
  })

  it('takes a class for its size', () => {
    const seal = render(<Seal className="hidden sm:block" />).container.firstElementChild!
    expect(classesOf(seal)).toEqual(expect.arrayContaining(['hidden', 'sm:block', 'size-16']))
  })
})

describe('both ornaments', () => {
  /** Colour classes that follow no look, put together when the test runs so the stylesheet build takes none of them for a class. */
  const RAW = new RegExp([['bg', 'white'], ['text', 'black'], ['fill', 'white'], ['stroke', 'white']].map((p) => p.join('-')).join('|'))
  /** Brand gold as words, put together the same way. */
  const GOLD_WORDS = new RegExp([['text', 'lca', 'gold'], ['text', 'gold\\b']].map((p) => p.join('-')).join('|'))

  it.each(['src/components/ThickThinRule.tsx', 'src/components/Seal.tsx'])('%s names no raw colour and nothing that moves', (file) => {
    const text = source(file)
    expect(text).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(text).not.toMatch(/rgb\(|hsl\(|oklch\(/)
    expect(text).not.toMatch(RAW)
    expect(text).not.toMatch(/animate-|transition|@keyframes/)
    // Brand gold is a line only: never a text colour.
    expect(text).not.toMatch(GOLD_WORDS)
  })
})
