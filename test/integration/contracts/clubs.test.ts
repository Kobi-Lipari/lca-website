// test/integration/contracts/clubs.test.ts
// GET /api/clubs keeps its contract (domain/contracts/clubs.ts): the real
// handler, the clubs the migrations seed and two made up clubs, one with
// every column filled and one with only its name and city. The site's
// getClubs() in src/areas/clubs/api.ts sends no body and no sign-in; the
// signed-in views are checked too, because the handler serves them. Since
// WS09 step 32 the contract has two branches, today's nine keys and the
// directory's wider row while CLUB_PAGES_ON is set, each strict; the
// constant is turned on through a getter on the mocked module.
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clubDirectoryItemSchema, clubListItemSchema, contracts } from '../../../domain/contracts'
import { onRequestGet as clubsGet, onRequestOptions as clubsOptions } from '../../../functions/api/clubs'
import { directoryCacheKey } from '../../../functions/utils/clubs/directory'
import { seedAdmin, seedClub, seedMember } from '../factories'
import { expectContract, flushWaitUntil, invoke, resetHarness } from '../harness'

const flags = vi.hoisted(() => ({ pagesOn: false }))
vi.mock('../../../functions/utils/clubs/pages', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../../functions/utils/clubs/pages')>()
  return {
    ...real,
    get CLUB_PAGES_ON() {
      return flags.pagesOn
    },
  }
})

/** The one key the directory's list is kept under, on the harness's origin. */
const KEY = directoryCacheKey('https://lca-website.pages.dev')

beforeEach(resetHarness)
afterEach(async () => {
  flags.pagesOn = false
  await flushWaitUntil()
  await caches.default.delete(KEY)
})

const contract = contracts['clubs'].GET

/** The nine columns the list answers, in its select's order. */
const LIST_KEYS = ['id', 'name', 'city', 'meeting_schedule', 'color', 'image_url', 'region', 'latitude', 'longitude']

/** A made up club with every column filled, and one with only the factory's three. */
async function writeExampleClubs(): Promise<{ full: string; bare: string }> {
  const full = await seedClub({ id: 'example-chess-club', name: 'Example Chess Club', city: 'Example City' })
  await env.DB.prepare(
    `UPDATE clubs SET
       location = 'Example Hall, 1 Example Street', description = 'A made up club.', meeting_schedule = 'Tuesdays, 7:00 PM to 9:00 PM',
       contact_email = 'club@example.org', color = '#1f3a5f', image_url = 'https://example.org/logo.png', region = 'Example Region',
       latitude = 30.45, longitude = -91.15
     WHERE id = ?`,
  ).bind(full).run()
  const bare = await seedClub({ id: 'another-example-club', name: 'Another Example Club', city: 'Example Town' })
  return { full, bare }
}

/** The database is kept across the cases of a file, so the two clubs are written once, by the first case that asks for them. */
let exampleClubs: Promise<{ full: string; bare: string }> | undefined
const seedExampleClubs = () => (exampleClubs ??= writeExampleClubs())

