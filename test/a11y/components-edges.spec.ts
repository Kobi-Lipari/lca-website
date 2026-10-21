// test/a11y/components-edges.spec.ts
//
// The base components of WS01 step 26 at their edges, in the browser, on
// both builds. test/a11y/components.spec.ts holds the main run; this file
// adds what it leaves out.
//
// - Every status shows its words, found by the checker itself (acceptance
//   criterion 5): a rule of the site's own, given to axe, fails a
//   [data-status] element, or a StatusDot under the new look, with no words
//   a reader can see, words hidden for screen readers only and a mark alone
//   included. It finds none in the four fixtures (the thirteen
//   [data-status] elements, and on a11y-on the three dots too), in light
//   and, on a11y-on, in dark mode, and it finds the four such elements a
//   test plants, so a pass means something.
// - The live tag's dot does not move (acceptance criterion 14), with no
//   reduced motion asked for: two pictures of each live tag a second apart
//   are the same, and a stylesheet that sets every status mark turning still
//   leaves the live dot with no animation, its own animation of none
//   winning, while the other marks turn (so the stylesheet did apply).
// - The gold Button keeps navy words on its gold in dark mode and while the
//   pointer is over it, at 4.5:1 or more, and shows a focus ring.
// - The keyboard reaches every chip's toggle and remove button, then the
//   scroll panel, in order, each with a ring a person can see; the arrow
//   keys scroll the panel and Shift+Tab leaves it.
// - On a phone the components fit the screen and axe finds nothing.
// - In dark mode axe finds nothing on the heritage, scholastic and live
//   fixtures either (components.spec.ts checks base).
// - The soon and LCA tints keep their tint in a browser that cannot mix
//   colours (acceptance criterion 6): the fallback rule, applied as such a
//   browser would apply it, gives the soon and LCA tags and the chip that is
//   on the tint bg-lca-gold/20 falls back to, with newLook off, and changes
//   nothing under the new look.
// - A screen reader hears each date block's words once.
// - In the /tournaments list the dot of an event whose registration is not
//   open yet says so under the new look, and is today's titled dot with
//   newLook off; under the new look the dot's words reach 4.5:1 on a
//   selected row's tint (a club's colour or the LCA gold at 5 per cent), in
//   light and dark mode.
//
// On a11y-off the two closed badges are left out of the axe runs, for the
// reason components.spec.ts gives (today's muted pair, 4.35:1; see
// REDESIGN_STATUS.md, Follow-ups, "Muted StatusBadge contrast (step 20)").
// Reads only; the clicks and the planted elements change only the page in
// the browser.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import AxeBuilder from '@axe-core/playwright'
import type { Locator, Page } from '@playwright/test'
import { expect, test } from './support'

const ON = 'a11y-on'
const OFF = 'a11y-off'
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']
const FIXTURES = ['base', 'heritage', 'scholastic', 'live'] as const
const CLOSED = '[data-status="closed"]'
const ROOT = join(import.meta.dirname, '../..')

/** The site's own axe rule: every [data-status] element, and every StatusDot under the new look, shows words a reader can see. */
const STATUS_WORDS = 'lca-status-words'
const AXE_WITH_STATUS_WORDS = `${readFileSync(join(ROOT, 'node_modules/axe-core/axe.min.js'), 'utf8')}
;axe.configure({
  checks: [{
    id: '${STATUS_WORDS}',
    evaluate: function (node, options, virtualNode) {
      var words = axe.commons.text.sanitize(axe.commons.text.visibleVirtual(virtualNode, false, false)).trim();
      this.data({ words: words });
      return words !== '';
    },
    metadata: { impact: 'serious', messages: { pass: 'The status shows its words', fail: 'The status shows no words a reader can see' } }
  }],
  rules: [{
    id: '${STATUS_WORDS}',
    selector: '[data-status], [data-slot="status-dot"]',
    any: ['${STATUS_WORDS}'],
    tags: ['lca'],
    metadata: { description: 'A status is shown in words beside its colour', help: 'Every status and registration dot shows its words' }
  }]
});`

/** Opens a fixture and waits for its fonts, so every box is final. */
async function openFixture(page: Page, name: string): Promise<Locator> {
  await page.goto(`/__fixtures/${name}`)
  const container = page.locator(`[data-fixture="${name}"]`)
  await expect(container.getByRole('heading', { level: 2, name: 'Every status' })).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  return container
}

