// test/integration/tournament-create.test.ts
// (Formerly launch-lockdown.test.ts: the lockdown that kept tournament
// creation to lca_admin was lifted when clubs were given access.)
//   1. Who may create tournaments, and for which club, with CREATION_ROLES_ON
//      set and unset (criterion 12 of brief 1.4's WS08 section, D20 and Q2).
//      Set, a standing director and the president create LCA-run hidden
//      drafts and are written as their first director, a club is refused them
//      with the LCA-run words, an LCA admin and a club rep create as before
//      with no director row, and everyone else is refused; unset, the standing
//      director and the president are refused, as today. A club rep's path, a
//      club rep who holds the President seat included, runs in both states.
//   2. A creator who has lost the grant that let them create, a former club
//      rep or a former LCA admin, keeps nothing on the event, in both states:
//      each first runs the event by its role, a cash payment among what it
//      changes, and once the role is gone the same requests and the delete
//      are refused with "Forbidden".
//   3. PATCHing membershipExpiry without a status derives the status from the date.
// CREATION_ROLES_ON is false in the tree. Here it is read through a getter on
// the mocked module, so each case runs in the state its name gives; the
// handler reads the constant at each request, through the module. The fee
// rule is mocked the same way for the one case that makes it refuse, since
// no grant that may create is refused a fee in this phase.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { env } from 'cloudflare:test'
import { FEES_NEED_PAYOUT_ACCOUNT, LCA_RUN_ONLY } from '../../domain/events/creation'
import { LCA_RUN_NEEDS_MEMBERSHIP } from '../../domain/membership/requirement'
import { invoke, resetHarness } from './harness'
import {
  seedAdmin, seedClub, seedDirector, seedMember, seedPresident, seedRegistration, seedTournament, seedTournamentDirector,
} from './factories'

import { onRequestPost as createTournament } from '../../functions/api/admin/tournaments'
import { onRequestDelete as deleteTournament, onRequestPatch as patchTournament } from '../../functions/api/admin/tournaments/[id]'
import { onRequestGet as getManage } from '../../functions/api/admin/tournaments/[id]/manage'
import { onRequestGet as getRatingReport } from '../../functions/api/admin/tournaments/[id]/rating-report'
import { onRequestPatch as patchRegistration } from '../../functions/api/registrations/[id]'
import { onRequestPatch as patchMembership } from '../../functions/api/admin/members/[id]/membership'

const flags = vi.hoisted(() => ({ rolesOn: false, refuseFees: false }))
vi.mock('../../functions/utils/events/creation', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../functions/utils/events/creation')>()
  return {
    ...real,
    get CREATION_ROLES_ON() {
      return flags.rolesOn
    },
  }
})
vi.mock('../../domain/events/creation', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../domain/events/creation')>()
  return {
    ...real,
    canChargeFees: (...args: Parameters<typeof real.canChargeFees>) => !flags.refuseFees && real.canChargeFees(...args),
  }
})

beforeEach(resetHarness)
afterEach(() => {
  flags.rolesOn = false
  flags.refuseFees = false
  vi.restoreAllMocks()
})

/** The two states of CREATION_ROLES_ON, for the cases that run in both. */
const STATES: ReadonlyArray<readonly [string, boolean]> = [['unset', false], ['set', true]]

const tournamentBody = (clubId?: string) => ({
  name: 'Club Probe Open',
  location: 'Kenner, LA',
  date: '2026-10-10',
  entryFee: 20,
  ...(clubId ? { clubId } : {}),
})

async function clubOf(tournamentId: string) {
  const row = await env.DB.prepare('SELECT club_id, is_visible FROM tournaments WHERE id = ?')
    .bind(tournamentId).first<{ club_id: string | null; is_visible: number }>()
  return row
}

/** The columns of a new event the cases read. */
async function draftOf(tournamentId: string) {
  return env.DB.prepare('SELECT club_id, created_by, is_visible, requires_lca_membership FROM tournaments WHERE id = ?')
    .bind(tournamentId)
    .first<{ club_id: string | null; created_by: string | null; is_visible: number; requires_lca_membership: number }>()
}

/** The event's directors, as tournament_directors holds them. */
async function directorsOf(tournamentId: string): Promise<string[]> {
  const { results } = await env.DB.prepare('SELECT member_id FROM tournament_directors WHERE tournament_id = ? ORDER BY member_id')
    .bind(tournamentId).all<{ member_id: string }>()
  return results.map((r) => r.member_id)
}

