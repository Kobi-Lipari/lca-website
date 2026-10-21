// test/a11y/chess-data-edges.spec.ts
//
// What test/a11y/chess-data.spec.ts leaves out of WS01 step 27's chess data,
// in the browser, on both builds.
//
// - The pinned columns sit on an opaque ground in every look: on each
//   fixture (base, heritage, scholastic, live, and on a11y-on base and
//   heritage in dark mode) the number and the name of the sample crosstable
//   are on the look's own surface, read from the scope as the browser
//   resolves it, with no transparency; the header row's tint and first
//   place's tint are laid over that ground and match the rest of their row,
//   and a row with no tint lays nothing over it.
// - The tints a row takes as it is used reach the pinned cells too: the
//   hover tint, on first place's row as well (where it takes the place of
//   the gold), and a selected row's tint, each the same colour on the
//   pinned cells as on the rest of the row, and gone again when the pointer
//   leaves.
// - On paper the pinned cells and a bounded box's header are not pinned:
//   table.tsx and REDESIGN_STATUS.md say they are static there, on the
//   fixture and on the printed crosstable and standings.
// - The half point and the figures are drawn from the monospace face's own
//   latin file on a11y-on, the one file of the face the four chess views
//   fetch, and with newLook off the face is never fetched and no figure is
//   drawn in it.
// - The figures line up: in the seeded standings each score of the same
//   length is drawn the same width, and on a11y-on the ½ takes the width of
//   a figure, as one monospace face draws them.
// - Every round cell of the seeded crosstable is named in words as a screen
//   reader gives the cell, on the pairings page and the print page, and each
//   row by the player's name.
// - At a phone's width the keyboard reaches the standings' box and the
//   crosstable's box with Tab, after the view's own tabs.
//
// Each page is read once its table rows are drawn, not on network idle
// alone, and a page that draws its error message because its data request
// failed is loaded once more. Reads only.
import type { Locator, Page } from '@playwright/test'
import { expect, test } from './support'

const ON = 'a11y-on'
const EVENT = '/tournaments/fx-t-done'
const FIXTURES = ['base', 'heritage', 'scholastic', 'live'] as const
/** Each look's surface (src/index.css) on a11y-on; with newLook off every fixture is today's white. */
const SURFACE: Record<string, string> = {
  base: 'rgb(255, 255, 255)',
  heritage: 'rgb(255, 253, 248)',
  scholastic: 'rgb(255, 255, 255)',
  live: 'rgb(14, 21, 38)',
  'base in dark mode': 'rgb(17, 26, 44)',
  'heritage in dark mode': 'rgb(17, 26, 44)',
}
const WHITE = 'rgb(255, 255, 255)'
const TRANSPARENT = 'rgba(0, 0, 0, 0)'
/** An opaque colour as getComputedStyle writes it. */
const OPAQUE = /^rgb\(\d+, \d+, \d+\)$/

/**
 * Waits for the section's rows, not for network idle. When the page's data
 * request fails, as it did now and then while the two servers shared one
 * local database that answered SQLITE_BUSY (REDESIGN_STATUS.md, Follow-ups,
 * "The a11y servers share one database (step 23)"), a page that drew its
 * error message instead is loaded once more, and the rows must then be there.
 */
async function rowsDrawn(page: Page, count = 5) {
  const rows = page.locator('main table').first().locator('tbody tr')
  const error = page.locator('main p.text-destructive')
  await expect(rows.first().or(error)).toBeVisible()
  if (await error.isVisible()) {
    console.log(`${page.url()} drew its error message (${await error.innerText()}); loading it once more`)
    await page.reload()
  }
  await expect(rows).toHaveCount(count)
}

/** The fixture's sample crosstable, once its six rows are drawn. */
async function sampleCrosstable(page: Page, name: string): Promise<Locator> {
  await page.goto(`/__fixtures/${name}`)
  const box = page.getByRole('region', { name: 'Sample crosstable' })
  await expect(box.locator('tbody tr')).toHaveCount(6)
  return box
}