describe('GET /api/clubs keeps its contract', () => {
  it('answers every club, the seeded ones and two made up ones, each row passing the contract', async () => {
    const { full, bare } = await seedExampleClubs()
    const result = await invoke(clubsGet)
    expect(result.status).toBe(200)
    const body = await expectContract(result, contract.response)
    const { results } = await env.DB.prepare('SELECT id FROM clubs').all<{ id: string }>()
    expect(body.clubs).toHaveLength(results.length)
    expect(body.clubs.map((c) => c.id)).toEqual(expect.arrayContaining([full, bare]))
    expect(body.clubs.find((c) => c.id === full)).toEqual({
      id: full, name: 'Example Chess Club', city: 'Example City', meeting_schedule: 'Tuesdays, 7:00 PM to 9:00 PM', color: '#1f3a5f',
      image_url: 'https://example.org/logo.png', region: 'Example Region', latitude: 30.45, longitude: -91.15,
    })
    expect(body.clubs.find((c) => c.id === bare)).toMatchObject({ meeting_schedule: null, image_url: null, region: null, latitude: null, longitude: null })
  })

  it('answers the nine columns alone, A to Z by name, and no contact email', async () => {
    await seedExampleClubs()
    const result = await invoke(clubsGet)
    const text = await result.response.text()
    const { clubs } = JSON.parse(text) as { clubs: Array<Record<string, unknown>> }
    for (const club of clubs) expect(Object.keys(club), String(club.id)).toEqual(LIST_KEYS)
    const names = clubs.map((c) => String(c.name))
    expect(names).toEqual([...names].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)))
    expect(text).not.toContain('contact_email')
    expect(text).not.toContain('club@example.org')
  })

  it('answers signed out visitors, a member and an LCA admin alike', async () => {
    await seedExampleClubs()
    const member = await seedMember()
    const admin = await seedAdmin()
    const bodies: string[] = []
    for (const as of [undefined, member, admin]) {
      const result = await invoke(clubsGet, { as })
      expect(result.status, as ?? 'signed out').toBe(200)
      bodies.push(await result.response.text())
    }
    expect(new Set(bodies).size).toBe(1)
    await expectContract(await invoke(clubsGet, { as: admin }), contract.response)
  })

  it('a column added to clubs never reaches the list, and its contract still holds', async () => {
    const { full } = await seedExampleClubs()
    await env.DB.prepare('ALTER TABLE clubs ADD COLUMN throwaway_note TEXT').run()
    try {
      await env.DB.prepare('UPDATE clubs SET throwaway_note = ? WHERE id = ?').bind('not for the public', full).run()
      const result = await invoke(clubsGet)
      expect(result.status).toBe(200)
      expect(await result.response.clone().text()).not.toContain('throwaway_note')
      await expectContract(result, contract.response)
    } finally {
      await env.DB.prepare('ALTER TABLE clubs DROP COLUMN throwaway_note').run()
    }
  })

  it('lists two clubs that share a name, each once, and keeps the contract', async () => {
    await seedExampleClubs()
    const first = await seedClub({ id: 'twin-club-one', name: 'Twin Example Chess Club', city: 'Example City' })
    const second = await seedClub({ id: 'twin-club-two', name: 'Twin Example Chess Club', city: 'Example Town' })
    const result = await invoke(clubsGet)
    const body = await expectContract(result, contract.response)
    const twins = body.clubs.filter((c) => c.name === 'Twin Example Chess Club').map((c) => c.id)
    expect(twins.sort()).toEqual([first, second].sort())
  })

  it('answers an empty list as { clubs: [] }, which the contract accepts', async () => {
    const empty = { prepare: () => ({ all: async () => ({ results: [] }) }) } as unknown as D1Database
    const result = await invoke(clubsGet, { env: { DB: empty } })
    expect(result.status).toBe(200)
    expect(await expectContract(result, contract.response)).toEqual({ clubs: [] })
  })

  it('answers OPTIONS with 204 and no body, and the contract names no write method', async () => {
    const result = await invoke(clubsOptions, { method: 'OPTIONS' })
    expect(result.status).toBe(204)
    expect(await result.response.text()).toBe('')
    expect(Object.keys(contracts['clubs'])).toEqual(['GET'])
  })

  it('the contract is strict: a tenth key, a missing key and a null name are refused', () => {
    const club = { id: 'c1', name: 'Example Chess Club', city: 'Example City', meeting_schedule: null, color: null, image_url: null, region: null, latitude: null, longitude: null }
    expect(clubListItemSchema.safeParse(club).success).toBe(true)
    expect(contract.response.safeParse({ clubs: [club] }).success).toBe(true)
    expect(contract.response.safeParse({ clubs: [{ ...club, contact_email: 'club@example.org' }] }).success).toBe(false)
    expect(contract.response.safeParse({ clubs: [{ ...club, region: undefined }] }).success).toBe(false)
    expect(contract.response.safeParse({ clubs: [{ ...club, name: null }] }).success).toBe(false)
    expect(contract.response.safeParse({ clubs: [], extra: 1 }).success).toBe(false)
  })

  it('with CLUB_PAGES_ON set, every row, the seeded clubs and the two made up ones, passes the wider branch', async () => {
    const { full, bare } = await seedExampleClubs()
    flags.pagesOn = true
    const result = await invoke(clubsGet, { path: '/api/clubs' })
    expect(result.status).toBe(200)
    const body = await expectContract(result, contract.response)
    const { results } = await env.DB.prepare('SELECT id FROM clubs').all<{ id: string }>()
    expect(body.clubs).toHaveLength(results.length)
    for (const club of body.clubs) expect(clubDirectoryItemSchema.safeParse(club).success, club.id).toBe(true)
    expect(body.clubs.map((c) => c.id)).toEqual(expect.arrayContaining([full, bare]))
    expect(await result.response.clone().text()).not.toContain('club@example.org')
  })

  it('the wider branch is strict too: a keeper, an address, a key short or a row of the other shape is refused', () => {
    const club = { id: 'c1', name: 'Example Chess Club', city: 'Example City', meeting_schedule: null, color: null, image_url: null, region: null, latitude: null, longitude: null }
    const wide = {
      ...club, slug: 'example-chess-club', statement: null, description: 'Chess club in Example City, Louisiana', point: { latitude: 30.45, longitude: -91.15 },
      weekend_play: false, scholastic_friendly: true,
    }
    expect(clubDirectoryItemSchema.safeParse(wide).success).toBe(true)
    expect(contract.response.safeParse({ clubs: [wide] }).success).toBe(true)
    expect(contract.response.safeParse({ clubs: [{ ...wide, point: null, statement: 'Tuesdays at 7:00 PM.', description: null }] }).success).toBe(true)
    expect(contract.response.safeParse({ clubs: [club, wide] }).success).toBe(false)
    expect(contract.response.safeParse({ clubs: [{ ...wide, keeper: 'LCA admins' }] }).success).toBe(false)
    expect(contract.response.safeParse({ clubs: [{ ...wide, contact_email: 'club@example.org' }] }).success).toBe(false)
    expect(contract.response.safeParse({ clubs: [{ ...wide, point: { latitude: 30.45, longitude: -91.15, zip: '70808' } }] }).success).toBe(false)
    expect(contract.response.safeParse({ clubs: [{ ...wide, weekend_play: 1 }] }).success).toBe(false)
    const noSlug: Record<string, unknown> = { ...wide }
    delete noSlug.slug
    expect(contract.response.safeParse({ clubs: [noSlug] }).success).toBe(false)
    expect(contract.response.safeParse({ clubs: [wide], keepers: [] }).success).toBe(false)
  })
})