/** The detail of the audit entry the create wrote for the event. */
async function auditDetailOf(tournamentId: string): Promise<unknown> {
  const row = await env.DB.prepare(
    "SELECT detail FROM admin_audit_log WHERE action = 'tournament_create' AND json_extract(detail, '$.tournament_id') = ?",
  ).bind(tournamentId).first<{ detail: string }>()
  return row ? JSON.parse(row.detail) : null
}

const countOf = async (sql: string) => (await env.DB.prepare(sql).first<{ n: number }>())?.n ?? 0
const eventCount = () => countOf('SELECT COUNT(*) AS n FROM tournaments')
const directorRowCount = () => countOf('SELECT COUNT(*) AS n FROM tournament_directors')

const create = (as: string, body: Record<string, unknown> = tournamentBody()) => invoke(createTournament, { method: 'POST', as, body })
const createdId = async (res: Awaited<ReturnType<typeof create>>) => (await res.json<{ tournament: { id: string } }>()).tournament.id

/** The president as the brief keeps the role: an LCA observer with a current term on the President seat. */
async function seedSeatedObserver(): Promise<string> {
  const id = await seedMember({ role: 'lca_observer' })
  await seedPresident(id)
  return id
}

describe('tournament creation with CREATION_ROLES_ON set (criterion 12, D20)', () => {
  beforeEach(() => {
    flags.rolesOn = true
  })

  it('a standing director creates an LCA-run hidden draft and is written as its first director, the audit entry naming the grant', async () => {
    const director = await seedDirector()
    const res = await create(director)
    expect(res.status).toBe(201)
    const id = await createdId(res)
    expect(await draftOf(id)).toEqual({ club_id: null, created_by: director, is_visible: 0, requires_lca_membership: 1 })
    expect(await directorsOf(id)).toEqual([director])
    expect(await auditDetailOf(id)).toEqual({ tournament_id: id, grant: 'standing_director' })
  })

  it('the president, an LCA observer who holds the seat, creates an LCA-run hidden draft and is written as its first director', async () => {
    const president = await seedSeatedObserver()
    const res = await create(president)
    expect(res.status).toBe(201)
    const id = await createdId(res)
    expect(await draftOf(id)).toEqual({ club_id: null, created_by: president, is_visible: 0, requires_lca_membership: 1 })
    expect(await directorsOf(id)).toEqual([president])
    expect(await auditDetailOf(id)).toEqual({ tournament_id: id, grant: 'president' })
  })

  it('the president and a standing director who name a club are refused with the LCA-run words, and nothing is written', async () => {
    const clubId = await seedClub()
    const people = [['the president', await seedSeatedObserver()], ['a standing director', await seedDirector()]] as const
    const events = await eventCount()
    const rows = await directorRowCount()
    for (const [name, as] of people) {
      const res = await create(as, tournamentBody(clubId))
      expect(res.status, name).toBe(403)
      expect(await res.json(), name).toEqual({ error: LCA_RUN_ONLY })
    }
    expect(await eventCount()).toBe(events)
    expect(await directorRowCount()).toBe(rows)
  })

  it('a standing director cannot create its LCA-run event without the LCA membership requirement (supports Q37)', async () => {
    const director = await seedDirector()
    const events = await eventCount()
    const res = await create(director, { ...tournamentBody(), requiresLcaMembership: false })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: LCA_RUN_NEEDS_MEMBERSHIP })
    expect(await eventCount()).toBe(events)
  })

  it('an LCA admin, and one who holds the seat, creates for a club and for none, as before, and is no event\'s director', async () => {
    const clubId = await seedClub()
    const seated = await seedAdmin()
    await seedPresident(seated)
    for (const admin of [await seedAdmin(), seated]) {
      for (const club of [clubId, undefined]) {
        const res = await create(admin, tournamentBody(club))
        expect(res.status).toBe(201)
        const id = await createdId(res)
        expect((await draftOf(id))?.club_id).toBe(club ?? null)
        expect(await directorsOf(id)).toEqual([])
        expect(await auditDetailOf(id)).toEqual({ tournament_id: id, grant: 'admin' })
      }
    }
  })

  it('a plain member, an officer and an observer who hold no seat, an auditor and a one-event director of another event are refused, and nothing is written', async () => {
    const elsewhere = await seedTournament({ isVisible: false })
    const oneEvent = await seedMember()
    await seedTournamentDirector(elsewhere, oneEvent)
    const people = [
      ['a plain member', await seedMember()],
      ['an officer who holds no seat', await seedMember({ role: 'lca_officer' })],
      ['an observer who holds no seat', await seedMember({ role: 'lca_observer' })],
      ['an auditor', await seedMember({ role: 'lca_auditor' })],
      ['a one-event director of another event', oneEvent],
    ] as const
    const events = await eventCount()
    for (const [name, as] of people) {
      const res = await create(as)
      expect(res.status, name).toBe(403)
      expect(await res.json(), name).toEqual({ error: 'Forbidden' })
    }
    expect(await eventCount()).toBe(events)
  })

  it('no creator is refused a fee above $0 on create: an LCA admin, the president, a standing director and a club rep each price an event (D24)', async () => {
    const clubId = await seedClub()
    const creators = [
      ['an LCA admin', await seedAdmin()],
      ['the president', await seedSeatedObserver()],
      ['a standing director', await seedDirector()],
      ['a club rep', await seedMember({ role: 'club_rep', clubId })],
    ] as const
    for (const [name, as] of creators) {
      const res = await create(as, { ...tournamentBody(), entryFee: 25, sections: [{ name: 'Open', entryFee: 40 }, { name: 'U1200', entryFee: 15 }] })
      expect(res.status, name).toBe(201)
      const { tournament } = await res.json<{ tournament: { entry_fee: number; sections: Array<{ name: string; entryFee: number }> } }>()
      expect(tournament.entry_fee, name).toBe(25)
      expect(tournament.sections.map((s) => [s.name, s.entryFee]), name).toEqual([['Open', 40], ['U1200', 15]])
    }
  })

  it('the fee check reads the event\'s fee and each section\'s: with canChargeFees made to refuse, a price above $0 anywhere is refused with the payout words, and a free event is not (D24)', async () => {
    flags.refuseFees = true
    const director = await seedDirector()
    const events = await eventCount()
    const priced: ReadonlyArray<readonly [string, Record<string, unknown>]> = [
      ['the event\'s fee, with no sections', { ...tournamentBody(), entryFee: 20 }],
      ['a section\'s own fee on a free event', { ...tournamentBody(), entryFee: 0, sections: [{ name: 'Open', entryFee: 0 }, { name: 'U1200', entryFee: 5 }] }],
      ['the event\'s fee, which a bare section name takes', { ...tournamentBody(), entryFee: 10, sections: ['Open'] }],
    ]
    for (const [name, body] of priced) {
      const res = await create(director, body)
      expect(res.status, name).toBe(403)
      expect(await res.json(), name).toEqual({ error: FEES_NEED_PAYOUT_ACCOUNT })
    }
    expect(await eventCount()).toBe(events)
    // A section whose fee is not a number takes the event's, as the section writer stores it.
    const free = await create(director, { ...tournamentBody(), entryFee: 0, sections: [{ name: 'Open', entryFee: 0 }, 'U1200', { name: 'U800', entryFee: '20' }] })
    expect(free.status).toBe(201)
    expect(await eventCount()).toBe(events + 1)
  })
})

