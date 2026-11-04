// test/integration/tournament-create-former-grant.test.ts
//
// Criterion 12's role-safety half (WS08 step 3): a creator who holds no
// director row and has lost the grant that let them create keeps nothing on
// the event, with CREATION_ROLES_ON unset and set. Each creator first runs
// the event by their role, so each refusal after the loss is the role's and
// not some other rule's:
// - while they hold it, the setup save, the manage answer, a cash payment
//   recorded at the door and the rating report answer them;
// - once it is gone (a club rep made a member with its club taken off or
//   kept, a club rep moved to another club, an LCA admin made a member or an
//   auditor), the same four and the delete are refused with the plain
//   "Forbidden", never any of the event's data, and the event, its name and
//   the entry's payment are as they were;
// - with the constant set, a grant held since gives nothing on the old
//   event either: a former club rep made a standing director, and a former
//   LCA admin who now holds the President seat as a member, have no
//   director row on it, so they are refused it as well, while each may
//   create an LCA-run event of their own.
// The payment change asked after the loss is one the creator could make
// while it held the role (cash, paid back to pending), so its 403 is the
// manage check's, not the refund rule's.
// CREATION_ROLES_ON is false in the tree. It is read here through a getter on
// the mocked module, so each case runs in the state its name gives.
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { onRequestPost as createTournament } from '../../functions/api/admin/tournaments'
import { onRequestDelete as deleteTournament, onRequestPatch as patchTournament } from '../../functions/api/admin/tournaments/[id]'
import { onRequestGet as getManage } from '../../functions/api/admin/tournaments/[id]/manage'
import { onRequestGet as getRatingReport } from '../../functions/api/admin/tournaments/[id]/rating-report'
import { onRequestPatch as patchRegistration } from '../../functions/api/registrations/[id]'
import { seedClub, seedMember, seedPresident, seedRegistration } from './factories'
import { invoke, resetHarness } from './harness'

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
  vi.restoreAllMocks()
})

const STATES: ReadonlyArray<readonly [string, boolean]> = [['unset', false], ['set', true]]

let seq = 0

async function createAs(as: string): Promise<string> {
  const res = await invoke(createTournament, {
    method: 'POST', as, body: { name: `Former grant probe ${++seq}`, location: 'Houma, LA', date: '2026-12-12', entryFee: 15 },
  })
  expect(res.status).toBe(201)
  return (await res.json<{ tournament: { id: string } }>()).tournament.id
}

const rowOf = (event: string) =>
  env.DB.prepare('SELECT name, venue FROM tournaments WHERE id = ?').bind(event).first<{ name: string; venue: string | null }>()
const paymentOf = async (entry: string) =>
  (await env.DB.prepare('SELECT payment_status FROM registrations WHERE id = ?').bind(entry).first<{ payment_status: string }>())?.payment_status
const directorRowsOf = async (member: string) =>
  (await env.DB.prepare('SELECT COUNT(*) AS n FROM tournament_directors WHERE member_id = ?').bind(member).first<{ n: number }>())?.n ?? 0

/** The event's five endpoints the criterion names, as a person asks them. */
async function fiveAnswers(as: string, event: string, entry: string) {
  return [
    ['its setup save', await invoke(patchTournament, { method: 'PATCH', as, params: { id: event }, body: { venue: 'Taken over' } })],
    ['its manage answer', await invoke(getManage, { as, params: { id: event } })],
    ['an entry\'s payment change', await invoke(patchRegistration, { method: 'PATCH', as, params: { id: entry }, body: { paymentStatus: 'pending' } })],
    ['its rating report', await invoke(getRatingReport, { as, params: { id: event } })],
    ['its delete', await invoke(deleteTournament, { method: 'DELETE', as, params: { id: event } })],
  ] as const
}

/** Runs the event by the role it was created with, so a refusal after the loss is the role's. */
async function runWhileHeld(as: string, event: string, entry: string): Promise<void> {
  const save = await invoke(patchTournament, { method: 'PATCH', as, params: { id: event }, body: { venue: 'Held by the creator' } })
  expect(save.status, 'the setup save while held').toBe(200)
  expect((await invoke(getManage, { as, params: { id: event } })).status, 'the manage answer while held').toBe(200)
  const cash = await invoke(patchRegistration, { method: 'PATCH', as, params: { id: entry }, body: { paymentStatus: 'paid' } })
  expect(cash.status, 'cash recorded at the door while held').toBe(200)
  expect(await paymentOf(entry)).toBe('paid')
  expect((await invoke(getRatingReport, { as, params: { id: event } })).status, 'the rating report while held').toBe(200)
}

