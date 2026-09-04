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
import { onRequestPatch as mePatch } from '../../functions/api/me'
import { onRequestDelete as memberDelete } from '../../functions/api/admin/members/[id]'
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

describe('PATCH /api/me input validation', () => {
  const patch = (as: string, body: unknown) =>
    invoke(mePatch, { method: 'PATCH', as, body })

  const nameOf = (id: string) =>
    env.DB.prepare('SELECT full_name, uscf_id FROM members WHERE id = ?')
      .bind(id).first<{ full_name: string; uscf_id: string | null }>()

  it('rejects a blank name instead of storing it', async () => {
    // This is the one that mattered: the admin route validated, and the
    // member-facing route that people actually use validated nothing.
    const id = await seedMember({ fullName: 'Real Name' })
    for (const fullName of ['', '   ']) {
      const res = await patch(id, { fullName })
      expect(res.status).toBe(400)
    }
    expect((await nameOf(id))?.full_name).toBe('Real Name')
  })

  it('rejects a name past the length cap', async () => {
    const id = await seedMember({ fullName: 'Real Name' })
    const res = await patch(id, { fullName: 'x'.repeat(101) })
    expect(res.status).toBe(400)
    expect((await nameOf(id))?.full_name).toBe('Real Name')
  })

  it('accepts a name at the cap, and trims it', async () => {
    const id = await seedMember()
    expect((await patch(id, { fullName: 'x'.repeat(100) })).status).toBe(200)
    await patch(id, { fullName: '  Campbell, Richard  ' })
    expect((await nameOf(id))?.full_name).toBe('Campbell, Richard')
  })

  it('rejects a USCF ID that is not eight digits', async () => {
    const id = await seedMember({ uscfId: '12345678' })
    for (const uscfId of ['123', '1234567890', 'abcdefgh', '1234-567']) {
      expect((await patch(id, { uscfId })).status).toBe(400)
    }
    expect((await nameOf(id))?.uscf_id).toBe('12345678')
  })

  it('accepts a real USCF ID', async () => {
    const id = await seedMember()
    expect((await patch(id, { uscfId: '87654321' })).status).toBe(200)
    expect((await nameOf(id))?.uscf_id).toBe('87654321')
  })

  it('treats null and empty string as clearing the ID', async () => {
    for (const clear of [null, '']) {
      const id = await seedMember({ uscfId: '12345678' })
      expect((await patch(id, { uscfId: clear })).status).toBe(200)
      expect((await nameOf(id))?.uscf_id).toBeNull()
    }
  })

  it('leaves a field alone when it is not sent at all', async () => {
    // The PATCH contract: absent means untouched, which is different from
    // sent-and-empty. Only the latter is an error.
    const id = await seedMember({ fullName: 'Keep Me', uscfId: '12345678' })
    expect((await patch(id, {})).status).toBe(200)
    const row = await nameOf(id)
    expect(row?.full_name).toBe('Keep Me')
    expect(row?.uscf_id).toBe('12345678')
  })
})

describe('deleting a member clears every reference', () => {
  it('removes the seat assignment, campaign recipient row and impersonation log', async () => {
    const adminId = await seedAdmin()
    const memberId = await seedMember()

    // Three tables the cascade used to miss. A deleted member kept their
    // officer seat and stayed on an in-flight campaign's recipient list.
    const seat = await env.DB.prepare(
      "SELECT id FROM board_members LIMIT 1",
    ).first<{ id: string }>()
    if (seat) {
      await env.DB.prepare(
        `INSERT INTO board_seat_assignments (id, seat_id, member_id, started_at)
         VALUES (?, ?, ?, date('now'))`,
      ).bind(`bsa-${memberId}`, seat.id, memberId).run()
    }

    await env.DB.prepare(
      `INSERT INTO email_campaigns (id, subject, body_html, filter_json, total_recipients)
       VALUES ('camp-del', 's', '<p>b</p>', '{}', 1)`,
    ).run()
    await env.DB.prepare(
      `INSERT INTO email_campaign_recipients (id, campaign_id, member_id, email)
       VALUES (?, 'camp-del', ?, 'x@y.z')`,
    ).bind(`rcpt-del-${memberId}`, memberId).run()

    await env.DB.prepare(
      `INSERT INTO impersonation_log (id, admin_id, target_member_id)
       VALUES (?, ?, ?)`,
    ).bind(`imp-${memberId}`, adminId, memberId).run().catch(() => {})

    const res = await invoke(memberDelete, {
      method: 'DELETE', as: adminId, params: { id: memberId },
    })
    expect(res.status).toBe(200)

    const count = async (sql: string) =>
      (await env.DB.prepare(sql).bind(memberId).first<{ n: number }>())?.n ?? 0

    expect(await count('SELECT COUNT(*) n FROM members WHERE id = ?')).toBe(0)
    expect(await count('SELECT COUNT(*) n FROM board_seat_assignments WHERE member_id = ?')).toBe(0)
    expect(await count('SELECT COUNT(*) n FROM email_campaign_recipients WHERE member_id = ?')).toBe(0)
    expect(await count('SELECT COUNT(*) n FROM impersonation_log WHERE target_member_id = ?')).toBe(0)
  })

  it('reports whether the auth user was removed too', async () => {
    // The response now carries authDeleted, so an admin can tell the
    // difference between a full removal and one that left a login behind.
    const adminId = await seedAdmin()
    const memberId = await seedMember()

    const res = await invoke(memberDelete, {
      method: 'DELETE', as: adminId, params: { id: memberId },
    })
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body).toHaveProperty('authDeleted')
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

    // The ticket is written before any mail is attempted, which is the whole
    // point: an outage at Resend must not lose someone's message. Asserted on
    // the id this request returned rather than a row count, so a ticket left
    // behind by another test cannot make this pass.
    const { ticketId } = await res.json()
    const saved = await env.DB.prepare(
      'SELECT id FROM support_tickets WHERE id = ?',
    ).bind(ticketId).first<{ id: string }>()
    expect(saved?.id).toBe(ticketId)
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