// test/a11y/signed-in.spec.ts
//
// Proves test/a11y/signedIn.ts on today's header. For each person in
// test/unit/fixtures/navPersonas.ts who is signed in, the bar shows Profile
// and Log out, and the More menu's account links are exactly the ones
// today's header gives that person; signed out, the bar shows Log in and
// Join LCA and nothing is planted. In every case no request leaves the local
// server, none goes to the fake sign-in address, and no call to the site's
// API is refused or fails. It also shows that the planted session survives a
// reload without a word to the sign-in service, that the page never plants
// over a session it already holds, and that a person who logs out stays
// signed out on the next page.
//
// It runs on both builds. The header is read through test/a11y/chrome.ts:
// Log in, Join LCA and Clubs are names any header gives, while Profile, Log
// out, More and the More menu's account links are today's alone, so each
// check of them says so through it. Since WS02 step 5 the a11y-on build
// draws the new header from 1024 pixels up, and these tests read the page
// at the default 1280, so there each check of today's header notes "today
// only", and a twin beside it, marked through ifNew, reads the new header
// instead: My LCA once the session is read, the My LCA menu's rows for the
// person (each person's myLcaMenuRows in the fixture), and Log out as that
// menu's last row. The checks any header must pass run on both builds.
//
// The first check of each signed-in test is that the session was read, with
// a message that names the key and the installed sign-in library's version,
// so a new version that keeps its session another way fails there first.
//
// Reads only: nothing here writes to either project's local database.
import type { Locator, Page } from '@playwright/test'
import { CHROME_NAMES, NEW_NAMES, TODAYS_NAMES, ifNew, ifToday, siteHeader, widthOf } from './chrome'
import { expect, test } from './support'
import { SESSION_KEY, sessionInPage, signInAs, waitForMemberAnswers } from './signedIn'
import { TODAYS_ACCOUNT_LINKS, navPersona, navPersonas } from '../unit/fixtures/navPersonas'

/** Today's More menu's account links, opened the way a mouse opens it at this width. */
async function accountLinks(page: Page): Promise<Locator> {
  await siteHeader(page).getByRole('button', { name: TODAYS_NAMES.more }).hover()
  const menu = page.getByRole('menu')
  await expect(menu).toBeVisible()
  const names = new RegExp(`^(?:${TODAYS_ACCOUNT_LINKS.join('|')})$`)
  return menu.getByRole('menuitem').filter({ hasText: names })
}

/** The new header's My LCA menu, opened by a click unless it is open, and its rows. */
async function openMyLca(page: Page): Promise<Locator> {
  const button = siteHeader(page).getByRole('button', { name: NEW_NAMES.myLca })
  if ((await button.getAttribute('aria-expanded')) !== 'true') await button.click()
  const menu = siteHeader(page).locator('[data-slot="my-lca-menu"]')
  await expect(menu).toBeVisible()
  return menu.getByRole('listitem')
}

const people = navPersonas()

