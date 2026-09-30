// test/integration/role-safety.test.ts
// Guard rails before handing out roles: what directors can do to payments,
// that their changes are logged, and that admins can delete any ticket.
import { beforeEach, describe, expect, it } from 'vitest'
import { env } from 'cloudflare:test'
import { invoke, resetHarness } from './harness'
import { seedAdmin, seedClub, seedMember, seedRegistration, seedTournament, seedTournamentDirector } from './factories'

import { onRequestPatch as registrationPatch } from '../../functions/api/registrations/[id]'
import { onRequestPatch as tournamentPatch } from '../../functions/api/admin/tournaments/[id]'
import { onRequestPatch as clubPatch } from '../../functions/api/admin/clubs/[id]'
import { onRequestPost as supportPost } from '../../functions/api/support'
import { onRequestDelete as adminTicketDelete } from '../../functions/api/admin/support/[id]'

beforeEach(resetHarness)

async function logCount(action: string): Promise<number> {
  const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM admin_audit_log WHERE action = ?')
    .bind(action).first<{ n: number }>()
  return row?.n ?? 0
}

async function directedEntry(paymentStatus: 'pending' | 'paid' = 'pending', card = false) {
  const td = await seedMember()
  const player = await seedMember()
  const tournamentId = await seedTournament()
  await seedTournamentDirector(tournamentId, td)
  const reg = await seedRegistration({ tournamentId, memberId: player, paymentStatus })
  await env.DB.prepare(
    `INSERT INTO payments (id, member_id, amount, type, reference_id, status, stripe_session_id, stripe_payment_intent)
     VALUES (?, ?, 30, 'tournament', ?, ?, ?, ?)`,
  ).bind(`pay-${reg}`, player, reg, paymentStatus === 'paid' ? 'completed' : 'pending',
    card ? 'cs_test' : null, card ? 'pi_test' : null).run()
  return { td, reg }
}

describe('payment status', () => {
  it('a director can record cash at the door, and it is logged', async () => {
    const { td, reg } = await directedEntry('pending')
    const res = await invoke(registrationPatch, { method: 'PATCH', as: td, params: { id: reg }, body: { paymentStatus: 'paid' } })
    expect(res.status).toBe(200)
    expect(await logCount('payment_change')).toBe(1)
  })

  it('a director cannot record a refund', async () => {
    const { td, reg } = await directedEntry('paid')
    const res = await invoke(registrationPatch, { method: 'PATCH', as: td, params: { id: reg }, body: { paymentStatus: 'refunded' } })
    expect(res.status).toBe(403)
  })

  it('a director cannot change a card payment; an admin can', async () => {
    const { td, reg } = await directedEntry('paid', true)
    const denied = await invoke(registrationPatch, { method: 'PATCH', as: td, params: { id: reg }, body: { paymentStatus: 'pending' } })
    expect(denied.status).toBe(403)
    const admin = await seedAdmin()
    const ok = await invoke(registrationPatch, { method: 'PATCH', as: admin, params: { id: reg }, body: { paymentStatus: 'refunded' } })
    expect(ok.status).toBe(200)
  })
})

describe('activity log', () => {
  it('records withdrawals, publishing and club edits', async () => {
    const { td, reg } = await directedEntry('paid')
    await invoke(registrationPatch, { method: 'PATCH', as: td, params: { id: reg }, body: { withdrawn: true } })
    expect(await logCount('registration_withdraw')).toBe(1)

    const clubId = await seedClub()
    const rep = await seedMember({ role: 'club_rep', clubId })
    const tournamentId = await seedTournament({ clubId, isVisible: false })
    await invoke(tournamentPatch, { method: 'PATCH', as: rep, params: { id: tournamentId }, body: { isVisible: true } })
    expect(await logCount('tournament_publish')).toBe(1)

    await invoke(clubPatch, { method: 'PATCH', as: rep, params: { id: clubId }, body: { description: 'Tuesdays at 6' } })
    expect(await logCount('club_edit')).toBe(1)
  })
})

describe('support tickets', () => {
  it('an admin can delete a general ticket; nobody else can', async () => {
    const res = await invoke(supportPost, { method: 'POST', body: { name: 'A', email: 'a@example.org', subject: 'Oops', body: 'my phone number is…' } })
    const { ticketId } = await res.json<{ ticketId: string }>()

    const member = await seedMember()
    expect((await invoke(adminTicketDelete, { method: 'DELETE', as: member, params: { id: ticketId } })).status).toBe(403)

    const admin = await seedAdmin()
    expect((await invoke(adminTicketDelete, { method: 'DELETE', as: admin, params: { id: ticketId } })).status).toBe(200)
    const gone = await env.DB.prepare('SELECT id FROM support_tickets WHERE id = ?').bind(ticketId).first()
    expect(gone).toBeNull()
    expect(await logCount('ticket_delete')).toBe(1)
  })
})
