// test/integration/edges.test.ts — boundaries, regressions, and abuse cases.
import { env } from 'cloudflare:test'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  emailBehavior,
  emailOutbox,
  invoke,
  resetHarness,
  signStripePayload,
  stripeSessions,
} from './harness'
import { seedAdmin, seedMember, seedRegistration, seedTournament } from './factories'

import { onRequestPost as registrationsPost } from '../../functions/api/registrations'
import { onRequestPatch as membershipPatch } from '../../functions/api/admin/members/[id]/membership'
import { onRequestGet as contactGet, onRequestPost as contactPost } from '../../functions/api/contact'
import { onRequestPost as donationPost } from '../../functions/api/donations/checkout'
import { onRequestPost as webhookPost } from '../../functions/api/stripe/webhook'
import {
  onRequestDelete as remindDelete,
  onRequestGet as remindGet,
  onRequestPost as remindPost,
} from '../../functions/api/tournaments/[id]/remind'

beforeEach(resetHarness)

describe('registration edge cases', () => {
  it('max_players: registration at capacity is refused', async () => {
    const tournamentId = await seedTournament({
      maxPlayers: 2, sections: [{ name: 'Open', entryFee: 0 }],
    })
    for (let i = 0; i < 2; i++) {
      await seedRegistration({ tournamentId, memberId: await seedMember(), section: 'Open' })
    }
    const late = await invoke(registrationsPost, {
      method: 'POST', as: await seedMember(),
      body: { tournamentId, section: 'Open' },
    })
    expect(late.status).toBe(400)
    expect((await late.json()).error).toMatch(/full/i)
  })

  it('registration_closes_at in the past blocks registration even while status is still open', async () => {
    const tournamentId = await seedTournament({
      registrationStatus: 'open',
      registrationClosesAt: '2026-01-01T00:00:00Z',
      sections: [{ name: 'Open', entryFee: 0 }],
    })
    const res = await invoke(registrationsPost, {
      method: 'POST', as: await seedMember(),
      body: { tournamentId, section: 'Open' },
    })
    expect(res.status).toBe(400)
  })

  it('closed/draft status blocks; invalid section blocks; too many byes blocks', async () => {
    const member = await seedMember()
    const closed = await seedTournament({ registrationStatus: 'closed', sections: [{ name: 'Open', entryFee: 0 }] })
    expect((await invoke(registrationsPost, { method: 'POST', as: member, body: { tournamentId: closed, section: 'Open' } })).status).toBe(400)

    const open = await seedTournament({ rounds: 4, sections: [{ name: 'Open', entryFee: 0 }] })
    expect((await invoke(registrationsPost, { method: 'POST', as: member, body: { tournamentId: open, section: 'Nope' } })).status).toBe(400)
    expect((await invoke(registrationsPost, { method: 'POST', as: member, body: { tournamentId: open, section: 'Open', byeRounds: [1, 2, 3, 4] } })).status).toBe(400)
  })

  it('a withdrawn player re-registering gets the reinstate message, not a new row', async () => {
    const member = await seedMember()
    const tournamentId = await seedTournament({ sections: [{ name: 'Open', entryFee: 0 }] })
    const regId = await seedRegistration({ tournamentId, memberId: member, section: 'Open' })
    await env.DB.prepare('UPDATE registrations SET withdrawn_at = ? WHERE id = ?')
      .bind(new Date().toISOString(), regId).run()

    const res = await invoke(registrationsPost, {
      method: 'POST', as: member, body: { tournamentId, section: 'Open' },
    })
    expect(res.status).toBe(409)
    expect((await res.json()).error).toMatch(/reinstate/i)
  })
})

