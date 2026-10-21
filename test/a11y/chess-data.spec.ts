// test/a11y/chess-data.spec.ts
//
// Chess data in the browser (WS01 step 27), on both builds, on the seeded
// finished event (scripts/seed/fixtures.sql: one section, five players,
// three rounds with a draw in each, a full-point bye and two half-point
// byes, totals 2.5, 2, 1.5, 1.5 and 0.5): its pairings page, standings first
// and the crosstable behind the tab, its print page's standings, crosstable
// and pairing sheet, and the fixture page's sample crosstable.
//
// - a11y-on (newLook on): scores and tiebreaks read ½ (2½, 1½, ½, 3½, 7½),
//   never with a point, and their figures are the Geist Mono face with
//   tabular-nums; header cells are th with scope col and the player's name a
//   th with scope row; each round of the crosstable is a result cell with
//   its letter, its mark and the game in words, and the key names the marks
//   in words.
// - a11y-off (newLook off): the same pages show 2.5 and 0.5 as today, the
//   result codes in the device's monospace stack, the same tabular figures,
//   and every header cell carries scope col, the one change.
// - axe with the WCAG 2.0, 2.1 and 2.2 A and AA rules finds nothing on the
//   four views at 1280 and 390 pixels wide in the base look, and on a11y-on
//   in the live look (main drawn as a live scope is, on its own ground) and
//   in dark mode. On a11y-off at 390 pixels today's scroll boxes, which hold
//   nothing the keyboard reaches, are kept out of the run, and a test holds
//   them to that one finding (scrollable-region-focusable); newLook makes
//   each box a named region in the tab order. Nothing goes in
//   known-violations.json.
// - At 390 pixels the number or the place and the name stay put while the
//   rest scrolls under them, each pinned cell opaque on the look's surface,
//   first place's tint carried, the row lines unbroken; the keyboard reaches
//   the box and scrolls it. The fixture's bounded box holds its header at the
//   top as it scrolls down.
// - The public pairings list writes a drawn game ½-½ on a11y-on and
//   1/2-1/2 on a11y-off.
// - Printed at a US Letter portrait width (740 pixels), the crosstable fits.
//   The spec adds rounds one at a time: with the cells' screen shape it stops
//   fitting at eight rounds, and with the print shape it still fits at 12.
//
// Each page is read once its table rows are drawn, not on network idle alone,
// and a page that draws its error message because its data request failed
// is loaded once more (rowsDrawn). Reads only.
import AxeBuilder from '@axe-core/playwright'
import type { Locator, Page } from '@playwright/test'
import { expect, test } from './support'

const ON = 'a11y-on'
const OFF = 'a11y-off'
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']
const EVENT = '/tournaments/fx-t-done'
/** The face the new look gives font-mono, and the device's own stack it gives with newLook off. */
const GEIST_MONO = /^"Geist Mono Variable", ui-monospace, .*monospace$/
const DEVICE_MONO = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
/** The seed's order and totals. */
const PLAYERS = ['Avery Fixture', 'Riley Fixture', 'Casey Fixture', 'Morgan Fixture', 'Jordan Fixture']
const TOTALS_ON = ['2½', '2', '1½', '1½', '½']
const TOTALS_OFF = ['2.5', '2', '1.5', '1.5', '0.5']
/** US Letter portrait less Chrome's default margins: 7.7 inches at 96 pixels an inch. */
const LETTER_WIDTH = 740

interface View { name: string; open: (page: Page) => Promise<void> }

