// test/a11y/clubs-reflow.spec.ts
//
// The new club page on a narrow phone, on the clubs build alone (the
// a11y-clubs project; see test/a11y/global-setup.ts), for a visitor who is
// signed out: at 320 by 568 and at 390 by 844, each fixture club's page at
// its short address does not scroll sideways, and nothing on it is wider
// than the window, measured as the suite's other reflow checks measure (the
// page's scroll width against its client width, and each box's right edge
// against the client width; a box set off the left edge on purpose, as the
// skip link is until it has the focus, scrolls nothing). A box inside a
// part that scrolls on its own (the section nav's row) or clips what
// overflows it (the cover, the map) is measured by that part instead. The
// cover's line names the club's region, the longest words on the page's
// first screen, and must wrap.
//
// Reads only.
import type { TestInfo } from '@playwright/test'
import { expect, openDrawn, test } from './support'
import { A11Y_CLUBS_VARIANT } from './global-setup'
import { cityLine } from '../../domain/clubs/pageWords'

const SIZES = [{ width: 320, height: 568 }, { width: 390, height: 844 }] as const

const FIXTURE_CLUBS = [
  { slug: 'fixture-capital-chess-club', name: 'Fixture Capital Chess Club', city: 'Baton Rouge', region: 'Baton Rouge / East Central' },
  { slug: 'fixture-north-chess-club', name: 'Fixture North Chess Club', city: 'Monroe', region: 'North Louisiana' },
] as const

function onlyClubs(testInfo: TestInfo) {
  test.skip(testInfo.project.name !== A11Y_CLUBS_VARIANT.name, 'the new club pages are drawn on the clubs build alone')
}

for (const club of FIXTURE_CLUBS) {
  for (const size of SIZES) {
    test(`${club.slug} at ${size.width} by ${size.height} does not scroll sideways, and nothing on it is wider than the window`, async ({ page, external }, testInfo) => {
      onlyClubs(testInfo)
      await page.setViewportSize(size)
      const line = page.locator('main').getByText(cityLine(club.city, club.region), { exact: true })
      await openDrawn(page, `/clubs/${club.slug}`, [page.getByRole('heading', { level: 1, name: club.name, exact: true }), line])
      await page.evaluate(() => document.fonts.ready)

      const m = await page.evaluate(() => {
        const room = document.documentElement.clientWidth
        /** A part that scrolls on its own or clips what overflows it. */
        const holds = (el: Element) => ['auto', 'scroll', 'hidden', 'clip'].includes(getComputedStyle(el).overflowX)
        const wide: string[] = []
        for (const el of Array.from(document.body.querySelectorAll('*'))) {
          const box = el.getBoundingClientRect()
          if (box.width === 0 || box.height === 0) continue
          let holder: Element | null = null
          for (let up = el.parentElement; up && up !== document.body; up = up.parentElement) {
            if (holds(up)) {
              holder = up
              break
            }
          }
          if (holder) continue
          if (box.right > room + 0.5) {
            const name = `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${el.getAttribute('data-slot') ? `[data-slot=${el.getAttribute('data-slot')}]` : ''}`
            wide.push(`${name} from ${Math.round(box.left)} to ${Math.round(box.right)}`)
          }
        }
        return { scroll: document.documentElement.scrollWidth, room, wide }
      })
      expect(m.scroll, `scroll width ${m.scroll} in a window ${m.room} wide`).toBeLessThanOrEqual(m.room)
      expect(m.wide).toEqual([])

      // The cover's line, region and all, sits inside the window: it wraps rather than run off.
      const box = await line.boundingBox()
      expect(box, 'the cover\'s line').not.toBeNull()
      expect(box!.x).toBeGreaterThanOrEqual(0)
      expect(box!.x + box!.width).toBeLessThanOrEqual(m.room + 0.5)
      expect(external).toEqual([])
    })
  }
}
