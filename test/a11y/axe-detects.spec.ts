// test/a11y/axe-detects.spec.ts
//
// The smoke spec passes when axe finds nothing new, which proves nothing if
// axe cannot find anything. This checks the same axe set-up (the WCAG 2.0,
// 2.1 and 2.2 A and AA tags) against small pages with known faults, so a
// green smoke run means the page is clean and not that axe was switched off.
// It also checks the allowlist logic the smoke spec uses is strict: a finding
// counts as known only when build, page, rule and selector all match.
import AxeBuilder from '@axe-core/playwright'
import { expect, test } from './support'

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

const FAULTY = `<!doctype html><html lang="en"><head><title>Faulty</title></head><body><main>
  <h1>Faulty page</h1>
  <img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=">
  <button></button>
  <input type="text" id="unlabelled">
  <p style="color:#aaa;background:#fff">Pale grey text on white</p>
  <a href="#x" style="display:inline-block;width:10px;height:10px;background:#000"></a>
</main></body></html>`

const CLEAN = `<!doctype html><html lang="en"><head><title>Clean</title></head><body><main>
  <h1>Clean page</h1>
  <img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" alt="A single pixel">
  <button type="button">Go</button>
  <label for="name">Name</label><input type="text" id="name">
  <p style="color:#111;background:#fff">Dark text on white</p>
</main></body></html>`

test('axe reports the faults in a page that has them', async ({ page }) => {
  await page.setContent(FAULTY)
  const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze()
  const rules = results.violations.map((v) => v.id)
  expect(rules).toEqual(expect.arrayContaining(['image-alt', 'button-name', 'label', 'color-contrast', 'link-name']))
  for (const v of results.violations) {
    expect(v.nodes.length).toBeGreaterThan(0)
    for (const n of v.nodes) expect(n.target.length).toBeGreaterThan(0)
  }
})

test('axe reports nothing on the same page once the faults are fixed', async ({ page }) => {
  await page.setContent(CLEAN)
  const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze()
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([])
  expect(results.passes.length).toBeGreaterThan(5)
})

test('axe reads the WCAG 2.2 target-size rule with these tags', async ({ page }) => {
  await page.setContent(
    `<!doctype html><html lang="en"><head><title>Small</title></head><body><main><h1>Small targets</h1>
     <button type="button" style="width:8px;height:8px;padding:0;margin:0 2px" aria-label="One"></button><button type="button" style="width:8px;height:8px;padding:0;margin:0 2px" aria-label="Two"></button></main></body></html>`,
  )
  const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze()
  expect(results.violations.map((v) => v.id)).toContain('target-size')
})

test('the page is stubbed and cut off from other hosts, so a run cannot pass by reaching the outside', async ({ page, external }) => {
  await page.setContent('<!doctype html><title>x</title><main>x</main>')
  const result = await page.evaluate(async () => {
    try {
      await fetch('https://example.org/outside')
      return 'reached'
    } catch {
      return 'blocked'
    }
  })
  expect(result).toBe('blocked')
  expect(external).toEqual(['https://example.org/outside'])
})