/**
 * Waits for the five rows of the section, not for network idle. When the
 * page's data request fails, as it did now and then while the two servers
 * shared one local database that answered SQLITE_BUSY (REDESIGN_STATUS.md,
 * Follow-ups, "The a11y servers share one database (step 23)"), the page
 * draws its error message instead of a table; so a page that shows its error
 * is loaded once more, and the rows must then be there.
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
async function openStandings(page: Page) {
  await page.goto(`${EVENT}/pairings`)
  await rowsDrawn(page)
}
async function openCrosstable(page: Page) {
  await openStandings(page)
  await page.getByRole('tab', { name: 'Crosstable' }).click()
  await expect(page.locator('main table thead th', { hasText: 'Rd 3' })).toBeVisible()
  await rowsDrawn(page)
}
const openPrint = (what: string) => async (page: Page) => {
  await page.goto(`${EVENT}/print?what=${what}`)
  await rowsDrawn(page)
}
const VIEWS: View[] = [
  { name: 'standings on the pairings page', open: openStandings },
  { name: 'crosstable on the pairings page', open: openCrosstable },
  { name: 'printed standings', open: openPrint('standings') },
  { name: 'printed crosstable', open: openPrint('crosstable') },
]

/** Each row's cells, header cells and data cells in order, as a sighted reader sees them (words for a screen reader left out). */
function readRows(page: Page): Promise<string[][]> {
  return page.locator('main table').first().locator('tbody tr').evaluateAll((trs) =>
    trs.map((tr) => [...tr.querySelectorAll(':scope > th, :scope > td')].map((cell) => {
      const copy = cell.cloneNode(true) as HTMLElement
      copy.querySelectorAll('.sr-only').forEach((n) => n.remove())
      return (copy.textContent ?? '').trim()
    })),
  )
}
const fontOf = (loc: Locator) => loc.evaluate((el) => ({ family: getComputedStyle(el).fontFamily, numeric: getComputedStyle(el).fontVariantNumeric }))

/** Draws main as a live scope draws: data-theme="live" on a box with its own ground and words, as ThemeScope layout="box" is drawn. */
async function asLiveScope(page: Page) {
  await page.locator('main').evaluate((main) => {
    main.setAttribute('data-theme', 'live')
    main.classList.add('bg-background', 'text-foreground')
  })
}

/** Every finding axe makes, one line each. */
function findings(results: Awaited<ReturnType<AxeBuilder['analyze']>>): string[] {
  return results.violations.flatMap((v) => v.nodes.map((n) => {
    const data = (n.any[0]?.data ?? {}) as { fgColor?: string; bgColor?: string; contrastRatio?: number }
    const colours = data.contrastRatio ? ` ${data.fgColor} on ${data.bgColor}, ${data.contrastRatio}:1` : ''
    return `${v.id} (${v.impact ?? 'no impact given'}) at ${n.target.map(String).join(' ')}${colours}`
  }))
}

// ── Half points, figures and headers (acceptance criteria 2, 4 and 5) ─────────

