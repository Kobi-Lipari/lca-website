// test/a11y/dark-spot.spec.ts
//
// Axe in dark mode on /, /tournaments and /membership (WS01 step 23).
//
// It runs on the a11y-on build (newLook on) with a dark device, so <html>
// carries .dark and the Looks-3 dark tokens apply. On a11y-off nothing turns
// dark (tokens.spec.ts proves it), so it skips there.
//
// Step 23 moved the pages' navy text to text-ink and their white grounds to
// bg-surface, so axe must find no colour-contrast failure caused by either:
// no failing text in the brand navy #1a2744 (navy on a dark ground) and no
// failing text on a white ground. Every colour-contrast failure that is left
// must come from a class a later step moves to the tokens: raw hex colours
// and the status colours (step 24) or gold text (step 25), on the element
// itself or on an ancestor up to its ground. Anything else fails the test.
// Every finding of every rule is printed and attached, so a run is also the
// record of what is left. The full axe sweep of every look is step 32's
// (WS01 acceptance criterion 1).
import AxeBuilder from '@axe-core/playwright'
import { expect, test } from './support'

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']
const NAVY = '#1a2744'
const WHITE = '#ffffff'

/** Classes whose colours a later step moves to the tokens: raw hex and status colours (24), gold text (25). */
const LATER = [
  /^(?:[^:\s]+:)*(?:text|bg|border)-\[#/,
  /^(?:[^:\s]+:)*(?:text|bg)-(?:emerald|red|amber|green|blue|yellow|orange|gray|slate)-/,
  /^(?:[^:\s]+:)*text-lca-gold\b/,
]

interface Contrast {
  selector: string
  html: string
  fg: string
  bg: string
  ratio: number
  /** The classes of the element and of its ancestors up to the one that paints its ground. */
  classes: string[]
}

test.use({ colorScheme: 'dark', reducedMotion: 'reduce', viewport: { width: 1280, height: 800 } })

for (const route of ['/', '/tournaments', '/membership']) {
  test(`${route} in dark mode: no navy text on a dark ground and no white ground`, async ({ page, external }, testInfo) => {
    test.skip(testInfo.project.name !== 'a11y-on', 'only the a11y-on build has dark mode')
    const scriptErrors: string[] = []
    page.on('pageerror', (err) => scriptErrors.push(err.message))

    await page.goto(route)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('main')).toBeVisible()
    const html = await page.evaluate(() => ({
      look: document.documentElement.getAttribute('data-look'),
      dark: document.documentElement.classList.contains('dark'),
      body: getComputedStyle(document.body).backgroundColor,
    }))
    expect(html).toEqual({ look: 'new', dark: true, body: 'rgb(11, 18, 32)' })

    const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze()
    const contrast: Contrast[] = []
    for (const v of results.violations.filter((x) => x.id === 'color-contrast')) {
      for (const n of v.nodes) {
        const data = (n.any[0]?.data ?? {}) as { fgColor?: string; bgColor?: string; contrastRatio?: number }
        const selector = n.target.map(String).join(' ')
        const classes = await page.evaluate((sel) => {
          const out: string[] = []
          for (let el = document.querySelector(sel); el; el = el.parentElement) {
            out.push(...Array.from(el.classList))
            const bg = getComputedStyle(el).backgroundColor
            if (bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') break
          }
          return out
        }, n.target.map(String)[0])
        contrast.push({
          selector,
          html: n.html.replace(/\s+/g, ' ').slice(0, 160),
          fg: (data.fgColor ?? '').toLowerCase(),
          bg: (data.bgColor ?? '').toLowerCase(),
          ratio: data.contrastRatio ?? 0,
          classes,
        })
      }
    }
    const cause = (c: Contrast) =>
      c.fg === NAVY ? 'navy text on a dark ground'
        : c.bg === WHITE ? 'a white ground'
          : c.classes.some((k) => LATER.some((re) => re.test(k))) ? `left to a later step (${c.classes.filter((k) => LATER.some((re) => re.test(k))).join(' ')})`
            : 'not explained'
    const others = results.violations.filter((x) => x.id !== 'color-contrast')

    const report = [
      `axe in dark mode on ${route}: ${results.passes.length} rules passed, ${contrast.length} colour-contrast failure(s), ${others.length} other rule(s) with findings.`,
      ...contrast.map((c) => `  color-contrast ${c.ratio}:1, ${c.fg} on ${c.bg}, ${cause(c)}: ${c.selector}\n        ${c.html}`),
      ...others.flatMap((v) => v.nodes.map((n) => `  ${v.id} (${v.impact ?? 'no impact given'}): ${n.target.map(String).join(' ')}`)),
    ].join('\n')
    console.log(report)
    await testInfo.attach(`axe-dark${route === '/' ? '-home' : route.replace(/\//g, '-')}.json`, {
      body: JSON.stringify({ contrast: contrast.map((c) => ({ ...c, cause: cause(c) })), others: others.map((v) => ({ rule: v.id, nodes: v.nodes.map((n) => n.target.map(String).join(' ')) })) }, null, 2),
      contentType: 'application/json',
    })

    expect(contrast.filter((c) => c.fg === NAVY), report).toEqual([])
    expect(contrast.filter((c) => c.bg === WHITE), report).toEqual([])
    expect(contrast.filter((c) => cause(c) === 'not explained'), report).toEqual([])
    expect(scriptErrors, 'script errors on the page').toEqual([])
    expect(external, 'requests to hosts other than the local server').toEqual([])
  })
}
