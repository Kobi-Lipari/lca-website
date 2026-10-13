// test/a11y/builds.spec.ts
//
// Checks that each Playwright project is looking at the build it names, and
// what that build adds for the accessibility tests:
//
// - the server on each port serves its own dist folder: the switches inside
//   the page are the ones its build was made with (newLook and themeHeritage
//   on in a11y-on, nothing on in a11y-off), read from the feature module the
//   site itself loaded
// - /__fixtures/:name exists in both test builds, draws the base look for
//   every name today, tells a visitor which names exist for an unknown one,
//   and follows the plain-language rules: a weekday on the date, "7:00 PM",
//   "US Chess" and half points as ½
// - the page loads with no script error and no request to any other host
//
// Reads only. Both projects share one local database, so nothing here writes.
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from './support'
import { A11Y_VARIANTS, ROOT } from './global-setup'

const SWITCHES_ON = ['newLook', 'themeHeritage']

/** The build folder of the project the test is running in. */
function variantOf(project: string) {
  const variant = A11Y_VARIANTS.find((v) => v.name === project)
  if (!variant) throw new Error(`${project} is not an accessibility project`)
  return variant
}

test.describe('which build is served', () => {
  test('the server on this port serves this project\'s build, with its switches', async ({ page }, testInfo) => {
    const variant = variantOf(testInfo.project.name)
    const assets = join(ROOT, variant.dist, 'assets')
    expect(existsSync(assets), `${variant.dist} was not built; run npm run test:a11y`).toBe(true)
    const featuresFile = readdirSync(assets).filter((f) => /^features-.*\.js$/.test(f))
    expect(featuresFile).toHaveLength(1)

    await page.goto('/')
    await page.waitForLoadState('networkidle')
    // The same module the site loaded: its default export is not named, so find the object of switches.
    const switches = await page.evaluate(async (url) => {
      const mod = await new Function('u', 'return import(u)')(url)
      const found = Object.values(mod as Record<string, unknown>).find((v) => v && typeof v === 'object' && 'newLook' in (v as object))
      return found as Record<string, boolean> | undefined
    }, `/assets/${featuresFile[0]}`)
    expect(switches, 'the feature switches object').toBeDefined()

    const on = variant.flags.split(',').filter(Boolean)
    expect(on).toEqual(testInfo.project.name === 'a11y-on' ? SWITCHES_ON : [])
    for (const [name, value] of Object.entries(switches!)) {
      expect(value, `${name} in ${testInfo.project.name}`).toBe(on.includes(name))
    }
    // The ones the project is named for.
    expect(switches!.newLook).toBe(testInfo.project.name === 'a11y-on')
    expect(switches!.themeHeritage).toBe(testInfo.project.name === 'a11y-on')
    // Switches the site has not turned on stay off in both.
    expect(switches!.newNav).toBe(false)
    expect(switches!.themeScholastic).toBe(false)
  })

  test('the two builds are different files, and the served page comes from this project\'s folder', async ({ request }, testInfo) => {
    const mine = variantOf(testInfo.project.name)
    const other = A11Y_VARIANTS.find((v) => v.name !== mine.name)!
    const index = await request.get('/')
    expect(index.status()).toBe(200)
    const html = await index.text()
    const entry = html.match(/<script[^>]+src="\/assets\/(index-[^"]+\.js)"/)?.[1]
    expect(entry, 'the page\'s entry script').toBeTruthy()
    expect(existsSync(join(ROOT, mine.dist, 'assets', entry!))).toBe(true)
    expect(existsSync(join(ROOT, other.dist, 'assets', entry!))).toBe(false)
    // The switches are in a chunk of their own, with a different name in each build.
    const featuresOf = (dist: string) => readdirSync(join(ROOT, dist, 'assets')).find((f) => /^features-.*\.js$/.test(f))!
    expect(featuresOf(mine.dist)).not.toBe(featuresOf(other.dist))
    const own = await request.get(`/assets/${featuresOf(mine.dist)}`)
    expect(own.status()).toBe(200)
    expect(await own.text()).toContain('newLook')
    // The other build's file is not on this server: what comes back (the site's page, for an unknown path) has no switches in it.
    const foreign = await request.get(`/assets/${featuresOf(other.dist)}`)
    expect(await foreign.text()).not.toContain('newLook')
  })
})

