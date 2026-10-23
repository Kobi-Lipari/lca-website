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
// It runs on both builds: today's header is the same on a11y-on and
// a11y-off, since nothing reads the new chrome's switches yet. Once the new
// header is drawn on a11y-on, the browser specs read the header through one
// helper, and these reads move there.
//
// The first check of each signed-in test is that the session was read, with
// a message that names the key and the installed sign-in library's version,
// so a new version that keeps its session another way fails there first.
//
// Reads only: nothing here writes to either project's local database.
import type { Locator, Page } from '@playwright/test'
import { expect, test } from './support'
import { SESSION_KEY, sessionInPage, signInAs, waitForMemberAnswers } from './signedIn'
import { TODAYS_ACCOUNT_LINKS, navPersona, navPersonas } from '../unit/fixtures/navPersonas'

/** Today's header: the page's banner, outside the main content. */
const bar = (page: Page) => page.getByRole('banner')

/** The More menu's account links, opened the way a mouse opens it at this width. */
async function accountLinks(page: Page): Promise<Locator> {
  await bar(page).getByRole('button', { name: 'More' }).hover()
  const menu = page.getByRole('menu')
  await expect(menu).toBeVisible()
  const names = new RegExp(`^(?:${TODAYS_ACCOUNT_LINKS.join('|')})$`)
  return menu.getByRole('menuitem').filter({ hasText: names })
}

const people = navPersonas()

for (const person of people.filter((p) => p.user !== null)) {
  test(`${person.title}: Profile, Log out and today's account links`, async ({ page, external, baseURL }) => {
    const visit = await signInAs(page, person, baseURL!)
    await page.goto('/')
    await expect(bar(page).getByRole('link', { name: 'Profile' }), visit.notRead).toBeVisible()
    await waitForMemberAnswers(visit)
    await expect(bar(page).getByRole('button', { name: 'Log out' })).toBeVisible()
    await expect(bar(page).getByRole('link', { name: 'Log in' })).toHaveCount(0)
    await expect(bar(page).getByRole('link', { name: 'Join LCA' })).toHaveCount(0)
    const links = await accountLinks(page)
    if (person.todaysRoleLinks.length > 0) await expect(links).toHaveText([...person.todaysRoleLinks])
    else await expect(links).toHaveCount(0)
    expect(await sessionInPage(page)).not.toBeNull()
    expect(visit.answered).toEqual(expect.arrayContaining(['POST /api/me', 'GET /api/me', 'GET /api/board/my-seats']))
    expect(visit.signInCalls).toEqual([])
    expect(visit.apiErrors).toEqual([])
    expect(external).toEqual([])
  })
}

test('a visitor who is signed out: Log in and Join LCA, and nothing planted', async ({ page, external, baseURL }) => {
  const visit = await signInAs(page, navPersona('signed-out'), baseURL!)
  await page.goto('/')
  await expect(bar(page).getByRole('link', { name: 'Log in' })).toBeVisible()
  await expect(bar(page).getByRole('link', { name: 'Join LCA' })).toBeVisible()
  await expect(bar(page).getByRole('link', { name: 'Profile' })).toHaveCount(0)
  await expect(bar(page).getByRole('button', { name: 'Log out' })).toHaveCount(0)
  await expect(await accountLinks(page)).toHaveCount(0)
  expect(visit.planted).toBe(false)
  expect(await sessionInPage(page)).toBeNull()
  expect(await page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith('sb-')))).toEqual([])
  expect(visit.answered.filter((call) => call !== 'GET /api/live/now')).toEqual([])
  expect(visit.signInCalls).toEqual([])
  expect(visit.apiErrors).toEqual([])
  expect(external).toEqual([])
})

test('the planted session survives a reload, is never planted over, and needs no word with the sign-in service', async ({ page, external, baseURL }) => {
  const visit = await signInAs(page, navPersona('admin'), baseURL!)
  await page.goto('/')
  await expect(bar(page).getByRole('link', { name: 'Profile' }), visit.notRead).toBeVisible()
  await waitForMemberAnswers(visit)
  const first = await sessionInPage(page)
  expect(first, `nothing under ${SESSION_KEY}`).not.toBeNull()
  // A session the page already holds is left alone, as one the library had renewed would be.
  await page.evaluate((key) => {
    const session = JSON.parse(localStorage.getItem(key)!) as Record<string, unknown>
    localStorage.setItem(key, JSON.stringify({ ...session, refresh_token: 'kept-across-the-reload' }))
  }, SESSION_KEY)
  await page.reload()
  await expect(bar(page).getByRole('link', { name: 'Profile' })).toBeVisible()
  // The reloaded page asks for the member again, and the wait waits for its own answers.
  await waitForMemberAnswers(visit)
  await expect(await accountLinks(page)).toHaveText(['Admin panel', 'Board inbox'])
  const second = await sessionInPage(page)
  expect(second?.access_token).toBe(first!.access_token)
  expect(second?.refresh_token).toBe('kept-across-the-reload')
  expect(visit.signInCalls).toEqual([])
  expect(visit.apiErrors).toEqual([])
  expect(external).toEqual([])
})

test('a person who logs out stays signed out on the next page, and the library\'s call to end the session is refused', async ({ page, external, baseURL }) => {
  const visit = await signInAs(page, navPersona('active-member'), baseURL!)
  await page.goto('/')
  await expect(bar(page).getByRole('link', { name: 'Profile' }), visit.notRead).toBeVisible()
  await waitForMemberAnswers(visit)
  await bar(page).getByRole('button', { name: 'Log out' }).click()
  await expect(bar(page).getByRole('link', { name: 'Log in' })).toBeVisible()
  expect(await sessionInPage(page)).toBeNull()
  await page.goto('/membership')
  await expect(bar(page).getByRole('link', { name: 'Log in' })).toBeVisible()
  await expect(bar(page).getByRole('link', { name: 'Profile' })).toHaveCount(0)
  expect(await sessionInPage(page)).toBeNull()
  // Logging out asks the sign-in service to end the session; the helper
  // refuses that call in the browser, and the library signs the page out all
  // the same. Nothing else was asked of the service.
  expect(visit.signInCalls.length).toBeGreaterThan(0)
  for (const call of visit.signInCalls) expect(call).toMatch(/^POST http:\/\/127\.0\.0\.1:9\/auth\/v1\/logout\b/)
  expect(visit.apiErrors).toEqual([])
  expect(external).toEqual([])
})
