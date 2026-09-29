// test/integration/emails.test.ts
// Short ticket numbers, and "you're registered" emails that go out once an
// entry is confirmed (and only once).
import { beforeEach, describe, expect, it } from 'vitest'
import { env } from 'cloudflare:test'
import { emailOutbox, invoke, resetHarness, signStripePayload, stripeSessions } from './harness'
import { seedMember, seedTournament } from './factories'

import { onRequestPost as supportPost } from '../../functions/api/support'
import { onRequestPost as contactPost } from '../../functions/api/contact'
import { onRequestPost as registrationPost } from '../../functions/api/registrations'
import { onRequestPost as batchPost } from '../../functions/api/registrations/batch'
import { onRequestPost as childrenPost } from '../../functions/api/me/children'
import { onRequestPost as webhookPost } from '../../functions/api/stripe/webhook'
import { formatEventDate } from '../../functions/utils/emailLayout'

beforeEach(resetHarness)

async function deliver(sessionId: string, metadata: Record<string, string>) {
  const rawBody = JSON.stringify({
    type: 'checkout.session.completed',
    data: { object: { id: sessionId, payment_intent: 'pi_test', metadata } },
  })
  const res = await invoke(webhookPost, {
    method: 'POST', rawBody,
    headers: { 'stripe-signature': await signStripePayload(rawBody) },
  })
  expect(res.status).toBe(200)
}

const confirmations = () => emailOutbox.filter((e) => e.subject.startsWith("You're registered"))

describe('ticket numbers', () => {
  it('numbers are sequential and shown to staff only, never to the person who wrote in', async () => {
    const open = async (body: Record<string, string>, handler = supportPost) => {
      const res = await invoke(handler, { method: 'POST', body })
      expect(res.status).toBe(201)
      const json = await res.json<{ ticketId: string; ticketNumber?: number }>()
      expect(json.ticketNumber).toBeUndefined()
      const row = await env.DB.prepare('SELECT number FROM support_tickets WHERE id = ?')
        .bind(json.ticketId).first<{ number: number }>()
      return row!.number
    }
    const first = await open({ name: 'A', email: 'a@example.org', subject: 'One', body: 'x' })
    const second = await open({ name: 'B', email: 'b@example.org', subject: 'Two', body: 'y' }, contactPost)

    expect(first).toBeGreaterThan(1000)
    expect(second).toBe(first + 1)

    const toSubmitter = emailOutbox.find((e) => e.to === 'b@example.org')!
    expect(toSubmitter.subject).not.toContain(String(second))
    expect(toSubmitter.html).not.toContain(`Ticket: ${second}`)
    expect(toSubmitter.html).not.toContain(`>${second}<`)

    const toStaff = emailOutbox.filter((e) => e.to === 'contact@louisianachess.org').at(-1)!
    expect(toStaff.subject.endsWith(`[Ticket: ${second}]`)).toBe(true)
    for (const e of emailOutbox) {
      expect(e.subject).not.toContain('ticket-')
      expect(e.html).not.toMatch(/>ticket-\d+/)
    }
  })

  it('a signed-in submitter gets a link that opens the ticket', async () => {
    const member = await seedMember({ email: 'member@example.org' })
    const res = await invoke(supportPost, {
      method: 'POST', as: member,
      body: { name: 'M', email: 'member@example.org', subject: 'Link', body: 'z' },
    })
    const { ticketId } = await res.json<{ ticketId: string }>()
    const mail = emailOutbox.find((e) => e.to === 'member@example.org')!
    expect(mail.html).toContain(`/support?ticket=${encodeURIComponent(ticketId)}`)
  })
})

describe('registration confirmations', () => {
  it('a free entry is confirmed by email right away', async () => {
    const member = await seedMember({ email: 'free@example.org', fullName: 'Free Player', uscfId: '12345678' })
    const tournamentId = await seedTournament({ name: 'Free Swiss', sections: [{ name: 'Open', entryFee: 0 }] })
    const res = await invoke(registrationPost, { method: 'POST', as: member, body: { tournamentId, section: 'Open' } })
    expect(res.status).toBe(201)

    const mails = confirmations()
    expect(mails).toHaveLength(1)
    expect(mails[0].to).toBe('free@example.org')
    expect(mails[0].subject).toBe("You're registered: Free Swiss")
    expect(mails[0].html).toContain('Open')
  })

  it('a paid entry is confirmed when payment arrives, once, even if Stripe retries', async () => {
    const member = await seedMember({ email: 'paid@example.org', uscfId: '12345679' })
    const tournamentId = await seedTournament({ sections: [{ name: 'Open', entryFee: 40 }] })
    const res = await invoke(registrationPost, { method: 'POST', as: member, body: { tournamentId, section: 'Open' } })
    expect(res.status).toBe(201)
    expect(confirmations()).toHaveLength(0)

    const session = stripeSessions.at(-1)!
    await deliver(session.id, session.metadata)
    await deliver(session.id, session.metadata)

    const mails = confirmations()
    expect(mails).toHaveLength(1)
    expect(mails[0].to).toBe('paid@example.org')
    expect(mails[0].html).toContain('$40.00')
  })

  it('a parent entering several children gets one email listing everyone', async () => {
    const parent = await seedMember({ email: 'parent@example.org', fullName: 'Pat Parent' })
    const addChild = async (fullName: string) => {
      const r = await invoke(childrenPost, { method: 'POST', as: parent, body: { fullName } })
      const { children } = await r.json<{ children: { id: string; full_name: string }[] }>()
      return children.find((c) => c.full_name === fullName)!.id
    }
    const a = await addChild('Alpha Kid')
    const b = await addChild('Bravo Kid')
    const tournamentId = await seedTournament({ isRated: false, sections: [{ name: 'K-8', entryFee: 15 }] })

    const res = await invoke(batchPost, {
      method: 'POST', as: parent,
      body: { tournamentId, entries: [{ memberId: a, section: 'K-8' }, { memberId: b, section: 'K-8' }] },
    })
    expect(res.status).toBe(201)
    const session = stripeSessions.at(-1)!
    await deliver(session.id, session.metadata)
    await deliver(session.id, session.metadata)

    const mails = confirmations()
    expect(mails).toHaveLength(1)
    expect(mails[0].to).toBe('parent@example.org')
    expect(mails[0].html).toContain('Alpha Kid')
    expect(mails[0].html).toContain('Bravo Kid')
    expect(mails[0].html).toContain('$30.00')
  })

  it('no email footer points at the dead support@ address', async () => {
    const member = await seedMember({ email: 'footer@example.org', uscfId: '12345670' })
    const tournamentId = await seedTournament({ sections: [{ name: 'Open', entryFee: 0 }] })
    await invoke(registrationPost, { method: 'POST', as: member, body: { tournamentId, section: 'Open' } })
    for (const e of emailOutbox) expect(e.html).not.toContain('support@louisianachess.org')
  })
})

describe('event dates in emails', () => {
  it('reads naturally for one-day and multi-day events', () => {
    expect(formatEventDate('2026-10-17')).toBe('Saturday, October 17, 2026')
    expect(formatEventDate('2026-10-17', '2026-10-18')).toBe('October 17–18, 2026')
    expect(formatEventDate('2026-10-31', '2026-11-01')).toBe('October 31–November 1, 2026')
    expect(formatEventDate('TBD')).toBe('TBD')
  })
})

describe('ticket number backfill', () => {
  it('the column exists and is unique', async () => {
    const idx = await env.DB.prepare(
      `SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_support_tickets_number'`,
    ).first<{ name: string }>()
    expect(idx?.name).toBe('idx_support_tickets_number')
  })
})