test.describe('half points in the monospace face, and real headers', () => {
  test.use({ colorScheme: 'light', reducedMotion: 'reduce', viewport: { width: 1280, height: 800 } })

  for (const view of [VIEWS[0], VIEWS[2]]) {
    test(`${view.name}: scores and tiebreaks, their face and their headers`, async ({ page }, testInfo) => {
      await view.open(page)
      const rows = await readRows(page)
      expect(rows.map((r) => r[1])).toEqual(PLAYERS)
      const table = page.locator('main table').first()
      if (testInfo.project.name === ON) {
        expect(rows.map((r) => r[3])).toEqual(TOTALS_ON)
        // Modified Median, Solkoff, Cumulative and Opponents' Cumulative, as the server works them out.
        expect(rows.map((r) => r.slice(5))).toEqual([
          ['3', '3½', '5', '7½'], ['2½', '4', '3½', '8'], ['1½', '4½', '3½', '8½'], ['0', '3', '3', '7'], ['1½', '4', '½', '8½'],
        ])
        expect(await table.innerText()).not.toMatch(/\d\.5/)
        for (const at of [1, 2, 3, 4, 5, 6, 7]) {
          const f = await fontOf(table.locator('tbody tr').first().locator(':scope > td').nth(at))
          expect(f.family, `cell ${at}`).toMatch(GEIST_MONO)
          expect(f.numeric, `cell ${at}`).toBe('tabular-nums')
        }
        // The player's name heads its row.
        const names = table.locator('tbody th')
        await expect(names).toHaveCount(5)
        for (const name of await names.all()) await expect(name).toHaveAttribute('scope', 'row')
        await expect(page.getByRole('rowheader', { name: 'Avery Fixture' })).toBeVisible()
      } else {
        expect(rows.map((r) => r[3])).toEqual(TOTALS_OFF)
        expect(rows[0].slice(5)).toEqual(['3', '3.5', '5', '7.5'])
        // Today's points (the fourth cell) are the sans face, with the table's tabular figures.
        const f = await fontOf(table.locator('tbody tr').first().locator(':scope > td').nth(3))
        expect(f.family).toBe('"Geist Variable", sans-serif')
        expect(f.numeric).toBe('tabular-nums')
        await expect(table.locator('tbody th')).toHaveCount(0)
      }
      const heads = table.locator('thead th')
      await expect(heads).toHaveCount(9)
      for (const th of await heads.all()) await expect(th).toHaveAttribute('scope', 'col')
    })
  }

  for (const view of [VIEWS[1], VIEWS[3]]) {
    test(`${view.name}: totals, rounds and colours, their face and their headers`, async ({ page }, testInfo) => {
      await view.open(page)
      const rows = await readRows(page)
      expect(rows.map((r) => r[1].replace(/\s*\(\d\)$/, ''))).toEqual(PLAYERS)
      const table = page.locator('main table').first()
      const total = table.locator('tbody tr').first().locator(':scope > td').last()
      if (testInfo.project.name === ON) {
        expect(rows.map((r) => r.at(-1))).toEqual(TOTALS_ON)
        expect(await fontOf(total)).toEqual({ family: expect.stringMatching(GEIST_MONO), numeric: 'tabular-nums' })
        // Each round: its letter and the opponent's number in sight, its mark drawn, the game in words.
        expect(rows.map((r) => r.slice(3, 6))).toEqual([
          ['W5', 'D2', 'W3'], ['B', 'D1', 'D4'], ['D4', 'W5', 'L1'], ['D3', 'H', 'D2'], ['L1', 'L3', 'H'],
        ])
        const marks = await table.locator('tbody tr').evaluateAll((trs) => trs.map((tr) => [...tr.querySelectorAll('[data-slot="result-cell"]')].map((c) => c.querySelector('svg')?.getAttribute('data-color') ?? '')))
        expect(marks).toEqual([['white', 'black', 'black'], ['', 'white', 'black'], ['white', 'black', 'white'], ['black', '', 'white'], ['black', 'white', '']])
        for (const words of ['Won with White against 5', 'Drew with Black against 2', 'Won with Black against 3', 'Full-point bye', 'Half-point bye', 'Lost with White against 1']) {
          await expect(page.getByRole('cell', { name: words, exact: true }).first()).toBeVisible()
        }
        expect(await fontOf(table.locator('[data-slot="result-cell"]').first())).toEqual({ family: expect.stringMatching(GEIST_MONO), numeric: 'tabular-nums' })
        await expect(table.locator('span.text-\\[10px\\]')).toHaveCount(0)
        const key = page.getByRole('list', { name: 'Key to the crosstable' })
        await expect(key.getByText('White', { exact: true })).toBeVisible()
        await expect(key.getByText('Black', { exact: true })).toBeVisible()
        expect(await table.innerText()).not.toMatch(/\d\.5/)
        await expect(table.locator('tbody th[scope="row"]')).toHaveCount(5)
      } else {
        expect(rows.map((r) => r.at(-1))).toEqual(TOTALS_OFF)
        // Today's codes in the device's monospace stack, the colour as the w and b line under each played game.
        const code = table.locator('tbody td span.font-mono').first()
        expect(await fontOf(code)).toEqual({ family: DEVICE_MONO, numeric: 'tabular-nums' })
        await expect(table.locator('span.text-\\[10px\\]')).toHaveCount(12)
        await expect(table.locator('[data-slot="result-cell"]')).toHaveCount(0)
        await expect(table.locator('tbody th')).toHaveCount(0)
      }
      for (const th of await table.locator('thead th').all()) await expect(th).toHaveAttribute('scope', 'col')
    })
  }

  test('the pairing sheet writes each score going into the round with ½, as it already did', async ({ page }) => {
    await page.goto(`${EVENT}/print?what=pairings&round=3`)
    await rowsDrawn(page, 3)
    const scores = await page.locator('main table tbody td:nth-child(2) span, main table tbody td:nth-child(4) span').allInnerTexts()
    // Casey 1½ against Avery 1½, Morgan 1 against Riley 1½, and Jordan's half-point bye.
    expect(scores).toEqual(['(1410) 1½', '(1905) 1½', '(1290) 1', '(1725) 1½', '(1660) 0'])
  })

  test('every header cell\'s scope is one a browser knows (axe\'s scope-attr-valid, a best-practice rule the WCAG tags leave out)', async ({ page }) => {
    for (const view of VIEWS) {
      await view.open(page)
      const results = await new AxeBuilder({ page }).include('main').withRules(['scope-attr-valid', 'th-has-data-cells', 'td-headers-attr']).analyze()
      expect(findings(results), view.name).toEqual([])
      expect(results.passes.map((p) => p.id), view.name).toContain('scope-attr-valid')
    }
  })
})

