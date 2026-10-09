// test/integration/membership-tiers.test.ts
// Membership checkout charges the prices held in domain/membership/tiers.ts
// and refuses anything that is not one of the four tiers, including names
// every object inherits ("toString", "constructor"). Nobody signed in gets a
// 401 and no session is created.
import { beforeEach, describe, expect, it } from 'vitest'
import { env } from 'cloudflare:test'
import { invoke, resetHarness, stripeBehavior, stripeSessions } from './harness'
import { seedMember } from './factories'
import { MEMBERSHIP_TIER_PRICES } from '../../domain/membership/tiers'

import { onRequestPost as membershipCheckout } from '../../functions/api/membership/checkout'

beforeEach(resetHarness)

const paymentCount = async () =>
  (await env.DB.prepare("SELECT COUNT(*) AS n FROM payments WHERE type = 'membership'").first<{ n: number }>())?.n ?? 0

// The test database keeps its rows between tests in a file, so each case
// compares against the count it started with.
let before = 0
beforeEach(async () => { before = await paymentCount() })

describe('membership checkout prices', () => {
  it.each([
    ['adult', 1500],
    ['scholastic', 500],
    ['family', 2500],
    ['senior', 1000],
  ])('charges %s the shared price (%i cents)', async (tier, cents) => {
    const member = await seedMember()
    const res = await invoke(membershipCheckout, { method: 'POST', as: member, body: { tier } })
    expect(res.status).toBe(200)
    const body = await res.json<{ tier: string; amount: number; paymentId: string }>()
    expect(body.tier).toBe(tier)
    expect(body.amount).toBe(cents / 100)
    expect(body.amount).toBe(MEMBERSHIP_TIER_PRICES[tier as keyof typeof MEMBERSHIP_TIER_PRICES])
    expect(stripeSessions).toHaveLength(1)
    expect(stripeSessions[0].amountCents).toBe(cents)
    expect(stripeSessions[0].productName).toMatch(/^LCA .* Membership \(1 year\)$/)
    const row = await env.DB.prepare('SELECT amount, reference_id, status FROM payments WHERE id = ?')
      .bind(body.paymentId).first<{ amount: number; reference_id: string; status: string }>()
    expect(row).toEqual({ amount: cents / 100, reference_id: tier, status: 'pending' })
  })
})

describe('membership checkout refuses what is not a tier', () => {
  it.each([
    ['toString'], ['constructor'], ['__proto__'], ['hasOwnProperty'], ['valueOf'],
    ['Adult'], [' adult'], [''], ['regular'], ['platinum'],
  ])('rejects %j with 400, no Stripe session and no payment row', async (tier) => {
    const member = await seedMember()
    const res = await invoke(membershipCheckout, { method: 'POST', as: member, body: { tier } })
    expect(res.status).toBe(400)
    expect(stripeSessions).toHaveLength(0)
    expect(await paymentCount()).toBe(before)
  })

  it.each([
    ['a missing tier', {}],
    ['a null tier', { tier: null }],
    ['a numeric tier', { tier: 15 }],
    ['an array tier', { tier: ['adult'] }],
    ['an object tier', { tier: { adult: 1 } }],
  ])('rejects %s with 400', async (_label, body) => {
    const res = await invoke(membershipCheckout, { method: 'POST', as: await seedMember(), body })
    expect(res.status).toBe(400)
    expect(stripeSessions).toHaveLength(0)
  })

  it('rejects a body that is not JSON with 400', async () => {
    const res = await invoke(membershipCheckout, { method: 'POST', as: await seedMember(), rawBody: 'tier=adult' })
    expect(res.status).toBe(400)
    expect(stripeSessions).toHaveLength(0)
  })
})

describe('membership checkout role safety', () => {
  it('turns away someone who is not signed in, whatever tier they ask for', async () => {
    const res = await invoke(membershipCheckout, { method: 'POST', body: { tier: 'adult' } })
    expect(res.status).toBe(401)
    expect(stripeSessions).toHaveLength(0)
    expect(await paymentCount()).toBe(before)
    expect(JSON.stringify(await res.json())).not.toMatch(/paymentUrl|amount/)
  })
})

describe('membership checkout when Stripe is down', () => {
  it('answers 502 and records no payment', async () => {
    stripeBehavior.succeed = false
    const res = await invoke(membershipCheckout, { method: 'POST', as: await seedMember(), body: { tier: 'family' } })
    expect(res.status).toBe(502)
    expect(await paymentCount()).toBe(before)
  })
})
