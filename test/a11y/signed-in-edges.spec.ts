// test/a11y/signed-in-edges.spec.ts
//
// The edges of test/a11y/signedIn.ts, beside test/a11y/signed-in.spec.ts:
//
// - the session is planted on the build's own address only: in the same
//   tab, a page of the other test build's server holds no session, and its
//   header is a signed-out visitor's, while the build's own pages stay
//   signed in
// - the race the helper waits out: until the member's answers arrive, the
//   header already shows Profile and no account link, and
//   waitForMemberAnswers does not return; once they arrive it does, and the
//   account links are there
// - one wait covers one page: a link the site follows itself loads no page,
//   so the first page's answers still count, while a new page waits for its
//   own, and the answers of the page before do not let the wait return
// - the planted session opens nothing on the server: the test servers
//   refuse its token on every call that needs a sign-in, the two the helper
//   answers in the browser and an LCA admin's own calls included, and a
//   refused call the page makes is listed, so the signed-in spec's empty
//   list of refused calls can be trusted
//
// It runs on both builds, like the signed-in spec. The header is read
// through test/a11y/chrome.ts, and each check of Profile, Log out or the
// More menu's account links, which today's header alone gives, says so
// through it; the first test asks it about the other build's header while
// that build's page is open. Since WS02 step 5 the a11y-on build draws the
// new header from 1024 pixels up, where these tests read, so there each
// check of today's header notes "today only", and a twin beside it, marked
// through ifNew, reads the new header: My LCA once the session is read, and
// the My LCA menu's rows, My LCA and Log out alone until the member's
// answers arrive and the person's own rows after. Reads only: every call
// here that would write is refused, so nothing is written to either
// project's local database.
import type { Locator, Page } from '@playwright/test'
import { CHROME_NAMES, NEW_NAMES, TODAYS_NAMES, ifNew, ifToday, siteHeader, widthOf } from './chrome'
import { expect, test } from './support'
import { A11Y_VARIANTS } from './global-setup'
import { PLANTED_MARK, sessionInPage, signInAs, waitForMemberAnswers } from './signedIn'
import { TODAYS_ACCOUNT_LINKS, navPersona } from '../unit/fixtures/navPersonas'

/** Today's More menu's account links, opened the way a mouse opens it at this width. */
async function accountLinks(page: Page): Promise<Locator> {
  await siteHeader(page).getByRole('button', { name: TODAYS_NAMES.more }).hover()
  const menu = page.getByRole('menu')
  await expect(menu).toBeVisible()
  return menu.getByRole('menuitem').filter({ hasText: new RegExp(`^(?:${TODAYS_ACCOUNT_LINKS.join('|')})$`) })
}

/** The new header's My LCA menu, opened by a click unless it is open, and its rows. */
async function openMyLca(page: Page): Promise<Locator> {
  const button = siteHeader(page).getByRole('button', { name: NEW_NAMES.myLca })
  if ((await button.getAttribute('aria-expanded')) !== 'true') await button.click()
  const menu = siteHeader(page).locator('[data-slot="my-lca-menu"]')
  await expect(menu).toBeVisible()
  return menu.getByRole('listitem')
}

test('plants the session on the build\'s own address only', async ({ page, external, baseURL }, testInfo) => {
  const other = A11Y_VARIANTS.find((v) => v.name !== testInfo.project.name)!
  const visit = await signInAs(page, navPersona('admin'), baseURL!)
  // The other build's page: what is read of its header is asked of the helper with that build's name.
  await page.goto(`http://127.0.0.1:${other.port}/`)
  await expect(siteHeader(page).getByRole('link', { name: CHROME_NAMES.logIn })).toBeVisible()
  await ifToday(testInfo, 'header', widthOf(page), 'no Profile in the other build\'s header', async () => {
    await expect(siteHeader(page).getByRole('link', { name: TODAYS_NAMES.profile })).toHaveCount(0)
  }, other.name)
  await ifNew(testInfo, 'header', widthOf(page), 'no My LCA in the other build\'s header', async () => {
    await expect(siteHeader(page).getByRole('button', { name: NEW_NAMES.myLca })).toHaveCount(0)
  }, other.name)
  expect(await page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith('sb-')))).toEqual([])
  expect(await page.evaluate((mark) => sessionStorage.getItem(mark), PLANTED_MARK)).toBeNull()
  expect(visit.answered.filter((call) => call !== 'GET /api/live/now')).toEqual([])

  // The build's own page again.
  await page.goto('/')
  await ifToday(testInfo, 'header', widthOf(page), 'Profile in today\'s header once the session is read', async () => {
    await expect(siteHeader(page).getByRole('link', { name: TODAYS_NAMES.profile }), visit.notRead).toBeVisible()
  })
  await ifNew(testInfo, 'header', widthOf(page), 'My LCA in the new header once the session is read', async () => {
    await expect(siteHeader(page).getByRole('button', { name: NEW_NAMES.myLca }), visit.notRead).toBeVisible()
  })
  await waitForMemberAnswers(visit)
  await ifToday(testInfo, 'header', widthOf(page), 'today\'s account links in the More menu', async () => {
    await expect(await accountLinks(page)).toHaveText(['Admin panel', 'Board inbox'])
  })
  await ifNew(testInfo, 'header', widthOf(page), 'the My LCA menu\'s rows for an LCA admin', async () => {
    await expect(await openMyLca(page)).toHaveText([...navPersona('admin').myLcaMenuRows])
  })
  expect(await sessionInPage(page)).not.toBeNull()
  expect(visit.signInCalls).toEqual([])
  expect(visit.apiErrors).toEqual([])
  expect(external).toEqual([])
})