/** The section of a fixture under a level 2 heading. */
const section = (container: Locator, heading: string) => container.getByRole('heading', { level: 2, name: heading }).locator('xpath=..')

/** Every finding axe makes, one line each, for the report. */
function findings(results: Awaited<ReturnType<AxeBuilder['analyze']>>): string[] {
  return results.violations.flatMap((v) => v.nodes.map((n) => {
    const data = (n.any[0]?.data ?? {}) as { fgColor?: string; bgColor?: string; contrastRatio?: number }
    const colours = data.contrastRatio ? ` ${data.fgColor} on ${data.bgColor}, ${data.contrastRatio}:1` : ''
    return `${v.id} at ${n.target.map(String).join(' ')}${colours}`
  }))
}

/** [r, g, b] of a CSS colour laid over a ground, as the browser paints them: through a canvas. */
function paintOver(page: Page, colour: string, ground: string): Promise<[number, number, number]> {
  return page.evaluate(([c, g]) => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 1
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 1, 1)
    ctx.fillStyle = c
    ctx.fillRect(0, 0, 1, 1)
    const [r, gr, b] = ctx.getImageData(0, 0, 1, 1).data
    return [r, gr, b] as [number, number, number]
  }, [colour, ground] as const)
}

/** WCAG 2.x contrast ratio of two [r, g, b] colours. */
function ratio(a: [number, number, number], b: [number, number, number]): number {
  const lum = (c: [number, number, number]) => {
    const [r, g, bl] = c.map((v) => {
      const s = v / 255
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl
  }
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** Whether the focused element draws a ring a person can see: an outline or a box shadow. */
function ringShown(target: Locator) {
  return target.evaluate((el) => {
    const s = getComputedStyle(el)
    const outline = s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 1
    // A ring drawn as a shadow: one layer at least with a colour that shows and some width.
    const layers = s.boxShadow === 'none' ? [] : s.boxShadow.split(/,(?![^(]*\))/)
    const shadow = layers.some((l) => !/rgba\(0, 0, 0, 0\)|transparent|\/ 0\)/.test(l) && /\s[1-9]\d*(?:\.\d+)?px/.test(l))
    return el.matches(':focus-visible') && (outline || shadow)
  })
}

test.describe('the checker\'s own rule: every [data-status] element shows words', () => {
  test.use({ colorScheme: 'light', reducedMotion: 'reduce', viewport: { width: 1280, height: 800 } })

  for (const name of FIXTURES) {
    test(`${name}: the rule passes every status and dot, in light and, on a11y-on, in dark mode`, async ({ page }, testInfo) => {
      const container = await openFixture(page, name)
      const run = () => new AxeBuilder({ page, axeSource: AXE_WITH_STATUS_WORDS }).include(`[data-fixture="${name}"]`).withRules([STATUS_WORDS]).analyze()
      const light = await run()
      expect(findings(light)).toEqual([])
      const passed = light.passes.find((p) => p.id === STATUS_WORDS)
      // Thirteen [data-status] elements on both builds, and the three dots that carry words under the new look.
      const expected = testInfo.project.name === ON ? 13 + 3 : 13
      expect(await container.locator('[data-status], [data-slot="status-dot"]').count()).toBe(expected)
      expect(passed?.nodes.length, 'every status and dot was checked').toBe(expected)
      for (const n of passed!.nodes) expect((n.any[0]?.data as { words: string }).words, n.target.join(' ')).not.toBe('')
      if (testInfo.project.name === ON) {
        await page.emulateMedia({ colorScheme: 'dark' })
        await page.reload()
        await openFixture(page, name)
        await expect(page.locator('html')).toHaveClass(/\bdark\b/)
        const dark = await run()
        expect(findings(dark)).toEqual([])
        expect(dark.passes.find((p) => p.id === STATUS_WORDS)?.nodes.length).toBe(expected)
      }
    })
  }

  test('fails a status with no words, words for screen readers only, or a mark alone, and a dot with no words', async ({ page }) => {
    const container = await openFixture(page, 'base')
    await container.evaluate((el) => {
      const planted = document.createElement('div')
      planted.id = 'planted-statuses'
      planted.innerHTML = [
        '<span data-status="open"><span class="sr-only">Registration open</span></span>',
        '<span data-status="soon"></span>',
        '<span data-status="full"><svg aria-hidden="true" viewBox="0 0 8 8" width="8" height="8"><circle cx="4" cy="4" r="3"></circle></svg></span>',
        '<span data-slot="status-dot"><span aria-hidden="true" style="display:inline-block;width:6px;height:6px;border-radius:9999px;background:#1a2744"></span></span>',
        '<span data-status="live">Live</span>',
      ].join('')
      el.append(planted)
    })
    const results = await new AxeBuilder({ page, axeSource: AXE_WITH_STATUS_WORDS }).include('#planted-statuses').withRules([STATUS_WORDS]).analyze()
    const failed = results.violations.find((v) => v.id === STATUS_WORDS)
    expect(failed?.nodes.map((n) => n.html.match(/data-(?:status|slot)="([\w-]+)"/)?.[1])).toEqual(['open', 'soon', 'full', 'status-dot'])
    expect(results.passes.find((p) => p.id === STATUS_WORDS)?.nodes).toHaveLength(1)
  })
})

test.describe('the live tag\'s dot does not move, with no reduced motion asked for', () => {
  test.use({ colorScheme: 'light', reducedMotion: 'no-preference', viewport: { width: 1280, height: 800 } })

  test('two pictures of each live tag a second apart are the same, in every fixture', async ({ page }) => {
    for (const name of FIXTURES) {
      const container = await openFixture(page, name)
      expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(false)
      const tags = container.locator('[data-slot="status-badge"][data-status="live"]')
      await expect(tags).toHaveCount(2)
      for (let i = 0; i < 2; i++) {
        const first = await tags.nth(i).screenshot({ animations: 'allow' })
        await page.waitForTimeout(1000)
        const second = await tags.nth(i).screenshot({ animations: 'allow' })
        expect(first.equals(second), `${name}: live tag ${i + 1} looks the same a second later`).toBe(true)
      }
    }
  })

  test('a stylesheet that turns every status mark leaves the live dot still, its own animation of none winning', async ({ page }) => {
    const container = await openFixture(page, 'base')
    await page.addStyleTag({ content: '@keyframes lca-probe-turn { to { transform: rotate(1turn); } } [data-slot="status-mark"] { animation: lca-probe-turn 1s linear infinite; }' })
    const marks = await container.locator('[data-slot="status-badge"]').evaluateAll((tags) =>
      tags.flatMap((tag) => [...tag.querySelectorAll('[data-slot="status-mark"]')].map((mark) => ({
        status: tag.getAttribute('data-status'),
        name: getComputedStyle(mark).animationName,
        running: mark.getAnimations().length,
      }))),
    )
    const live = marks.filter((m) => m.status === 'live')
    expect(live).toEqual([
      { status: 'live', name: 'none', running: 0 },
      { status: 'live', name: 'none', running: 0 },
    ])
    // The stylesheet did apply: every other mark turns.
    const others = marks.filter((m) => m.status !== 'live')
    expect(others.length).toBeGreaterThanOrEqual(7)
    for (const m of others) expect(m, m.status ?? '').toEqual({ status: m.status, name: 'lca-probe-turn', running: 1 })
  })
})

test.describe('the gold Button', () => {
  test.use({ colorScheme: 'light', reducedMotion: 'reduce', viewport: { width: 1280, height: 800 } })

  test('keeps navy words on its gold, at 4.5:1 or more, at rest and under the pointer, in light and, on a11y-on, dark mode', async ({ page }, testInfo) => {
    const schemes = testInfo.project.name === ON ? (['light', 'dark'] as const) : (['light'] as const)
    for (const scheme of schemes) {
      await page.emulateMedia({ colorScheme: scheme })
      for (const name of FIXTURES) {
        const container = await openFixture(page, name)
        const gold = container.getByRole('button', { name: 'Join the waitlist' })
        const ground = await container.evaluate((el) => getComputedStyle(el).backgroundColor)
        // The Button's colours ease in on a11y-off, where no reduced-motion rule stops them: measure once they settle.
        const settled = () => gold.evaluate(async (el) => {
          await Promise.all(el.getAnimations().map((a) => a.finished))
          return { bg: getComputedStyle(el).backgroundColor, color: getComputedStyle(el).color }
        })
        await page.mouse.move(0, 0)
        const rest = await settled()
        expect(rest, `${name} ${scheme}`).toEqual({ bg: 'rgb(200, 169, 74)', color: 'rgb(26, 39, 68)' })
        await gold.hover()
        await expect.poll(() => gold.evaluate((el) => el.matches(':hover'))).toBe(true)
        const hover = await settled()
        expect(hover.color, `${name} ${scheme} under the pointer`).toBe('rgb(26, 39, 68)')
        const fill = await paintOver(page, hover.bg, ground)
        const words = await paintOver(page, hover.color, ground)
        expect(ratio(words, fill), `${name} ${scheme}: navy on ${hover.bg} over ${ground}`).toBeGreaterThanOrEqual(4.5)
        // Gold, not some other fill: red the most, blue the least.
        expect(fill[0] > fill[1] && fill[1] > fill[2], `${name} ${scheme}: ${fill}`).toBe(true)
      }
    }
  })

  test('shows a focus ring when the keyboard reaches it', async ({ page }) => {
    const container = await openFixture(page, 'base')
    const gold = container.getByRole('button', { name: 'Join the waitlist' })
    // The control before it on the page is the text field.
    await container.getByLabel('Your name').focus()
    await page.keyboard.press('Tab')
    await expect(gold).toBeFocused()
    expect(await ringShown(gold)).toBe(true)
  })
})

test.describe('the keyboard through the chips and into the scroll panel', () => {
  test.use({ colorScheme: 'light', reducedMotion: 'reduce', viewport: { width: 1280, height: 800 } })

  test('reaches each toggle and remove button in order, then the panel, each with a ring a person can see', async ({ page }) => {
    const container = await openFixture(page, 'base')
    await container.getByRole('button', { name: 'Join the waitlist' }).focus()
    const stops: string[] = []
    for (let i = 0; i < 7; i++) {
      await page.keyboard.press('Tab')
      const focused = page.locator(':focus')
      stops.push(await focused.evaluate((el) => el.getAttribute('aria-label') ?? (el.textContent ?? '').trim()))
      expect(await ringShown(focused), stops.at(-1)).toBe(true)
    }
    expect(stops).toEqual(['This month', 'Classical 2', 'Scholastic 2', 'Remove filter: Scholastic', 'Near me', 'Remove filter: Next 3 months', 'Setup steps'])
  })

  test('the arrow keys scroll the panel a line at a time, and Shift+Tab leaves it', async ({ page }) => {
    const container = await openFixture(page, 'base')
    const panel = container.getByRole('region', { name: 'Setup steps' })
    await container.getByRole('button', { name: 'Remove filter: Next 3 months', exact: true }).focus()
    await page.keyboard.press('Tab')
    await expect(panel).toBeFocused()
    const top = () => panel.evaluate((el) => el.scrollTop)
    expect(await top()).toBe(0)
    await page.keyboard.press('ArrowDown')
    await expect.poll(top).toBeGreaterThan(0)
    const height = await panel.evaluate((el) => el.clientHeight)
    // A line, not a page.
    await expect.poll(top).toBeLessThan(height)
    // Back up to the top. One press may not get there: a slower machine can
    // see the scroll down land after the first reading above, a line or more
    // further on. So press ArrowUp again while the panel is not at the top,
    // reading scrollTop after each press, up to ten presses.
    const atTop = () => expect.poll(top, { timeout: 1_000 }).toBe(0).then(() => true, () => false)
    for (let press = 1; press <= 10; press++) {
      await page.keyboard.press('ArrowUp')
      if (await atTop()) break
    }
    expect(await top()).toBe(0)
    await page.keyboard.press('Shift+Tab')
    await expect(container.getByRole('button', { name: 'Remove filter: Next 3 months', exact: true })).toBeFocused()
  })
})

test.describe('on a phone', () => {
  test.use({ colorScheme: 'light', reducedMotion: 'reduce', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })

  for (const name of FIXTURES) {
    test(`${name}: the components fit the screen, the remove buttons stay 24 by 24 or more, and axe finds nothing`, async ({ page }, testInfo) => {
      const container = await openFixture(page, name)
      const boxes = await container.evaluate((el) => {
        const parts = el.querySelectorAll('[data-slot="status-badge"], [data-slot="status-dot"], [data-slot="filter-chip"], [data-slot="date-block"], [data-slot="scroll-panel"], [data-variant="gold"]')
        return [...parts].map((p) => {
          const r = p.getBoundingClientRect()
          return { slot: p.getAttribute('data-slot') ?? p.getAttribute('data-variant'), left: r.left, right: r.right, width: r.width }
        })
      })
      expect(boxes.length).toBeGreaterThanOrEqual(10 + 5 + 3 + 1 + 1)
      for (const b of boxes) {
        expect(b.left, b.slot!).toBeGreaterThanOrEqual(0)
        expect(b.right, b.slot!).toBeLessThanOrEqual(390)
      }
      for (const remove of await container.getByRole('button', { name: /^Remove filter: / }).all()) {
        const box = (await remove.boundingBox())!
        expect(box.width).toBeGreaterThanOrEqual(24)
        expect(box.height).toBeGreaterThanOrEqual(24)
      }
      let axe = new AxeBuilder({ page }).include(`[data-fixture="${name}"]`).withTags(AXE_TAGS)
      if (testInfo.project.name === OFF) axe = axe.exclude(CLOSED)
      const results = await axe.analyze()
      expect(findings(results), findings(results).join('\n')).toEqual([])
    })
  }
})

test.describe('in dark mode, the other looks', () => {
  test.use({ colorScheme: 'dark', reducedMotion: 'reduce', viewport: { width: 1280, height: 800 } })

  for (const name of ['heritage', 'scholastic', 'live'] as const) {
    test(`${name}: axe finds nothing on the fixture`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== ON, 'only the a11y-on build has dark mode')
      await openFixture(page, name)
      await expect(page.locator('html')).toHaveClass(/\bdark\b/)
      const results = await new AxeBuilder({ page }).include(`[data-fixture="${name}"]`).withTags(AXE_TAGS).analyze()
      expect(findings(results), findings(results).join('\n')).toEqual([])
    })
  }
})

