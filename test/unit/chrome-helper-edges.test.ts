// test/unit/chrome-helper-edges.test.ts
//
// test/a11y/chrome.ts at its edges, read without a browser and whatever its
// table holds on the day: each case that needs a table puts its own in
// place and the real one goes back after, so the steps that draw the new
// chrome change test/unit/chrome-helper.test.tsx alone.
//
// - onlyToday skips through the suite's own test.skip, with the reason
//   "today's header only: " or "today's footer only: " and the why, exactly
//   when todayAt says the part is not today's at every width the test
//   reads; the build a spec names wins over its project's; and a build the
//   table does not hold stops the test with an error that names it, before
//   any skip
// - ifToday runs what it holds once where today's chrome is drawn and waits
//   for it, and a check that fails inside it fails the test with its own
//   error, thrown or rejected, so a check marked as today's is never
//   loosened; where the new chrome is drawn it runs nothing and notes each
//   check it did not read, in order, after the notes the test already has
// - chromeAt reads a width at the start of a pair as that pair's and the
//   width below it as the pair before's, and a width below a list's first
//   pair is an error that names the part, the build and the width
// - the table as it stands: the two builds test/a11y/global-setup.ts names
//   and no other, both parts each, every list from 0 with rising widths and
//   each entry today's or new; and no build is said to draw the new chrome
//   while its switches leave the chrome off (chromeOn in src/lib/nav.ts)
import type { TestInfo } from '@playwright/test'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FEATURES, FLAG_OVERRIDE_MODE, applyFlagOverrides } from '@/lib/features'
import { chromeOn } from '@/lib/nav'
import { DRAWN, chromeAt, ifToday, onlyToday, todayAt, type Chrome, type Part } from '../a11y/chrome'
import { A11Y_VARIANTS } from '../a11y/global-setup'

/** The suite's own skip, which onlyToday calls; in a browser run it is Playwright's. */
const skip = vi.hoisted(() => vi.fn())
vi.mock('../a11y/support', () => ({ test: { skip } }))

type Pairs = ReadonlyArray<readonly [number, Chrome]>
/** The helper's table, as a case changes it for itself. */
const table = DRAWN as unknown as Record<string, Record<Part, Pairs>>
/** Each build's two lists as they are, put back after every case. */
const real = Object.fromEntries(Object.entries(table).map(([build, parts]) => [build, { ...parts }]))
const BUILDS = A11Y_VARIANTS.map((v) => v.name)
const PARTS: Part[] = ['header', 'footer']

/** Puts a table in place for one case: each build's lists as given, today's at every width where none is. */
function plant(lists: Record<string, Partial<Record<Part, Pairs>>>) {
  for (const build of Object.keys(table)) {
    for (const part of PARTS) table[build][part] = lists[build]?.[part] ?? [[0, 'today']]
  }
}

interface Note {
  type: string
  description?: string
}
/** What a test's own testInfo gives the helper: its project, and the notes of its report. */
function testInfoOf(build: string): TestInfo & { annotations: Note[] } {
  return { project: { name: build }, annotations: [] } as unknown as TestInfo & { annotations: Note[] }
}

afterEach(() => {
  for (const [build, parts] of Object.entries(real)) Object.assign(table[build], parts)
  skip.mockClear()
})