test('waits for the member\'s answers, not for Profile, which shows before them', async ({ page, external, baseURL }, testInfo) => {
  const own = new URL(baseURL!).origin
  const visit = await signInAs(page, navPersona('admin'), baseURL!)
  let release!: () => void
  const held = new Promise<void>((resolve) => (release = resolve))
  // Added after the helper's own routes, so it is tried first: it holds the
  // member's calls until the test lets them go on to the helper.
  await page.route(
    (url) => url.origin === own && (url.pathname === '/api/me' || url.pathname === '/api/board/my-seats'),
    async (route) => {
      await held
      await route.fallback()
    },
  )
  await page.goto('/')
  await ifToday(testInfo, 'header', widthOf(page), 'Profile and Log out in today\'s header before the member\'s answers', async () => {
    await expect(siteHeader(page).getByRole('link', { name: TODAYS_NAMES.profile }), visit.notRead).toBeVisible()
    await expect(siteHeader(page).getByRole('button', { name: TODAYS_NAMES.logOut })).toBeVisible()
  })
  await ifNew(testInfo, 'header', widthOf(page), 'My LCA in the new header before the member\'s answers', async () => {
    await expect(siteHeader(page).getByRole('button', { name: NEW_NAMES.myLca }), visit.notRead).toBeVisible()
  })
  // Signed in, but the member and the seats have not arrived: no account link yet.
  await ifToday(testInfo, 'header', widthOf(page), 'no account link yet in today\'s More menu', async () => {
    await expect(await accountLinks(page)).toHaveCount(0)
  })
  await ifNew(testInfo, 'header', widthOf(page), 'no role row yet in the My LCA menu, only My LCA and Log out', async () => {
    await expect(await openMyLca(page)).toHaveText([NEW_NAMES.myLca, NEW_NAMES.logOut])
  })
  expect(visit.answered.filter((call) => call !== 'GET /api/live/now')).toEqual([])
  await expect(waitForMemberAnswers(visit, 1_500)).rejects.toThrow(/were not both answered within 1\.5 s/)

  release()
  await waitForMemberAnswers(visit)
  await ifToday(testInfo, 'header', widthOf(page), 'today\'s account links in the More menu', async () => {
    await expect(await accountLinks(page)).toHaveText(['Admin panel', 'Board inbox'])
  })
  await ifNew(testInfo, 'header', widthOf(page), 'the My LCA menu\'s rows for an LCA admin, once the answers arrive', async () => {
    await expect(await openMyLca(page)).toHaveText([...navPersona('admin').myLcaMenuRows])
  })
  expect(visit.signInCalls).toEqual([])
  expect(visit.apiErrors).toEqual([])
  expect(external).toEqual([])
})

