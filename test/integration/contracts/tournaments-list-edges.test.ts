// test/integration/contracts/tournaments-list-edges.test.ts
// GET /api/tournaments: the edges around its contract (domain/contracts/events.ts).
// Who sees which drafts, empty and stale data, dates at the ends of the year
// and the clock changes in America/Chicago, ties on the sort, and a
// contract that has not drifted from the table.
import { env } from 'cloudflare:test'
import { beforeEach, describe, expect, it } from 'vitest'
import { contracts, tournamentListItemSchema } from '../../../domain/contracts'
import { onRequestGet as tournamentsGet } from '../../../functions/api/tournaments'
import { seedClub, seedMember, seedTournament, seedTournamentDirector } from '../factories'
import { expectContract, invoke, resetHarness } from '../harness'

beforeEach(resetHarness)

const contract = contracts['tournaments'].GET
const list = (as?: string) => invoke(tournamentsGet, { as, path: '/api/tournaments' })
const ids = async (as?: string) => (await expectContract(await list(as), contract.response)).tournaments.map((t) => t.id)

describe('GET /api/tournaments: who sees drafts', () => {
  it('a club rep does not see another club\'s draft, and the answer still holds the contract', async () => {
    const mine = await seedClub()
    const theirs = await seedClub()
    const myDraft = await seedTournament({ clubId: mine, isVisible: false })
    const theirDraft = await seedTournament({ clubId: theirs, isVisible: false })
    const rep = await seedMember({ role: 'club_rep', clubId: mine })
    const seen = await ids(rep)
    expect(seen).toContain(myDraft)
    expect(seen).not.toContain(theirDraft)
  })

  it('a member with a club but not the rep role does not see that club\'s draft', async () => {
    const club = await seedClub()
    const draft = await seedTournament({ clubId: club, isVisible: false })
    const member = await seedMember({ clubId: club })
    expect(await ids(member)).not.toContain(draft)
  })

  it('a director sees only the drafts they direct', async () => {
    const directed = await seedTournament({ isVisible: false })
    const other = await seedTournament({ isVisible: false })
    const director = await seedMember({ role: 'tournament_director' })
    await seedTournamentDirector(directed, director)
    const seen = await ids(director)
    expect(seen).toContain(directed)
    expect(seen).not.toContain(other)
  })

  it('an observer and an officer see every draft', async () => {
    const draft = await seedTournament({ isVisible: false })
    for (const role of ['lca_observer', 'lca_officer']) {
      expect(await ids(await seedMember({ role })), role).toContain(draft)
    }
  })

  it('a bad token is the public view, not an error', async () => {
    const draft = await seedTournament({ isVisible: false })
    const shown = await seedTournament()
    const result = await invoke(tournamentsGet, { path: '/api/tournaments', headers: { Authorization: 'Bearer not-a-real-token' } })
    expect(result.status).toBe(200)
    const seen = (await expectContract(result, contract.response)).tournaments.map((t) => t.id)
    expect(seen).toContain(shown)
    expect(seen).not.toContain(draft)
  })

  it('a draft never reaches the public list with its fields, even if every other event is visible', async () => {
    await seedTournament({ name: 'Secret draft', isVisible: false, registrationStatus: 'draft' })
    await seedTournament({ name: 'Shown' })
    const text = await (await list()).response.text()
    expect(text).not.toContain('Secret draft')
  })
})

describe('GET /api/tournaments: empty and stale data', () => {
  it('keeps completed and past events in the list, with the contract holding', async () => {
    const past = await seedTournament({ status: 'completed', date: '2019-05-04' })
    const body = await expectContract(await list(), contract.response)
    const row = body.tournaments.find((t) => t.id === past)
    expect(row?.status).toBe('completed')
    expect(row?.end_date).toBeNull()
  })

  it('reads a sections column that is not an array as an empty list of sections', async () => {
    const odd = await seedTournament()
    const text = await seedTournament()
    const nul = await seedTournament()
    await env.DB.prepare(`UPDATE tournaments SET sections = '{"name":"Open"}' WHERE id = ?`).bind(odd).run()
    await env.DB.prepare(`UPDATE tournaments SET sections = 'not json' WHERE id = ?`).bind(text).run()
    await env.DB.prepare(`UPDATE tournaments SET sections = '[]' WHERE id = ?`).bind(nul).run()
    const body = await expectContract(await list(), contract.response)
    for (const id of [odd, text, nul]) expect(body.tournaments.find((t) => t.id === id)?.sections).toEqual([])
  })

  it('a section with a fee in dollars and cents keeps its decimals', async () => {
    const id = await seedTournament({ sections: [{ name: 'Open', entryFee: 12.5 }, { name: 'Free', entryFee: 0 }] })
    const body = await expectContract(await list(), contract.response)
    expect(body.tournaments.find((t) => t.id === id)?.sections).toEqual([
      { name: 'Open', entryFee: 12.5 },
      { name: 'Free', entryFee: 0 },
    ])
  })
})

