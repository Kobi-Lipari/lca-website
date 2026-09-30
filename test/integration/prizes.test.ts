// test/integration/prizes.test.ts
// Prize winners through the real endpoints: the director sees them as the
// event goes; the public sees them once it's finished.
import { beforeEach, describe, expect, it } from 'vitest'
import { env } from 'cloudflare:test'
import { invoke, resetHarness } from './harness'
import { seedAdmin, seedMember, seedRegistration, seedTournament } from './factories'

import { onRequestPost as generatePost } from '../../functions/api/admin/tournaments/[id]/generate-pairings'
import { onRequestPatch as resultPatch } from '../../functions/api/admin/tournaments/[id]/games/[gameId]'
import { onRequestGet as manageGet } from '../../functions/api/admin/tournaments/[id]/manage'
import { onRequestGet as publicGet } from '../../functions/api/tournaments/[id]'

beforeEach(resetHarness)

interface Award { member_id: string; cash: number; prize: string; items: string[] }

describe('prizes', () => {
  it('works out winners for the director, and publishes them when the event is finished', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament({
      rounds: 2,
      sections: [{
        name: 'Open', entryFee: 0,
        prizes: {
          place: [{ amount: 100, label: 'Trophy' }, { amount: 50 }],
          classes: [{ label: 'Top U1200', ratingMax: 1199, prizes: [{ amount: 30 }] }],
        },
      }],
    })
    for (const rating of [1800, 1600, 1400, 1100]) {
      await seedRegistration({ tournamentId, memberId: await seedMember({ uscfRating: rating }) })
    }
    for (let round = 1; round <= 2; round++) {
      expect((await invoke(generatePost, { method: 'POST', as: admin, params: { id: tournamentId }, body: { round, section: 'Open' } })).status).toBe(201)
      const { results } = await env.DB.prepare(
        `SELECT id FROM tournament_games WHERE tournament_id = ? AND round = ? AND result = 'pending'`,
      ).bind(tournamentId, round).all<{ id: string }>()
      for (const g of results ?? []) {
        await invoke(resultPatch, { method: 'PATCH', as: admin, params: { id: tournamentId, gameId: g.id }, body: { result: '1-0' } })
      }
    }

    const manage = await (await invoke(manageGet, { as: admin, params: { id: tournamentId } }))
      .json<{ prizes: Award[]; standings: Array<{ member_id: string; score: number }> }>()
    // Colors are a coin toss, so who wins varies. The place prizes are
    // always paid in full; the U1200 prize too, unless the U1200 player
    // did better from a place prize (then nobody else qualifies for it).
    const total = Math.round(manage.prizes.reduce((a, p) => a + p.cash, 0) * 100) / 100
    expect([150, 180]).toContain(total)
    expect(manage.prizes.some((p) => p.items.includes('Trophy (1st)'))).toBe(true)
    // Nobody gets two cash prizes.
    expect(new Set(manage.prizes.map((p) => p.member_id)).size).toBe(manage.prizes.length)

    const before = await (await invoke(publicGet, { params: { id: tournamentId } })).json<{ prizes: Award[] }>()
    expect(before.prizes).toEqual([])
    await env.DB.prepare(`UPDATE tournaments SET status = 'completed' WHERE id = ?`).bind(tournamentId).run()
    const after = await (await invoke(publicGet, { params: { id: tournamentId } })).json<{ prizes: Award[] }>()
    expect(after.prizes).toEqual(manage.prizes)
  })
})
