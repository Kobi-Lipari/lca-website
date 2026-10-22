// test/a11y/components.spec.ts
//
// The base components of WS01 step 26 on the fixture page, in the browser,
// on both builds, and the first axe run on the fixture page itself.
//
// - Every status shows its words (WS01 acceptance criterion 5): on every
//   fixture, each [data-status] element has words in it, and axe with the
//   WCAG 2.0, 2.1 and 2.2 A and AA rules finds nothing on the fixture page,
//   the filter chips' nested-interactive and target-size, the scroll panel's
//   scrollable-region-focusable and the contrast of every status included.
//   On a11y-off, today's look, the two closed badges are kept out of that
//   run: today's muted pair is #737373 on #f5f5f5, 4.35:1, below the 4.5:1
//   words need, in the old muted pill and, with newLook off, in the status
//   tag's closed pair, which is the same two colours. A test of their own
//   holds them to exactly that one finding, so the day it is fixed this file
//   says to take the exclusion out (REDESIGN_STATUS.md, Follow-ups, "Muted
//   StatusBadge contrast (step 20)"). Nothing goes in known-violations.json,
//   which is never added to.
// - The live tag's dot does not move (acceptance criterion 14): no animation
//   class, its computed animation-name is none and getAnimations() finds
//   nothing, measured with no reduced motion asked for, so the new look's
//   reduced-motion rule is not what holds it still.
// - The gold Button is gold with navy words in every look; the filter chips
//   toggle by keyboard, and the remove button sits beside the toggle at 24 by
//   24 pixels or more; the date blocks carry the weekday and a valid
//   dateTime; the scroll panel is reached with Tab and scrolled with the keys,
//   its header held at the top, and a box the keyboard moves to from below is
//   scrolled out from under the header rather than left hidden there (WCAG
//   2.4.11, Focus Not Obscured); StatusDot says its words under the new look,
//   here and in the /tournaments list, and is today's dot with newLook off.
//
// Reads only; the chips' clicks change only the page in the browser.
import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { expect, test } from './support'

const ON = 'a11y-on'
const OFF = 'a11y-off'
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']
const FIXTURES = ['base', 'heritage', 'scholastic', 'live'] as const
/** The closed badges: today's muted pill and the closed status tag. */
const CLOSED = '[data-status="closed"]'

/** Opens a fixture and waits for its fonts, so every box is final. */
async function openFixture(page: Page, name: string) {
  await page.goto(`/__fixtures/${name}`)
  const container = page.locator(`[data-fixture="${name}"]`)
  await expect(container.getByRole('heading', { level: 2, name: 'Every status' })).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  return container
}

/** Every finding axe makes, one line each, for the report. */
function findings(results: Awaited<ReturnType<AxeBuilder['analyze']>>): string[] {
  return results.violations.flatMap((v) => v.nodes.map((n) => {
    const data = (n.any[0]?.data ?? {}) as { fgColor?: string; bgColor?: string; contrastRatio?: number }
    const colours = data.contrastRatio ? ` ${data.fgColor} on ${data.bgColor}, ${data.contrastRatio}:1` : ''
    return `${v.id} (${v.impact ?? 'no impact given'}) at ${n.target.map(String).join(' ')}${colours}`
  }))
}