// ── The public pairings list ──────────────────────────────────────────────

test('the pairings list writes a drawn game ½-½ under the new look, and 1/2-1/2 as today without it', async ({ page }, testInfo) => {
  await openStandings(page)
  await page.getByRole('button', { name: /^Round 1/ }).click()
  const results = page.locator('main ul li > span:last-child')
  await expect(results).toHaveCount(3)
  const want = testInfo.project.name === ON ? '½-½' : '1/2-1/2'
  expect(await results.allInnerTexts()).toEqual(['1-0', want, '1'])
})

// ── The accessibility checker (acceptance criterion 4) ─────────────────────

const WIDTHS = [1280, 390] as const

for (const width of WIDTHS) {
  test.describe(`axe at ${width} pixels`, () => {
    test.use({ colorScheme: 'light', reducedMotion: 'reduce', viewport: { width, height: 900 } })

    for (const view of VIEWS) {
      test(`${view.name}: the base look, and on a11y-on the live look`, async ({ page, external }, testInfo) => {
        const errors: string[] = []
        page.on('pageerror', (e) => errors.push(e.message))
        await view.open(page)
        let axe = new AxeBuilder({ page }).include('main').withTags(AXE_TAGS)
        // Today's scroll boxes hold nothing the keyboard reaches; the next test holds them to that one finding.
        if (testInfo.project.name === OFF && width === 390) axe = axe.exclude('main .overflow-x-auto')
        const looks = testInfo.project.name === ON ? ['base', 'live'] : ['base']
        for (const look of looks) {
          if (look === 'live') await asLiveScope(page)
          const results = await axe.analyze()
          const report = [`axe on ${view.name} at ${width} pixels, ${look} look (${testInfo.project.name}): ${results.passes.length} rules passed, ${results.violations.length} with findings.`, ...findings(results)].join('\n')
          console.log(report)
          expect(findings(results), report).toEqual([])
          const ran = new Set([...results.passes, ...results.incomplete, ...results.inapplicable].map((r) => r.id))
          for (const rule of ['color-contrast', 'scrollable-region-focusable', 'td-headers-attr', 'th-has-data-cells', 'aria-prohibited-attr']) expect(ran, rule).toContain(rule)
        }
        expect(errors).toEqual([])
        expect(external).toEqual([])
      })
    }

    if (width === 390) {
      test('a11y-off: today\'s scroll boxes are the one finding at a phone\'s width, which the new look mends', async ({ page }, testInfo) => {
        test.skip(testInfo.project.name !== OFF, 'today\'s scroll boxes are drawn only on a11y-off')
        for (const view of VIEWS) {
          await view.open(page)
          const results = await new AxeBuilder({ page }).include('main').withTags(AXE_TAGS).analyze()
          expect(results.violations.map((v) => v.id), view.name).toEqual(['scrollable-region-focusable'])
          expect(results.violations[0].nodes.map((n) => n.target.join(' ')), view.name).toEqual(['.overflow-x-auto'])
        }
      })
    }
  })
}

test.describe('axe in dark mode', () => {
  test.use({ colorScheme: 'dark', reducedMotion: 'reduce', viewport: { width: 1280, height: 900 } })

  test('the four views pass in dark mode', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== ON, 'only the a11y-on build has dark mode')
    for (const view of VIEWS) {
      await view.open(page)
      await expect(page.locator('html')).toHaveClass(/\bdark\b/)
      const results = await new AxeBuilder({ page }).include('main').withTags(AXE_TAGS).analyze()
      const report = [`axe on ${view.name} in dark mode: ${results.passes.length} rules passed, ${results.violations.length} with findings.`, ...findings(results)].join('\n')
      console.log(report)
      expect(findings(results), report).toEqual([])
    }
  })
})

// ── Pinned columns on a phone (acceptance criterion 6) ──────────────────────

