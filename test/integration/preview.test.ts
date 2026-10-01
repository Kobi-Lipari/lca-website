// test/integration/preview.test.ts
// A hidden event is a 404 to the public, but its director can open the
// public page (and the print page, which uses the same data) to preview it.
import { beforeEach, describe, expect, it } from 'vitest'
import { invoke, resetHarness } from './harness'
import { seedMember, seedTournament, seedTournamentDirector } from './factories'
import { onRequestGet as publicGet } from '../../functions/api/tournaments/[id]'

beforeEach(resetHarness)

describe('previewing a hidden event', () => {
  it('shows it to its director and hides it from everyone else', async () => {
    const tournamentId = await seedTournament({ isVisible: false })
    const director = await seedMember()
    await seedTournamentDirector(tournamentId, director)
    const stranger = await seedMember()

    expect((await invoke(publicGet, { params: { id: tournamentId } })).status).toBe(404)
    expect((await invoke(publicGet, { as: stranger, params: { id: tournamentId } })).status).toBe(404)
    const preview = await invoke(publicGet, { as: director, params: { id: tournamentId } })
    expect(preview.status).toBe(200)
    expect((await preview.json<{ tournament: { is_visible: number } }>()).tournament.is_visible).toBe(0)
  })
})