for (const person of people.filter((p) => p.user !== null)) {
  test(`${person.title}: Profile, Log out and today's account links`, async ({ page, external, baseURL }, testInfo) => {
    const visit = await signInAs(page, person, baseURL!)
    await page.goto('/')
    await ifToday(testInfo, 'header', widthOf(page), 'Profile in today\'s header once the session is read', async () => {
      await expect(siteHeader(page).getByRole('link', { name: TODAYS_NAMES.profile }), visit.notRead).toBeVisible()
    })
    await ifNew(testInfo, 'header', widthOf(page), 'My LCA in the new header once the session is read', async () => {
      await expect(siteHeader(page).getByRole('button', { name: NEW_NAMES.myLca }), visit.notRead).toBeVisible()
    })
    await waitForMemberAnswers(visit)
    await ifToday(testInfo, 'header', widthOf(page), 'Log out in today\'s header', async () => {
      await expect(siteHeader(page).getByRole('button', { name: TODAYS_NAMES.logOut })).toBeVisible()
    })
    await expect(siteHeader(page).getByRole('link', { name: CHROME_NAMES.logIn })).toHaveCount(0)
    await expect(siteHeader(page).getByRole('link', { name: CHROME_NAMES.joinLca })).toHaveCount(0)
    await ifToday(testInfo, 'header', widthOf(page), 'today\'s account links in the More menu', async () => {
      const links = await accountLinks(page)
      if (person.todaysRoleLinks.length > 0) await expect(links).toHaveText([...person.todaysRoleLinks])
      else await expect(links).toHaveCount(0)
    })
    await ifNew(testInfo, 'header', widthOf(page), 'the My LCA menu\'s rows for this person, Log out last', async () => {
      await expect(await openMyLca(page)).toHaveText([...person.myLcaMenuRows])
    })
    expect(await sessionInPage(page)).not.toBeNull()
    expect(visit.answered).toEqual(expect.arrayContaining(['POST /api/me', 'GET /api/me', 'GET /api/board/my-seats']))
    expect(visit.signInCalls).toEqual([])
    expect(visit.apiErrors).toEqual([])
    expect(external).toEqual([])
  })
}

test('a visitor who is signed out: Log in and Join LCA, and nothing planted', async ({ page, external, baseURL }, testInfo) => {
  const visit = await signInAs(page, navPersona('signed-out'), baseURL!)
  await page.goto('/')
  await expect(siteHeader(page).getByRole('link', { name: CHROME_NAMES.logIn })).toBeVisible()
  await expect(siteHeader(page).getByRole('link', { name: CHROME_NAMES.joinLca })).toBeVisible()
  await ifToday(testInfo, 'header', widthOf(page), 'no Profile, no Log out and no account link in today\'s header', async () => {
    await expect(siteHeader(page).getByRole('link', { name: TODAYS_NAMES.profile })).toHaveCount(0)
    await expect(siteHeader(page).getByRole('button', { name: TODAYS_NAMES.logOut })).toHaveCount(0)
    await expect(await accountLinks(page)).toHaveCount(0)
  })
  await ifNew(testInfo, 'header', widthOf(page), 'no My LCA in the new header', async () => {
    await expect(siteHeader(page).getByRole('button', { name: NEW_NAMES.myLca })).toHaveCount(0)
  })
  expect(visit.planted).toBe(false)
  expect(await sessionInPage(page)).toBeNull()
  expect(await page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith('sb-')))).toEqual([])
  expect(visit.answered.filter((call) => call !== 'GET /api/live/now')).toEqual([])
  expect(visit.signInCalls).toEqual([])
  expect(visit.apiErrors).toEqual([])
  expect(external).toEqual([])
})

