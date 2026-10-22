// test/integration/requires-membership-edges.test.ts
// Edges around tournaments.requires_lca_membership that requires-membership
// .test.ts does not reach: the column as D1 holds it after the migrations,
// the club-run backfill of migration 0054 run on real rows and again, two
// saves at the same moment, a repeated save, values that are not true or
// false, the retired memberDiscount on its own, plain words in every refusal,
// and entering a club-run event with the requirement on or off.
import { env } from 'cloudflare:test'
import { beforeEach, describe, expect, it } from 'vitest'
import { contracts, errorBodySchema } from '../../domain/contracts'
import { LCA_RUN_NEEDS_MEMBERSHIP, requiresLcaMembership } from '../../domain/membership/requirement'
import { onRequestPost as createTournament } from '../../functions/api/admin/tournaments'
import { onRequestPatch as patchTournament } from '../../functions/api/admin/tournaments/[id]'
import { onRequestPost as registerPost } from '../../functions/api/registrations'
import { onRequestPost as batchPost } from '../../functions/api/registrations/batch'
import { migrationModules, splitSql } from './setup'
import { seedAdmin, seedClub, seedDirector, seedMember, seedTournament, seedTournamentDirector } from './factories'
import { expectContract, invoke, resetHarness } from './harness'

beforeEach(resetHarness)

const edit = contracts['admin/tournaments/[id]'].PATCH
const patch = (as: string | undefined, tournamentId: string, body: unknown) =>
  invoke(patchTournament, { method: 'PATCH', as, params: { id: tournamentId }, body })
const rowOf = (tournamentId: string) => env.DB.prepare('SELECT * FROM tournaments WHERE id = ?').bind(tournamentId).first<Record<string, unknown>>()
const flag = async (tournamentId: string) => (await rowOf(tournamentId))?.requires_lca_membership
const setFlag = (tournamentId: string, value: number) =>
  env.DB.prepare('UPDATE tournaments SET requires_lca_membership = ? WHERE id = ?').bind(value, tournamentId).run()

describe('the column as the migrations leave it', () => {
  it('is an integer, not null, defaulting to 1', async () => {
    const { results } = await env.DB.prepare(`PRAGMA table_info('tournaments')`).all<{ name: string; type: string; notnull: number; dflt_value: string | null }>()
    const column = results.find((c) => c.name === 'requires_lca_membership')
    expect(column).toMatchObject({ type: 'INTEGER', notnull: 1, dflt_value: '1' })
    // member_discount is still in the table, so no data is dropped.
    expect(results.some((c) => c.name === 'member_discount')).toBe(true)
  })

  it('a row inserted without it holds 1, and a null is refused', async () => {
    const tournamentId = await seedTournament()
    expect(await flag(tournamentId)).toBe(1)
    await expect(env.DB.prepare('UPDATE tournaments SET requires_lca_membership = NULL WHERE id = ?').bind(tournamentId).run()).rejects.toThrow()
    expect(await flag(tournamentId)).toBe(1)
  })
})

describe('the 0054 backfill on real rows', () => {
  const statements = () => {
    const file = Object.keys(migrationModules).find((p) => p.endsWith('0054_requires_lca_membership.sql'))
    expect(file).toBeTruthy()
    return splitSql(migrationModules[file as string])
  }
  const backfill = () => {
    const update = statements().find((s) => /^\s*UPDATE\b/i.test(s))
    expect(update).toBeTruthy()
    return update as string
  }

  it('the file is one ALTER that adds the column, then one UPDATE of the club-run events', () => {
    const all = statements()
    expect(all).toHaveLength(2)
    expect(all[0]).toMatch(/ALTER TABLE `tournaments` ADD `requires_lca_membership` integer DEFAULT 1 NOT NULL/)
    expect(backfill()).toMatch(/SET `requires_lca_membership` = 0 WHERE `club_id` IS NOT NULL/)
  })

  it('sets club-run events to 0, leaves LCA-run events at 1, and a run straight after changes nothing', async () => {
    const clubId = await seedClub()
    const clubEvent = await seedTournament({ clubId })
    const secondClubEvent = await seedTournament({ clubId: await seedClub() })
    const lcaEvent = await seedTournament()
    expect([await flag(clubEvent), await flag(secondClubEvent), await flag(lcaEvent)]).toEqual([1, 1, 1])

    const first = await env.DB.prepare(backfill()).run()
    expect(first.meta.changes).toBe(2)
    expect([await flag(clubEvent), await flag(secondClubEvent), await flag(lcaEvent)]).toEqual([0, 0, 1])

    const before = await env.DB.prepare('SELECT * FROM tournaments ORDER BY id').all()
    const second = await env.DB.prepare(backfill()).run()
    expect(second.meta.changes).toBe(0)
    expect((await env.DB.prepare('SELECT * FROM tournaments ORDER BY id').all()).results).toEqual(before.results)
  })

  it('touches no other column of the club-run rows', async () => {
    const clubEvent = await seedTournament({ clubId: await seedClub(), entryFee: 40 })
    await env.DB.prepare('UPDATE tournaments SET member_discount = 6 WHERE id = ?').bind(clubEvent).run()
    const before = await rowOf(clubEvent)
    await env.DB.prepare(backfill()).run()
    const after = await rowOf(clubEvent)
    expect({ ...after, requires_lca_membership: before?.requires_lca_membership }).toEqual(before)
    expect(after?.member_discount).toBe(6)
  })
})