/** Each row of a box's table: the row's own colour, and its first cells' grounds, tints and positions. */
function rowsOf(box: Locator) {
  return box.evaluate((el) => [...el.querySelectorAll('tr')].map((tr) => {
    const cells = [...tr.children] as HTMLElement[]
    const style = (c: HTMLElement) => getComputedStyle(c)
    return {
      head: tr.parentElement!.tagName === 'THEAD',
      row: getComputedStyle(tr).backgroundColor,
      ground: cells.slice(0, 2).map((c) => style(c).backgroundColor),
      tint: cells.slice(0, 2).map((c) => style(c).backgroundImage),
      rest: cells.slice(2).map((c) => style(c).backgroundColor),
      position: cells.map((c) => style(c).position),
    }
  }))
}

/** The surface of the look the box sits in, as the browser resolves var(--surface) there. */
function surfaceAround(box: Locator): Promise<string> {
  return box.evaluate((el) => {
    const probe = document.createElement('div')
    probe.style.backgroundColor = 'var(--surface)'
    el.parentElement!.appendChild(probe)
    const colour = getComputedStyle(probe).backgroundColor
    probe.remove()
    return colour
  })
}

/** A row's tint laid over a pinned cell, as getComputedStyle writes the layer. */
const layer = (colour: string) => `linear-gradient(${colour}, ${colour})`

// ── Pinned cells on an opaque ground, in every look (acceptance criterion 6) ──

test.describe('the pinned cells of the sample crosstable, in every look', () => {
  test.use({ colorScheme: 'light', reducedMotion: 'reduce', viewport: { width: 1280, height: 900 } })

  for (const name of FIXTURES) {
    test(`${name}: the number and the name sit on the look's opaque surface, with each row's tint laid over it`, async ({ page }, testInfo) => {
      const box = await sampleCrosstable(page, name)
      const surface = await surfaceAround(box)
      expect(surface).toBe(testInfo.project.name === ON ? SURFACE[name] : WHITE)
      const rows = await rowsOf(box)
      expect(rows.map((r) => r.head)).toEqual([true, false, false, false, false, false, false])
      for (const [i, r] of rows.entries()) {
        const at = r.head ? 'the header' : `row ${i}`
        // Opaque, and the look's own surface, so nothing that scrolls under the cell shows through.
        expect(r.ground, at).toEqual([surface, surface])
        for (const g of r.ground) expect(g, at).toMatch(OPAQUE)
        if (r.head || i === 1) {
          // The header's tint and first place's tint: laid over the pinned cells, the same colour as the row.
          expect(r.row, at).not.toBe(TRANSPARENT)
          expect(r.tint, at).toEqual([layer(r.row), layer(r.row)])
        } else {
          expect(r.row, at).toBe(TRANSPARENT)
          expect(r.tint, at).toEqual(['none', 'none'])
          // The cells that scroll paint nothing of their own, so the row shows through them.
          for (const c of r.rest) expect(c, at).toBe(TRANSPARENT)
        }
        expect(r.position.slice(0, 2), at).toEqual(['sticky', 'sticky'])
      }
    })
  }
})

test.describe('the pinned cells in dark mode', () => {
  test.use({ colorScheme: 'dark', reducedMotion: 'reduce', viewport: { width: 1280, height: 900 } })

  for (const name of ['base', 'heritage'] as const) {
    test(`${name}: the number and the name sit on the dark surface`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== ON, 'only the a11y-on build has dark mode')
      const box = await sampleCrosstable(page, name)
      await expect(page.locator('html')).toHaveClass(/\bdark\b/)
      const surface = await surfaceAround(box)
      expect(surface).toBe(SURFACE[`${name} in dark mode`])
      for (const r of await rowsOf(box)) {
        expect(r.ground).toEqual([surface, surface])
        if (r.tint[0] !== 'none') expect(r.tint).toEqual([layer(r.row), layer(r.row)])
      }
    })
  }
})

// ── The tints a row takes as it is used (acceptance criterion 6) ─────────────

