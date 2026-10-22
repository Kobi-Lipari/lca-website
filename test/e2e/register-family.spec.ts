// test/e2e/register-family.spec.ts
//
// A guardian registers herself and two children for an event in one
// payment, on a branch preview (npm run test:e2e, or the e2e-preview
// workflow). Pending (test.fixme) until every precondition below holds; the
// steps are written now so the test that proves the household checkout
// exists before the checkout does.
//
// Preconditions, all of which the e2e-preview workflow asks the person
// starting it to confirm:
//   1. [env.preview] in wrangler.toml holds the preview database id (it does
//      since step 1) and E2E_BASE_URL is that branch's preview address.
//   2. The preview database is migrated (npm run db:migrate:preview) and
//      seeded (npm run db:seed:preview) from the branch under test.
//   3. The preview's Pages environment has Stripe test keys, never live ones,
//      so the payment below is a test payment.
//   4. WS06's household checkout has shipped and householdCheckout is on in
//      that branch's src/lib/features.ts.
//   5. A test login for the guardian exists, with an active Family
//      membership, and its address and password are in E2E_GUARDIAN_EMAIL
//      and E2E_GUARDIAN_PASSWORD. It is a test account, not anyone's own:
//      previews share the sign-in service with the live site.
//
// The event is the seed's open LCA event, "Fixture Fall Open" (fx-t-open),
// whose sections are Open, Under 1600 and Scholastic.
import { expect, test } from '@playwright/test'
import { FAMILY_MEMBERSHIP_CHILDREN } from '../../domain/households/family'

const EVENT_ID = 'fx-t-open'
const STRIPE_TEST_CARD = '4242 4242 4242 4242'

test.describe('register a family', () => {
  test.fixme('a guardian enters herself and two children with one payment', async ({ page }) => {
    const email = process.env.E2E_GUARDIAN_EMAIL ?? ''
    const password = process.env.E2E_GUARDIAN_PASSWORD ?? ''

    await test.step('sign in as the test guardian', async () => {
      await page.goto('/login')
      await page.getByLabel('Email').fill(email)
      await page.getByLabel('Password').fill(password)
      await page.getByRole('button', { name: 'Log in' }).click()
      await expect(page).not.toHaveURL(/\/login/)
    })

    await test.step(`the Family plan covers at most ${FAMILY_MEMBERSHIP_CHILDREN} children`, async () => {
      // The household fills the plan to FAMILY_MEMBERSHIP_CHILDREN (3, from
      // domain/households/family.ts) and the plan takes no more. WS06 still
      // lets a guardian save a further child, but never under the plan: the
      // form says that child needs a Scholastic membership instead. This
      // step stops there, so the household stays at the plan's limit.
      await page.goto('/dashboard/family')
      const covered = page.getByText(/covers \d children/)
      for (let i = await page.getByTestId('family-child').count(); i < FAMILY_MEMBERSHIP_CHILDREN; i++) {
        await page.getByRole('link', { name: 'Add a family member' }).click()
        await page.getByLabel('First name').fill(`Child${i + 1}`)
        await page.getByLabel('Last name').fill('Fixture')
        await page.getByRole('button', { name: 'Save' }).click()
      }
      await expect(covered).toContainText(`covers ${FAMILY_MEMBERSHIP_CHILDREN} children`)
      await expect(page.getByText(/0 spots left|plan is full/i)).toBeVisible()
      await page.getByRole('link', { name: 'Add a family member' }).click()
      await expect(page.getByText(/Scholastic membership/)).toBeVisible()
      await page.getByRole('button', { name: 'Cancel' }).click()
      await expect(page.getByTestId('family-child')).toHaveCount(FAMILY_MEMBERSHIP_CHILDREN)
    })

    await test.step('open the event and choose Register my family', async () => {
      await page.goto(`/tournaments/${EVENT_ID}`)
      await page.getByRole('button', { name: 'Register my family' }).click()
      await expect(page.getByRole('heading', { name: "Who's playing?" })).toBeVisible()
    })

    await test.step('tick the guardian and two children, a section each, and confirm the names', async () => {
      const players = page.getByRole('group', { name: /player/i })
      await players.nth(0).getByRole('checkbox').check()
      await players.nth(0).getByLabel('Section').selectOption('Open')
      for (const n of [1, 2]) {
        await players.nth(n).getByRole('checkbox').check()
        // The seed's Scholastic section has gradeMax 12.
        await players.nth(n).getByLabel('In 12th grade or below?').check()
        await players.nth(n).getByLabel('Section').selectOption('Scholastic')
      }
      await page.getByLabel('These names are spelled the way they should appear on pairings and results').check()
      await page.getByRole('button', { name: 'Continue' }).click()
    })

    await test.step('byes, US Chess and membership steps need nothing for this household', async () => {
      await page.getByRole('button', { name: 'Continue' }).click()
      await page.getByRole('button', { name: 'Continue' }).click()
    })

    await test.step('check your answers shows three lines and one total', async () => {
      await expect(page.getByRole('heading', { name: 'Check your answers' })).toBeVisible()
      await expect(page.getByTestId('order-line')).toHaveCount(3)
      await expect(page.getByText(/You pay today/)).toBeVisible()
      await page.getByRole('button', { name: /Pay/ }).click()
    })

    await test.step('pay with a Stripe test card', async () => {
      await expect(page).toHaveURL(/checkout\.stripe\.com/)
      await page.getByLabel('Card number').fill(STRIPE_TEST_CARD)
      await page.getByLabel('Expiration').fill('12 / 34')
      await page.getByLabel('CVC').fill('123')
      await page.getByRole('button', { name: /Pay/ }).click()
    })

    await test.step('one confirmation card per player, each with its own Withdraw link', async () => {
      await expect(page).toHaveURL(new RegExp(`/tournaments/${EVENT_ID}`))
      await expect(page.getByTestId('confirmation-card')).toHaveCount(3)
      await expect(page.getByRole('link', { name: 'Withdraw' })).toHaveCount(3)
    })
  })
})