describe('two saves at the same moment', () => {
  it('an edit that does not carry the field cannot undo another save that switched it on', async () => {
    const admin = await seedAdmin()
    for (let i = 0; i < 5; i++) {
      const tournamentId = await seedTournament({ clubId: await seedClub() })
      await setFlag(tournamentId, 0)
      const saves = [
        () => patch(admin, tournamentId, { name: `Renamed at the same time ${i}` }),
        () => patch(admin, tournamentId, { requiresLcaMembership: true }),
      ]
      const [first, second] = await Promise.all((i % 2 ? saves.reverse() : saves).map((save) => save()))
      expect([first.status, second.status]).toEqual([200, 200])
      expect(await flag(tournamentId), `round ${i}`).toBe(1)
    }
  })

  it('two opposite settings leave one of the two values, never an error or a mixed row', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament({ clubId: await seedClub() })
    const results = await Promise.all([
      patch(admin, tournamentId, { requiresLcaMembership: true }),
      patch(admin, tournamentId, { requiresLcaMembership: false }),
      patch(admin, tournamentId, { requiresLcaMembership: true }),
      patch(admin, tournamentId, { requiresLcaMembership: false }),
    ])
    expect(results.map((r) => r.status)).toEqual([200, 200, 200, 200])
    expect([0, 1]).toContain(await flag(tournamentId))
  })

  it('an admin taking the club off while the rep switches it off: both answer, and the event ends as one or the other, not a mix', async () => {
    const clubId = await seedClub()
    const tournamentId = await seedTournament({ clubId })
    await setFlag(tournamentId, 1)
    const rep = await seedMember({ role: 'club_rep', clubId })
    const [detach, switchOff] = await Promise.all([
      patch(await seedAdmin(), tournamentId, { clubId: null }),
      patch(rep, tournamentId, { requiresLcaMembership: false }),
    ])
    expect(detach.status).toBe(200)
    // The rep's save either ran first (the club was still there) or reached an
    // event with no club and was refused; the order decides the end state.
    expect([200, 400, 403]).toContain(switchOff.status)
    const row = await rowOf(tournamentId)
    expect([null, clubId]).toContain(row?.club_id)
    expect(requiresLcaMembership({ club_id: row?.club_id as string | null, requires_lca_membership: row?.requires_lca_membership as number })).toBe(row?.club_id == null || row?.requires_lca_membership === 1)
  })

  it('two creates at the same moment each get their own starting value', async () => {
    const admin = await seedAdmin()
    const clubId = await seedClub()
    const body = (over: Record<string, unknown>) => ({ name: 'Same Time Open', location: 'Kenner, LA', date: '2026-10-24', entryFee: 20, ...over })
    const [lca, club] = await Promise.all([
      invoke(createTournament, { method: 'POST', as: admin, body: body({}) }),
      invoke(createTournament, { method: 'POST', as: admin, body: body({ clubId }) }),
    ])
    const create = contracts['admin/tournaments'].POST.response
    expect((await expectContract(lca, create)).tournament.requires_lca_membership).toBe(1)
    expect((await expectContract(club, create)).tournament.requires_lca_membership).toBe(0)
  })
})

describe('a repeated save', () => {
  it('sending the same value again answers the same and changes nothing', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament({ clubId: await seedClub() })
    const first = await patch(admin, tournamentId, { requiresLcaMembership: true })
    const afterFirst = await rowOf(tournamentId)
    const second = await patch(admin, tournamentId, { requiresLcaMembership: true })
    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    expect((await expectContract(second, edit.response)).tournament.requires_lca_membership).toBe(1)
    const afterSecond = await rowOf(tournamentId)
    expect({ ...afterSecond, updated_at: null }).toEqual({ ...afterFirst, updated_at: null })
  })

  it('the rep sending false twice stays at 0, and a refused attempt in between changes nothing', async () => {
    const clubId = await seedClub()
    const tournamentId = await seedTournament({ clubId })
    const rep = await seedMember({ role: 'club_rep', clubId })
    expect((await patch(rep, tournamentId, { requiresLcaMembership: false })).status).toBe(200)
    expect((await patch(await seedDirector(), tournamentId, { requiresLcaMembership: true })).status).toBe(403)
    expect((await patch(rep, tournamentId, { requiresLcaMembership: false })).status).toBe(200)
    expect(await flag(tournamentId)).toBe(0)
  })
})

