// test/integration/requires-membership.test.ts
// tournaments.requires_lca_membership (decision D12, applied with the
// decisions K made on October 8): on by default, and always on for an event
// LCA runs itself (no club); a club-run event starts with it off, existing
// (migration 0054) and new (the admin create), unless told otherwise. It
// round-trips through the admin create and edit and every GET that answers a
// tournament. Only an LCA admin or the rep of the organizing club may change
// it: an assigned director, who may otherwise edit the event, gets 403 for
// this field, and so does another club's rep. Nothing turns a player away
// yet; enforcement at checkout is WS06's.
import { env } from 'cloudflare:test'
import { beforeEach, describe, expect, it } from 'vitest'
import { contracts, errorBodySchema } from '../../domain/contracts'
import { LCA_RUN_NEEDS_MEMBERSHIP } from '../../domain/membership/requirement'
import { onRequestPost as createTournament } from '../../functions/api/admin/tournaments'
import { onRequestPatch as patchTournament } from '../../functions/api/admin/tournaments/[id]'
import { onRequestGet as manageGet } from '../../functions/api/admin/tournaments/[id]/manage'
import { onRequestGet as tournamentGet } from '../../functions/api/tournaments/[id]'
import { onRequestGet as tournamentsGet } from '../../functions/api/tournaments'
import { onRequestPost as registerPost } from '../../functions/api/registrations'
import { seedAdmin, seedClub, seedDirector, seedMember, seedTournament, seedTournamentDirector } from './factories'
import { expectContract, invoke, resetHarness } from './harness'

beforeEach(resetHarness)

const create = contracts['admin/tournaments'].POST
const edit = contracts['admin/tournaments/[id]'].PATCH
const FORBIDDEN_FIELD = "Only the organizing club's rep or an LCA admin can change whether an LCA membership is required"

const stored = async (tournamentId: string) =>
  (await env.DB.prepare('SELECT requires_lca_membership AS v FROM tournaments WHERE id = ?').bind(tournamentId).first<{ v: number }>())?.v
const rowOf = (tournamentId: string) => env.DB.prepare('SELECT * FROM tournaments WHERE id = ?').bind(tournamentId).first()
const tournamentCount = async () =>
  (await env.DB.prepare('SELECT COUNT(*) AS n FROM tournaments').first<{ n: number }>())?.n

const newEvent = (over: Record<string, unknown> = {}) => ({ name: 'Requirement Open', location: 'Kenner, LA', date: '2026-10-24', entryFee: 20, ...over })

/** A club-run event as migration 0054 leaves one: the requirement off. */
async function clubEvent(clubId: string): Promise<string> {
  const tournamentId = await seedTournament({ clubId })
  await env.DB.prepare('UPDATE tournaments SET requires_lca_membership = 0 WHERE id = ?').bind(tournamentId).run()
  return tournamentId
}

const patch = (as: string | undefined, tournamentId: string, body: Record<string, unknown>) =>
  invoke(patchTournament, { method: 'PATCH', as, params: { id: tournamentId }, body })

describe('the admin create sets the starting value', () => {
  it('an LCA-run event requires a membership', async () => {
    const res = await invoke(createTournament, { method: 'POST', as: await seedAdmin(), body: newEvent() })
    expect(res.status).toBe(201)
    const { tournament } = await expectContract(res, create.response)
    expect(tournament.club_id).toBeNull()
    expect(tournament.requires_lca_membership).toBe(1)
    expect(await stored(tournament.id)).toBe(1)
  })

  it('a club-run event made by an admin starts with it off, unless the body asks for it', async () => {
    const admin = await seedAdmin()
    const clubId = await seedClub()
    const off = await expectContract(await invoke(createTournament, { method: 'POST', as: admin, body: newEvent({ clubId }) }), create.response)
    expect(off.tournament.requires_lca_membership).toBe(0)
    const on = await expectContract(
      await invoke(createTournament, { method: 'POST', as: admin, body: newEvent({ clubId, requiresLcaMembership: true }) }),
      create.response,
    )
    expect(on.tournament.requires_lca_membership).toBe(1)
    expect(await stored(on.tournament.id)).toBe(1)
  })

  it("a club rep's event starts with it off, and the rep may ask for it on", async () => {
    const clubId = await seedClub()
    const rep = await seedMember({ role: 'club_rep', clubId })
    const off = await expectContract(await invoke(createTournament, { method: 'POST', as: rep, body: newEvent() }), create.response)
    expect(off.tournament.club_id).toBe(clubId)
    expect(off.tournament.requires_lca_membership).toBe(0)
    const on = await expectContract(await invoke(createTournament, { method: 'POST', as: rep, body: newEvent({ requiresLcaMembership: true }) }), create.response)
    expect(on.tournament.requires_lca_membership).toBe(1)
    const offAgain = await expectContract(await invoke(createTournament, { method: 'POST', as: rep, body: newEvent({ requiresLcaMembership: false }) }), create.response)
    expect(offAgain.tournament.requires_lca_membership).toBe(0)
  })

  it('switching it off on an LCA-run event is 400 in plain words, and nothing is created', async () => {
    const before = await tournamentCount()
    const res = await invoke(createTournament, { method: 'POST', as: await seedAdmin(), body: newEvent({ requiresLcaMembership: false }) })
    expect(res.status).toBe(400)
    expect(await expectContract(res, errorBodySchema)).toEqual({ error: LCA_RUN_NEEDS_MEMBERSHIP })
    expect(await tournamentCount()).toBe(before)
  })

  it('a value that is not true or false is 400 with fields', async () => {
    const res = await invoke(createTournament, { method: 'POST', as: await seedAdmin(), body: newEvent({ requiresLcaMembership: 'no' }) })
    expect(res.status).toBe(400)
    expect(Object.keys(await res.json())).toEqual(['error', 'fields'])
  })

  it('a director, a plain member and no sign-in still cannot create', async () => {
    const before = await tournamentCount()
    expect((await invoke(createTournament, { method: 'POST', as: await seedDirector(), body: newEvent({ requiresLcaMembership: true }) })).status).toBe(403)
    expect((await invoke(createTournament, { method: 'POST', as: await seedMember(), body: newEvent({ requiresLcaMembership: true }) })).status).toBe(403)
    expect((await invoke(createTournament, { method: 'POST', body: newEvent({ requiresLcaMembership: true }) })).status).toBe(401)
    expect(await tournamentCount()).toBe(before)
  })
})

