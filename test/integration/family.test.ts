// test/integration/family.test.ts
// Family accounts: a parent manages children's profiles, a family membership
// covers them, and one checkout registers several players.
import { beforeEach, describe, expect, it } from 'vitest'
import { env } from 'cloudflare:test'
import { invoke, resetHarness, signStripePayload, stripeSessions } from './harness'
import { seedAdmin, seedMember, seedTournament } from './factories'

import {
  onRequestGet as childrenGet,
  onRequestPost as childrenPost,
} from '../../functions/api/me/children'
import {
  onRequestDelete as childDelete,
  onRequestPatch as childPatch,
} from '../../functions/api/me/children/[id]'
import { onRequestPost as batchPost } from '../../functions/api/registrations/batch'
import { onRequestPatch as registrationPatch } from '../../functions/api/registrations/[id]'
import { onRequestPost as webhookPost } from '../../functions/api/stripe/webhook'
import { onRequestPost as membershipCheckout } from '../../functions/api/membership/checkout'
import { onRequestPost as impersonatePost } from '../../functions/api/admin/impersonate/[memberId]'
import { resolveRecipients } from '../../functions/utils/campaigns'

beforeEach(resetHarness)

type Child = { id: string; full_name: string; membership_status: string; membership_expiry: string | null }

async function addChild(parent: string, fullName: string, uscfId?: string): Promise<Child> {
  const res = await invoke(childrenPost, { method: 'POST', as: parent, body: { fullName, uscfId } })
  expect(res.status).toBe(201)
  const { children } = await res.json<{ children: Child[] }>()
  return children.find((c) => c.full_name === fullName)!
}

async function completeCheckout(sessionId: string, metadata: Record<string, string>) {
  const rawBody = JSON.stringify({
    type: 'checkout.session.completed',
    data: { object: { id: sessionId, payment_intent: 'pi_family', metadata } },
  })
  const res = await invoke(webhookPost, {
    method: 'POST', rawBody,
    headers: { 'stripe-signature': await signStripePayload(rawBody) },
  })
  expect(res.status).toBe(200)
}

describe('children on an account', () => {
  it('a parent can add, rename and remove a child; the child uses the parent email', async () => {
    const parent = await seedMember({ email: 'parent@test.lca' })
    const kid = await addChild(parent, 'Kid One')

    const row = await env.DB.prepare('SELECT email, guardian_id FROM members WHERE id = ?')
      .bind(kid.id).first<{ email: string; guardian_id: string }>()
    expect(row).toEqual({ email: 'parent@test.lca', guardian_id: parent })

    const renamed = await invoke(childPatch, { method: 'PATCH', as: parent, params: { id: kid.id }, body: { fullName: 'Kid Renamed' } })
    expect(renamed.status).toBe(200)

    const removed = await invoke(childDelete, { method: 'DELETE', as: parent, params: { id: kid.id } })
    expect(removed.status).toBe(200)
    const list = await invoke(childrenGet, { as: parent })
    expect((await list.json<{ children: Child[] }>()).children).toHaveLength(0)
  })

  it('nobody else can see, edit or remove your child', async () => {
    const parent = await seedMember()
    const stranger = await seedMember()
    const kid = await addChild(parent, 'Mine')

    expect((await (await invoke(childrenGet, { as: stranger })).json<{ children: Child[] }>()).children).toHaveLength(0)
    expect((await invoke(childPatch, { method: 'PATCH', as: stranger, params: { id: kid.id }, body: { fullName: 'Hijack' } })).status).toBe(404)
    expect((await invoke(childDelete, { method: 'DELETE', as: stranger, params: { id: kid.id } })).status).toBe(404)
  })

  it('a child with tournament history cannot be deleted', async () => {
    const parent = await seedMember()
    const kid = await addChild(parent, 'Played Before')
    const tournamentId = await seedTournament({ sections: [{ name: 'K-8', entryFee: 0 }] })
    await invoke(batchPost, { method: 'POST', as: parent, body: { tournamentId, entries: [{ memberId: kid.id, section: 'K-8' }] } })

    const res = await invoke(childDelete, { method: 'DELETE', as: parent, params: { id: kid.id } })
    expect(res.status).toBe(409)
  })

  it('refuses a USCF ID that already belongs to another account', async () => {
    const parent = await seedMember()
    await seedMember({ uscfId: '12345678' })
    const res = await invoke(childrenPost, { method: 'POST', as: parent, body: { fullName: 'Dup', uscfId: '12345678' } })
    expect(res.status).toBe(409)
  })
})

