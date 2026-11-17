// test/integration/role-safety.test.ts
// Guard rails before handing out roles: what directors can do to payments,
// that their changes are logged, that admins can delete any ticket, and, with
// the creation roles on, what a one-event director may not do to the event
// they direct (WS08 step 5). CREATION_ROLES_ON is false in the tree; the
// creation roles' case reads it through a getter on the mocked module, as
// test/integration/tournament-create.test.ts does, and every other case runs
// with it unset, as before. The approval wait's cases (WS09 step 18) read
// REGION_EVENTS_ON, false in the tree, through a getter on its own module in
// the same way.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { env } from 'cloudflare:test'
import { errorBodySchema } from '../../domain/contracts'
import { expectContract, invoke, resetHarness } from './harness'
import { seedAdmin, seedClub, seedMember, seedPresident, seedRegistration, seedTournament, seedTournamentDirector } from './factories'
import { noWaits } from './mailRuns'

import { onRequestPatch as registrationPatch } from '../../functions/api/registrations/[id]'
import { onRequestDelete as tournamentDelete, onRequestPatch as tournamentPatch } from '../../functions/api/admin/tournaments/[id]'
import { onRequestDelete as directorRemove, onRequestPost as directorAssign } from '../../functions/api/admin/tournaments/[id]/directors'
import { onRequestPatch as clubPatch } from '../../functions/api/admin/clubs/[id]'
import { onRequestPut as clubPlacesPut } from '../../functions/api/admin/clubs/[id]/places'
import { onRequestPost as supportPost } from '../../functions/api/support'
import { onRequestDelete as adminTicketDelete } from '../../functions/api/admin/support/[id]'
import { onRequestPost as approvalPost } from '../../functions/api/admin/tournaments/[id]/approval'

const flags = vi.hoisted(() => ({ rolesOn: false, keepersOn: false, regionOn: false }))
vi.mock('../../functions/utils/events/creation', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../functions/utils/events/creation')>()
  return {
    ...real,
    get CREATION_ROLES_ON() {
      return flags.rolesOn
    },
  }
})

// CLUB_KEEPERS_ON, false in the tree, read the same way by the keepers' save's cases (WS09 step 6).
vi.mock('../../functions/utils/clubs/pages', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../functions/utils/clubs/pages')>()
  return {
    ...real,
    get CLUB_KEEPERS_ON() {
      return flags.keepersOn
    },
    get REGION_EVENTS_ON() {
      return flags.regionOn
    },
  }
})

beforeEach(resetHarness)
afterEach(() => {
  flags.rolesOn = false
  flags.keepersOn = false
  flags.regionOn = false
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

  it('with CLUB_KEEPERS_ON set, a keeper\'s save writes its club_edit row once, in the save\'s own batch, and a save that changes nothing writes none', async () => {
    flags.keepersOn = true
    const clubId = await seedClub({ name: 'Example Chess Club' })
    const rep = await seedMember({ role: 'club_rep', clubId })
    const before = await logCount('club_edit')

    const saved = await invoke(clubPatch, { method: 'PATCH', as: rep, params: { id: clubId }, body: { aboutText: 'Tuesdays, 6:00 PM', weekendPlay: true } })
    expect(saved.status).toBe(200)
    expect(await logCount('club_edit')).toBe(before + 1)
    const entry = await env.DB.prepare('SELECT actor_id, actor_email, target_label, detail FROM admin_audit_log WHERE action = \'club_edit\' ORDER BY rowid DESC LIMIT 1')
      .first<{ actor_id: string; actor_email: string; target_label: string; detail: string }>()
    const actor = await env.DB.prepare('SELECT email FROM members WHERE id = ?').bind(rep).first<{ email: string }>()
    expect(entry).toMatchObject({ actor_id: rep, actor_email: actor?.email, target_label: 'Example Chess Club' })
    // The club has no region, so no representative is told, and the row says so.
    expect(JSON.parse(entry!.detail)).toEqual({ club_id: clubId, fields: ['description', 'about_text', 'weekend_play'], notice: false })

    expect((await invoke(clubPatch, { method: 'PATCH', as: rep, params: { id: clubId }, body: { aboutText: 'Tuesdays, 6:00 PM' } })).status).toBe(200)
    expect(await logCount('club_edit')).toBe(before + 1)
    expect((await invoke(clubPlacesPut, { method: 'PUT', as: rep, params: { id: clubId }, body: { places: [{ name: 'Example Hall' }] } })).status).toBe(200)
    expect(await logCount('club_edit')).toBe(before + 2)
  })
})