test('waits for each page\'s own answers: a new page waits again, a link the site follows itself does not', async ({ page, external, baseURL }, testInfo) => {
  const own = new URL(baseURL!).origin
  const visit = await signInAs(page, navPersona('admin'), baseURL!)
  await page.goto('/')
  await ifToday(testInfo, 'header', widthOf(page), 'Profile in today\'s header once the session is read', async () => {
    await expect(siteHeader(page).getByRole('link', { name: TODAYS_NAMES.profile }), visit.notRead).toBeVisible()
  })
  await ifNew(testInfo, 'header', widthOf(page), 'My LCA in the new header once the session is read', async () => {
    await expect(siteHeader(page).getByRole('button', { name: NEW_NAMES.myLca }), visit.notRead).toBeVisible()
  })
  await waitForMemberAnswers(visit)
  await ifToday(testInfo, 'header', widthOf(page), 'today\'s account links in the More menu', async () => {
    await expect(await accountLinks(page)).toHaveText(['Admin panel', 'Board inbox'])
  })
  await ifNew(testInfo, 'header', widthOf(page), 'the My LCA menu\'s rows for an LCA admin', async () => {
    await expect(await openMyLca(page)).toHaveText([...navPersona('admin').myLcaMenuRows])
  })

  // The header's Clubs link changes the address without loading a page: the
  // site keeps the member it has, and so does the wait.
  const firstPage = [...visit.answeredOnThisPage]
  await siteHeader(page).getByRole('link', { name: CHROME_NAMES.clubs, exact: true }).click()
  await expect(page).toHaveURL(/\/clubs$/)
  expect(visit.answeredOnThisPage.slice(0, firstPage.length)).toEqual(firstPage)
  await waitForMemberAnswers(visit, 1_500)

  // A new page, with its member's calls held: the first page's answers no
  // longer count, so the wait does not return until this page has its own.
  let release!: () => void
  const held = new Promise<void>((resolve) => (release = resolve))
  await page.route(
    (url) => url.origin === own && (url.pathname === '/api/me' || url.pathname === '/api/board/my-seats'),
    async (route) => {
      await held
      await route.fallback()
    },
  )
  await page.goto('/')
  await ifToday(testInfo, 'header', widthOf(page), 'Profile in today\'s header, and no account link yet', async () => {
    await expect(siteHeader(page).getByRole('link', { name: TODAYS_NAMES.profile })).toBeVisible()
    await expect(await accountLinks(page)).toHaveCount(0)
  })
  await ifNew(testInfo, 'header', widthOf(page), 'My LCA in the new header, and no role row yet in its menu', async () => {
    await expect(siteHeader(page).getByRole('button', { name: NEW_NAMES.myLca })).toBeVisible()
    await expect(await openMyLca(page)).toHaveText([NEW_NAMES.myLca, NEW_NAMES.logOut])
  })
  expect(visit.answeredOnThisPage.filter((call) => call !== 'GET /api/live/now')).toEqual([])
  expect(visit.answered).toEqual(expect.arrayContaining(['GET /api/me', 'GET /api/board/my-seats']))
  await expect(waitForMemberAnswers(visit, 1_500)).rejects.toThrow(/were not both answered within 1\.5 s/)

  release()
  await waitForMemberAnswers(visit)
  await ifToday(testInfo, 'header', widthOf(page), 'today\'s account links in the More menu', async () => {
    await expect(await accountLinks(page)).toHaveText(['Admin panel', 'Board inbox'])
  })
  await ifNew(testInfo, 'header', widthOf(page), 'the My LCA menu\'s rows for an LCA admin, once this page\'s answers arrive', async () => {
    await expect(await openMyLca(page)).toHaveText([...navPersona('admin').myLcaMenuRows])
  })
  expect(visit.signInCalls).toEqual([])
  expect(visit.apiErrors).toEqual([])
  expect(external).toEqual([])
})

test('opens nothing on the server, and a refused call is listed', async ({ page, external, baseURL }, testInfo) => {
  const visit = await signInAs(page, navPersona('everything'), baseURL!)
  await page.goto('/')
  await ifToday(testInfo, 'header', widthOf(page), 'Profile in today\'s header once the session is read', async () => {
    await expect(siteHeader(page).getByRole('link', { name: TODAYS_NAMES.profile }), visit.notRead).toBeVisible()
  })
  await ifNew(testInfo, 'header', widthOf(page), 'My LCA in the new header once the session is read', async () => {
    await expect(siteHeader(page).getByRole('button', { name: NEW_NAMES.myLca }), visit.notRead).toBeVisible()
  })
  await waitForMemberAnswers(visit)
  const token = (await sessionInPage(page))!.access_token
  const headers = { Authorization: `Bearer ${token}` }

  // Straight to the server, past the helper's answers in the page: the token
  // carries aal2 and the person is an LCA admin in the list, and every call
  // is refused all the same, since the server cannot check it.
  const READS = ['/api/me', '/api/board/my-seats', '/api/me/children', '/api/admin/members', '/api/admin/audit', '/api/board/tickets']
  for (const path of READS) {
    const res = await page.request.get(path, { headers })
    expect(res.status(), path).toBe(401)
    expect(await res.text(), path).not.toMatch(/example\.org|Fixture|fx-/)
  }
  const impersonate = await page.request.post('/api/admin/impersonate/fx-m-p1', { headers, data: {} })
  expect(impersonate.status()).toBe(401)
  expect(await impersonate.text()).not.toMatch(/access_token|refresh_token|Fixture|fx-/)

  // The page asking with the same token is refused too, and the refusal is listed.
  expect(visit.apiErrors).toEqual([])
  const status = await page.evaluate(async (bearer) => (await fetch('/api/admin/members', { headers: { Authorization: `Bearer ${bearer}` } })).status, token)
  expect(status).toBe(401)
  await expect.poll(() => visit.apiErrors).toEqual(['401 GET /api/admin/members'])
  expect(visit.signInCalls).toEqual([])
  expect(external).toEqual([])
})
