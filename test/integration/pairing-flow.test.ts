// test/integration/pairing-flow.test.ts
// A whole event through the real endpoints: pair every round, enter results,
// read standings with tiebreaks. The old engine crashed or hung from round 3
// in events like these.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { env } from 'cloudflare:test'
import { invoke, resetHarness } from './harness'
import { seedAdmin, seedClub, seedMember, seedRegistration, seedTournament } from './factories'

import { onRequestPost as generatePost } from '../../functions/api/admin/tournaments/[id]/generate-pairings'
import { onRequestPatch as resultPatch } from '../../functions/api/admin/tournaments/[id]/games/[gameId]'
import { onRequestGet as manageGet } from '../../functions/api/admin/tournaments/[id]/manage'
import { onRequestPatch as tournamentPatch } from '../../functions/api/admin/tournaments/[id]'

// CLUB_PAGES_ON is held unset but in the cases of WS09 step 37 that set it,
// through a getter on the mocked module.
const flags = vi.hoisted(() => ({ pagesOn: false }))
vi.mock('../../functions/utils/clubs/pages', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../functions/utils/clubs/pages')>()
  return {
    ...real,
    get CLUB_PAGES_ON() {
      return flags.pagesOn
    },
  }
})

beforeEach(resetHarness)
afterEach(() => {
  flags.pagesOn = false
})

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

describe('pairing options', () => {
  it('accelerates round 1 when the event is set to', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament({ rounds: 4, sections: [{ name: 'Open', entryFee: 0 }] })
    expect((await invoke(tournamentPatch, { method: 'PATCH', as: admin, params: { id: tournamentId }, body: { accelerated: true } })).status).toBe(200)
    const ids: string[] = []
    for (let i = 0; i < 8; i++) {
      const id = await seedMember({ uscfRating: 2000 - i * 100 })
      ids.push(id)
      await seedRegistration({ tournamentId, memberId: id, section: 'Open' })
    }
    await invoke(generatePost, { method: 'POST', as: admin, params: { id: tournamentId }, body: { round: 1, section: 'Open' } })
    const top = new Set(ids.slice(0, 4))
    for (const g of await pendingGames(tournamentId, 1)) {
      expect(top.has(g.white_member_id)).toBe(top.has(g.black_member_id as string))
    }
  })

  it('keeps a parent and child apart when it can', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament({ rounds: 3, sections: [{ name: 'Open', entryFee: 0 }] })
    const ids: string[] = []
    for (let i = 0; i < 4; i++) {
      const id = await seedMember({ uscfRating: 1600 - i * 100 })
      ids.push(id)
      await seedRegistration({ tournamentId, memberId: id, section: 'Open' })
    }
    // Round 1 would pair 1600 with 1400 (top half vs bottom half); make them family.
    await env.DB.prepare('UPDATE members SET guardian_id = ? WHERE id = ?').bind(ids[0], ids[2]).run()
    await invoke(generatePost, { method: 'POST', as: admin, params: { id: tournamentId }, body: { round: 1, section: 'Open' } })
    const r1 = await pendingGames(tournamentId, 1)
    for (const g of r1) {
      expect([g.white_member_id, g.black_member_id].sort().join()).not.toBe([ids[0], ids[2]].sort().join())
    }
    for (const g of r1) await invoke(resultPatch, { method: 'PATCH', as: admin, params: { id: tournamentId, gameId: g.id }, body: { result: '1/2-1/2' } })
    await invoke(generatePost, { method: 'POST', as: admin, params: { id: tournamentId }, body: { round: 2, section: 'Open' } })
    for (const g of await pendingGames(tournamentId, 2)) {
      expect([g.white_member_id, g.black_member_id].sort().join()).not.toBe([ids[0], ids[2]].sort().join())
    }
  })
})

// WS09 step 37: with CLUB_PAGES_ON set a player is no longer tied to a club,
// so an event set to keep families and clubmates apart pairs as one set to
// keep families apart, and its stored rule is kept for when the constant is
// unset. Four players, 1600 to 1300: round 1 pairs the top half with the
// bottom, so 1600 meets 1400 unless the two are kept apart.
describe('keeping clubmates apart, with CLUB_PAGES_ON unset and set (WS09 step 37)', () => {
  /** An event with the rule given and four players; the first and third share a club and are not family, or are family when asked. */
  async function eventWith(keepApart: 'family' | 'family_club' | 'none', bond: 'club' | 'family') {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament({ rounds: 3, sections: [{ name: 'Open', entryFee: 0 }] })
    const set = await invoke(tournamentPatch, { method: 'PATCH', as: admin, params: { id: tournamentId }, body: { keepApart } })
    expect(set.status).toBe(200)
    const clubId = await seedClub({ name: 'Example Chess Club' })
    const ids: string[] = []
    for (let i = 0; i < 4; i++) {
      const id = await seedMember({ uscfRating: 1600 - i * 100, ...(bond === 'club' && (i === 0 || i === 2) ? { clubId } : {}) })
      ids.push(id)
      await seedRegistration({ tournamentId, memberId: id, section: 'Open' })
    }
    if (bond === 'family') await env.DB.prepare('UPDATE members SET guardian_id = ? WHERE id = ?').bind(ids[0], ids[2]).run()
    return { admin, tournamentId, pair: [ids[0], ids[2]].sort().join() }
  }

  /** Whether round 1 paired the first and third players together. */
  async function pairedTogether(admin: string, tournamentId: string, pair: string): Promise<boolean> {
    const res = await invoke(generatePost, { method: 'POST', as: admin, params: { id: tournamentId }, body: { round: 1, section: 'Open' } })
    expect(res.status).toBe(201)
    return (await pendingGames(tournamentId, 1)).some((g) => [g.white_member_id, g.black_member_id].sort().join() === pair)
  }

  const storedRule = async (tournamentId: string) =>
    (await env.DB.prepare('SELECT keep_apart FROM tournaments WHERE id = ?').bind(tournamentId).first<{ keep_apart: string }>())?.keep_apart

  it('unset: an event set to family_club keeps two clubmates who are not family apart, as today', async () => {
    const { admin, tournamentId, pair } = await eventWith('family_club', 'club')
    expect(await pairedTogether(admin, tournamentId, pair)).toBe(false)
    expect(await storedRule(tournamentId)).toBe('family_club')
  })

  it('set: an event set to family_club pairs the two clubmates as families only, and keeps family_club stored', async () => {
    flags.pagesOn = true
    const { admin, tournamentId, pair } = await eventWith('family_club', 'club')
    expect(await storedRule(tournamentId)).toBe('family_club')
    expect(await pairedTogether(admin, tournamentId, pair)).toBe(true)
    expect(await storedRule(tournamentId)).toBe('family_club')
  })

  it('set: an event set to family_club still keeps a parent and child apart', async () => {
    flags.pagesOn = true
    const { admin, tournamentId, pair } = await eventWith('family_club', 'family')
    expect(await pairedTogether(admin, tournamentId, pair)).toBe(false)
  })

  it('an event set to family or to none pairs the same with the constant unset and set', async () => {
    for (const on of [false, true]) {
      flags.pagesOn = on
      for (const [rule, bond, together] of [['family', 'club', true], ['family', 'family', false], ['none', 'club', true], ['none', 'family', true]] as const) {
        const { admin, tournamentId, pair } = await eventWith(rule, bond)
        expect(await pairedTogether(admin, tournamentId, pair), `${on} ${rule} ${bond}`).toBe(together)
        expect(await storedRule(tournamentId), `${on} ${rule} ${bond}`).toBe(rule)
      }
    }
  })
})