describe('the admin edit changes it', () => {
  it('an admin switches it on and off on a club-run event, and it round-trips through every GET', async () => {
    const admin = await seedAdmin()
    const clubId = await seedClub()
    const tournamentId = await clubEvent(clubId)

    const on = await patch(admin, tournamentId, { requiresLcaMembership: true })
    expect(on.status).toBe(200)
    expect((await expectContract(on, edit.response)).tournament.requires_lca_membership).toBe(1)
    expect(await stored(tournamentId)).toBe(1)

    const detail = await expectContract(await invoke(tournamentGet, { params: { id: tournamentId } }), contracts['tournaments/[id]'].GET.response)
    expect(detail.tournament.requires_lca_membership).toBe(1)
    const manage = await expectContract(await invoke(manageGet, { as: admin, params: { id: tournamentId } }), contracts['admin/tournaments/[id]/manage'].GET.response)
    expect(manage.tournament.requires_lca_membership).toBe(1)

    const off = await patch(admin, tournamentId, { requiresLcaMembership: false })
    expect((await expectContract(off, edit.response)).tournament.requires_lca_membership).toBe(0)
    const list = await expectContract(await invoke(tournamentsGet, { path: '/api/tournaments' }), contracts['tournaments'].GET.response)
    expect(list.tournaments.find((t) => t.id === tournamentId)?.requires_lca_membership).toBe(0)
  })

  it("the owning club's rep may change it", async () => {
    const clubId = await seedClub()
    const tournamentId = await clubEvent(clubId)
    const rep = await seedMember({ role: 'club_rep', clubId })
    const res = await patch(rep, tournamentId, { requiresLcaMembership: true })
    expect(res.status).toBe(200)
    expect((await expectContract(res, edit.response)).tournament.requires_lca_membership).toBe(1)
    expect((await expectContract(await patch(rep, tournamentId, { requiresLcaMembership: false }), edit.response)).tournament.requires_lca_membership).toBe(0)
  })

  it('an edit that leaves it out keeps it as it is', async () => {
    const clubId = await seedClub()
    const tournamentId = await clubEvent(clubId)
    const res = await patch(await seedAdmin(), tournamentId, { name: 'Renamed' })
    expect((await expectContract(res, edit.response)).tournament.requires_lca_membership).toBe(0)
    const lcaRun = await seedTournament()
    expect((await expectContract(await patch(await seedAdmin(), lcaRun, { name: 'Renamed' }), edit.response)).tournament.requires_lca_membership).toBe(1)
  })

  it('switching it off on an LCA-run event is 400, and nothing in the edit is written', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament()
    const before = await rowOf(tournamentId)
    const res = await patch(admin, tournamentId, { name: 'Should not save', requiresLcaMembership: false })
    expect(res.status).toBe(400)
    expect(await expectContract(res, errorBodySchema)).toEqual({ error: LCA_RUN_NEEDS_MEMBERSHIP })
    expect(await rowOf(tournamentId)).toEqual(before)
    // Asking for it on, where it is always on, is fine.
    expect((await expectContract(await patch(admin, tournamentId, { requiresLcaMembership: true }), edit.response)).tournament.requires_lca_membership).toBe(1)
  })

  it('an admin who takes the club off an event turns the requirement on; doing that and switching it off is 400', async () => {
    const admin = await seedAdmin()
    const clubId = await seedClub()
    const first = await clubEvent(clubId)
    const refused = await patch(admin, first, { clubId: null, requiresLcaMembership: false })
    expect(refused.status).toBe(400)
    expect(await expectContract(refused, errorBodySchema)).toEqual({ error: LCA_RUN_NEEDS_MEMBERSHIP })
    expect(await rowOf(first)).toMatchObject({ club_id: clubId, requires_lca_membership: 0 })

    const detached = await expectContract(await patch(admin, first, { clubId: null }), edit.response)
    expect(detached.tournament).toMatchObject({ club_id: null, requires_lca_membership: 1 })
  })

  it('an admin who moves an LCA-run event to a club keeps the requirement as it was until it is changed', async () => {
    const admin = await seedAdmin()
    const clubId = await seedClub()
    const tournamentId = await seedTournament()
    const moved = await expectContract(await patch(admin, tournamentId, { clubId }), edit.response)
    expect(moved.tournament).toMatchObject({ club_id: clubId, requires_lca_membership: 1 })
    const both = await expectContract(await patch(admin, tournamentId, { clubId, requiresLcaMembership: false }), edit.response)
    expect(both.tournament.requires_lca_membership).toBe(0)
  })
})