describe('GET /api/tournaments: dates and ties', () => {
  // The date columns are calendar days. These are the days around the clock
  // changes in America/Chicago and the turn of a year, which must come back
  // as the same text with no zone applied.
  const days = ['2026-03-08', '2026-03-07', '2026-11-01', '2026-12-31', '2027-01-01', '2028-02-29']

  it('returns calendar days exactly as stored', async () => {
    const made = new Map<string, string>()
    for (const day of days) made.set(await seedTournament({ date: day }), day)
    await env.DB.prepare(`UPDATE tournaments SET end_date = '2026-11-02' WHERE date = '2026-11-01'`).run()
    const body = await expectContract(await list(), contract.response)
    for (const [id, day] of made) expect(body.tournaments.find((t) => t.id === id)?.date).toBe(day)
    expect(body.tournaments.find((t) => t.date === '2026-11-01')?.end_date).toBe('2026-11-02')
  })

  it('sorts by date, earliest first', async () => {
    const made = new Set<string>()
    for (const day of days) made.add(await seedTournament({ date: day }))
    const body = await expectContract(await list(), contract.response)
    const mine = body.tournaments.filter((t) => made.has(t.id)).map((t) => t.date)
    expect(mine).toEqual([...days].sort())
    // The whole list is in date order, whatever else is in the table.
    const all = body.tournaments.map((t) => t.date)
    expect(all).toEqual([...all].sort())
  })

  it('lists events on the same day together, none lost or repeated', async () => {
    const same = [await seedTournament({ date: '2026-09-12' }), await seedTournament({ date: '2026-09-12' }), await seedTournament({ date: '2026-09-12' })]
    const earlier = await seedTournament({ date: '2026-09-05' })
    const mine = new Set([earlier, ...same])
    const seen = (await ids()).filter((id) => mine.has(id))
    expect(seen[0]).toBe(earlier)
    expect([...seen.slice(1)].sort()).toEqual([...same].sort())
    const everything = await ids()
    expect(new Set(everything).size).toBe(everything.length)
  })

  it('stores created_at as UTC database text, the form the contract names', async () => {
    const id = await seedTournament()
    const row = (await expectContract(await list(), contract.response)).tournaments.find((t) => t.id === id)
    expect(row?.created_at).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
  })
})

describe('GET /api/tournaments: the contract and the table agree', () => {
  it('names every column of tournaments, plus club_name and club_color', async () => {
    const { results } = await env.DB.prepare(`PRAGMA table_info(tournaments)`).all<{ name: string }>()
    const columns = results.map((r) => r.name)
    const named = Object.keys(tournamentListItemSchema.shape)
    expect([...named].sort()).toEqual([...columns, 'club_name', 'club_color'].sort())
  })

  it('every column the database default fills passes its schema', async () => {
    // A row with only the required columns: every default and every NULL.
    await env.DB.prepare(`INSERT INTO tournaments (id, name, location, date, entry_fee, sections, rounds) VALUES ('bare', 'Bare', 'Baton Rouge, LA', '2026-10-24', 0, '[]', 3)`).run()
    const body = await expectContract(await list(), contract.response)
    const row = body.tournaments.find((t) => t.id === 'bare')
    expect(row?.is_visible).toBe(1)
    expect(row?.status).toBe('upcoming')
    expect(row?.venue).toBeNull()
  })
})

describe('GET /api/tournaments: the HTTP answer', () => {
  it('is JSON with the shared headers', async () => {
    const result = await list()
    expect(result.status).toBe(200)
    expect(result.response.headers.get('Content-Type')).toBe('application/json')
    expect(result.response.headers.get('Access-Control-Allow-Origin')).toBe('*')
  })
})
