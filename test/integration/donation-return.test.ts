// test/integration/donation-return.test.ts
//
// Where a donor comes back to. The donation dialog
// (src/components/DonateButton.tsx) now hands the donor to Stripe's
// checkout in the same tab, so the page they come back to is the site's own
// page in that tab, as POST /api/donations/checkout asks Stripe for it:
//
// - once they have paid, /donate/success on the site's own address, with
//   the payment's id, the id the answer gives and the pending payment row
//   carries; if they cancel, the home page on the site's own address;
// - the same for a signed-in donor, whose payment is theirs;
// - the answer holds the payment's id and the checkout's address alone,
//   never the member or anything else of theirs;
// - each request that reaches the server is a checkout of its own, so a
//   second press is kept to one request by the dialog, which refuses it
//   while the first is asked for (test/unit/donate-dialog-edges.test.tsx);
// - role safety: the endpoint is open to anyone, and a token the sign-in
//   service refuses is a donation from nobody, never credited to the member
//   the body names, never sending a member's address to Stripe, and
//   answering no member's data (the harness's stand-in for the sign-in
//   service takes any other bare token as naming a member, so a refused
//   token is the one it can show);
// - an amount the endpoint refuses (400) asks Stripe for nothing and writes
//   no payment.
import { beforeEach, describe, expect, it } from 'vitest'
import { env } from 'cloudflare:test'
import { invoke, resetHarness, stripeSessions } from './harness'
import { seedMember } from './factories'

import { onRequestPost as donationPost } from '../../functions/api/donations/checkout'

beforeEach(resetHarness)

/** The address the harness's requests are made at, and so the site's own. */
const SITE = 'https://lca-website.pages.dev'

interface PaymentRow {
  id: string
  member_id: string | null
  amount: number
  type: string
  status: string
  stripe_session_id: string | null
}

const paymentRow = (id: string) => env.DB.prepare('SELECT id, member_id, amount, type, status, stripe_session_id FROM payments WHERE id = ?').bind(id).first<PaymentRow>()
/** The payments in the database: the file's database is not emptied between its cases, so a case counts what it adds. */
const paymentCount = async () => (await env.DB.prepare('SELECT COUNT(*) AS n FROM payments').first<{ n: number }>())?.n ?? 0

describe('where a donor handed to Stripe in the same tab comes back to', () => {
  it('is the site\'s /donate/success with the payment\'s id once paid, and the site\'s home page on a cancel', async () => {
    const res = await invoke(donationPost, { method: 'POST', body: { amount: 25 } })
    expect(res.status).toBe(200)
    const body = await res.json<{ paymentId: string; paymentUrl: string }>()
    expect(stripeSessions).toHaveLength(1)
    const [session] = stripeSessions
    expect(session.successUrl).toBe(`${SITE}/donate/success?paymentId=${body.paymentId}`)
    expect(session.cancelUrl).toBe(`${SITE}/`)
    // The address the dialog hands the tab to is the checkout's own.
    expect(body.paymentUrl).toBe(session.url)
    // The pending payment the success page reads is that id, for that session.
    expect(await paymentRow(body.paymentId)).toEqual({ id: body.paymentId, member_id: null, amount: 25, type: 'donation', status: 'pending', stripe_session_id: session.id })
  })

  it('is the same for a signed-in donor, whose payment is theirs', async () => {
    const donor = await seedMember({ email: 'fixture.donor@example.org' })
    const res = await invoke(donationPost, { method: 'POST', as: donor, body: { amount: 40 } })
    expect(res.status).toBe(200)
    const { paymentId } = await res.json<{ paymentId: string }>()
    const [session] = stripeSessions
    expect(session.successUrl).toBe(`${SITE}/donate/success?paymentId=${paymentId}`)
    expect(session.cancelUrl).toBe(`${SITE}/`)
    expect(session.customerEmail).toBe('fixture.donor@example.org')
    expect((await paymentRow(paymentId))?.member_id).toBe(donor)
  })

  it('answers with the payment\'s id and the checkout\'s address alone, signed in or not', async () => {
    const donor = await seedMember()
    for (const as of [undefined, donor]) {
      const res = await invoke(donationPost, { method: 'POST', body: { amount: 10 }, ...(as ? { as } : {}) })
      expect(res.status).toBe(200)
      expect(Object.keys(await res.json()).sort()).toEqual(['paymentId', 'paymentUrl'])
    }
  })
})

describe('each request is a checkout of its own', () => {
  it('two requests make two sessions and two pending payments, each with its own way back', async () => {
    const before = await paymentCount()
    const first = await (await invoke(donationPost, { method: 'POST', body: { amount: 25 } })).json<{ paymentId: string }>()
    const second = await (await invoke(donationPost, { method: 'POST', body: { amount: 25 } })).json<{ paymentId: string }>()
    expect(first.paymentId).not.toBe(second.paymentId)
    expect(stripeSessions).toHaveLength(2)
    expect(stripeSessions.map((s) => s.successUrl)).toEqual([
      `${SITE}/donate/success?paymentId=${first.paymentId}`,
      `${SITE}/donate/success?paymentId=${second.paymentId}`,
    ])
    expect(await paymentCount()).toBe(before + 2)
  })
})

describe('role safety: open to anyone, credited to no one it cannot name', () => {
  it('with a token the sign-in service refuses, takes the donation as from nobody: no member on the payment, though the body names one, no address sent to Stripe, no member\'s data in the answer', async () => {
    const someone = await seedMember({ email: 'fixture.someone@example.org' })
    const res = await invoke(donationPost, { method: 'POST', body: { amount: 15, memberId: someone }, headers: { Authorization: 'Bearer invalid-token' } })
    expect(res.status).toBe(200)
    const body = await res.json<Record<string, unknown>>()
    expect(Object.keys(body).sort()).toEqual(['paymentId', 'paymentUrl'])
    expect(JSON.stringify(body)).not.toContain(someone)
    expect(stripeSessions[0].customerEmail).toBeNull()
    expect(stripeSessions[0].metadata.member_id).toBe('')
    expect((await paymentRow(body.paymentId as string))?.member_id).toBeNull()
  })
})

describe('an amount the endpoint refuses', () => {
  it.each([
    ['nothing', {}],
    ['less than $1', { amount: 0.99 }],
    ['a negative amount', { amount: -5 }],
    ['an amount written as words', { amount: '25' }],
    ['more than $10,000', { amount: 10_000.01 }],
  ])('%s: answers 400, asks Stripe for nothing and writes no payment', async (_, body) => {
    const before = await paymentCount()
    const res = await invoke(donationPost, { method: 'POST', body })
    expect(res.status).toBe(400)
    expect(stripeSessions).toHaveLength(0)
    expect(await paymentCount()).toBe(before)
  })

  it('takes exactly $1 and exactly $10,000', async () => {
    for (const amount of [1, 10_000]) {
      const res = await invoke(donationPost, { method: 'POST', body: { amount } })
      expect(res.status, `$${amount}`).toBe(200)
    }
    expect(stripeSessions.map((s) => s.amountCents)).toEqual([100, 1_000_000])
  })
})