describe('onlyToday', () => {
  it('skips through the suite\'s own skip exactly when the part is not today\'s at every width the test reads, saying which part and why', () => {
    for (const build of BUILDS) {
      for (const part of PARTS) {
        for (const widths of [[1280], [390], [320, 768, 1280], [1023, 1024]]) {
          skip.mockClear()
          onlyToday(testInfoOf(build), part, widths, 'the why')
          expect(skip, `${build}, the ${part} at ${widths.join(' and ')}`).toHaveBeenCalledTimes(1)
          expect(skip).toHaveBeenCalledWith(!todayAt(build, part, widths), `today's ${part} only: the why`)
        }
      }
    }
  })

  it('with the new header drawn from 1024 pixels on a11y-on: skips a test that reads 1280, not one that reads 390 and 768, nor one of the footer or of a11y-off', () => {
    plant({ 'a11y-on': { header: [[0, 'today'], [1024, 'new']] } })
    const on = testInfoOf('a11y-on')
    onlyToday(on, 'header', [390, 1280], 'today\'s mark at both widths')
    expect(skip).toHaveBeenLastCalledWith(true, 'today\'s header only: today\'s mark at both widths')
    onlyToday(on, 'header', [390, 768], 'today\'s mark below the new header\'s widths')
    expect(skip).toHaveBeenLastCalledWith(false, 'today\'s header only: today\'s mark below the new header\'s widths')
    onlyToday(on, 'footer', [1280], 'today\'s logo')
    expect(skip).toHaveBeenLastCalledWith(false, 'today\'s footer only: today\'s logo')
    onlyToday(testInfoOf('a11y-off'), 'header', [1280], 'today\'s image')
    expect(skip).toHaveBeenLastCalledWith(false, 'today\'s header only: today\'s image')
    expect(skip).toHaveBeenCalledTimes(4)
  })

  it('asks about the build a spec names, not its own project\'s, when the page open is the other build\'s', () => {
    plant({ 'a11y-on': { header: [[0, 'new']] } })
    onlyToday(testInfoOf('a11y-off'), 'header', [1280], 'the other build\'s header', 'a11y-on')
    expect(skip).toHaveBeenLastCalledWith(true, 'today\'s header only: the other build\'s header')
    onlyToday(testInfoOf('a11y-on'), 'header', [1280], 'the other build\'s header', 'a11y-off')
    expect(skip).toHaveBeenLastCalledWith(false, 'today\'s header only: the other build\'s header')
  })

  it('stops a test that asks about a build the table does not hold, naming it and the builds there are, before any skip', () => {
    expect(() => onlyToday(testInfoOf('a11y-maybe'), 'header', [1280], 'why')).toThrow(/"a11y-maybe"/)
    expect(() => onlyToday(testInfoOf('a11y-on'), 'footer', [390], 'why', 'e2e-preview')).toThrow(`the builds are ${Object.keys(DRAWN).join(' and ')}`)
    expect(skip).not.toHaveBeenCalled()
  })
})

describe('ifToday', () => {
  it('runs what it holds once where today\'s chrome is drawn, waits for it, and notes nothing', async () => {
    plant({})
    const info = testInfoOf('a11y-on')
    const order: string[] = []
    const sync = vi.fn(() => {
      order.push('sync')
    })
    const later = vi.fn(async () => {
      await new Promise((done) => setTimeout(done, 5))
      order.push('async')
    })
    await expect(ifToday(info, 'header', 1280, 'a check that returns', sync)).resolves.toBeUndefined()
    await ifToday(info, 'footer', 390, 'a check that waits', later)
    order.push('after')
    expect(order).toEqual(['sync', 'async', 'after'])
    expect(sync).toHaveBeenCalledTimes(1)
    expect(later).toHaveBeenCalledTimes(1)
    expect(info.annotations).toEqual([])
  })

  it('fails the test with the very error a check inside it throws or rejects with, so marking a check as today\'s never loosens it', async () => {
    plant({})
    const info = testInfoOf('a11y-off')
    const thrown = new Error('a check that fails')
    await expect(ifToday(info, 'header', 1280, 'a thrown check', () => {
      throw thrown
    })).rejects.toBe(thrown)
    const rejected = new Error('a check that fails later')
    await expect(ifToday(info, 'footer', 1280, 'a rejected check', async () => {
      await Promise.resolve()
      throw rejected
    })).rejects.toBe(rejected)
    // A failing expect inside it, the way the specs write their checks.
    await expect(ifToday(info, 'header', 390, 'the mark\'s size', () => {
      expect(28, 'the mark at 390 pixels').toBe(30)
    })).rejects.toThrow(/the mark at 390 pixels/)
    expect(info.annotations).toEqual([])
  })

  it('where the new chrome is drawn, runs nothing and notes each check it did not read, in order, after the notes the test already has', async () => {
    plant({ 'a11y-on': { header: [[0, 'today'], [1024, 'new']], footer: [[0, 'new']] } })
    const info = testInfoOf('a11y-on')
    info.annotations.push({ type: 'measured', description: 'a note the test made first' })
    const notRun = vi.fn(() => {
      throw new Error('not to be run where the new chrome is drawn')
    })
    await ifToday(info, 'header', 1280, 'the brand link\'s name', notRun)
    await ifToday(info, 'footer', 390, 'the logo\'s file', notRun)
    // Today's header is still drawn below 1024 pixels there, so this one runs and notes nothing.
    const below = vi.fn()
    await ifToday(info, 'header', 768, 'the mark\'s size', below)
    expect(notRun).not.toHaveBeenCalled()
    expect(below).toHaveBeenCalledTimes(1)
    expect(info.annotations).toEqual([
      { type: 'measured', description: 'a note the test made first' },
      { type: 'today only', description: 'the brand link\'s name: not read on a11y-on at 1280 pixels, where the new header is drawn' },
      { type: 'today only', description: 'the logo\'s file: not read on a11y-on at 390 pixels, where the new footer is drawn' },
    ])
  })

  it('rejects a build the table does not hold, naming it, and runs and notes nothing', async () => {
    const info = testInfoOf('a11y-on')
    const run = vi.fn()
    await expect(ifToday(info, 'header', 1280, 'the other build\'s names', run, 'a11y-maybe')).rejects.toThrow(/"a11y-maybe"/)
    const preview = testInfoOf('e2e-preview')
    await expect(ifToday(preview, 'footer', 1280, 'the logo', run)).rejects.toThrow(/"e2e-preview"/)
    expect(run).not.toHaveBeenCalled()
    expect(info.annotations).toEqual([])
    expect(preview.annotations).toEqual([])
  })
})