describe('family membership', () => {
  it('buying a family membership covers up to three children, including ones added later', async () => {
    const parent = await seedMember({ membershipStatus: 'pending' })
    const kids = [await addChild(parent, 'A'), await addChild(parent, 'B')]

    const checkout = await invoke(membershipCheckout, { method: 'POST', as: parent, body: { tier: 'family' } })
    const { paymentId } = await checkout.json<{ paymentId: string }>()
    await completeCheckout('cs_membership', { type: 'membership', payment_id: paymentId, member_id: parent })

    const parentRow = await env.DB.prepare('SELECT membership_status, membership_expiry, membership_type FROM members WHERE id = ?')
      .bind(parent).first<{ membership_status: string; membership_expiry: string; membership_type: string }>()
    expect(parentRow?.membership_type).toBe('family')

    for (const k of kids) {
      const row = await env.DB.prepare('SELECT membership_status, membership_expiry FROM members WHERE id = ?')
        .bind(k.id).first<{ membership_status: string; membership_expiry: string }>()
      expect(row?.membership_status).toBe('active')
      expect(row?.membership_expiry).toBe(parentRow?.membership_expiry)
    }

    // Third child joins later and is covered; a fourth is not.
    const third = await addChild(parent, 'C')
    const fourth = await addChild(parent, 'D')
    const status = async (id: string) => (await env.DB.prepare('SELECT membership_status FROM members WHERE id = ?')
      .bind(id).first<{ membership_status: string }>())?.membership_status
    expect(await status(third.id)).toBe('active')
    expect(await status(fourth.id)).toBe('pending')
  })

  it('an adult membership does not cover children', async () => {
    const parent = await seedMember({ membershipStatus: 'pending' })
    const kid = await addChild(parent, 'Not Covered')
    const checkout = await invoke(membershipCheckout, { method: 'POST', as: parent, body: { tier: 'adult' } })
    const { paymentId } = await checkout.json<{ paymentId: string }>()
    await completeCheckout('cs_adult', { type: 'membership', payment_id: paymentId, member_id: parent })

    const row = await env.DB.prepare('SELECT membership_status FROM members WHERE id = ?')
      .bind(kid.id).first<{ membership_status: string }>()
    expect(row?.membership_status).toBe('pending')
  })
})