test.describe('every status in words, and axe on the fixture page', () => {
  test.use({ colorScheme: 'light', reducedMotion: 'reduce', viewport: { width: 1280, height: 800 } })

  for (const name of FIXTURES) {
    test(`${name}: every [data-status] element has words, and axe finds nothing`, async ({ page, external }, testInfo) => {
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(e.message))
      const container = await openFixture(page, name)

      const statuses = await container.locator('[data-status]').evaluateAll((els) =>
        els.map((el) => ({ status: el.getAttribute('data-status'), words: (el as HTMLElement).innerText.trim(), shown: (el as HTMLElement).offsetHeight > 0 })),
      )
      expect(statuses).toHaveLength(3 + 8 + 2)
      for (const s of statuses) {
        expect(s.words, `${s.status} has words`).not.toBe('')
        expect(s.shown, `${s.status} is shown`).toBe(true)
      }
      expect(new Set(statuses.map((s) => s.status))).toEqual(new Set(['open', 'soon', 'full', 'waitlist', 'closed', 'live', 'partner', 'lca']))

      let axe = new AxeBuilder({ page }).include(`[data-fixture="${name}"]`).withTags(AXE_TAGS)
      // Today's closed pair, 4.35:1, is the one finding on a11y-off; the next test holds it to that.
      if (testInfo.project.name === OFF) axe = axe.exclude(CLOSED)
      const results = await axe.analyze()
      const report = [`axe on /__fixtures/${name} (${testInfo.project.name}): ${results.passes.length} rules passed, ${results.violations.length} with findings.`, ...findings(results)].join('\n')
      console.log(report)
      await testInfo.attach(`axe-fixture-${name}.json`, { body: JSON.stringify({ violations: findings(results), passes: results.passes.map((p) => p.id) }, null, 2), contentType: 'application/json' })
      expect(findings(results), report).toEqual([])
      // The rules the new components must pass were run, not left out.
      const ran = new Set([...results.passes, ...results.incomplete, ...results.inapplicable].map((r) => r.id))
      for (const rule of ['color-contrast', 'nested-interactive', 'target-size', 'scrollable-region-focusable', 'button-name']) expect(ran, rule).toContain(rule)
      expect(results.passes.map((p) => p.id)).toEqual(expect.arrayContaining(['nested-interactive', 'target-size', 'scrollable-region-focusable']))
      expect(errors).toEqual([])
      expect(external).toEqual([])
    })
  }

  test('a11y-off: the closed badges\' one finding is today\'s muted pair, 4.35:1, in every fixture', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== OFF, 'today\'s muted pair is drawn only on a11y-off')
    for (const name of FIXTURES) {
      await openFixture(page, name)
      const results = await new AxeBuilder({ page }).include(`[data-fixture="${name}"] ${CLOSED}`).withTags(AXE_TAGS).analyze()
      expect(results.violations.map((v) => v.id), name).toEqual(['color-contrast'])
      const nodes = results.violations[0].nodes.map((n) => n.any[0]?.data as { fgColor: string; bgColor: string; contrastRatio: number })
      expect(nodes, name).toHaveLength(2)
      for (const d of nodes) {
        // Today's muted words on today's muted ground (axe cuts the ratio to two places, 4.34 for 4.349).
        expect([d.fgColor.toLowerCase(), d.bgColor.toLowerCase()], name).toEqual(['#737373', '#f5f5f5'])
        expect(d.contrastRatio, name).toBeGreaterThan(4.3)
        expect(d.contrastRatio, name).toBeLessThan(4.5)
      }
    }
  })
})

test.describe('in dark mode', () => {
  test.use({ colorScheme: 'dark', reducedMotion: 'reduce', viewport: { width: 1280, height: 800 } })

  test('base: every [data-status] element has words, and axe finds nothing', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== ON, 'only the a11y-on build has dark mode')
    const container = await openFixture(page, 'base')
    await expect(page.locator('html')).toHaveClass(/\bdark\b/)
    const words = await container.locator('[data-status]').evaluateAll((els) => els.map((el) => (el as HTMLElement).innerText.trim()))
    expect(words.filter((w) => w === '')).toEqual([])
    const results = await new AxeBuilder({ page }).include('[data-fixture="base"]').withTags(AXE_TAGS).analyze()
    expect(findings(results), findings(results).join('\n')).toEqual([])
  })
})

test.describe('the live tag\'s dot, with no reduced motion asked for', () => {
  test.use({ colorScheme: 'light', reducedMotion: 'no-preference' })

  test('has no animation class, its animation-name is none and it has no animations, in every fixture', async ({ page }) => {
    for (const name of FIXTURES) {
      const container = await openFixture(page, name)
      // The reduced-motion rule of the new look is not in play.
      expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(false)
      await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
      const live = await container.locator('[data-status="live"]').evaluateAll((tags) =>
        tags.map((tag) => {
          const dot = tag.querySelector('[data-slot="status-mark"]')!
          const classes = [tag, dot, ...dot.querySelectorAll('*')].map((el) => el.getAttribute('class') ?? '').join(' ')
          return {
            words: (tag as HTMLElement).innerText.trim(),
            dot: dot.tagName.toLowerCase(),
            animationClass: /(?:^|\s)(?:[\w-]+:)*animate-/.test(classes),
            animationName: getComputedStyle(dot).animationName,
            dotAnimations: dot.getAnimations().length,
            tagAnimations: tag.getAnimations({ subtree: true }).length,
          }
        }),
      )
      expect(live, name).toEqual([
        { words: 'Live', dot: 'svg', animationClass: false, animationName: 'none', dotAnimations: 0, tagAnimations: 0 },
        { words: 'Live · Round 3', dot: 'svg', animationClass: false, animationName: 'none', dotAnimations: 0, tagAnimations: 0 },
      ])
      // Nothing on the fixture page runs a CSS animation at all.
      expect(await page.evaluate(() => document.getAnimations().filter((a) => a instanceof CSSAnimation).length), name).toBe(0)
    }
  })
})