describe('a club\'s places', () => {
  it('role safety: signed out, a member and another club\'s rep are refused on PUT places, with CLUB_KEEPERS_ON unset and set, each refusal is { error }, and nothing is written', async () => {
    const clubId = await seedClub()
    const member = await seedMember({ clubId })
    const otherRep = await seedMember({ role: 'club_rep', clubId: await seedClub() })
    const stored = async () => ({
      places: (await env.DB.prepare('SELECT COUNT(*) AS n FROM club_places WHERE club_id = ?').bind(clubId).first<{ n: number }>())?.n,
      club: await env.DB.prepare('SELECT * FROM clubs WHERE id = ?').bind(clubId).first(),
      log: await logCount('club_edit'),
    })
    const before = await stored()
    for (const on of [false, true]) {
      flags.keepersOn = on
      const body = { places: [{ name: 'Example Hall' }] }
      const signedOut = await invoke(clubPlacesPut, { method: 'PUT', params: { id: clubId }, body })
      expect(signedOut.status, String(on)).toBe(401)
      await expectContract(signedOut, errorBodySchema)
      for (const who of [member, otherRep]) {
        const res = await invoke(clubPlacesPut, { method: 'PUT', as: who, params: { id: clubId }, body })
        expect(res.status, `${who} ${on}`).toBe(403)
        expect(await expectContract(res, errorBodySchema)).toEqual({ error: 'Forbidden' })
      }
    }
    expect(await stored()).toEqual(before)
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

describe('the approval wait (WS09 step 18)', () => {
  beforeEach(() => {
    flags.regionOn = true
    // The LCA admins' emails go 400ms apart; the pause is not waited for here.
    noWaits()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  /** A representative's club event in the region, drafted by them and marked for an LCA admin's approval. */
  async function waitingEvent() {
    const clubId = await seedClub({ name: 'Example Chess Club' })
    await env.DB.prepare("UPDATE clubs SET region = 'Example Bayou Region' WHERE id = ?").bind(clubId).run()
    const representative = await seedMember({ fullName: 'Player One' })
    const seat = `seat-safety-${representative}`
    await env.DB.prepare(
      "INSERT INTO board_members (id, role, name, sort_order, slug, category, is_active) VALUES (?, 'Example Region Representative', '', 99, ?, 'regional_rep', 1)",
    ).bind(seat, seat).run()
    await env.DB.prepare("INSERT INTO seat_regions (seat_id, region) VALUES (?, 'Example Bayou Region')").bind(seat).run()
    await env.DB.prepare('INSERT INTO board_seat_assignments (id, seat_id, member_id) VALUES (?, ?, ?)').bind(`term-${seat}`, seat, representative).run()
    const tournamentId = await seedTournament({ clubId, createdBy: representative, entryFee: 0, sections: [{ name: 'Open', entryFee: 0 }], isVisible: false })
    await env.DB.prepare('UPDATE tournaments SET needs_lca_approval = 1 WHERE id = ?').bind(tournamentId).run()
    const rep = await seedMember({ role: 'club_rep', clubId })
    const director = await seedMember()
    await seedTournamentDirector(tournamentId, director)
    return { tournamentId, representative, rep, director, admin: await seedAdmin() }
  }
  const move = (as: string | undefined, id: string, body: unknown, aal: 'aal1' | 'aal2' = 'aal2') => invoke(approvalPost, { method: 'POST', as, params: { id }, body, aal })
  const wait = (id: string) => env.DB.prepare('SELECT approval_requested_at, approved_at, approved_by, is_visible FROM tournaments WHERE id = ?').bind(id).first()
  const allRows = async () => (await env.DB.prepare('SELECT COUNT(*) AS n FROM admin_audit_log').first<{ n: number }>())?.n

  it('approve and ask for changes need an LCA admin with a second factor: without it the admin gets requireAdmin\'s refusal, the representative, a club rep and a director 403, signed out 401, each refusal is { error } and writes no row', async () => {
    const { tournamentId, representative, rep, director, admin } = await waitingEvent()
    expect((await move(representative, tournamentId, { action: 'submit' })).status).toBe(200)
    const before = { wait: await wait(tournamentId), log: await allRows() }
    for (const body of [{ action: 'approve' }, { action: 'ask_changes', note: 'Example note' }]) {
      const noFactor = await move(admin, tournamentId, body, 'aal1')
      expect(noFactor.status, body.action).toBe(403)
      expect(await noFactor.json(), body.action).toEqual({
        error: 'Two-factor authentication is required for admin access. Set it up in your account security settings.',
        mfaRequired: true,
      })
      for (const who of [representative, rep, director]) {
        const res = await move(who, tournamentId, body)
        expect(res.status, `${who} ${body.action}`).toBe(403)
        expect(await expectContract(res, errorBodySchema)).toEqual({ error: 'Forbidden' })
      }
      const signedOut = await move(undefined, tournamentId, body)
      expect(signedOut.status, body.action).toBe(401)
      await expectContract(signedOut, errorBodySchema)
    }
    expect({ wait: await wait(tournamentId), log: await allRows() }).toEqual(before)
  })

  it('each move that goes through writes one row in the activity log, naming who made it, and a move that changes nothing or is refused writes none', async () => {
    const { tournamentId, representative, admin } = await waitingEvent()
    const rowsOf = async (action: string) => (await env.DB.prepare("SELECT COUNT(*) AS n FROM admin_audit_log WHERE action = ? AND json_extract(detail, '$.tournament_id') = ?")
      .bind(action, tournamentId).first<{ n: number }>())?.n
    expect((await move(representative, tournamentId, { action: 'submit' })).status).toBe(200)
    expect(await rowsOf('tournament_submitted')).toBe(1)
    // A second submit changes nothing, and an approve without the second factor is refused: no row for either.
    expect((await move(representative, tournamentId, { action: 'submit' })).status).toBe(200)
    expect((await move(admin, tournamentId, { action: 'approve' }, 'aal1')).status).toBe(403)
    expect(await rowsOf('tournament_submitted')).toBe(1)
    expect(await rowsOf('tournament_approved')).toBe(0)
    expect((await move(admin, tournamentId, { action: 'ask_changes', note: 'Example note' })).status).toBe(200)
    expect(await rowsOf('tournament_changes_asked')).toBe(1)
    expect((await move(admin, tournamentId, { action: 'approve' })).status).toBe(200)
    expect((await move(admin, tournamentId, { action: 'approve' })).status).toBe(409)
    expect(await rowsOf('tournament_approved')).toBe(1)
    const { results } = await env.DB.prepare("SELECT actor_id, action, detail FROM admin_audit_log WHERE action LIKE 'tournament_%' AND json_extract(detail, '$.tournament_id') = ? ORDER BY rowid")
      .bind(tournamentId).all<{ actor_id: string; action: string; detail: string }>()
    expect(results.map((r) => [r.actor_id, r.action, JSON.parse(r.detail)])).toEqual([
      [representative, 'tournament_submitted', { tournament_id: tournamentId }],
      [admin, 'tournament_changes_asked', { tournament_id: tournamentId }],
      [admin, 'tournament_approved', { tournament_id: tournamentId }],
    ])
  })
})