describe('tournament creation with CREATION_ROLES_ON unset, as today (criterion 12)', () => {
  it('tournament directors and plain members cannot create tournaments, with CREATION_ROLES_ON unset, as today', async () => {
    for (const role of ['member', 'tournament_director', 'lca_auditor']) {
      const id = await seedMember({ role })
      const res = await invoke(createTournament, { method: 'POST', as: id, body: tournamentBody() })
      expect(res.status).toBe(403)
    }
  })

  it('a standing director and the president are refused, as today, and nothing is written', async () => {
    const people = [['a standing director', await seedDirector()], ['the president', await seedSeatedObserver()]] as const
    const events = await eventCount()
    for (const [name, as] of people) {
      const res = await create(as)
      expect(res.status, name).toBe(403)
      expect(await res.json(), name).toEqual({ error: 'Forbidden' })
    }
    expect(await eventCount()).toBe(events)
  })

  it('lca_admin can create for any club, and saves time control and close time', async () => {
    const adminId = await seedAdmin()
    const clubId = await seedClub()
    const res = await invoke(createTournament, {
      method: 'POST',
      as: adminId,
      body: {
        ...tournamentBody(clubId),
        timeControl: 'G/60+5',
        registrationClosesAt: '2026-10-09T18:00',
        customDetails: [{ title: 'Parking', body: 'Free in the back lot' }],
      },
    })
    expect(res.status).toBe(201)
    const { tournament } = await res.json<{
      tournament: { id: string; club_id: string; time_control: string; registration_closes_at: string; custom_details: string }
    }>()
    expect(tournament.club_id).toBe(clubId)
    expect(tournament.time_control).toBe('G/60+5')
    expect(tournament.registration_closes_at).toBe('2026-10-09T18:00')
    expect(JSON.parse(tournament.custom_details)).toHaveLength(1)
  })

  it('an LCA admin\'s create writes no director row and the audit entry as before, with no grant in it', async () => {
    const admin = await seedAdmin()
    const res = await create(admin)
    expect(res.status).toBe(201)
    const id = await createdId(res)
    expect(await directorsOf(id)).toEqual([])
    expect(await auditDetailOf(id)).toEqual({ tournament_id: id })
  })
})