test.describe('the hover tint and a selected row\'s tint', () => {
  test.use({ colorScheme: 'light', reducedMotion: 'reduce', viewport: { width: 1280, height: 900 } })

  test('reach the pinned cells, the same colour as the rest of the row, and leave with the pointer', async ({ page }) => {
    const box = await sampleCrosstable(page, 'base')
    const body = box.locator('tbody tr')
    /** The row at index i of the body, read again. */
    const row = async (i: number) => (await rowsOf(box)).filter((r) => !r.head)[i]

    // A row with no tint of its own, under the pointer.
    await body.nth(2).locator('td').last().hover()
    await expect.poll(async () => (await row(2)).row).not.toBe(TRANSPARENT)
    const hovered = await row(2)
    expect(hovered.tint).toEqual([layer(hovered.row), layer(hovered.row)])
    expect(hovered.ground).toEqual([WHITE, WHITE])

    // First place's row under the pointer takes the same hover tint in place of its gold, pinned cells included.
    const gold = (await row(0)).row
    await body.nth(0).locator('td').last().hover()
    await expect.poll(async () => (await row(0)).row).toBe(hovered.row)
    expect((await row(0)).tint).toEqual([layer(hovered.row), layer(hovered.row)])
    expect(gold).not.toBe(hovered.row)

    // The pointer leaves: the plain row lays nothing over its pinned cells again, and first place has its gold back.
    await page.mouse.move(0, 0)
    await expect.poll(async () => (await row(2)).row).toBe(TRANSPARENT)
    expect((await row(2)).tint).toEqual(['none', 'none'])
    expect((await row(0)).row).toBe(gold)

    // A selected row.
    await body.nth(3).evaluate((tr) => tr.setAttribute('data-state', 'selected'))
    const selected = await row(3)
    expect(selected.row).not.toBe(TRANSPARENT)
    expect(selected.tint).toEqual([layer(selected.row), layer(selected.row)])
  })
})

// ── On paper ──────────────────────────────────────────────────────────────

test.describe('on paper', () => {
  test.use({ colorScheme: 'light', reducedMotion: 'reduce', viewport: { width: 740, height: 1000 } })

  test('the sample crosstable\'s pinned cells and its bounded box\'s header are static, as table.tsx says', async ({ page }) => {
    const box = await sampleCrosstable(page, 'base')
    await page.emulateMedia({ media: 'print' })
    // The bounded box gives up its bound on paper, so the whole table prints.
    expect(await box.evaluate((el) => ({ maxHeight: getComputedStyle(el).maxHeight, overflow: getComputedStyle(el).overflowX }))).toEqual({ maxHeight: 'none', overflow: 'visible' })
    const rows = await rowsOf(box)
    for (const [i, r] of rows.entries()) {
      expect(r.position, r.head ? 'the header' : `row ${i}`).toEqual(r.position.map(() => 'static'))
    }
  })

  for (const what of ['crosstable', 'standings'] as const) {
    test(`every cell of the printed ${what} is static`, async ({ page }) => {
      await page.goto(`${EVENT}/print?what=${what}`)
      await rowsDrawn(page)
      await page.emulateMedia({ media: 'print' })
      const positions = await page.locator('main table').first().evaluate((table) =>
        [...table.querySelectorAll('tr')].map((tr) => [...tr.children].map((c) => getComputedStyle(c).position)),
      )
      expect(positions.flat().filter((p) => p !== 'static')).toEqual([])
    })
  }
})

// ── The face the figures are drawn in (acceptance criteria 2 and 5) ──────────