test.describe('the soon and LCA tints in a browser that cannot mix colours', () => {
  test.use({ colorScheme: 'light', reducedMotion: 'reduce', viewport: { width: 1280, height: 800 } })

  test('the fallback rule gives the soon and LCA tags and the chip that is on their tint with newLook off, and changes nothing under the new look', async ({ page }, testInfo) => {
    const container = await openFixture(page, 'base')
    // The rule as the site's stylesheet holds it, inside @supports not (color: color-mix(...)).
    const rule = await page.evaluate(() => {
      const found: string[] = []
      const walk = (rules: CSSRuleList) => {
        for (const r of rules) {
          if (r instanceof CSSSupportsRule && /^not\b/.test(r.conditionText) && r.conditionText.includes('color-mix')) {
            for (const inner of r.cssRules) if (inner instanceof CSSStyleRule && inner.selectorText === ':root') found.push(inner.cssText)
          } else if (r instanceof CSSMediaRule) walk(r.cssRules)
        }
      }
      for (const sheet of document.styleSheets) walk(sheet.cssRules)
      return found
    })
    expect(rule).toHaveLength(1)
    expect(rule[0]).toMatch(/--status-soon-tint:\s*#c8a94a33/)
    expect(rule[0]).toMatch(/--status-lca-tint:\s*#c8a94a33/)

    const paint = () => container.evaluate(async (el) => {
      // The chip eases its colours in on a11y-off, where no reduced-motion rule stops it: read them once settled.
      await Promise.all(document.getAnimations().map((a) => a.finished))
      const pick = (sel: string) => getComputedStyle(el.querySelector(sel)!).backgroundColor
      return {
        soon: pick('[data-slot="status-badge"][data-status="soon"]'),
        lca: pick('[data-slot="status-badge"][data-status="lca"]'),
        chip: pick('[data-slot="filter-chip"][data-state="on"]'),
        open: pick('[data-slot="status-badge"][data-status="open"]'),
        pill: getComputedStyle(el.querySelector('span[data-status="soon"]:not([data-slot])')!.parentElement!).backgroundColor,
        ground: getComputedStyle(el).backgroundColor,
        rootSoon: getComputedStyle(document.documentElement).getPropertyValue('--status-soon-tint').trim(),
        rootLca: getComputedStyle(document.documentElement).getPropertyValue('--status-lca-tint').trim(),
      }
    })
    const before = await paint()
    // A browser that cannot mix colours applies the rule; this one skips it, so it is added as such a browser reads it.
    await page.addStyleTag({ content: rule[0] })
    const after = await paint()

    if (testInfo.project.name === ON) {
      // The new look's own values outrank the rule, on <html> as in the fixture's look.
      expect(before.rootSoon).toBe('#fbf7e9')
      expect(before.rootLca).toBe('#1a2744')
      expect(after).toEqual(before)
      return
    }
    expect([after.rootSoon, after.rootLca]).toEqual(['#c8a94a33', '#c8a94a33'])
    for (const part of ['soon', 'lca', 'chip'] as const) expect(after[part], part).toBe('rgba(200, 169, 74, 0.2)')
    expect(after.open).toBe(before.open)
    expect(after.ground).toBe(before.ground)
    // The same tint the gold pill of today falls back to, and the same colour as the mix on the page's ground.
    expect(await paintOver(page, after.soon, after.ground)).toEqual(await paintOver(page, '#c8a94a33', after.ground))
    const mixed = await paintOver(page, before.soon, before.ground)
    const fallen = await paintOver(page, after.soon, after.ground)
    const pill = await paintOver(page, before.pill, before.ground)
    for (let i = 0; i < 3; i++) {
      expect(Math.abs(mixed[i] - fallen[i]), `channel ${i}: the mix ${mixed}, the fallback ${fallen}`).toBeLessThanOrEqual(2)
      expect(Math.abs(pill[i] - fallen[i]), `channel ${i}: today's gold pill ${pill}, the fallback ${fallen}`).toBeLessThanOrEqual(2)
    }
  })
})

test.describe('the date blocks for a screen reader', () => {
  test.use({ colorScheme: 'light', reducedMotion: 'reduce', viewport: { width: 1280, height: 800 } })

  test('each is heard as formatDate\'s words, once, with the weekday, and the stacked parts are not heard', async ({ page }) => {
    const container = await openFixture(page, 'base')
    const tree = await section(container, 'Dates').ariaSnapshot()
    for (const words of ['Sat, Oct 24', 'Sat, Nov 7', 'Fri, Dec 4, 2026']) {
      expect(tree.split(words).length - 1, `${words} in\n${tree}`).toBe(1)
    }
    // The parts stacked for the eye ("Sat", "24", "Oct") are not read on their own.
    for (const line of tree.split('\n')) expect(line, tree).not.toMatch(/:\s*(?:Sun|Mon|Tue|Wed|Thu|Fri|Sat|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|\d{1,4})\s*$/)
  })
})

test.describe('StatusDot in the /tournaments list, registration not open yet', () => {
  test.use({ colorScheme: 'light', reducedMotion: 'reduce', viewport: { width: 1280, height: 800 } })

  test('says Opening soon under the new look, and is today\'s titled dot with newLook off', async ({ page }, testInfo) => {
    await page.goto('/tournaments')
    const row = page.getByRole('button', { name: /Fixture Winter Swiss/ }).first()
    await expect(row).toBeVisible()
    if (testInfo.project.name === ON) {
      await expect(row.locator('[data-slot="status-dot"]')).toHaveText('Opening soon')
      await expect(page.getByRole('button', { name: /Fixture Winter Swiss.*Opening soon/ }).first()).toBeVisible()
      await expect(row.locator('[title]')).toHaveCount(0)
    } else {
      await expect(row.locator('[data-slot="status-dot"]')).toHaveCount(0)
      await expect(row.locator('span[title="Opening soon"]')).toHaveCount(1)
      await expect(row).not.toContainText('Opening soon')
    }
  })
})

test.describe('StatusDot\'s words on a selected row of the /tournaments list', () => {
  test.use({ reducedMotion: 'reduce', viewport: { width: 1280, height: 800 } })

  for (const scheme of ['light', 'dark'] as const) {
    test(`reach 4.5:1 on the row's club tint when it is selected, in ${scheme} mode`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== ON, 'the dot has words only under the new look')
      await page.emulateMedia({ colorScheme: scheme })
      await page.goto('/tournaments')
      // A club's event (its colour) and an LCA event (the LCA gold), each selected in turn.
      for (const name of ['Fixture Saturday Quads', 'Fixture Fall Open']) {
        const row = page.getByRole('button', { name: new RegExp(name) }).first()
        await row.click()
        await expect.poll(() => row.evaluate((el) => (el as HTMLElement).style.backgroundColor)).not.toBe('')
        const dot = row.locator('[data-slot="status-dot"]')
        await expect(dot).toHaveText('Registration open')
        const results = await new AxeBuilder({ page }).include(`[data-slot="status-dot"]`).withRules(['color-contrast']).analyze()
        expect(findings(results), `${name}, ${scheme}`).toEqual([])
        expect(results.passes.map((p) => p.id), `${name}, ${scheme}`).toContain('color-contrast')
      }
    })
  }
})