test.describe('the gold Button', () => {
  test.use({ colorScheme: 'light', reducedMotion: 'reduce' })

  test('is gold with navy words in every look, never white on gold', async ({ page }) => {
    for (const name of FIXTURES) {
      const container = await openFixture(page, name)
      const gold = container.getByRole('button', { name: 'Join the waitlist' })
      await expect(gold).toHaveAttribute('data-variant', 'gold')
      const paint = await gold.evaluate((el) => ({ bg: getComputedStyle(el).backgroundColor, color: getComputedStyle(el).color, weight: getComputedStyle(el).fontWeight }))
      expect(paint, name).toEqual({ bg: 'rgb(200, 169, 74)', color: 'rgb(26, 39, 68)', weight: '600' })
    }
  })
})

test.describe('the filter chips', () => {
  test.use({ colorScheme: 'light', reducedMotion: 'reduce', viewport: { width: 1280, height: 800 } })

  test('toggle by keyboard, show their counts, and keep the remove button beside the toggle at 24 by 24 or more', async ({ page }) => {
    const container = await openFixture(page, 'base')
    const chips = container.getByRole('heading', { level: 2, name: 'Filter chips' }).locator('xpath=..')
    const month = chips.getByRole('button', { name: 'This month', exact: true })
    const classical = chips.getByRole('button', { name: 'Classical 2', exact: true })
    await expect(month).toHaveAttribute('aria-pressed', 'true')
    await expect(classical).toHaveAttribute('aria-pressed', 'false')
    await classical.focus()
    await page.keyboard.press('Space')
    await expect(classical).toHaveAttribute('aria-pressed', 'true')
    await page.keyboard.press('Enter')
    await expect(classical).toHaveAttribute('aria-pressed', 'false')

    // A chip that toggles and can be removed: two controls side by side in a group, neither inside the other.
    const group = chips.getByRole('group', { name: 'Scholastic' })
    await expect(group.getByRole('button')).toHaveCount(2)
    const layout = await group.evaluate((el) => {
      const [toggle, remove] = [...el.querySelectorAll('button')]
      const r = remove.getBoundingClientRect()
      return {
        siblings: toggle.parentElement === el && remove.parentElement === el,
        nested: toggle.contains(remove) || remove.contains(toggle),
        toggle: toggle.getAttribute('aria-pressed'),
        remove: remove.getAttribute('aria-label'),
        width: r.width,
        height: r.height,
      }
    })
    expect(layout).toMatchObject({ siblings: true, nested: false, toggle: 'false', remove: 'Remove filter: Scholastic' })
    expect(layout.width).toBeGreaterThanOrEqual(24)
    expect(layout.height).toBeGreaterThanOrEqual(24)

    // The applied filter can only be removed, by keyboard too, and is gone when it is.
    const remove = chips.getByRole('button', { name: 'Remove filter: Next 3 months', exact: true })
    const box = await remove.boundingBox()
    expect(box!.width).toBeGreaterThanOrEqual(24)
    expect(box!.height).toBeGreaterThanOrEqual(24)
    await expect(chips.getByRole('button', { name: 'Next 3 months', exact: true })).toHaveCount(0)
    await remove.focus()
    await page.keyboard.press('Enter')
    await expect(chips.getByText('Next 3 months')).toHaveCount(0)
  })

  test('a chip that is on takes the soon tag\'s tint and words with a gold-ink line, the tile\'s colours', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== ON, 'the tile\'s colours are the new look\'s')
    const container = await openFixture(page, 'base')
    const chip = container.locator('[data-slot="filter-chip"][data-state="on"]')
    await expect(chip).toHaveCount(1)
    const paint = await chip.evaluate((el) => {
      const s = getComputedStyle(el)
      return { bg: s.backgroundColor, border: s.borderTopColor, color: s.color, height: el.getBoundingClientRect().height, radius: s.borderTopLeftRadius }
    })
    expect(paint).toEqual({ bg: 'rgb(251, 247, 233)', border: 'rgb(134, 106, 30)', color: 'rgb(112, 87, 24)', height: 32, radius: '6px' })
  })
})

