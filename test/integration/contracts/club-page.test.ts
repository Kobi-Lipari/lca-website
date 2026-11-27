// test/integration/contracts/club-page.test.ts
// GET /api/clubs/[id]/page keeps its contract (domain/contracts/clubPage.ts):
// the real handler, with CLUB_PAGES_ON or CLUB_KEEPERS_ON set through a
// getter on a mock of their module, since both are false in the tree, for a
// made-up club with every block filled, a bare one and a seeded one. The
// strict contract refuses a key it does not name, and every 404 is the plain
// error body. The site's getClubPage() in src/areas/clubs/api.ts sends no
// body.
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { contracts, errorBodySchema } from '../../../domain/contracts'
import { onRequestGet as pageGet } from '../../../functions/api/clubs/[id]/page'
import { seedAdmin, seedClub, seedMember, seedTournament } from '../factories'
import { expectContract, invoke, resetHarness } from '../harness'

const flags = vi.hoisted(() => ({ pagesOn: false, keepersOn: false }))
vi.mock('../../../functions/utils/clubs/pages', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../../functions/utils/clubs/pages')>()
  return {
    ...real,
    get CLUB_PAGES_ON() {
      return flags.pagesOn
    },
    get CLUB_KEEPERS_ON() {
      return flags.keepersOn
    },
  }
})
beforeEach(resetHarness)
afterEach(() => {
  flags.pagesOn = false
  flags.keepersOn = false
})

const contract = contracts['clubs/[id]/page'].GET

/** A made-up club with every block filled: its words, ticks, links, two places, an event, a news row and a rep. */
async function fullClub(): Promise<string> {
  const id = await seedClub({ id: 'example-contract-club', name: 'Example Contract Club', city: 'Example City' })
  await env.DB.prepare(
    `UPDATE clubs SET slug = 'example-contract-club', region = 'Example Contract Region', color = '#1f3a5f', image_url = '/api/clubs/example-contract-club/logo?v=1',
            about_text = 'A made up club.', how_we_meet_text = 'Tuesdays at 7:00 PM', cost_text = 'Free', welcome_text = 'Everyone',
            weekend_play = 1, scholastic_friendly = 1, contact_name_public = 'Contact P.', contact_email = 'club@example.org',
            facebook_url = 'https://example.org/facebook', website_url = 'https://example.org', other_url = 'https://example.org/other',
            told_updated_at = '2026-11-02 15:00:00', latitude = 30.4, longitude = -91.2
      WHERE id = ?`,
  ).bind(id).run()
  await env.DB.prepare(
    `INSERT INTO club_places (club_id, name, street, note, latitude, longitude, sort) VALUES
       (?, 'Example Hall', '1 Example Street', 'Room past the desk', 30.4, -91.2, 0), (?, 'Example Annex', NULL, NULL, NULL, NULL, 1)`,
  ).bind(id, id).run()
  await seedTournament({ clubId: id, name: 'Example Contract Open', date: '2026-12-05', maxPlayers: 30 })
  await env.DB.prepare(`INSERT INTO club_news (id, club_id, title, news_date, excerpt) VALUES ('news-contract-1', ?, 'Example News', '2026-11-01', 'Example excerpt')`).bind(id).run()
  await seedMember({ role: 'club_rep', clubId: id, fullName: 'Rita Sample', email: 'rita.contract@example.org' })
  return id
}

let full: Promise<string> | undefined
const seedFull = () => (full ??= fullClub())

describe('GET /api/clubs/[id]/page keeps its contract', () => {
  it('answers a club with every block filled, to a visitor with CLUB_PAGES_ON set', async () => {
    const id = await seedFull()
    flags.pagesOn = true
    const result = await invoke(pageGet, { params: { id } })
    expect(result.status).toBe(200)
    const body = await expectContract(result, contract.response)
    expect(body.sections).toEqual(['about', 'when_and_where', 'events', 'news', 'contact'])
    expect(body.places).toHaveLength(2)
    expect(body.events).toHaveLength(1)
    // Who keeps the club is not in the answer (K's decision 12): the contract has no such key and the body names no keeper.
    expect(Object.keys(body)).not.toContain('author')
    expect(JSON.stringify(body)).not.toMatch(/Kept by|Rita/)
  })

  it('answers a bare club and a seeded one', async () => {
    flags.pagesOn = true
    const bare = await seedClub({ id: 'example-bare-contract-club', name: 'Example Bare Club', city: 'Example Town' })
    await expectContract(await invoke(pageGet, { params: { id: bare } }), contract.response)
    const { results } = await env.DB.prepare('SELECT id FROM clubs WHERE slug IS NOT NULL ORDER BY id LIMIT 1').all<{ id: string }>()
    await expectContract(await invoke(pageGet, { params: { id: results[0].id } }), contract.response)
  })

  it('answers the club\'s keeper the same contract with only CLUB_KEEPERS_ON set', async () => {
    const id = await seedFull()
    flags.keepersOn = true
    await expectContract(await invoke(pageGet, { as: await seedAdmin(), params: { id } }), contract.response)
  })

  it('refuses a key the contract does not name, the club\'s email among them', async () => {
    const id = await seedFull()
    flags.pagesOn = true
    const body = await (await invoke(pageGet, { params: { id } })).json<Record<string, unknown> & { club: Record<string, unknown> }>()
    expect(contract.response.safeParse(body).success).toBe(true)
    expect(contract.response.safeParse({ ...body, officers: [] }).success).toBe(false)
    expect(contract.response.safeParse({ ...body, club: { ...body.club, contact_email: 'club@example.org' } }).success).toBe(false)
  })

  it('answers every 404 with the plain error body', async () => {
    const id = await seedFull()
    const missing = await invoke(pageGet, { params: { id } })
    expect(missing.status).toBe(404)
    await expectContract(missing, errorBodySchema)
    flags.keepersOn = true
    const stranger = await invoke(pageGet, { params: { id } })
    expect(stranger.status).toBe(404)
    await expectContract(stranger, errorBodySchema)
  })
})