describe('membership PATCH regression (expiry-wipe fix)', () => {
  it('updating status alone preserves the stored expiry', async () => {
    const admin = await seedAdmin()
    const member = await seedMember()
    await env.DB.prepare('UPDATE members SET membership_expiry = ? WHERE id = ?')
      .bind('2027-06-30', member).run()

    const res = await invoke(membershipPatch, {
      method: 'PATCH', as: admin, params: { id: member },
      body: { membershipStatus: 'active' },
    })
    expect(res.status).toBe(200)
    const row = await env.DB.prepare('SELECT membership_expiry FROM members WHERE id = ?')
      .bind(member).first<{ membership_expiry: string | null }>()
    expect(row?.membership_expiry).toBe('2027-06-30')
  })
})

describe('contact endpoint (PII-leak fix + resilience)', () => {
  it('GET requires admin', async () => {
    expect((await invoke(contactGet)).status).toBe(401)
    expect((await invoke(contactGet, { as: await seedMember() })).status).toBe(403)
    expect((await invoke(contactGet, { as: await seedAdmin() })).status).toBe(200)
  })

  it('POST saves, sends two emails, and escapes injected HTML in the notification', async () => {
    const res = await invoke(contactPost, {
      method: 'POST',
      body: {
        name: '<script>alert(1)</script>', email: 'x@y.z',
        subject: 'Hello', body: 'line1\nline2',
      },
    })
    expect(res.status).toBe(201)
    expect(emailOutbox).toHaveLength(2)
    const notification = emailOutbox.find((e) => e.to === 'contact@louisianachess.org')
    expect(notification?.html).not.toContain('<script>')
    expect(notification?.html).toContain('&lt;script&gt;')
  })

  it('POST still succeeds when the email provider is down (trySendEmail)', async () => {
    emailBehavior.succeed = false
    const res = await invoke(contactPost, {
      method: 'POST',
      body: { name: 'A', email: 'a@b.c', subject: 'S', body: 'B' },
    })
    expect(res.status).toBe(201)
    const saved = await env.DB.prepare('SELECT COUNT(*) as c FROM contact_messages').first<{ c: number }>()
    expect(saved!.c).toBeGreaterThan(0)
  })
})

describe('donations (0019 regression: type + anonymous member)', () => {
  it('anonymous donation inserts a null-member donation payment and the webhook completes it', async () => {
    const res = await invoke(donationPost, {
      method: 'POST', body: { amount: 25 },
    })
    expect(res.status).toBe(200)
    const { paymentId } = await res.json()
    const session = stripeSessions[0]
    expect(session.metadata.type).toBe('donation')

    const rawBody = JSON.stringify({
      type: 'checkout.session.completed',
      data: { object: { payment_intent: 'pi_d1', metadata: session.metadata } },
    })
    const hook = await invoke(webhookPost, {
      method: 'POST', rawBody,
      headers: { 'stripe-signature': await signStripePayload(rawBody) },
    })
    expect(hook.status).toBe(200)

    const row = await env.DB.prepare('SELECT member_id, type, status FROM payments WHERE id = ?')
      .bind(paymentId).first<{ member_id: string | null; type: string; status: string }>()
    expect(row?.member_id).toBeNull()
    expect(row?.type).toBe('donation')
    expect(row?.status).toBe('completed')
  })

  it('rejects out-of-range amounts', async () => {
    expect((await invoke(donationPost, { method: 'POST', body: { amount: 0 } })).status).toBe(400)
    expect((await invoke(donationPost, { method: 'POST', body: { amount: 20000 } })).status).toBe(400)
  })
})

describe('tournament reminders (dead-route fix)', () => {
  it('opt-in → status true → opt-out → status false', async () => {
    const member = await seedMember()
    const tournamentId = await seedTournament()

    expect((await invoke(remindPost, { method: 'POST', as: member, params: { id: tournamentId } })).status).toBe(200)
    expect((await (await invoke(remindGet, { as: member, params: { id: tournamentId } })).json()).opted_in).toBe(true)
    expect((await invoke(remindDelete, { method: 'DELETE', as: member, params: { id: tournamentId } })).status).toBe(200)
    expect((await (await invoke(remindGet, { as: member, params: { id: tournamentId } })).json()).opted_in).toBe(false)
  })
})