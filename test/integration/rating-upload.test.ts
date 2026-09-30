// test/integration/rating-upload.test.ts
// The details for the US Chess upload files are saved on the event and
// come back with the rating report, with sensible suggestions before that.
import { beforeEach, describe, expect, it } from 'vitest'
import { env } from 'cloudflare:test'
import { invoke, resetHarness } from './harness'
import { seedAdmin, seedMember, seedTournament, seedTournamentDirector } from './factories'

import { onRequestGet as reportGet } from '../../functions/api/admin/tournaments/[id]/rating-report'
import { onRequestPatch as tournamentPatch } from '../../functions/api/admin/tournaments/[id]'

beforeEach(resetHarness)

describe('US Chess upload details', () => {
  it('suggests the chief TD and place, then keeps what the director saves', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament({ isRated: true })
    await env.DB.prepare(`UPDATE tournaments SET location = 'Kenner, LA', venue = '1 Main St, Kenner, LA 70065' WHERE id = ?`).bind(tournamentId).run()
    const td = await seedMember({ uscfId: '87654321', fullName: 'Tess Director' })
    await seedTournamentDirector(tournamentId, td)

    const first = await (await invoke(reportGet, { as: admin, params: { id: tournamentId } }))
      .json<{ upload: { settings: unknown; suggested: Record<string, string> } }>()
    expect(first.upload.settings).toBeNull()
    expect(first.upload.suggested).toMatchObject({ chiefTdId: '87654321', city: 'Kenner', state: 'LA', zip: '70065' })

    const saved = { affiliateId: 'A6012345', chiefTdId: '87654321', city: 'Kenner', state: 'LA', zip: '70065' }
    expect((await invoke(tournamentPatch, { method: 'PATCH', as: admin, params: { id: tournamentId }, body: { reportSettings: saved } })).status).toBe(200)
    const second = await (await invoke(reportGet, { as: admin, params: { id: tournamentId } }))
      .json<{ upload: { settings: unknown } }>()
    expect(second.upload.settings).toEqual(saved)
  })
})
