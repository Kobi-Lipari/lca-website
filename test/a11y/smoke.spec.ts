// test/a11y/smoke.spec.ts
//
// Loads the homepage on both accessibility test builds (a11y-on with newLook
// and themeHeritage, a11y-off with no switches) and runs axe on it, with the
// WCAG 2.0, 2.1 and 2.2 A and AA rules.
//
// Every violation axe finds is printed and attached to the report. A
// violation fails the test unless known-violations.json lists it (rule id,
// selector, build and page): those are the issues the site has today, kept
// visible rather than ignored, and the full axe sweep of step 32 (WS01
// acceptance criterion 1) fixes them and empties that list. A listed issue
// that no longer appears is reported, so the list can be trimmed.
//
// The page must also load without a script error and without asking any host
// other than the local server for anything.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import AxeBuilder from '@axe-core/playwright'
import { expect, test } from './support'

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

interface Finding {
  project: string
  route: string
  rule: string
  impact: string | null
  selector: string
  help: string
  /** The start of the element's HTML, to say which element it is. */
  html: string
}

interface KnownList {
  comment: string
  violations: Array<Omit<Finding, 'help' | 'impact' | 'html'> & { impact?: string | null; help?: string }>
}

const known = JSON.parse(readFileSync(join(import.meta.dirname, 'known-violations.json'), 'utf8')) as KnownList

const sameIssue = (a: { project: string; route: string; rule: string; selector: string }, b: typeof a) =>
  a.project === b.project && a.route === b.route && a.rule === b.rule && a.selector === b.selector

for (const route of ['/']) {
  test(`${route} loads and axe reports no new violations`, async ({ page, external }, testInfo) => {
    const project = testInfo.project.name
    const scriptErrors: string[] = []
    page.on('pageerror', (err) => scriptErrors.push(err.message))

    await page.goto(route)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('main')).toBeVisible()

    const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze()
    const found: Finding[] = results.violations.flatMap((v) =>
      v.nodes.map((n) => ({
        project,
        route,
        rule: v.id,
        impact: v.impact ?? null,
        selector: n.target.map(String).join(' '),
        help: v.help,
        html: n.html.replace(/\s+/g, ' ').slice(0, 160),
      })),
    )

    const listed = known.violations.filter((k) => k.project === project && k.route === route)
    const fresh = found.filter((f) => !listed.some((k) => sameIssue(k, f)))
    const gone = listed.filter((k) => !found.some((f) => sameIssue(k, f)))

    const report = [
      `axe on ${route} (${project}): ${results.passes.length} rules passed, ${found.length} violation(s) found, ${found.length - fresh.length} of them known.`,
      ...found.map((f) => `  ${listed.some((k) => sameIssue(k, f)) ? 'known' : 'NEW  '} ${f.rule} (${f.impact ?? 'no impact given'}) at ${f.selector}: ${f.help}\n        ${f.html}`),
      ...gone.map((k) => `  fixed ${k.rule} at ${k.selector}: listed in known-violations.json but not found on this run; remove it once it no longer appears`),
    ].join('\n')
    console.log(report)
    await testInfo.attach(`axe-${project}${route === '/' ? '-home' : route.replace(/\//g, '-')}.json`, {
      body: JSON.stringify({ found, fresh, gone }, null, 2),
      contentType: 'application/json',
    })
    for (const k of gone) testInfo.annotations.push({ type: 'fixed', description: `${k.rule} at ${k.selector}` })

    expect(fresh, report).toEqual([])
    expect(scriptErrors, 'script errors on the page').toEqual([])
    expect(external, 'requests to hosts other than the local server').toEqual([])
  })
}
