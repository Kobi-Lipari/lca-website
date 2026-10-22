// test/e2e/publish-round.spec.ts
//
// A tournament director pairs a round, publishes it, and a player sees the
// pairing, on a branch preview (npm run test:e2e, or the e2e-preview
// workflow). Pending (test.fixme) until every precondition below holds; the
// steps are written now so the test that proves round publishing exists
// before the TD console does.
//
// Preconditions, all of which the e2e-preview workflow asks the person
// starting it to confirm:
//   1. [env.preview] in wrangler.toml holds the preview database id (it does
//      since step 1) and E2E_BASE_URL is that branch's preview address.
//   2. The preview database is migrated (npm run db:migrate:preview) and
//      seeded (npm run db:seed:preview) from the branch under test.
//   3. The preview's Pages environment has Stripe test keys, never live ones
//      (this test takes no payment, but the preview must never hold live
//      keys while tests run against it).
//   4. WS07's live mode and WS08's TD console, with Publish round, have
//      shipped and their switches are on in that branch's
//      src/lib/features.ts.
//   5. A test login for the director exists and is a director of the seed's
//      "Fixture Fall Open" (fx-t-open), and its address and password are in
//      E2E_DIRECTOR_EMAIL and E2E_DIRECTOR_PASSWORD. It is a test account,
//      not anyone's own: previews share the sign-in service with the live
//      site.
//
// Players come from the seed: the event's entries are checked in first.
import { expect, test } from '@playwright/test'

const EVENT_ID = 'fx-t-open'

test.describe('publish a round', () => {
  test.fixme('a director pairs and publishes round 1, and the pairings show publicly', async ({ page, browser }) => {
    const email = process.env.E2E_DIRECTOR_EMAIL ?? ''
    const password = process.env.E2E_DIRECTOR_PASSWORD ?? ''

    await test.step('sign in as the test director', async () => {
      await page.goto('/login')
      await page.getByLabel('Email').fill(email)
      await page.getByLabel('Password').fill(password)
      await page.getByRole('button', { name: 'Log in' }).click()
      await expect(page).not.toHaveURL(/\/login/)
    })

    await test.step('open the TD console and check in every entry', async () => {
      await page.goto(`/admin/tournaments/${EVENT_ID}`)
      await page.getByRole('tab', { name: 'Check-in' }).click()
      await page.getByRole('button', { name: /Check in all/ }).click()
      await expect(page.getByText(/checked in/)).toBeVisible()
    })

    await test.step('pair round 1 and look at the preview before anything is published', async () => {
      await page.getByRole('button', { name: 'Pair next round' }).click()
      await expect(page.getByRole('heading', { name: /Round 1 preview/ })).toBeVisible()
      await expect(page.getByRole('row', { name: /Board 1/ })).toBeVisible()
    })

    await test.step('the public pairings page shows nothing for round 1 yet', async () => {
      const visitor = await browser.newPage()
      await visitor.goto(`/tournaments/${EVENT_ID}/pairings`)
      await expect(visitor.getByText(/Round 1/)).toHaveCount(0)
      await visitor.close()
    })

    await test.step('publish round 1, with player notices off', async () => {
      await page.getByLabel('Notify players').uncheck()
      await page.getByRole('button', { name: 'Publish round' }).click()
      await expect(page.getByText(/Round 1 published/)).toBeVisible()
    })

    await test.step('a signed-out visitor sees round 1 with full names, boards and colours', async () => {
      const visitor = await browser.newPage()
      await visitor.goto(`/tournaments/${EVENT_ID}/pairings`)
      await expect(visitor.getByRole('heading', { name: /Round 1/ })).toBeVisible()
      await expect(visitor.getByRole('table')).toContainText('Avery Fixture')
      await expect(visitor.getByText(/updated/i)).toBeVisible()
      await visitor.close()
    })
  })
})
