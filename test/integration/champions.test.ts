// test/integration/champions.test.ts
import { beforeEach, describe, expect, it } from 'vitest'
import { invoke, resetHarness } from './harness'
import { seedAdmin, seedMember, seedTournament } from './factories'
import { onRequestGet as championsGet } from '../../functions/api/champions'
import { onRequestPost as championsPost } from '../../functions/api/admin/champions'
import { onRequestPatch as championPatch, onRequestDelete as championDelete } from '../../functions/api/admin/champions/[id]'
import { onRequestPatch as tournamentPatch } from '../../functions/api/admin/tournaments/[id]'

beforeEach(resetHarness)

type Row = { id: string; year: number; title: string; champion: string; kind: string; photo_url: string | null }
type List = { champions: Row[]; upcoming: Array<{ id: string }> }

// Migration 0056 fills the table with the real honor roll (ids "lca-..."),
// so the rows these tests add are read back by leaving those out.
const added = (list: List) => list.champions.filter((c) => !c.id.startsWith('lca-'))

describe('state champions', () => {
  it('admins add (one or many), edit and remove; everyone can see them', async () => {
    const admin = await seedAdmin()
    expect((await invoke(championsPost, { method: 'POST', as: admin, body: { year: 2025, title: 'Louisiana State Champion', champion: 'Jane Doe' } })).status).toBe(201)
    const many = await invoke(championsPost, { method: 'POST', as: admin, body: { rows: [
      { year: 2024, title: 'Louisiana State Champion', champion: 'John Roe' },
      { year: 2024, title: 'K-12', champion: 'Kid Star', kind: 'scholastic', photoUrl: '/champions/photos/kid-star.jpg' },
    ] } })
    expect(many.status).toBe(201)

    let list = added(await (await invoke(championsGet, {})).json<List>())
    // Newest year first; within a year by title, so the K-12 section sorts before the state title.
    expect(list.map((c) => c.year)).toEqual([2025, 2024, 2024])
    // The list defaults to state; the scholastic row keeps its list and its photo.
    expect(list.map((c) => c.kind)).toEqual(['state', 'scholastic', 'state'])
    expect(list.map((c) => c.photo_url)).toEqual([null, '/champions/photos/kid-star.jpg', null])

    const jane = list[0].id
    expect((await invoke(championPatch, { method: 'PATCH', as: admin, params: { id: jane }, body: { champion: 'Jane Q. Doe', photoUrl: 'https://example.org/jane.jpg' } })).status).toBe(200)
    expect((await invoke(championDelete, { method: 'DELETE', as: admin, params: { id: list[1].id } })).status).toBe(200)
    list = added(await (await invoke(championsGet, {})).json<List>())
    expect(list.map((c) => c.champion)).toEqual(['Jane Q. Doe', 'John Roe'])
    expect(list[0].photo_url).toBe('https://example.org/jane.jpg')
    // Editing one field leaves the list alone.
    expect((await invoke(championPatch, { method: 'PATCH', as: admin, params: { id: list[1].id }, body: { kind: 'scholastic' } })).status).toBe(200)
    expect((await invoke(championPatch, { method: 'PATCH', as: admin, params: { id: list[1].id }, body: { notes: 'co-champion' } })).status).toBe(200)
    expect(added(await (await invoke(championsGet, {})).json<List>())[1].kind).toBe('scholastic')
  })

  it('carries the honor roll itself: the 1915 and 2025 state champions and the 2021 sections, with photos', async () => {
    const list = (await (await invoke(championsGet, {})).json<List>()).champions
    const state = list.filter((c) => c.kind === 'state' && c.id.startsWith('lca-'))
    const scholastic = list.filter((c) => c.kind === 'scholastic' && c.id.startsWith('lca-'))
    expect(state).toHaveLength(84)
    expect(scholastic).toHaveLength(77)
    expect(state.find((c) => c.year === 1915)?.champion).toBe('James McConnell Jr.')
    expect(state.find((c) => c.year === 2025)).toMatchObject({ champion: 'Nicholas Matta', photo_url: '/champions/photos/state-2025-nicholas-matta.jpg' })
    expect(scholastic.filter((c) => c.year === 2021).map((c) => c.title).sort()).toEqual(['High School', 'Lower Elementary', 'Middle School', 'Upper Elementary'])
    expect(list[0].year).toBe(2025)
  })

  it('rejects bad rows, a list it does not have, a photo it cannot serve, and non-admins', async () => {
    const admin = await seedAdmin()
    const member = await seedMember()
    expect((await invoke(championsPost, { method: 'POST', as: admin, body: { year: 1800, title: 'X', champion: 'Y' } })).status).toBe(400)
    expect((await invoke(championsPost, { method: 'POST', as: admin, body: { year: 2020, title: 'X', champion: 'Y', kind: 'junior' } })).status).toBe(400)
    expect((await invoke(championsPost, { method: 'POST', as: admin, body: { year: 2020, title: 'X', champion: 'Y', photoUrl: 'javascript:alert(1)' } })).status).toBe(400)
    expect((await invoke(championsPost, { method: 'POST', as: admin, body: { year: 2020, title: 'X', champion: 'Y', photoUrl: 'http://example.org/plain.jpg' } })).status).toBe(400)
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