test.describe('/__fixtures/:name', () => {
  test('draws the base look for every fixture name, each with its own data-theme', async ({ page, external }) => {
    const scripts: string[] = []
    page.on('pageerror', (e) => scripts.push(e.message))
    const expected: Record<string, string> = { base: '', heritage: 'heritage', scholastic: 'scholastic', live: 'live' }
    for (const [name, theme] of Object.entries(expected)) {
      await page.goto(`/__fixtures/${name}`)
      await expect(page.getByRole('heading', { level: 1, name: `Fixture: ${name}` })).toBeVisible()
      const container = page.locator(`[data-fixture="${name}"]`)
      await expect(container).toHaveCount(1)
      expect(await container.getAttribute('data-theme'), name).toBe(theme)
      await expect(page).toHaveTitle(new RegExp(`Fixture: ${name}`))
      // Buttons, a text field, status badges and a table are all there to measure.
      await expect(container.getByRole('button', { name: 'Register' })).toBeVisible()
      await expect(container.getByLabel('Your name')).toBeVisible()
      await expect(container.locator('[data-status]')).toHaveCount(3)
      await expect(container.locator('th')).toHaveCount(3)
    }
    expect(scripts).toEqual([])
    expect(external).toEqual([])
  })

  test('says which names exist when the name is unknown, and never draws a fixture for it', async ({ page }) => {
    for (const bad of ['nope', 'Base', 'constructor', 'toString', '__proto__', 'base%20']) {
      await page.goto(`/__fixtures/${bad}`)
      await expect(page.getByRole('heading', { level: 1 })).toContainText('No fixture named')
      await expect(page.locator('[data-fixture]'), bad).toHaveCount(0)
      await expect(page.getByRole('link', { name: 'heritage' })).toBeVisible()
    }
  })

  test('has no route for a missing name', async ({ page }) => {
    await page.goto('/__fixtures/')
    await expect(page.locator('[data-fixture]')).toHaveCount(0)
  })

  test('puts a weekday on the date, writes the time as 7:00 PM, says US Chess, and writes half points as ½', async ({ page }) => {
    await page.goto('/__fixtures/base')
    await expect(page.getByRole('heading', { level: 1, name: 'Fixture: base' })).toBeVisible()
    const main = await page.locator('main').innerText()

    const date = main.match(/\b(Sun|Mon|Tue|Wed|Thu|Fri|Sat), ([A-Z][a-z]{2}) (\d{1,2})\b/)
    expect(date, 'a weekday and a date').not.toBeNull()
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    // The page gives no year, so the weekday must be right for the year the tests were written for.
    expect(weekdays[new Date(Date.UTC(2026, months.indexOf(date![2]), Number(date![3]))).getUTCDay()]).toBe(date![1])

    expect(main).toContain('at 7:00 PM')
    expect(main.match(/\b\d{1,2}:\d{2}\s*[ap]\.?m\.?/gi)).toEqual(['7:00 PM'])
    expect(main).toContain('US Chess')
    expect(main).not.toMatch(/USCF/i)

    const scores = await page.locator('main td.font-mono').allInnerTexts()
    expect(scores).toEqual(['3½', '3', '2½'])
    expect(main).not.toMatch(/\d\.5/)
  })

  test('puts figures in the monospace face, headers in a header cell, and a label on the field', async ({ page }) => {
    await page.goto('/__fixtures/base')
    const font = await page.locator('main td.font-mono').first().evaluate((el) => getComputedStyle(el).fontFamily)
    expect(font).toMatch(/monospace/)
    await expect(page.getByRole('columnheader')).toHaveText(['Place', 'Player', 'Score'])
    await expect(page.getByLabel('Your name')).toHaveAttribute('placeholder', 'First and last name')
  })
})