describe.each(STATES)('club reps, with CREATION_ROLES_ON %s (Q2)', (_state, rolesOn) => {
  beforeEach(() => {
    flags.rolesOn = rolesOn
  })

  it('club_rep creates a hidden draft owned by their own club, and is no director of it', async () => {
    const clubId = await seedClub()
    const repId = await seedMember({ role: 'club_rep', clubId })
    const res = await invoke(createTournament, { method: 'POST', as: repId, body: tournamentBody() })
    expect(res.status).toBe(201)
    const { tournament } = await res.json<{ tournament: { id: string } }>()
    const row = await clubOf(tournament.id)
    expect(row?.club_id).toBe(clubId)
    expect(row?.is_visible).toBe(0)
    expect(await directorsOf(tournament.id)).toEqual([])
  })

  it('club_rep cannot create for another club', async () => {
    const own = await seedClub()
    const other = await seedClub()
    const repId = await seedMember({ role: 'club_rep', clubId: own })
    const res = await invoke(createTournament, { method: 'POST', as: repId, body: tournamentBody(other) })
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'Club reps can only create tournaments for their club' })
  })

  it('club_rep with no club is refused rather than creating an orphan', async () => {
    const repId = await seedMember({ role: 'club_rep' })
    const res = await invoke(createTournament, { method: 'POST', as: repId, body: tournamentBody() })
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'Your account is not linked to a club yet. Ask an LCA admin to assign you one.' })
  })

  it('a club_rep with no club who sends no name is answered 400, since the body is checked before the club', async () => {
    const repId = await seedMember({ role: 'club_rep' })
    const res = await create(repId, { ...tournamentBody(), name: '' })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'name, location, date, and entryFee are required' })
  })

  it('a club_rep cannot choose a custom tournament id', async () => {
    const clubId = await seedClub()
    const repId = await seedMember({ role: 'club_rep', clubId })
    const res = await invoke(createTournament, {
      method: 'POST', as: repId, body: { ...tournamentBody(), id: 'hand-picked-id' },
    })
    expect(res.status).toBe(201)
    const { tournament } = await res.json<{ tournament: { id: string } }>()
    expect(tournament.id).not.toBe('hand-picked-id')
  })

  it('a club_rep who holds the President seat creates its own club\'s hidden draft and no other club\'s, and is no director of it', async () => {
    const own = await seedClub()
    const other = await seedClub()
    const rep = await seedMember({ role: 'club_rep', clubId: own })
    await seedPresident(rep)
    const refused = await create(rep, tournamentBody(other))
    expect(refused.status).toBe(403)
    expect(await refused.json()).toEqual({ error: 'Club reps can only create tournaments for their club' })
    const res = await create(rep)
    expect(res.status).toBe(201)
    const id = await createdId(res)
    expect(await draftOf(id)).toEqual({ club_id: own, created_by: rep, is_visible: 0, requires_lca_membership: 0 })
    expect(await directorsOf(id)).toEqual([])
    expect(await auditDetailOf(id)).toEqual(rolesOn ? { tournament_id: id, grant: 'president' } : { tournament_id: id })
  })

  it('a club_rep with no club who holds the President seat is refused as any club rep with no club', async () => {
    const rep = await seedMember({ role: 'club_rep' })
    await seedPresident(rep)
    const events = await eventCount()
    const res = await create(rep)
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'Your account is not linked to a club yet. Ask an LCA admin to assign you one.' })
    expect(await eventCount()).toBe(events)
  })
})