test('the planted session survives a reload, is never planted over, and needs no word with the sign-in service', async ({ page, external, baseURL }, testInfo) => {
  const visit = await signInAs(page, navPersona('admin'), baseURL!)
  await page.goto('/')
  await ifToday(testInfo, 'header', widthOf(page), 'Profile in today\'s header once the session is read', async () => {
    await expect(siteHeader(page).getByRole('link', { name: TODAYS_NAMES.profile }), visit.notRead).toBeVisible()
  })
  await ifNew(testInfo, 'header', widthOf(page), 'My LCA in the new header once the session is read', async () => {
    await expect(siteHeader(page).getByRole('button', { name: NEW_NAMES.myLca }), visit.notRead).toBeVisible()
  })
  await waitForMemberAnswers(visit)
  const first = await sessionInPage(page)
  expect(first, `nothing under ${SESSION_KEY}`).not.toBeNull()
  // A session the page already holds is left alone, as one the library had renewed would be.
  await page.evaluate((key) => {
    const session = JSON.parse(localStorage.getItem(key)!) as Record<string, unknown>
    localStorage.setItem(key, JSON.stringify({ ...session, refresh_token: 'kept-across-the-reload' }))
  }, SESSION_KEY)
  await page.reload()
  await ifToday(testInfo, 'header', widthOf(page), 'Profile in today\'s header after the reload', async () => {
    await expect(siteHeader(page).getByRole('link', { name: TODAYS_NAMES.profile })).toBeVisible()
  })
  await ifNew(testInfo, 'header', widthOf(page), 'My LCA in the new header after the reload', async () => {
    await expect(siteHeader(page).getByRole('button', { name: NEW_NAMES.myLca })).toBeVisible()
  })
  // The reloaded page asks for the member again, and the wait waits for its own answers.
  await waitForMemberAnswers(visit)
  await ifToday(testInfo, 'header', widthOf(page), 'today\'s account links in the More menu', async () => {
    await expect(await accountLinks(page)).toHaveText(['Admin panel', 'Board inbox'])
  })
  await ifNew(testInfo, 'header', widthOf(page), 'the My LCA menu\'s rows for an LCA admin', async () => {
    await expect(await openMyLca(page)).toHaveText([...navPersona('admin').myLcaMenuRows])
  })
  const second = await sessionInPage(page)
  expect(second?.access_token).toBe(first!.access_token)
  expect(second?.refresh_token).toBe('kept-across-the-reload')
  expect(visit.signInCalls).toEqual([])
  expect(visit.apiErrors).toEqual([])
  expect(external).toEqual([])
})

test('a person who logs out stays signed out on the next page, and the library\'s call to end the session is refused', async ({ page, external, baseURL }, testInfo) => {
  const visit = await signInAs(page, navPersona('active-member'), baseURL!)
  await page.goto('/')
  await ifToday(testInfo, 'header', widthOf(page), 'Profile in today\'s header once the session is read', async () => {
    await expect(siteHeader(page).getByRole('link', { name: TODAYS_NAMES.profile }), visit.notRead).toBeVisible()
  })
  await ifNew(testInfo, 'header', widthOf(page), 'My LCA in the new header once the session is read', async () => {
    await expect(siteHeader(page).getByRole('button', { name: NEW_NAMES.myLca }), visit.notRead).toBeVisible()
  })
  await waitForMemberAnswers(visit)
  await ifToday(testInfo, 'header', widthOf(page), 'Log out from today\'s header', async () => {
    await siteHeader(page).getByRole('button', { name: TODAYS_NAMES.logOut }).click()
  })
  await ifNew(testInfo, 'header', widthOf(page), 'Log out from the new header\'s My LCA menu, its last row', async () => {
    await openMyLca(page)
    await siteHeader(page).getByRole('button', { name: NEW_NAMES.logOut }).click()
  })
  await expect(siteHeader(page).getByRole('link', { name: CHROME_NAMES.logIn })).toBeVisible()
  expect(await sessionInPage(page)).toBeNull()
  await page.goto('/membership')
  await expect(siteHeader(page).getByRole('link', { name: CHROME_NAMES.logIn })).toBeVisible()
  await ifToday(testInfo, 'header', widthOf(page), 'no Profile in today\'s header once signed out', async () => {
    await expect(siteHeader(page).getByRole('link', { name: TODAYS_NAMES.profile })).toHaveCount(0)
  })
  await ifNew(testInfo, 'header', widthOf(page), 'no My LCA in the new header once signed out', async () => {
    await expect(siteHeader(page).getByRole('button', { name: NEW_NAMES.myLca })).toHaveCount(0)
  })
  expect(await sessionInPage(page)).toBeNull()
  // Logging out asks the sign-in service to end the session; the helper
  // refuses that call in the browser, and the library signs the page out all
  // the same. Nothing else was asked of the service.
  expect(visit.signInCalls.length).toBeGreaterThan(0)
  for (const call of visit.signInCalls) expect(call).toMatch(/^POST http:\/\/127\.0\.0\.1:9\/auth\/v1\/logout\b/)
  expect(visit.apiErrors).toEqual([])
  expect(external).toEqual([])
})