describe('values that are not true or false', () => {
  it.each([['"no"', 'no'], ['1', 1], ['0', 0], ['null', null], ['an object', {}]])('an edit with %s is 400 with fields, and nothing is written', async (_label, value) => {
    const tournamentId = await seedTournament({ clubId: await seedClub() })
    const before = await rowOf(tournamentId)
    const res = await patch(await seedAdmin(), tournamentId, { name: 'Should not save', requiresLcaMembership: value })
    expect(res.status).toBe(400)
    expect(Object.keys(await res.json())).toEqual(['error', 'fields'])
    expect(await rowOf(tournamentId)).toEqual(before)
  })

  it.each([['1', 1], ['null', null]])('a create with %s is 400, and no event is made', async (_label, value) => {
    const count = async () => (await env.DB.prepare('SELECT COUNT(*) AS n FROM tournaments').first<{ n: number }>())?.n
    const before = await count()
    const res = await invoke(createTournament, {
      method: 'POST', as: await seedAdmin(), body: { name: 'Odd Value Open', location: 'Kenner, LA', date: '2026-10-24', entryFee: 20, clubId: await seedClub(), requiresLcaMembership: value },
    })
    expect(res.status).toBe(400)
    expect(await count()).toBe(before)
  })
})

describe('the retired memberDiscount does not trip the role rule', () => {
  it('an assigned director who sends memberDiscount alone saves the rest with 200', async () => {
    const tournamentId = await seedTournament({ clubId: await seedClub() })
    const director = await seedDirector()
    await seedTournamentDirector(tournamentId, director)
    await env.DB.prepare('UPDATE tournaments SET member_discount = 4 WHERE id = ?').bind(tournamentId).run()
    const res = await patch(director, tournamentId, { memberDiscount: 9, name: 'Director edit' })
    expect(res.status).toBe(200)
    expect(await rowOf(tournamentId)).toMatchObject({ name: 'Director edit', member_discount: 4 })
  })

  it('sent together with the requirement, the director is still refused and nothing is saved', async () => {
    const tournamentId = await seedTournament({ clubId: await seedClub() })
    const director = await seedDirector()
    await seedTournamentDirector(tournamentId, director)
    const before = await rowOf(tournamentId)
    const res = await patch(director, tournamentId, { memberDiscount: 9, name: 'Director edit', requiresLcaMembership: true })
    expect(res.status).toBe(403)
    expect(await rowOf(tournamentId)).toEqual(before)
  })
})

describe('every refusal is in plain words', () => {
  it('names no column, no old rating-body name and no decimal half', async () => {
    const clubId = await seedClub()
    const clubEvent = await seedTournament({ clubId })
    const lcaEvent = await seedTournament()
    const director = await seedDirector()
    await seedTournamentDirector(clubEvent, director)
    const messages: string[] = []
    const keep = async (res: Response) => {
      expect([400, 403]).toContain(res.status)
      messages.push((await expectContract(res, errorBodySchema)).error)
    }
    await keep(await patch(director, clubEvent, { requiresLcaMembership: true }))
    await keep(await patch(await seedMember({ role: 'club_rep', clubId: await seedClub() }), clubEvent, { requiresLcaMembership: true }))
    await keep(await patch(await seedAdmin(), lcaEvent, { requiresLcaMembership: false }))
    await keep(await invoke(createTournament, { method: 'POST', as: await seedAdmin(), body: { name: 'Plain Words', location: 'Kenner, LA', date: '2026-10-24', entryFee: 20, requiresLcaMembership: false } }))
    expect(messages).toContain(LCA_RUN_NEEDS_MEMBERSHIP)
    for (const message of messages) {
      expect(message).not.toMatch(/requires_lca_membership|requiresLcaMembership|club_id|uscf|\d\.5\b|undefined|null/i)
      expect(message).toMatch(/^[A-Z].*[^.]$|\.$/)
    }
  })
})

describe('entering a club-run event', () => {
  it('a player with no membership enters, alone or with a family, whether the requirement is on or off', async () => {
    for (const required of [0, 1]) {
      const tournamentId = await seedTournament({ clubId: await seedClub(), sections: [{ name: 'Open', entryFee: 0 }] })
      await setFlag(tournamentId, required)
      const single = await invoke(registerPost, { method: 'POST', as: await seedMember({ membershipStatus: 'expired' }), body: { tournamentId, section: 'Open' } })
      expect(single.status, `single, requirement ${required}`).toBe(201)

      const parent = await seedMember({ membershipStatus: 'pending' })
      const child = await seedMember({ membershipStatus: 'pending' })
      await env.DB.prepare('UPDATE members SET guardian_id = ? WHERE id = ?').bind(parent, child).run()
      const family = await invoke(batchPost, { method: 'POST', as: parent, body: { tournamentId, entries: [{ section: 'Open' }, { memberId: child, section: 'Open' }] } })
      expect(family.status, `family, requirement ${required}`).toBe(201)
    }
  })
})