describe('role safety on the requirement', () => {
  it('an assigned director who is neither the club rep nor an admin gets 403 for this field, and may still edit the rest', async () => {
    const clubId = await seedClub()
    const tournamentId = await clubEvent(clubId)
    const director = await seedDirector()
    const assignedMember = await seedMember()
    await seedTournamentDirector(tournamentId, director)
    await seedTournamentDirector(tournamentId, assignedMember)
    const before = await rowOf(tournamentId)
    for (const who of [director, assignedMember]) {
      for (const value of [true, false]) {
        const res = await patch(who, tournamentId, { name: 'Should not save', requiresLcaMembership: value })
        expect(res.status, `${who} ${value}`).toBe(403)
        expect(await expectContract(res, errorBodySchema)).toEqual({ error: FORBIDDEN_FIELD })
      }
    }
    expect(await rowOf(tournamentId)).toEqual(before)
    // The same director without the field edits as before.
    const ok = await patch(director, tournamentId, { name: 'Edited by the director' })
    expect(ok.status).toBe(200)
    expect((await expectContract(ok, edit.response)).tournament).toMatchObject({ name: 'Edited by the director', requires_lca_membership: 0 })
  })

  it("another club's rep gets 403, even when assigned as the event's director", async () => {
    const clubId = await seedClub()
    const otherClub = await seedClub()
    const tournamentId = await clubEvent(clubId)
    const otherRep = await seedMember({ role: 'club_rep', clubId: otherClub })
    const before = await rowOf(tournamentId)

    const stranger = await patch(otherRep, tournamentId, { requiresLcaMembership: true })
    expect(stranger.status).toBe(403)
    await expectContract(stranger, errorBodySchema)

    await seedTournamentDirector(tournamentId, otherRep)
    const assigned = await patch(otherRep, tournamentId, { requiresLcaMembership: true })
    expect(assigned.status).toBe(403)
    expect(await expectContract(assigned, errorBodySchema)).toEqual({ error: FORBIDDEN_FIELD })
    expect(await rowOf(tournamentId)).toEqual(before)
  })

  it('a club rep assigned to direct an LCA-run event gets 403 for this field', async () => {
    const clubId = await seedClub()
    const tournamentId = await seedTournament()
    const rep = await seedMember({ role: 'club_rep', clubId })
    await seedTournamentDirector(tournamentId, rep)
    const res = await patch(rep, tournamentId, { requiresLcaMembership: true })
    expect(res.status).toBe(403)
    expect(await expectContract(res, errorBodySchema)).toEqual({ error: FORBIDDEN_FIELD })
  })

  it('a plain member gets 403 and no sign-in gets 401, and the value is unchanged', async () => {
    const clubId = await seedClub()
    const tournamentId = await clubEvent(clubId)
    const member = await patch(await seedMember(), tournamentId, { requiresLcaMembership: true })
    expect(member.status).toBe(403)
    await expectContract(member, errorBodySchema)
    const anonymous = await patch(undefined, tournamentId, { requiresLcaMembership: true })
    expect(anonymous.status).toBe(401)
    await expectContract(anonymous, errorBodySchema)
    expect(await stored(tournamentId)).toBe(0)
  })
})

describe('nothing is enforced at entry yet', () => {
  it('a player without a membership can still enter an event that requires one (the checkout step is WS06)', async () => {
    const tournamentId = await seedTournament({ sections: [{ name: 'Open', entryFee: 0 }] })
    expect(await stored(tournamentId)).toBe(1)
    const res = await invoke(registerPost, { method: 'POST', as: await seedMember({ membershipStatus: 'pending' }), body: { tournamentId, section: 'Open' } })
    expect(res.status).toBe(201)
  })
})