test.describe('the date blocks', () => {
  test.use({ colorScheme: 'light', reducedMotion: 'reduce' })

  test('carry the weekday in their words and the calendar day in a valid dateTime', async ({ page }) => {
    const container = await openFixture(page, 'base')
    const blocks = await container.locator('time[data-slot="date-block"]').evaluateAll((els) =>
      els.map((el) => ({ dateTime: el.getAttribute('datetime'), words: el.querySelector('.sr-only')!.textContent, width: el.getBoundingClientRect().width })),
    )
    expect(blocks.map(({ dateTime, words }) => ({ dateTime, words }))).toEqual([
      { dateTime: '2026-10-24', words: 'Sat, Oct 24' },
      { dateTime: '2026-11-07', words: 'Sat, Nov 7' },
      { dateTime: '2026-12-04', words: 'Fri, Dec 4, 2026' },
    ])
    for (const b of blocks) {
      expect(b.dateTime).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(Number.isNaN(Date.parse(b.dateTime!))).toBe(false)
      expect(b.width).toBe(64)
    }
    // A screen reader hears formatDate's words once: the stacked parts are hidden from it.
    const names = await container.locator('time[data-slot="date-block"]').evaluateAll((els) => els.map((el) => [...el.children].filter((c) => c.getAttribute('aria-hidden') !== 'true').map((c) => c.textContent)))
    expect(names).toEqual([['Sat, Oct 24'], ['Sat, Nov 7'], ['Fri, Dec 4, 2026']])
  })
})

test.describe('the scroll panel', () => {
  test.use({ colorScheme: 'light', reducedMotion: 'reduce', viewport: { width: 1280, height: 800 } })

  test('is a named region Tab reaches, scrolled by the keys, its overscroll kept inside and its header held at the top', async ({ page }) => {
    const container = await openFixture(page, 'base')
    const panel = container.getByRole('region', { name: 'Setup steps' })
    await expect(panel).toBeVisible()
    const style = await panel.evaluate((el) => {
      const s = getComputedStyle(el)
      return { overflowY: s.overflowY, overscroll: s.overscrollBehaviorY, maxHeight: s.maxHeight, scrolls: el.scrollHeight > el.clientHeight, tabIndex: el.tabIndex }
    })
    expect(style).toEqual({ overflowY: 'auto', overscroll: 'contain', maxHeight: '192px', scrolls: true, tabIndex: 0 })

    // The panel is the next stop after the last control before it.
    await container.getByRole('button', { name: 'Remove filter: Next 3 months', exact: true }).focus()
    await page.keyboard.press('Tab')
    await expect(panel).toBeFocused()

    const scrollTop = () => panel.evaluate((el) => el.scrollTop)
    const atBottom = () => panel.evaluate((el) => Math.abs(el.scrollTop + el.clientHeight - el.scrollHeight) <= 1)
    // The browser may scroll smoothly; the next key waits until the panel has stopped.
    const settled = () => panel.evaluate((el) => new Promise<number>((resolve) => {
      let last = -1
      const tick = () => {
        if (el.scrollTop === last) resolve(el.scrollTop)
        else {
          last = el.scrollTop
          requestAnimationFrame(() => requestAnimationFrame(tick))
        }
      }
      tick()
    }))
    expect(await settled()).toBe(0)
    await page.keyboard.press('PageDown')
    await expect.poll(scrollTop).toBeGreaterThan(0)
    await settled()
    await expect(panel).toBeFocused()
    await page.keyboard.press('End')
    await expect.poll(atBottom).toBe(true)
    await settled()
    // The header stays at the top of the panel while the rows scroll under it.
    const held = await panel.evaluate((el) => {
      const header = el.querySelector('[data-slot="scroll-panel-header"]')!
      return Math.round(header.getBoundingClientRect().top - el.getBoundingClientRect().top - el.clientTop)
    })
    expect(held).toBe(0)
    await expect(panel).toBeFocused()
    await page.keyboard.press('Home')
    await expect.poll(scrollTop).toBe(0)
  })

  test('scrolls a box the keyboard moves to out from under the header, never leaving it hidden there (WCAG 2.4.11)', async ({ page }) => {
    const container = await openFixture(page, 'base')
    const panel = container.getByRole('region', { name: 'Setup steps' })
    const boxes = panel.getByRole('checkbox')
    await expect(boxes).toHaveCount(11)
    // The whole panel in the window, so every point of it can be hit.
    await panel.scrollIntoViewIfNeeded()

    // The panel's scroll padding is its header's height and the focus ring's 4px reach.
    const padding = await panel.evaluate((el) => ({
      padding: getComputedStyle(el).scrollPaddingTop,
      header: (el.querySelector('[data-slot="scroll-panel-header"]') as HTMLElement).offsetHeight,
    }))
    expect(padding.padding).toBe(`${padding.header + 4}px`)

    /** Where the nth box sits: inside the header's box, clear below it, and whether a point at its centre reaches it. */
    const where = (n: number) => panel.evaluate((el, i) => {
      const header = el.querySelector('[data-slot="scroll-panel-header"]')!.getBoundingClientRect()
      const box = el.querySelectorAll('input[type="checkbox"]')[i]
      const r = box.getBoundingClientRect()
      return {
        underHeader: r.top >= header.top && r.bottom <= header.bottom,
        clear: r.top >= header.bottom,
        seen: document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) === box,
      }
    }, n)
    /** The panel's scrollTop once it has stopped moving. */
    const settled = () => panel.evaluate((el) => new Promise<number>((resolve) => {
      let last = -1
      const tick = () => {
        if (el.scrollTop === last) resolve(el.scrollTop)
        else {
          last = el.scrollTop
          requestAnimationFrame(() => requestAnimationFrame(tick))
        }
      }
      tick()
    }))

    // A person scrolls the list so the fourth box sits under the header, the fifth just below it.
    await panel.evaluate((el) => {
      const header = el.querySelector('[data-slot="scroll-panel-header"]')!.getBoundingClientRect()
      const r = el.querySelectorAll('input[type="checkbox"]')[3].getBoundingClientRect()
      el.scrollTo({ top: el.scrollTop + (r.top + r.height / 2) - (header.top + header.height / 2), behavior: 'instant' })
    })
    const scrolled = await settled()
    expect(scrolled).toBeGreaterThan(0)
    expect(await where(3)).toEqual({ underHeader: true, clear: false, seen: false })
    expect(await where(4)).toEqual({ underHeader: false, clear: true, seen: true })

    // The keyboard is on the fifth box, which is in view, so nothing scrolls; Shift+Tab moves it to the fourth.
    await boxes.nth(4).focus()
    expect(await settled()).toBe(scrolled)
    await page.keyboard.press('Shift+Tab')
    await expect(boxes.nth(3)).toBeFocused()
    expect(await settled()).toBeLessThan(scrolled)
    expect(await where(3)).toEqual({ underHeader: false, clear: true, seen: true })
  })
})

