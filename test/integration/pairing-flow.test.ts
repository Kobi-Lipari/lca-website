// test/integration/pairing-flow.test.ts
// A whole event through the real endpoints: pair every round, enter results,
// read standings with tiebreaks. The old engine crashed or hung from round 3
// in events like these.
import { beforeEach, describe, expect, it } from 'vitest'
import { env } from 'cloudflare:test'
import { invoke, resetHarness } from './harness'
import { seedAdmin, seedMember, seedRegistration, seedTournament } from './factories'

import { onRequestPost as generatePost } from '../../functions/api/admin/tournaments/[id]/generate-pairings'
import { onRequestPatch as resultPatch } from '../../functions/api/admin/tournaments/[id]/games/[gameId]'
import { onRequestGet as manageGet } from '../../functions/api/admin/tournaments/[id]/manage'
import { onRequestPatch as tournamentPatch } from '../../functions/api/admin/tournaments/[id]'

beforeEach(resetHarness)

async function pendingGames(tournamentId: string, round: number) {
  const { results } = await env.DB.prepare(
    `SELECT id, white_member_id, black_member_id, result FROM tournament_games
      WHERE tournament_id = ? AND round = ? ORDER BY board`,
  ).bind(tournamentId, round).all<{ id: string; white_member_id: string; black_member_id: string | null; result: string }>()
  return results ?? []
}

async function runEvent(players: number, rounds: number, system?: 'fide') {
  const admin = await seedAdmin()
  const tournamentId = await seedTournament({ rounds, sections: [{ name: 'Open', entryFee: 0 }] })
  if (system) {
    const set = await invoke(tournamentPatch, { method: 'PATCH', as: admin, params: { id: tournamentId }, body: { pairingSystem: system } })
    expect(set.status).toBe(200)
  }
  for (let i = 0; i < players; i++) {
    const id = await seedMember({ uscfRating: 2100 - i * 57 })
    await seedRegistration({ tournamentId, memberId: id, section: 'Open' })
  }
  const met = new Set<string>()
  for (let round = 1; round <= rounds; round++) {
    const res = await invoke(generatePost, { method: 'POST', as: admin, params: { id: tournamentId }, body: { round, section: 'Open' } })
    expect(res.status).toBe(201)
    const games = await pendingGames(tournamentId, round)
    const seen = new Set<string>()
    for (const g of games) {
      for (const p of [g.white_member_id, g.black_member_id]) if (p) {
        expect(seen.has(p)).toBe(false)
        seen.add(p)
      }
      if (!g.black_member_id) continue
      const key = [g.white_member_id, g.black_member_id].sort().join('|')
      expect(met.has(key)).toBe(false)
      met.add(key)
      // Higher board wins, with a draw every third board — enough variety
      // to create lone leaders and odd score groups.
      const result = games.indexOf(g) % 3 === 2 ? '1/2-1/2' : '1-0'
      const saved = await invoke(resultPatch, { method: 'PATCH', as: admin, params: { id: tournamentId, gameId: g.id }, body: { result } })
      expect(saved.status).toBe(200)
    }
    expect(seen.size).toBe(players)
  }
  return { admin, tournamentId }
}

describe('a whole Swiss event', () => {
  it('pairs 9 players through 5 rounds with no rematches, then ranks them with tiebreaks', async () => {
    const { admin, tournamentId } = await runEvent(9, 5)
    const manage = await invoke(manageGet, { as: admin, params: { id: tournamentId } })
    const { standings } = await manage.json<{ standings: Array<{ place: number; placeLabel: string; score: number; tiebreaks: Record<string, number> }> }>()
    expect(standings).toHaveLength(9)
    expect(standings[0].place).toBe(1)
    expect(standings[0].tiebreaks).toHaveProperty('modifiedMedian')
    for (let i = 1; i < standings.length; i++) expect(standings[i - 1].score).toBeGreaterThanOrEqual(standings[i].score)
  })

  it('works the same with FIDE-style pairing chosen on the event', async () => {
    await runEvent(8, 5, 'fide')
  })

  it('refuses to skip a round or pair beyond the advertised rounds without confirmation', async () => {
    const { admin, tournamentId } = await runEvent(4, 3)
    const extra = await invoke(generatePost, { method: 'POST', as: admin, params: { id: tournamentId }, body: { round: 4, section: 'Open' } })
    expect(extra.status).toBe(400)
    const skip = await invoke(generatePost, { method: 'POST', as: admin, params: { id: tournamentId }, body: { round: 6, section: 'Open', allowExtraRound: true } })
    expect(skip.status).toBe(400)
    const playoff = await invoke(generatePost, { method: 'POST', as: admin, params: { id: tournamentId }, body: { round: 4, section: 'Open', allowExtraRound: true } })
    expect(playoff.status).toBe(201)
  })
})
