// test/integration/contracts/search.test.ts
//
// GET /api/search keeps its contract (domain/contracts/search.ts, WS02 step
// 9): its query as the registry gives it, an answer holding all five groups
// checked through expectContract, which fails a field the schema does not
// name as well as one it lacks, and the 400 in the shape every error takes
// (errorBodySchema). The rows are this file's own, seeded here, and the
// clock is held at noon on Sunday, November 1, 2026 in Louisiana.
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { contracts, errorBodySchema } from '../../../domain/contracts'
import { answerSearch } from '../../../functions/utils/search'
import { seedClub, seedTournament } from '../factories'
import { expectContract, invoke, resetHarness } from '../harness'

beforeEach(() => {
  resetHarness()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-01T18:00:00.000Z'))
})
afterEach(() => {
  vi.useRealTimers()
})

const ask = (q: string) => invoke((context) => answerSearch(context, null), { path: `/api/search?q=${encodeURIComponent(q)}` })

describe('GET /api/search contract', () => {
  const contract = contracts['search'].GET

  it('reads its query as the registry gives it', () => {
    expect(contract.query?.safeParse({ q: 'morphy' }).success).toBe(true)
    expect(contract.query?.safeParse({ q: 'morphy', type: 'clubs' }).success).toBe(true)
    expect(contract.query?.safeParse({}).success).toBe(false)
  })

  it('holds for an answer with every group: an LCA event and a partner event, a club, a post, a result and a champions row', async () => {
    const upcoming = await seedTournament({ name: 'Galago Fall Open', date: '2026-11-21' })
    const past = await seedTournament({ name: 'Galago Summer Open', date: '2026-06-13' })
    await env.DB.prepare(
      `INSERT INTO clearinghouse (id, name, start_date, end_date, city, state, link, is_lca)
       VALUES ('fx-galago-partner', 'Galago Gulf Open', '2026-11-28', NULL, 'Biloxi', 'MS', 'https://example.org/galago', 0)`,
    ).run()
    const clubId = await seedClub({ name: 'Galago Chess Club', city: 'Natchitoches' })
    await env.DB.prepare('UPDATE clubs SET region = ? WHERE id = ?').bind('Central Louisiana', clubId).run()
    await env.DB.prepare(
      `INSERT INTO lca_posts (id, slug, title, summary, status, published_at) VALUES ('fx-galago-post', 'galago-news', 'Galago news', 'A fixture post.', 'published', '2026-10-01')`,
    ).run()
    await env.DB.prepare(
      `INSERT INTO state_champions (year, title, champion, kind) VALUES (2016, 'Galago Champion', 'Fixture Holder', 'state')`,
    ).run()

    const result = await ask('Galago')
    expect(result.status).toBe(200)
    const body = await expectContract(result, contract.response)
    expect(body.q).toBe('galago')
    expect(body.groups.map((g) => [g.type, g.label, g.items.length])).toEqual([
      ['tournaments', 'Tournaments', 2], ['clubs', 'Clubs', 1], ['news', 'News', 1], ['results', 'Results', 1], ['champions', 'Champions', 1],
    ])
    const [lca, partner] = body.groups[0].items
    expect(lca).toMatchObject({ id: `event:${upcoming}`, href: `/tournaments/${upcoming}`, tag: { tone: 'open', label: 'Registration open' } })
    expect(partner).toEqual({ id: 'partner:fx-galago-partner', title: 'Galago Gulf Open', meta: 'Sat, Nov 28, 2026 · Biloxi, MS', href: 'https://example.org/galago', external: true })
    expect(body.groups[3].items[0]).toMatchObject({ id: `event:${past}`, tag: { tone: 'final', label: 'Final standings' } })
    expect(body.groups[4].items[0]).toEqual({ id: 'champions:state:2016:galago-champion', title: '2016 Galago Champion', meta: 'State champions', href: '/champions#state-champions' })
  })

  it('holds for an answer with no group', async () => {
    const body = await expectContract(await ask('zzyzx'), contract.response)
    expect(body).toEqual({ q: 'zzyzx', groups: [] })
  })

  it('answers a search too short with the body every error has', async () => {
    const result = await ask('a')
    expect(result.status).toBe(400)
    expect(await expectContract(result, errorBodySchema)).toEqual({ error: 'Search for 2 to 64 letters or numbers.' })
  })
})