test.describe('StatusDot', () => {
  test.use({ colorScheme: 'light', reducedMotion: 'reduce', viewport: { width: 1280, height: 800 } })

  test('says its words under the new look, and is today\'s dot with its title with newLook off', async ({ page }, testInfo) => {
    const container = await openFixture(page, 'base')
    const section = container.getByRole('heading', { level: 2, name: 'Every status' }).locator('xpath=..')
    if (testInfo.project.name === ON) {
      // Open, draft and closed: a closed registration says so, as the event page does.
      const dots = section.locator('[data-slot="status-dot"]')
      await expect(dots).toHaveText(['Registration open', 'Opening soon', 'Registration closed'])
      await expect(section.locator('[title]')).toHaveCount(0)
    } else {
      // Today's titles, closed under "Coming soon" as before.
      await expect(section.locator('[data-slot="status-dot"]')).toHaveCount(0)
      const titled = await section.locator('span[title]').evaluateAll((els) => els.map((el) => ({ title: el.getAttribute('title'), text: el.textContent })))
      expect(titled).toEqual([
        { title: 'Registration open', text: '' },
        { title: 'Opening soon', text: '' },
        { title: 'Coming soon', text: '' },
      ])
    }
  })

  test('in the /tournaments list, says its words under the new look, readable on the row', async ({ page }, testInfo) => {
    await page.goto('/tournaments')
    const row = page.getByRole('button', { name: /Fixture Fall Open/ }).first()
    await expect(row).toBeVisible()
    if (testInfo.project.name === ON) {
      const dot = row.locator('[data-slot="status-dot"]')
      await expect(dot).toHaveText('Registration open')
      await expect(row).toContainText('Registration open')
      const results = await new AxeBuilder({ page }).include('[data-slot="status-dot"]').withRules(['color-contrast']).analyze()
      expect(findings(results)).toEqual([])
      expect(results.passes.map((p) => p.id)).toContain('color-contrast')
    } else {
      await expect(row.locator('[data-slot="status-dot"]')).toHaveCount(0)
      await expect(row.locator('span[title="Registration open"]')).toHaveCount(1)
      await expect(row).not.toContainText('Registration open')
    }
  })
})