async function expectKeepsNothing(as: string, event: string, entry: string): Promise<void> {
  for (const [what, res] of await fiveAnswers(as, event, entry)) {
    expect(res.status, what).toBe(403)
    expect(await res.json(), what).toEqual({ error: 'Forbidden' })
  }
  expect(await rowOf(event)).toMatchObject({ venue: 'Held by the creator' })
  expect(await paymentOf(entry)).toBe('paid')
  expect(await directorRowsOf(as)).toBe(0)
}

describe.each(STATES)('a creator who has lost the grant, with CREATION_ROLES_ON %s (criterion 12, role safety)', (_state, rolesOn) => {
  beforeEach(() => {
    flags.rolesOn = rolesOn
  })

  it.each([
    ['a club rep made a member, its club taken off', 'club_rep', "UPDATE members SET role = 'member', club_id = NULL WHERE id = ?"],
    ['a club rep made a member, its club kept on the account', 'club_rep', "UPDATE members SET role = 'member' WHERE id = ?"],
    ['an LCA admin made a member', 'lca_admin', "UPDATE members SET role = 'member' WHERE id = ?"],
    ['an LCA admin made an auditor', 'lca_admin', "UPDATE members SET role = 'lca_auditor' WHERE id = ?"],
  ] as const)('%s ran the event by the role, and keeps nothing on it once the role is gone', async (_who, role, loss) => {
    const creator = await seedMember({ role, clubId: role === 'club_rep' ? await seedClub() : null })
    const event = await createAs(creator)
    const entry = await seedRegistration({ tournamentId: event, memberId: await seedMember(), paymentStatus: 'pending' })
    await runWhileHeld(creator, event, entry)
    await env.DB.prepare(loss).bind(creator).run()
    await expectKeepsNothing(creator, event, entry)
  })

  it('a club rep moved to another club keeps nothing on its first club\'s event, and manages the new club\'s as before', async () => {
    const first = await seedClub()
    const next = await seedClub()
    const rep = await seedMember({ role: 'club_rep', clubId: first })
    const event = await createAs(rep)
    const entry = await seedRegistration({ tournamentId: event, memberId: await seedMember(), paymentStatus: 'pending' })
    await runWhileHeld(rep, event, entry)
    await env.DB.prepare('UPDATE members SET club_id = ? WHERE id = ?').bind(next, rep).run()
    await expectKeepsNothing(rep, event, entry)
    const own = await createAs(rep)
    expect((await env.DB.prepare('SELECT club_id FROM tournaments WHERE id = ?').bind(own).first<{ club_id: string }>())?.club_id).toBe(next)
  })
})

describe('with CREATION_ROLES_ON set, a grant held since gives nothing on the old event (criterion 12, role safety)', () => {
  beforeEach(() => {
    flags.rolesOn = true
  })

  it('a former club rep made a standing director has no row on its club\'s event and is refused it, while it creates an LCA-run event of its own', async () => {
    const rep = await seedMember({ role: 'club_rep', clubId: await seedClub() })
    const event = await createAs(rep)
    const entry = await seedRegistration({ tournamentId: event, memberId: await seedMember(), paymentStatus: 'pending' })
    await runWhileHeld(rep, event, entry)
    await env.DB.prepare("UPDATE members SET role = 'tournament_director', club_id = NULL WHERE id = ?").bind(rep).run()
    await expectKeepsNothing(rep, event, entry)
    const own = await createAs(rep)
    const rows = (await env.DB.prepare('SELECT tournament_id FROM tournament_directors WHERE member_id = ?').bind(rep).all<{ tournament_id: string }>()).results
    expect(rows.map((r) => r.tournament_id)).toEqual([own])
  })

  it('a former LCA admin who now holds the President seat as a member has no row on the event it created as an admin and is refused it', async () => {
    const admin = await seedMember({ role: 'lca_admin' })
    const event = await createAs(admin)
    const entry = await seedRegistration({ tournamentId: event, memberId: await seedMember(), paymentStatus: 'pending' })
    await runWhileHeld(admin, event, entry)
    await env.DB.prepare("UPDATE members SET role = 'member' WHERE id = ?").bind(admin).run()
    await seedPresident(admin)
    await expectKeepsNothing(admin, event, entry)
  })
})
