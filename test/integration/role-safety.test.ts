// test/integration/role-safety.test.ts
// Guard rails before handing out roles: what directors can do to payments,
// that their changes are logged, that admins can delete any ticket, and, with
// the creation roles on, what a one-event director may not do to the event
// they direct (WS08 step 5). CREATION_ROLES_ON is false in the tree; the
// creation roles' case reads it through a getter on the mocked module, as
// test/integration/tournament-create.test.ts does, and every other case runs
// with it unset, as before.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { env } from 'cloudflare:test'
import { errorBodySchema } from '../../domain/contracts'
import { expectContract, invoke, resetHarness } from './harness'
import { seedAdmin, seedClub, seedMember, seedPresident, seedRegistration, seedTournament, seedTournamentDirector } from './factories'

import { onRequestPatch as registrationPatch } from '../../functions/api/registrations/[id]'
import { onRequestDelete as tournamentDelete, onRequestPatch as tournamentPatch } from '../../functions/api/admin/tournaments/[id]'
import { onRequestDelete as directorRemove, onRequestPost as directorAssign } from '../../functions/api/admin/tournaments/[id]/directors'
import { onRequestPatch as clubPatch } from '../../functions/api/admin/clubs/[id]'
import { onRequestPost as supportPost } from '../../functions/api/support'
import { onRequestDelete as adminTicketDelete } from '../../functions/api/admin/support/[id]'

const flags = vi.hoisted(() => ({ rolesOn: false }))
vi.mock('../../functions/utils/events/creation', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../functions/utils/events/creation')>()
  return {
    ...real,
    get CREATION_ROLES_ON() {
      return flags.rolesOn
    },
  }
})

beforeEach(resetHarness)
afterEach(() => {
  flags.rolesOn = false
})

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

describe('creation roles', () => {
  beforeEach(() => {
    flags.rolesOn = true
  })

  it('a one-event director cannot name or remove a director, flip the membership switch or delete the event, with CREATION_ROLES_ON set: each refusal is { error }, and nothing is written', async () => {
    // The president's unpublished draft with no entries, and the member the president named to run it.
    const president = await seedMember({ role: 'lca_observer' })
    await seedPresident(president)
    const tournamentId = await seedTournament({ isVisible: false, createdBy: president })
    await seedTournamentDirector(tournamentId, president)
    const director = await seedMember()
    await seedTournamentDirector(tournamentId, director)
    const stored = async () => ({
      event: await env.DB.prepare('SELECT * FROM tournaments WHERE id = ?').bind(tournamentId).first(),
      directors: (await env.DB.prepare('SELECT member_id FROM tournament_directors WHERE tournament_id = ? ORDER BY member_id').bind(tournamentId).all()).results,
      log: (await env.DB.prepare('SELECT COUNT(*) AS n FROM admin_audit_log').first<{ n: number }>())?.n,
    })
    const before = await stored()

    const params = { id: tournamentId }
    const answers = [
      ['naming a director', await invoke(directorAssign, { method: 'POST', as: director, params, body: { memberId: await seedMember() } })],
      ['removing one', await invoke(directorRemove, { method: 'DELETE', as: director, params, body: { memberId: president } })],
      ['the membership switch', await invoke(tournamentPatch, { method: 'PATCH', as: director, params, body: { requiresLcaMembership: false } })],
      ['the delete', await invoke(tournamentDelete, { method: 'DELETE', as: director, params })],
    ] as const
    for (const [what, answer] of answers) {
      expect(answer.status, what).toBe(403)
      await expectContract(answer, errorBodySchema)
    }
    // The event, its two directors and the activity log are as they were: no row for any of the four.
    expect(await stored()).toEqual(before)
  })
})
