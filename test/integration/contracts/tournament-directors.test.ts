// test/integration/contracts/tournament-directors.test.ts
//
// GET, POST and DELETE /api/admin/tournaments/[id]/directors keep their
// contracts (domain/contracts/events.ts), given in WS09 step 17 when the
// endpoint left test/unit/contracts-pending.ts:
// - each method's answer is the event's directors, every key named and
//   nothing more, after the naming or the removal for the two writes;
// - the request carries the member's id, read through parseBody: a body
//   without it is still answered "memberId is required", and a body that is
//   not JSON gets parseBody's own words;
// - the answer's contract refuses a key it does not name, at the top and in
//   a director's row;
// - the refusals keep the plain { error } body.
import { beforeEach, describe, expect, it } from 'vitest'
import { contracts, errorBodySchema, fieldErrorBodySchema } from '../../../domain/contracts'
import {
  onRequestDelete as removeDirector,
  onRequestGet as getDirectors,
  onRequestPost as assignDirector,
} from '../../../functions/api/admin/tournaments/[id]/directors'
import { seedAdmin, seedClub, seedMember, seedTournament, seedTournamentDirector } from '../factories'
import { expectContract, invoke, resetHarness } from '../harness'

beforeEach(resetHarness)

const list = contracts['admin/tournaments/[id]/directors'].GET
const name = contracts['admin/tournaments/[id]/directors'].POST
const unname = contracts['admin/tournaments/[id]/directors'].DELETE

async function world() {
  const admin = await seedAdmin()
  const club = await seedClub({ name: 'Example Chess Club' })
  const event = await seedTournament({ clubId: club, entryFee: 0 })
  const director = await seedMember({ fullName: 'Player One', email: 'player.one@example.org' })
  return { admin, club, event, director }
}

describe('the directors endpoint keeps its contracts', () => {
  it('GET answers every director of the event under its contract, each row with its five keys', async () => {
    const { admin, event, director } = await world()
    await seedTournamentDirector(event, director)
    const answer = await expectContract(await invoke(getDirectors, { as: admin, params: { id: event } }), list.response)
    expect(answer.directors).toHaveLength(1)
    expect(answer.directors[0]).toMatchObject({ tournament_id: event, member_id: director, full_name: 'Player One', email: 'player.one@example.org' })
    expect(Object.keys(answer.directors[0]).sort()).toEqual(['assigned_at', 'email', 'full_name', 'member_id', 'tournament_id'])
  })

  it('POST names a director, 201, with the request its contract gives and the list after the naming under its contract', async () => {
    const { admin, event, director } = await world()
    const body = { memberId: director }
    expect(name.request.safeParse(body).success).toBe(true)
    const res = await invoke(assignDirector, { method: 'POST', as: admin, params: { id: event }, body })
    expect(res.status).toBe(201)
    const answer = await expectContract(res, name.response)
    expect(answer.directors.map((d) => d.member_id)).toEqual([director])
  })

  it('DELETE removes a director, 200, with the list after the removal under its contract', async () => {
    const { admin, event, director } = await world()
    await seedTournamentDirector(event, director)
    const body = { memberId: director }
    expect(unname.request.safeParse(body).success).toBe(true)
    const res = await invoke(removeDirector, { method: 'DELETE', as: admin, params: { id: event }, body })
    expect(res.status).toBe(200)
    expect(await expectContract(res, unname.response)).toEqual({ directors: [] })
  })

  it('reads the body through parseBody: no member id keeps the endpoint\'s own words, a body that is not JSON gets parseBody\'s, and a member id that is not text is a field error', async () => {
    const { admin, event } = await world()
    for (const handler of [assignDirector, removeDirector]) {
      const method = handler === assignDirector ? 'POST' : 'DELETE'
      const missing = await invoke(handler, { method, as: admin, params: { id: event }, body: {} })
      expect(missing.status, method).toBe(400)
      expect(await expectContract(missing, errorBodySchema)).toEqual({ error: 'memberId is required' })
      const broken = await invoke(handler, { method, as: admin, params: { id: event }, rawBody: 'not json', headers: { 'Content-Type': 'application/json' } })
      expect(broken.status, method).toBe(400)
      expect((await expectContract(broken, fieldErrorBodySchema)).error).toBe('Invalid JSON body')
      const number = await invoke(handler, { method, as: admin, params: { id: event }, body: { memberId: 7 } })
      expect(number.status, method).toBe(400)
      expect(Object.keys((await expectContract(number, fieldErrorBodySchema)).fields)).toEqual(['memberId'])
    }
  })

  it('refuses an answer with a key the contract does not name, at the top and in a director\'s row, for each method', () => {
    const row = { tournament_id: 'example-event', member_id: 'example-member', assigned_at: '2026-11-15 18:00:00', full_name: 'Player One', email: 'player.one@example.org' }
    for (const contract of [list, name, unname]) {
      expect(contract.response.safeParse({ directors: [row] }).success).toBe(true)
      expect(contract.response.safeParse({ directors: [row], extra: 1 }).success).toBe(false)
      expect(contract.response.safeParse({ directors: [{ ...row, uscf_id: '12345678' }] }).success).toBe(false)
      expect(contract.response.safeParse({ directors: [{ ...row, assigned_at: 'Sun, Nov 15' }] }).success).toBe(false)
    }
  })

  it('keeps the plain { error } body for a refusal and a missing event, and 401 signed out', async () => {
    const { event, director } = await world()
    const member = await seedMember()
    const refused = await invoke(assignDirector, { method: 'POST', as: member, params: { id: event }, body: { memberId: director } })
    expect(refused.status).toBe(403)
    await expectContract(refused, errorBodySchema)
    const listRefused = await invoke(getDirectors, { as: member, params: { id: event } })
    expect(listRefused.status).toBe(403)
    await expectContract(listRefused, errorBodySchema)
    const missing = await invoke(assignDirector, { method: 'POST', as: await seedAdmin(), params: { id: 'example-no-such-event' }, body: { memberId: director } })
    expect(missing.status).toBe(404)
    expect(await expectContract(missing, errorBodySchema)).toEqual({ error: 'Tournament not found' })
    expect((await invoke(getDirectors, { params: { id: event } })).status).toBe(401)
  })
})
