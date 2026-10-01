// test/integration/champions.test.ts
import { beforeEach, describe, expect, it } from 'vitest'
import { invoke, resetHarness } from './harness'
import { seedAdmin, seedMember, seedTournament } from './factories'
import { onRequestGet as championsGet } from '../../functions/api/champions'
import { onRequestPost as championsPost } from '../../functions/api/admin/champions'
import { onRequestPatch as championPatch, onRequestDelete as championDelete } from '../../functions/api/admin/champions/[id]'
import { onRequestPatch as tournamentPatch } from '../../functions/api/admin/tournaments/[id]'

beforeEach(resetHarness)

type List = { champions: Array<{ id: string; year: number; champion: string }>; upcoming: Array<{ id: string }> }

describe('state champions', () => {
  it('admins add (one or many), edit and remove; everyone can see them', async () => {
    const admin = await seedAdmin()
    expect((await invoke(championsPost, { method: 'POST', as: admin, body: { year: 2025, title: 'Louisiana State Champion', champion: 'Jane Doe' } })).status).toBe(201)
    const many = await invoke(championsPost, { method: 'POST', as: admin, body: { rows: [
      { year: 2024, title: 'Louisiana State Champion', champion: 'John Roe' },
      { year: 2024, title: 'State Scholastic K-12', champion: 'Kid Star' },
    ] } })
    expect(many.status).toBe(201)

    let list = await (await invoke(championsGet, {})).json<List>()
    expect(list.champions.map((c) => c.year)).toEqual([2025, 2024, 2024])

    const jane = list.champions[0].id
    expect((await invoke(championPatch, { method: 'PATCH', as: admin, params: { id: jane }, body: { champion: 'Jane Q. Doe' } })).status).toBe(200)
    expect((await invoke(championDelete, { method: 'DELETE', as: admin, params: { id: list.champions[2].id } })).status).toBe(200)
    list = await (await invoke(championsGet, {})).json<List>()
    expect(list.champions.map((c) => c.champion)).toEqual(['Jane Q. Doe', 'John Roe'])
  })

  it('rejects bad rows and non-admins', async () => {
    const admin = await seedAdmin()
    const member = await seedMember()
    expect((await invoke(championsPost, { method: 'POST', as: admin, body: { year: 1800, title: 'X', champion: 'Y' } })).status).toBe(400)
    expect((await invoke(championsPost, { method: 'POST', as: member, body: { year: 2020, title: 'X', champion: 'Y' } })).status).toBe(403)
  })

  it('lists upcoming events marked as state championships', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament()
    expect((await invoke(tournamentPatch, { method: 'PATCH', as: admin, params: { id: tournamentId }, body: { isStateChampionship: true } })).status).toBe(200)
    const list = await (await invoke(championsGet, {})).json<List>()
    expect(list.upcoming.map((t) => t.id)).toContain(tournamentId)
  })
})
