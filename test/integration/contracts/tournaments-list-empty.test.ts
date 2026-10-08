// test/integration/contracts/tournaments-list-empty.test.ts
// GET /api/tournaments with no events at all. Its own file, so the
// database can be emptied without touching other tests' rows.
import { env } from 'cloudflare:test'
import { beforeAll, describe, expect, it } from 'vitest'
import { contracts } from '../../../domain/contracts'
import { onRequestGet as tournamentsGet } from '../../../functions/api/tournaments'
import { seedAdmin, seedClub, seedMember, seedTournament } from '../factories'
import { expectContract, invoke } from '../harness'

const contract = contracts['tournaments'].GET

beforeAll(async () => {
  await env.DB.prepare('DELETE FROM tournaments').run()
})

describe('GET /api/tournaments with no events', () => {
  it('answers 200 with an empty list for the public', async () => {
    const result = await invoke(tournamentsGet, { path: '/api/tournaments' })
    expect(result.status).toBe(200)
    expect((await expectContract(result, contract.response)).tournaments).toEqual([])
  })

  it('answers an empty list for an admin, a club rep and a plain member', async () => {
    const club = await seedClub()
    for (const as of [await seedAdmin(), await seedMember({ role: 'club_rep', clubId: club }), await seedMember()]) {
      const result = await invoke(tournamentsGet, { as, path: '/api/tournaments' })
      expect(result.status).toBe(200)
      expect((await expectContract(result, contract.response)).tournaments).toEqual([])
    }
  })

  it('with only a hidden draft, the public list is still empty and the admin list has one', async () => {
    const draft = await seedTournament({ isVisible: false, registrationStatus: 'draft' })
    const publicList = await expectContract(await invoke(tournamentsGet, { path: '/api/tournaments' }), contract.response)
    expect(publicList.tournaments).toEqual([])
    const adminList = await expectContract(await invoke(tournamentsGet, { as: await seedAdmin(), path: '/api/tournaments' }), contract.response)
    expect(adminList.tournaments.map((t) => t.id)).toEqual([draft])
  })
})