test.describe('the monospace face', () => {
  test.use({ colorScheme: 'light', reducedMotion: 'reduce', viewport: { width: 1280, height: 900 } })

  test('on a11y-on the half point is drawn from the face\'s latin file; with newLook off the face is never fetched', async ({ page }, testInfo) => {
    const fetched: string[] = []
    page.on('request', (r) => {
      if (/geist-mono/i.test(r.url())) fetched.push(new URL(r.url()).pathname)
    })
    const views: Array<[string, () => Promise<void>]> = [
      ['standings', async () => { await page.goto(`${EVENT}/pairings`); await rowsDrawn(page) }],
      ['crosstable', async () => { await page.getByRole('tab', { name: 'Crosstable' }).click(); await rowsDrawn(page) }],
      ['printed standings', async () => { await page.goto(`${EVENT}/print?what=standings`); await rowsDrawn(page) }],
      ['printed crosstable', async () => { await page.goto(`${EVENT}/print?what=crosstable`); await rowsDrawn(page) }],
    ]
    for (const [view, open] of views) {
      await open()
      await page.evaluate(() => document.fonts.ready)
      const faces = await page.evaluate(() => {
        /** Whether a unicode-range such as "U+0-FF, U+131" covers a code point. */
        const covers = (range: string, point: number) => range.split(',').some((part) => {
          const [a, b = a] = part.trim().replace(/^U\+/i, '').split('-')
          return point >= parseInt(a, 16) && point <= parseInt(b, 16)
        })
        return [...document.fonts].filter((f) => /Geist Mono/.test(f.family)).map((f) => ({ half: covers(f.unicodeRange, 0xbd), status: f.status }))
      })
      expect(faces.length, view).toBe(6)
      const inMono = await page.locator('main').evaluate((main) =>
        // textContent, not innerText: the marks are SVG, which has no innerText.
        [...main.querySelectorAll('*')].filter((el) => /Geist Mono/.test(getComputedStyle(el).fontFamily)).map((el) => (el.textContent ?? '').trim()),
      )
      if (testInfo.project.name === ON) {
        // The latin file, which holds the ½, is the one file loaded; the other five subsets are never needed.
        expect(faces.filter((f) => f.status === 'loaded'), view).toEqual([{ half: true, status: 'loaded' }])
        expect(inMono.length, view).toBeGreaterThan(0)
        expect(inMono.join(' '), view).toContain('½')
        expect(inMono.join(' '), view).not.toMatch(/\d\.5/)
      } else {
        expect(faces.every((f) => f.status === 'unloaded'), view).toBe(true)
        expect(inMono, view).toEqual([])
      }
    }
    if (testInfo.project.name === ON) {
      expect(fetched.length).toBeGreaterThan(0)
      expect([...new Set(fetched.map((p) => p.replace(/-[\w]+\.woff2$/, '')))]).toEqual(['/assets/geist-mono-latin-wght-normal'])
    } else {
      expect(fetched).toEqual([])
    }
  })
})

test.describe('the figures line up', () => {
  test.use({ colorScheme: 'light', reducedMotion: 'reduce', viewport: { width: 1280, height: 900 } })

  test('in the standings, scores of the same length take the same width, and on a11y-on the ½ takes a figure\'s width', async ({ page }, testInfo) => {
    await page.goto(`${EVENT}/pairings`)
    await rowsDrawn(page)
    await page.evaluate(() => document.fonts.ready)
    /** The drawn width of the text in each row's points cell (the fourth, after the place, the name and the rating). */
    const points = await page.locator('main table').first().evaluate((table) => [...table.querySelectorAll('tbody tr')].map((tr) => {
      const cell = tr.querySelectorAll(':scope > th, :scope > td')[3] as HTMLElement
      const range = document.createRange()
      range.selectNodeContents(cell)
      return { text: (cell.textContent ?? '').trim(), width: range.getBoundingClientRect().width }
    }))
    const on = testInfo.project.name === ON
    expect(points.map((p) => p.text)).toEqual(on ? ['2½', '2', '1½', '1½', '½'] : ['2.5', '2', '1.5', '1.5', '0.5'])
    // Every score of the same length is drawn the same width, so the columns of figures line up.
    const byLength = new Map<number, number[]>()
    for (const p of points) byLength.set(p.text.length, [...(byLength.get(p.text.length) ?? []), p.width])
    for (const [length, widths] of byLength) {
      for (const w of widths) expect(Math.abs(w - widths[0]), `${length} characters: ${widths.join(', ')}`).toBeLessThan(0.5)
    }
    if (on) {
      // One face, every character the same width: the ½ is the face's own, not a wider one from another font.
      const one = points.find((p) => p.text === '½')!.width
      expect(Math.abs(points.find((p) => p.text === '2')!.width - one)).toBeLessThan(0.5)
      expect(Math.abs(points.find((p) => p.text === '2½')!.width - 2 * one)).toBeLessThan(0.5)
    }
  })
})

// ── Every round cell named in words (acceptance criterion 3) ─────────────────

