// @vitest-environment jsdom
//
// My region's This month bar after checkpoint U's pictures (WS09 checkpoint
// V). At 390 pixels wide each part of the bar wrapped onto a line of its
// own, and each such line started with the separator dot. Now, below the
// width where the bar sits on one line (lg, 1024px), the parts stand one
// under another with no dot drawn, and from that width up the bar reads as
// it did: one line, dots between. The dot is never read aloud. Held here by
// the markup and its classes; the pictures hold the look.
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { ThisMonthBar } from '@/areas/clubs/components/ThisMonthBar'

const THIS_MONTH = { nextCheck: { day: '2026-12-07', date: 'Mon, Dec 7, 2026', time: '8:00 AM' }, checked: 1, notChecked: 2 }

function draw(hasClubs = true) {
  render(<ThisMonthBar thisMonth={THIS_MONTH} hasClubs={hasClubs} toConfirm={2} running={false} onConfirmAll={() => {}} />)
  const heading = screen.getByRole('heading', { level: 2, name: 'This month' })
  // The row of the bar's parts, whose first holds the heading and, with Help's marks, the heading's mark after it.
  return { heading, row: heading.closest('section')!.firstElementChild as HTMLElement, section: heading.closest('section') as HTMLElement }
}

const classes = (el: Element) => (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean)
/** The classes that hold at a width below lg, and those lg adds. */
const narrow = (el: Element) => classes(el).filter((c) => !c.includes(':'))
const wide = (el: Element) => {
  const lg = classes(el).filter((c) => c.startsWith('lg:')).map((c) => c.slice(3))
  return [...narrow(el).filter((c) => !lg.some((w) => (w.startsWith('flex-') && c.startsWith('flex-') && !c.startsWith('flex-wrap')) || w === c)), ...lg]
}

afterEach(cleanup)

describe('the This month bar on a phone and from the wide layout up', () => {
  it('below lg the parts stack one under another, and no separator is drawn, so no line starts with one', () => {
    const { row } = draw()
    expect(narrow(row)).toContain('flex')
    expect(narrow(row)).toContain('flex-col')
    expect(narrow(row)).not.toContain('flex-wrap')
    const dots = [...row.querySelectorAll('p > span')]
    expect(dots).toHaveLength(3)
    for (const dot of dots) {
      expect(dot.textContent).toBe('· ')
      expect(narrow(dot)).toContain('hidden')
    }
  })

  it('from lg up the bar reads as the base drew it: one wrapping row, items on the baseline, the base\'s gaps, dots between', () => {
    const { row } = draw()
    // The base's row: flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-1 text-sm text-ink.
    expect(new Set(wide(row))).toEqual(new Set(['flex', 'min-w-0', 'flex-row', 'flex-wrap', 'items-baseline', 'gap-x-1.5', 'gap-y-1', 'text-sm', 'text-ink']))
    for (const dot of row.querySelectorAll('p > span')) expect(classes(dot)).toContain('lg:inline')
  })

  it('the words in the page are the base\'s but for "due", the dots in them, and no dot is read aloud in either layout', () => {
    const { row, section } = draw()
    // "due" in place of the base's "lands", by K's decision 10.
    expect(row.textContent).toBe('This month· Next monthly check due Mon, Dec 7, 2026· 1 of 3 checked in the last 90 days· 2 not checked in 90 days')
    expect(section.textContent).toBe(`${row.textContent}Confirm all still accurate`)
    for (const dot of row.querySelectorAll('p > span')) expect(dot.getAttribute('aria-hidden')).toBe('true')
    // Each part is its own paragraph, so it reads as its own line with no dot in either layout.
    expect([...row.querySelectorAll('p')].map((p) => [...p.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(''))).toEqual([
      'Next monthly check due Mon, Dec 7, 2026', '1 of 3 checked in the last 90 days', '2 not checked in 90 days',
    ])
  })

  it('with no club the bar names the next check alone, the same way', () => {
    const { row } = draw(false)
    expect(row.querySelectorAll('p')).toHaveLength(1)
    expect(narrow(row.querySelector('p > span')!)).toContain('hidden')
  })

  it('the change is a class change in ThisMonthBar.tsx alone, and My region still draws the bar', () => {
    const root = resolve(__dirname, '../..')
    const bar = readFileSync(join(root, 'src/areas/clubs/components/ThisMonthBar.tsx'), 'utf8')
    expect(bar).toContain('<span aria-hidden="true" className="hidden lg:inline">· </span>')
    expect(readFileSync(join(root, 'src/pages/MyRegionPage.tsx'), 'utf8')).toContain('<ThisMonthBar')
  })
})
