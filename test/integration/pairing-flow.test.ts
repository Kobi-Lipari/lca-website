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

import { onRequestPost as gamesPost } from '../../functions/api/admin/tournaments/[id]/games'

describe('manual pairings', () => {
  async function setup() {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament({ rounds: 3, sections: [{ name: 'Open', entryFee: 0 }] })
    const ids: string[] = []
    for (let i = 0; i < 4; i++) {
      const id = await seedMember({ uscfRating: 1800 - i * 100 })
      ids.push(id)
      await seedRegistration({ tournamentId, memberId: id, section: 'Open' })
    }
    await invoke(generatePost, { method: 'POST', as: admin, params: { id: tournamentId }, body: { round: 1, section: 'Open' } })
    return { admin, tournamentId, ids }
  }

  it('swaps colors on a board', async () => {
    const { admin, tournamentId } = await setup()
    const [g] = await pendingGames(tournamentId, 1)
    const res = await invoke(gamesPost, {
      method: 'POST', as: admin, params: { id: tournamentId },
      body: { round: 1, section: 'Open', pairings: [{ board: g.board, whiteMemberId: g.black_member_id, blackMemberId: g.white_member_id }] },
    })
    expect(res.status).toBe(201)
    const [after] = await pendingGames(tournamentId, 1)
    expect(after.white_member_id).toBe(g.black_member_id)
  })

  it('refuses a player on two boards, someone outside the section, and self-pairing', async () => {
    const { admin, tournamentId, ids } = await setup()
    const [b1] = await pendingGames(tournamentId, 1)
    const onBoardTwo = (await pendingGames(tournamentId, 1))[1].white_member_id
    const twoBoards = await invoke(gamesPost, { method: 'POST', as: admin, params: { id: tournamentId },
      body: { round: 1, section: 'Open', pairings: [{ board: b1.board, whiteMemberId: b1.white_member_id, blackMemberId: onBoardTwo }] } })
    expect(twoBoards.status).toBe(400)
    const outsider = await seedMember()
    const notEntered = await invoke(gamesPost, { method: 'POST', as: admin, params: { id: tournamentId },
      body: { round: 1, section: 'Open', pairings: [{ board: 9, whiteMemberId: outsider, blackMemberId: null }] } })
    expect(notEntered.status).toBe(400)
    const self = await invoke(gamesPost, { method: 'POST', as: admin, params: { id: tournamentId },
      body: { round: 1, section: 'Open', pairings: [{ board: 1, whiteMemberId: ids[0], blackMemberId: ids[0] }] } })
    expect(self.status).toBe(400)
  })

  it('asks before replacing a board that already has a result', async () => {
    const { admin, tournamentId } = await setup()
    const [g] = await pendingGames(tournamentId, 1)
    await invoke(resultPatch, { method: 'PATCH', as: admin, params: { id: tournamentId, gameId: g.id }, body: { result: '1-0' } })
    const swap = { round: 1, section: 'Open', pairings: [{ board: g.board, whiteMemberId: g.black_member_id, blackMemberId: g.white_member_id }] }
    const first = await invoke(gamesPost, { method: 'POST', as: admin, params: { id: tournamentId }, body: swap })
    expect(first.status).toBe(409)
    const confirmed = await invoke(gamesPost, { method: 'POST', as: admin, params: { id: tournamentId }, body: { ...swap, confirmReplace: true } })
    expect(confirmed.status).toBe(201)
  })
})