describe('registering a family in one checkout', () => {
  it('creates one Stripe checkout with a line per player, and the webhook confirms them all', async () => {
    const parent = await seedMember({ uscfId: '11110000' })
    const a = await addChild(parent, 'Alpha', '22220000')
    const b = await addChild(parent, 'Bravo', '33330000')
    const tournamentId = await seedTournament({
      isRated: true,
      sections: [{ name: 'Open', entryFee: 30 }, { name: 'K-8', entryFee: 15 }],
    })

    const res = await invoke(batchPost, {
      method: 'POST', as: parent,
      body: {
        tournamentId,
        entries: [
          { section: 'Open' },
          { memberId: a.id, section: 'K-8', byeRounds: [1] },
          { memberId: b.id, section: 'K-8' },
        ],
      },
    })
    expect(res.status).toBe(201)
    const data = await res.json<{ total: number; paymentUrl: string }>()
    expect(data.total).toBe(60)
    expect(data.paymentUrl).toBeTruthy()

    const session = stripeSessions.at(-1)!
    expect(session.lineItems.map((l) => l.amountCents)).toEqual([3000, 1500, 1500])
    expect(session.metadata.type).toBe('tournament_batch')

    const pending = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM registrations WHERE tournament_id = ? AND payment_status = 'pending'`,
    ).bind(tournamentId).first<{ n: number }>()
    expect(pending?.n).toBe(3)

    await completeCheckout(session.id, session.metadata)
    // Delivered twice, as Stripe may: still exactly three paid entries.
    await completeCheckout(session.id, session.metadata)

    const paid = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM registrations WHERE tournament_id = ? AND payment_status = 'paid'`,
    ).bind(tournamentId).first<{ n: number }>()
    expect(paid?.n).toBe(3)
    const completed = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM payments WHERE stripe_session_id = ? AND status = 'completed'`,
    ).bind(session.id).first<{ n: number }>()
    expect(completed?.n).toBe(3)
  })

  it('free sections are confirmed straight away with no checkout', async () => {
    const parent = await seedMember()
    const kid = await addChild(parent, 'Free Kid')
    const tournamentId = await seedTournament({ sections: [{ name: 'Scholastic', entryFee: 0 }] })
    const before = stripeSessions.length

    const res = await invoke(batchPost, {
      method: 'POST', as: parent, body: { tournamentId, entries: [{ memberId: kid.id, section: 'Scholastic' }] },
    })
    expect(res.status).toBe(201)
    expect((await res.json<{ paymentUrl: string | null }>()).paymentUrl).toBeNull()
    expect(stripeSessions.length).toBe(before)
  })

  it('refuses to register someone else’s child', async () => {
    const parent = await seedMember()
    const stranger = await seedMember()
    const kid = await addChild(parent, 'Not Yours')
    const tournamentId = await seedTournament()
    const res = await invoke(batchPost, {
      method: 'POST', as: stranger, body: { tournamentId, entries: [{ memberId: kid.id, section: 'Open' }] },
    })
    expect(res.status).toBe(403)
  })

  it('checks capacity for the whole group and writes nothing when it does not fit', async () => {
    const parent = await seedMember()
    const a = await addChild(parent, 'One')
    const b = await addChild(parent, 'Two')
    const tournamentId = await seedTournament({ maxPlayers: 1 })

    const res = await invoke(batchPost, {
      method: 'POST', as: parent,
      body: { tournamentId, entries: [{ memberId: a.id, section: 'Open' }, { memberId: b.id, section: 'Open' }] },
    })
    expect(res.status).toBe(400)
    const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM registrations WHERE tournament_id = ?')
      .bind(tournamentId).first<{ n: number }>()
    expect(n?.n).toBe(0)
  })

  it('names the child who needs a USCF ID for a rated event', async () => {
    const parent = await seedMember({ uscfId: '44440000' })
    const kid = await addChild(parent, 'No Id Yet')
    const tournamentId = await seedTournament({ isRated: true })
    const res = await invoke(batchPost, {
      method: 'POST', as: parent, body: { tournamentId, entries: [{ memberId: kid.id, section: 'Open' }] },
    })
    expect(res.status).toBe(400)
    expect((await res.json<{ error: string }>()).error).toContain('No Id Yet')
  })

  it('a parent can update their child’s bye requests', async () => {
    const parent = await seedMember()
    const kid = await addChild(parent, 'Bye Kid')
    const tournamentId = await seedTournament({ rounds: 4, sections: [{ name: 'Open', entryFee: 0 }] })
    const res = await invoke(batchPost, {
      method: 'POST', as: parent, body: { tournamentId, entries: [{ memberId: kid.id, section: 'Open' }] },
    })
    const { registrations } = await res.json<{ registrations: Array<{ id: string }> }>()

    const patch = await invoke(registrationPatch, {
      method: 'PATCH', as: parent, params: { id: registrations[0].id }, body: { byeRounds: [2] },
    })
    expect(patch.status).toBe(200)
  })
})

describe('children and the rest of the system', () => {
  it('an admin cannot "log in as" a child profile (it would be the parent’s session)', async () => {
    const admin = await seedAdmin()
    const parent = await seedMember()
    const kid = await addChild(parent, 'No Login')
    const res = await invoke(impersonatePost, { method: 'POST', as: admin, params: { memberId: kid.id } })
    expect(res.status).toBe(400)
  })

  it('group email reaches a family once, not once per child', async () => {
    const parent = await seedMember({ email: 'household@test.lca' })
    await addChild(parent, 'Sib One')
    await addChild(parent, 'Sib Two')
    const recipients = await resolveRecipients(env.DB, {})
    expect(recipients.filter((r) => r.email === 'household@test.lca')).toHaveLength(1)
    expect(recipients.find((r) => r.email === 'household@test.lca')?.id).toBe(parent)
  })
})