/** The box's scroll offsets once they have stopped moving: a key press scrolls smoothly, over several frames. */
function settled(box: Locator): Promise<{ left: number; top: number }> {
  return box.evaluate((el) => new Promise<{ left: number; top: number }>((resolve) => {
    let last = `${el.scrollLeft},${el.scrollTop}`
    let still = 0
    const tick = () => {
      const now = `${el.scrollLeft},${el.scrollTop}`
      still = now === last ? still + 1 : 0
      last = now
      if (still >= 5) resolve({ left: el.scrollLeft, top: el.scrollTop })
      else requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }))
}

/** Where the first three cells of each row sit against the box, their grounds, and the row lines. */
function pinned(box: Locator) {
  return box.evaluate((el) => {
    const left = el.getBoundingClientRect().left + el.clientLeft
    return [...el.querySelectorAll('tbody tr')].map((tr) => {
      const cells = [...tr.querySelectorAll(':scope > th, :scope > td')] as HTMLElement[]
      return {
        at: cells.slice(0, 3).map((c) => Math.round(c.getBoundingClientRect().left - left)),
        ground: cells.slice(0, 2).map((c) => getComputedStyle(c).backgroundColor),
        tint: cells.slice(0, 2).map((c) => getComputedStyle(c).backgroundImage !== 'none'),
        line: cells.slice(0, 3).map((c) => getComputedStyle(c).borderBottomWidth),
      }
    })
  })
}

for (const [scheme, look, surface] of [['light', 'base', 'rgb(255, 255, 255)'], ['dark', 'base', 'rgb(17, 26, 44)'], ['light', 'live', 'rgb(14, 21, 38)']] as const) {
  test.describe(`pinned columns at 390 pixels, ${look} look, ${scheme} device`, () => {
    test.use({ colorScheme: scheme, reducedMotion: 'reduce', viewport: { width: 390, height: 900 } })

    for (const [view, name] of [[VIEWS[0], 'Open standings'], [VIEWS[1], 'Open crosstable']] as const) {
      test(`${view.name}: the number or place and the name stay put on the surface while the rest scrolls`, async ({ page }, testInfo) => {
        test.skip(testInfo.project.name !== ON, 'the pinned columns are the new look\'s')
        await view.open(page)
        if (look === 'live') await asLiveScope(page)
        const box = page.getByRole('region', { name })
        await expect(box).toBeVisible()
        expect(await box.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true)
        const before = await pinned(box)
        // The keyboard reaches the box and scrolls it.
        await box.focus()
        await expect(box).toBeFocused()
        await page.keyboard.press('ArrowRight')
        expect((await settled(box)).left).toBeGreaterThan(0)
        // Then all the way across, so the most scrolls under the pinned cells.
        await box.evaluate((el) => el.scrollTo({ left: el.scrollWidth, behavior: 'instant' }))
        const across = (await settled(box)).left
        expect(across).toBeGreaterThan(40)
        const after = await pinned(box)
        for (const [i, row] of after.entries()) {
          expect(row.at.slice(0, 2), `row ${i + 1} pinned`).toEqual(before[i].at.slice(0, 2))
          expect(row.at[2], `row ${i + 1} scrolled`).toBe(before[i].at[2] - across)
          expect(row.ground, `row ${i + 1} ground`).toEqual([surface, surface])
          // Only first place's row lays a tint over its pinned cells, in the standings.
          expect(row.tint, `row ${i + 1} tint`).toEqual(view === VIEWS[0] && i === 0 ? [true, true] : [false, false])
          expect(row.line, `row ${i + 1} line`).toEqual(i === after.length - 1 ? ['0px', '0px', '0px'] : ['1px', '1px', '1px'])
        }
      })
    }
  })
}

test.describe('the fixture page\'s sample crosstable', () => {
  test.use({ colorScheme: 'light', reducedMotion: 'reduce', viewport: { width: 1280, height: 900 } })

  test('draws every result code, and its bounded box holds the header at the top and the number and name at the left', async ({ page }) => {
    await page.goto('/__fixtures/base')
    const box = page.getByRole('region', { name: 'Sample crosstable' })
    await expect(box.locator('tbody tr')).toHaveCount(6)
    expect(await box.locator('[data-slot="result-cell"]').evaluateAll((cells) => [...new Set(cells.map((c) => c.getAttribute('data-result')))].sort())).toEqual(
      ['B', 'D', 'F', 'H', 'L', 'U', 'W', 'X', 'pending'],
    )
    const style = await box.evaluate((el) => ({ maxHeight: getComputedStyle(el).maxHeight, overscroll: getComputedStyle(el).overscrollBehaviorY, tabIndex: el.tabIndex, down: el.scrollHeight > el.clientHeight, across: el.scrollWidth > el.clientWidth }))
    expect(style).toEqual({ maxHeight: '192px', overscroll: 'contain', tabIndex: 0, down: true, across: true })
    // The box is the next stop after the scroll panel's last box to tick.
    await page.getByRole('checkbox', { name: /Review and publish/ }).focus()
    await page.keyboard.press('Tab')
    await expect(box).toBeFocused()
    const head = () => box.evaluate((el) => {
      const top = el.getBoundingClientRect().top + el.clientTop
      const left = el.getBoundingClientRect().left + el.clientLeft
      const th = [...el.querySelectorAll('thead th')] as HTMLElement[]
      const row = [...el.querySelectorAll('tbody tr:nth-child(4) > *')] as HTMLElement[]
      return {
        head: Math.round(th[0].getBoundingClientRect().top - top),
        corner: [th[0], th[1]].map((c) => Math.round(c.getBoundingClientRect().left - left)),
        pinned: [row[0], row[1]].map((c) => Math.round(c.getBoundingClientRect().left - left)),
        ground: [th[0], row[0], row[1]].map((c) => getComputedStyle(c).backgroundColor),
      }
    })
    const before = await head()
    await page.keyboard.press('PageDown')
    expect((await settled(box)).top).toBeGreaterThan(0)
    await box.evaluate((el) => el.scrollTo({ left: el.scrollWidth, top: el.scrollTop, behavior: 'instant' }))
    expect((await settled(box)).left).toBeGreaterThan(40)
    const after = await head()
    expect(after.head).toBe(before.head)
    expect(after.corner).toEqual(before.corner)
    expect(after.pinned).toEqual(before.pinned)
    expect(after.ground.every((g) => g !== 'rgba(0, 0, 0, 0)')).toBe(true)
  })
})

// ── Printing (the risk the plan names) ──────────────────────────────────────

test.describe('the printed crosstable at a US Letter portrait width', () => {
  test.use({ colorScheme: 'light', reducedMotion: 'reduce', viewport: { width: LETTER_WIDTH, height: 1000 } })

  test('stays on the paper as rounds are added; the screen\'s cell shape alone would stop fitting', async ({ page }, testInfo) => {
    await openPrint('crosstable')(page)
    await page.emulateMedia({ media: 'print' })
    /** The table's width and the page's, in pixels. */
    const widths = () => page.evaluate(() => {
      const table = document.querySelector('main table')!
      return { table: Math.round(table.getBoundingClientRect().width), page: Math.round(table.closest('section')!.getBoundingClientRect().width) }
    })
    /** Adds a round: a copy of the last round's column, before the total. */
    const addRound = () => page.evaluate(() => {
      for (const tr of [...document.querySelector('main table')!.querySelectorAll('tr')]) {
        const cells = [...tr.children]
        const copy = cells[cells.length - 2].cloneNode(true) as HTMLElement
        if (tr.parentElement!.tagName === 'THEAD') copy.textContent = `Rd ${cells.length - 3}`
        tr.insertBefore(copy, cells[cells.length - 1])
      }
    })
    /** Takes the print shape off the result cells, leaving the shape they have on a screen. */
    const screenShape = () => page.evaluate(() => {
      for (const cell of document.querySelectorAll('[data-slot="result-cell"]')) cell.className = cell.className.split(' ').filter((c) => !c.startsWith('print:')).join(' ')
    })

    const fit: string[] = []
    for (let rounds = 3; rounds <= 12; rounds++) {
      const w = await widths()
      fit.push(`${rounds}: ${w.table} of ${w.page}`)
      expect(w.table, `${rounds} rounds`).toBeLessThanOrEqual(w.page)
      await addRound()
    }
    let stops = 0
    if (testInfo.project.name === ON) {
      await page.reload()
      await rowsDrawn(page)
      await page.emulateMedia({ media: 'print' })
      for (let rounds = 3; rounds <= 12 && stops === 0; rounds++) {
        await screenShape()
        const w = await widths()
        if (w.table > w.page) stops = rounds
        await addRound()
      }
      // The screen's 58-pixel cells stop fitting well before 12 rounds; the print shape is what keeps them on the paper.
      expect(stops).toBeGreaterThan(3)
      expect(stops).toBeLessThanOrEqual(12)
    }
    console.log(`Printed crosstable at ${LETTER_WIDTH} pixels (${testInfo.project.name}), rounds: table width of page width: ${fit.join('; ')}${stops ? `. With the screen's cell shape it stops fitting at ${stops} rounds.` : ''}`)
  })
})