/** The seed's crosstable, by player: each round in words, then the total. */
const GAMES: Array<[string, string[], string]> = [
  ['Avery Fixture', ['Won with White against 5', 'Drew with Black against 2', 'Won with Black against 3'], '2½'],
  ['Riley Fixture', ['Full-point bye', 'Drew with White against 1', 'Drew with Black against 4'], '2'],
  ['Casey Fixture', ['Drew with White against 4', 'Won with Black against 5', 'Lost with White against 1'], '1½'],
  ['Morgan Fixture', ['Drew with Black against 3', 'Half-point bye', 'Drew with White against 2'], '1½'],
  ['Jordan Fixture', ['Lost with Black against 1', 'Lost with White against 3', 'Half-point bye'], '½'],
]

test.describe('the seeded crosstable, as a screen reader gives it', () => {
  test.use({ colorScheme: 'light', reducedMotion: 'reduce', viewport: { width: 1280, height: 900 } })

  const views: Array<[string, (page: Page) => Promise<void>]> = [
    ['on the pairings page', async (page) => {
      await page.goto(`${EVENT}/pairings`)
      await rowsDrawn(page)
      await page.getByRole('tab', { name: 'Crosstable' }).click()
      await expect(page.locator('main table thead th', { hasText: 'Rd 3' })).toBeVisible()
      await rowsDrawn(page)
    }],
    ['on the print page', async (page) => {
      await page.goto(`${EVENT}/print?what=crosstable`)
      await rowsDrawn(page)
    }],
  ]

  for (const [where, open] of views) {
    test(`${where}: every round cell is named in words, each row by the player`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== ON, 'the games in words are the new look\'s; today\'s cells show the code and a w or b')
      await open(page)
      const table = page.locator('main table').first()
      const rows = table.locator('tbody tr')
      for (const [i, [player, games, total]] of GAMES.entries()) {
        const row = rows.nth(i)
        await expect(row.getByRole('rowheader')).toHaveAccessibleName(new RegExp(`^${player} \\(\\d\\)$`))
        // The cells after the row header: the number, the rating, the three rounds and the total.
        const cells = row.getByRole('cell')
        await expect(cells).toHaveCount(6)
        for (const [r, words] of games.entries()) await expect(cells.nth(2 + r), `${player}, round ${r + 1}`).toHaveAccessibleName(words)
        await expect(cells.nth(5)).toHaveAccessibleName(total)
      }
    })
  }
})

// ── The keyboard reaches each box at a phone's width (acceptance criterion 4) ─

test.describe('at a phone\'s width', () => {
  test.use({ colorScheme: 'light', reducedMotion: 'reduce', viewport: { width: 390, height: 900 } })

  test('Tab reaches the standings\' box and the crosstable\'s box after the view\'s tabs', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== ON, 'today\'s boxes are not in the tab order; chess-data.spec.ts holds them to that one finding')
    await page.goto(`${EVENT}/pairings`)
    await rowsDrawn(page)
    for (const [tab, name] of [['Standings', 'Open standings'], ['Crosstable', 'Open crosstable']] as const) {
      await page.getByRole('tab', { name: tab }).click()
      await rowsDrawn(page)
      const box = page.getByRole('region', { name })
      await expect(box).toBeVisible()
      expect(await box.evaluate((el) => el.scrollWidth > el.clientWidth), `${name} is wider than the phone`).toBe(true)
      const stops: string[] = []
      for (let presses = 0; presses < 12; presses++) {
        await page.keyboard.press('Tab')
        const at = await page.evaluate(() => {
          const el = document.activeElement as HTMLElement | null
          return el ? `${el.tagName.toLowerCase()} ${el.getAttribute('aria-label') ?? el.innerText.trim().slice(0, 30)}` : ''
        })
        stops.push(at)
        if (await box.evaluate((el) => el === document.activeElement)) break
      }
      await expect(box, `the stops after the ${tab} tab: ${stops.join(' | ')}`).toBeFocused()
      // The keyboard then scrolls the box sideways.
      await page.keyboard.press('ArrowRight')
      await expect.poll(() => box.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0)
    }
  })
})