describe('chromeAt', () => {
  it('reads a width at the start of a pair as that pair\'s, and the width below it as the pair before\'s', () => {
    // A made-up list of three pairs, to read every edge between them.
    plant({ 'a11y-on': { footer: [[0, 'today'], [768, 'new'], [1024, 'today']] } })
    expect([0, 320, 767, 768, 1023, 1024, 1440].map((width) => chromeAt('a11y-on', 'footer', width))).toEqual(['today', 'today', 'today', 'new', 'new', 'today', 'today'])
    expect(todayAt('a11y-on', 'footer', [390, 1280])).toBe(true)
    expect(todayAt('a11y-on', 'footer', [390, 800])).toBe(false)
    // The other part and the other build read their own lists.
    expect(chromeAt('a11y-on', 'header', 800)).toBe('today')
    expect(chromeAt('a11y-off', 'footer', 800)).toBe('today')
  })

  it('is an error, naming the part, the build and the width, below a list\'s first pair, and onlyToday stops there rather than skip', () => {
    plant({ 'a11y-off': { header: [[640, 'today']] } })
    expect(() => chromeAt('a11y-off', 'header', 639)).toThrow(/\bheader\b.*\ba11y-off\b.*\b639 pixels/)
    expect(chromeAt('a11y-off', 'header', 640)).toBe('today')
    expect(() => onlyToday(testInfoOf('a11y-off'), 'header', [390, 1280], 'why')).toThrow(/\bheader\b.*\ba11y-off\b.*\b390 pixels/)
    expect(skip).not.toHaveBeenCalled()
  })
})

describe('the table as it stands', () => {
  it('holds the two builds test/a11y/global-setup.ts names and no other, both parts each, every list from 0 with rising widths and each entry today\'s or new', () => {
    expect(Object.keys(DRAWN).sort()).toEqual([...BUILDS].sort())
    for (const [build, parts] of Object.entries(DRAWN)) {
      expect(Object.keys(parts).sort(), build).toEqual(['footer', 'header'])
      for (const [part, list] of Object.entries(parts)) {
        const where = `${build}, the ${part}`
        expect(list.length, where).toBeGreaterThan(0)
        expect(list[0][0], `${where}: its first pair starts at 0`).toBe(0)
        for (const [from, chrome] of list) {
          expect(Number.isInteger(from) && from >= 0, `${where}: ${from}`).toBe(true)
          expect(['today', 'new'], `${where}: ${chrome}`).toContain(chrome)
        }
        for (let i = 1; i < list.length; i++) expect(list[i][0], `${where}: its widths rise`).toBeGreaterThan(list[i - 1][0])
      }
    }
  })

  it('says the new chrome is drawn only on a build whose switches turn the chrome on, since without it the site keeps today\'s header and footer', () => {
    for (const variant of A11Y_VARIANTS) {
      // The build's switches: the site's own, with the build's names turned on, as src/lib/features.ts reads them in that build.
      const on = chromeOn(applyFlagOverrides(FEATURES, FLAG_OVERRIDE_MODE, variant.flags))
      for (const part of PARTS) {
        const drawnNew = DRAWN[variant.name][part].filter(([, chrome]) => chrome === 'new').map(([from]) => from)
        if (!on) expect(drawnNew, `${variant.name}, the ${part}: new from these widths with the chrome off`).toEqual([])
      }
    }
  })
})