describe.each(STATES)('a creator who has lost the grant, with CREATION_ROLES_ON %s (criterion 12, role safety)', (_state, rolesOn) => {
  beforeEach(() => {
    flags.rolesOn = rolesOn
  })

  it.each([
    ['a former club rep', 'club_rep'],
    ['a former LCA admin', 'lca_admin'],
  ] as const)('%s who created an event gets 403 on its setup save, its manage answer, an entry\'s payment change, its rating report and its delete', async (_name, role) => {
    const creator = await seedMember({ role, clubId: role === 'club_rep' ? await seedClub() : null })
    const res = await create(creator)
    expect(res.status).toBe(201)
    const event = await createdId(res)
    const entry = await seedRegistration({ tournamentId: event, memberId: await seedMember() })
    const paymentOf = async () =>
      (await env.DB.prepare('SELECT payment_status FROM registrations WHERE id = ?').bind(entry).first<{ payment_status: string }>())?.payment_status
    /** Records a cash payment, as a manager at the door may: neither a refund nor a card payment, which stay with an LCA admin. */
    const recordCash = (paymentStatus: 'pending' | 'paid') =>
      invoke(patchRegistration, { method: 'PATCH', as: creator, params: { id: entry }, body: { paymentStatus } })
    // While they hold the role, they run the event by it, with no director row:
    // the setup save, the manage answer, the entry's cash payment moved to
    // pending and back to paid, and the rating report all answer them.
    const renamed = await invoke(patchTournament, { method: 'PATCH', as: creator, params: { id: event }, body: { name: 'Bayou Open' } })
    expect(renamed.status).toBe(200)
    expect((await invoke(getManage, { as: creator, params: { id: event } })).status).toBe(200)
    expect((await recordCash('pending')).status).toBe(200)
    expect(await paymentOf()).toBe('pending')
    expect((await recordCash('paid')).status).toBe(200)
    expect((await invoke(getRatingReport, { as: creator, params: { id: event } })).status).toBe(200)
    expect(await directorsOf(event)).toEqual([])

    await env.DB.prepare("UPDATE members SET role = 'member', club_id = NULL WHERE id = ?").bind(creator).run()

    // The payment change asked now is the one they made while they held the
    // role, so its 403 is the manage check's and not the refund rule's.
    const answers = [
      ['its setup save', await invoke(patchTournament, { method: 'PATCH', as: creator, params: { id: event }, body: { name: 'Taken Over Open' } })],
      ['its manage answer', await invoke(getManage, { as: creator, params: { id: event } })],
      ['an entry\'s payment change', await recordCash('pending')],
      ['its rating report', await invoke(getRatingReport, { as: creator, params: { id: event } })],
      ['its delete', await invoke(deleteTournament, { method: 'DELETE', as: creator, params: { id: event } })],
    ] as const
    for (const [what, answer] of answers) {
      expect(answer.status, what).toBe(403)
      expect(await answer.json(), what).toEqual({ error: 'Forbidden' })
    }
    // The event, its name and the entry's payment are as they were.
    expect((await env.DB.prepare('SELECT name FROM tournaments WHERE id = ?').bind(event).first<{ name: string }>())?.name).toBe('Bayou Open')
    expect(await paymentOf()).toBe('paid')
  })
})

describe('membership PATCH derives status from expiry', () => {
  it('setting a past expiry with no status flips status to expired', async () => {
    const adminId = await seedAdmin()
    const memberId = await seedMember({ membershipStatus: 'active' })
    const res = await invoke(patchMembership, {
      method: 'PATCH',
      as: adminId,
      params: { id: memberId },
      body: { membershipExpiry: '2024-01-01' },
    })
    expect(res.status).toBe(200)
    const { member: updated } = (await res.json()) as { member: { membership_status: string } }
    expect(updated.membership_status).toBe('expired')
  })

  it('setting a future expiry with no status flips status to active', async () => {
    const adminId = await seedAdmin()
    const memberId = await seedMember({ membershipStatus: 'expired' })
    const res = await invoke(patchMembership, {
      method: 'PATCH',
      as: adminId,
      params: { id: memberId },
      body: { membershipExpiry: '2030-01-01' },
    })
    expect(res.status).toBe(200)
    const { member: updated } = (await res.json()) as { member: { membership_status: string } }
    expect(updated.membership_status).toBe('active')
  })

  it('an explicit status wins over the derived one', async () => {
    const adminId = await seedAdmin()
    const memberId = await seedMember({ membershipStatus: 'active' })
    const res = await invoke(patchMembership, {
      method: 'PATCH',
      as: adminId,
      params: { id: memberId },
      body: { membershipExpiry: '2030-01-01', membershipStatus: 'none' },
    })
    expect(res.status).toBe(200)
    const { member: updated } = (await res.json()) as { member: { membership_status: string } }
    expect(updated.membership_status).toBe('none')
  })
})
