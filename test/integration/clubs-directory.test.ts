// test/integration/clubs-directory.test.ts
//
// GET /api/clubs and the new directory (WS09 step 32), through the real
// handler:
// - with CLUB_PAGES_ON unset, as it ships: today's answer to the byte, with
//   today's headers, one query and nothing kept in the edge's cache, held
//   against a stored copy of the base's answer for made-up clubs;
// - with it set: today's nine keys and then the directory's, built by the
//   club page's own rules, for the same clubs, A to Z as SQLite orders them;
//   the same answer for every reader, kept five minutes under one key;
// - no keeper, seat or person's name, and no address, in any key or value;
// - no part of the request read: a near, a city or a ZIP code changes
//   nothing, adds no key to the cache, writes nothing and logs nothing.
// The constant is turned on through a getter on the mocked module, as the
// handler reads it at each call. Every club and person is made up.
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clubDirectoryResponseSchema, clubListResponseSchema, contracts } from '../../domain/contracts'
import { aToZ } from '../../domain/clubs/order'
import { onRequestGet as clubsGet, onRequestOptions as clubsOptions } from '../../functions/api/clubs'
import * as clubsModule from '../../functions/api/clubs'
import { DIRECTORY_CACHE_CONTROL, DIRECTORY_READER_CACHE_CONTROL, directoryCacheKey } from '../../functions/utils/clubs/directory'
import { clubNamedBy, clubPageAnswer } from '../../functions/utils/clubs/pageAnswer'
import { pageDescription } from '../../functions/utils/clubs/pageHtml'
import { seedAdmin, seedClub, seedMember, seedSeat } from './factories'
import { expectContract, flushWaitUntil, invoke, resetHarness } from './harness'
import { countingDb } from './mailRuns'

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

/** The harness's origin, and the one key the list is kept under. */
const ORIGIN = 'https://lca-website.pages.dev'
const KEY = directoryCacheKey(ORIGIN)

beforeEach(async () => {
  resetHarness()
  await caches.default.delete(KEY)
})
afterEach(async () => {
  flags.pagesOn = false
  await flushWaitUntil()
  await caches.default.delete(KEY)
  vi.restoreAllMocks()
})

const contract = contracts['clubs'].GET

/** Today's nine keys, in the select's order, and the directory's after them. */
const LIST_KEYS = ['id', 'name', 'city', 'meeting_schedule', 'color', 'image_url', 'region', 'latitude', 'longitude']
const DIRECTORY_KEYS = [...LIST_KEYS, 'slug', 'statement', 'description', 'point', 'weekend_play', 'scholastic_friendly']

/** Two made-up clubs as the database answers today's select, in its column order. */
const BASE_ROWS = [
  { id: 'example-chess-club', name: 'Example Chess Club', city: 'Example City', meeting_schedule: 'Tuesdays, 7:00 PM', color: '#1f3a5f', image_url: null, region: 'North Louisiana', latitude: 30.45, longitude: -91.15 },
  { id: 'example-rooks-club', name: 'Example Rooks Club', city: 'Example Town', meeting_schedule: null, color: null, image_url: null, region: null, latitude: null, longitude: null },
]

/** The base's answer for BASE_ROWS, as f46fd6d's handler wrote it, byte for byte. */
const STORED_BASE_BODY = '{"clubs":[{"id":"example-chess-club","name":"Example Chess Club","city":"Example City","meeting_schedule":"Tuesdays, 7:00 PM","color":"#1f3a5f","image_url":null,"region":"North Louisiana","latitude":30.45,"longitude":-91.15},{"id":"example-rooks-club","name":"Example Rooks Club","city":"Example Town","meeting_schedule":null,"color":null,"image_url":null,"region":null,"latitude":null,"longitude":null}]}'

/** The base's headers, as f46fd6d's handler sent them, in the order a Headers object lists them. */
const STORED_BASE_HEADERS = [
  ['access-control-allow-headers', 'Content-Type, Authorization'],
  ['access-control-allow-methods', 'GET, POST, PATCH, OPTIONS'],
  ['access-control-allow-origin', '*'],
  ['content-type', 'application/json'],
]

/** The base's one query, as f46fd6d's handler sent it. */
const STORED_BASE_QUERY = `SELECT id, name, city, meeting_schedule, color, image_url, region, latitude, longitude
     FROM clubs
     ORDER BY name ASC`

/** A made-up database that answers BASE_ROWS, and counts what it is asked. */
function baseRowsDb() {
  const prepared: string[] = []
  let reads = 0
  const db = {
    prepare: (sql: string) => {
      prepared.push(sql)
      return { all: async () => { reads += 1; return { results: BASE_ROWS } } }
    },
  } as unknown as D1Database
  return { db, prepared, reads: () => reads }
}

let made = 0
/** A made-up club written as the club editor saves one; answers its id. */
async function writeClub(opts: {
  name: string
  city?: string
  region?: string | null
  slug?: string | null
  statement?: string | null
  about?: string | null
  weekend?: boolean
  scholastic?: boolean
  pin?: [number, number] | null
  places?: Array<[number | null, number | null]>
}): Promise<string> {
  made += 1
  const id = await seedClub({ id: `dir-club-${made}`, name: opts.name, city: opts.city ?? 'Example City' })
  await env.DB.prepare(
    `UPDATE clubs SET region = ?, slug = ?, how_we_meet_text = ?, about_text = ?, weekend_play = ?, scholastic_friendly = ?,
       latitude = ?, longitude = ?, contact_email = 'club@example.org', contact_name_public = 'Player One'
     WHERE id = ?`,
  ).bind(
    opts.region ?? null, opts.slug ?? null, opts.statement ?? null, opts.about ?? null, opts.weekend ? 1 : 0, opts.scholastic ? 1 : 0,
    opts.pin?.[0] ?? null, opts.pin?.[1] ?? null, id,
  ).run()
  for (const [i, [latitude, longitude]] of (opts.places ?? []).entries()) {
    await env.DB.prepare('INSERT INTO club_places (club_id, name, sort, latitude, longitude) VALUES (?, ?, ?, ?, ?)')
      .bind(id, `Example Hall ${i + 1}`, i, latitude, longitude).run()
  }
  return id
}

/** The answer's clubs, parsed. */
async function clubsOf(result: { response: Response }): Promise<Array<Record<string, unknown>>> {
  return (JSON.parse(await result.response.clone().text()) as { clubs: Array<Record<string, unknown>> }).clubs
}

describe('with CLUB_PAGES_ON unset, as it ships', () => {
  it('today\'s bytes with it unset: the stored copy of the base\'s answer, its headers, one query and nothing kept', async () => {
    const { db, prepared, reads } = baseRowsDb()
    const result = await invoke(clubsGet, { path: '/api/clubs', env: { DB: db } })
    expect(result.status).toBe(200)
    expect(await result.response.text()).toBe(STORED_BASE_BODY)
    expect([...result.response.headers]).toEqual(STORED_BASE_HEADERS)
    expect(prepared).toEqual([STORED_BASE_QUERY])
    expect(reads()).toBe(1)
    await flushWaitUntil()
    expect(await caches.default.match(KEY)).toBeUndefined()
  })

  it('answers the same bytes and headers for every reader and every address, with one query each and no cache', async () => {
    const member = await seedMember()
    const admin = await seedAdmin()
    for (const [as, path] of [[undefined, '/api/clubs'], [member, '/api/clubs?near=70808'], [admin, '/api/clubs?city=Example%20City&zip=70808&sort=nearest']] as const) {
      const { db, prepared, reads } = baseRowsDb()
      const result = await invoke(clubsGet, { as, path, env: { DB: db }, headers: { Cookie: 'example=1' } })
      expect(await result.response.text(), path).toBe(STORED_BASE_BODY)
      expect([...result.response.headers], path).toEqual(STORED_BASE_HEADERS)
      expect(prepared, path).toEqual([STORED_BASE_QUERY])
      expect(reads(), path).toBe(1)
    }
    await flushWaitUntil()
    expect(await caches.default.match(KEY)).toBeUndefined()
  })

  it('keeps today\'s contract, the branch of the nine keys', async () => {
    await writeClub({ name: 'Example Unset Club', statement: 'Tuesdays at 7:00 PM.' })
    const result = await invoke(clubsGet, { path: '/api/clubs' })
    await expectContract(result, contract.response)
    for (const club of await clubsOf(result)) expect(Object.keys(club), String(club.id)).toEqual(LIST_KEYS)
    expect(clubListResponseSchema.safeParse(await result.json()).success).toBe(true)
  })
})

describe('with CLUB_PAGES_ON set', () => {
  it('the list\'s new fields with the constant set: the nine keys unchanged, then the directory\'s, by the club page\'s rules', async () => {
    const full = await writeClub({
      name: 'Example Full Directory Club', region: 'North Louisiana', slug: 'example-full-directory-club', statement: 'Tuesdays at 7:00 PM at the Example Library.',
      about: 'A made-up club.', weekend: true, scholastic: true, pin: [31.0, -92.0], places: [[32.5, -93.75], [30.1, -91.1]],
    })
    const aboutOnly = await writeClub({ name: 'Example About Directory Club', about: 'We play <b>rapid</b> games and talk chess.', pin: [30.2, -91.2] })
    const bare = await writeClub({ name: 'Example Bare Directory Club', city: 'Example Town', region: 'Lafayette / South Central', pin: [30.22, -92.02] })
    const unplaced = await writeClub({ name: 'Example Unplaced Directory Club', pin: [30.3, -91.3], places: [[null, null]] })
    const nowhere = await writeClub({ name: 'Example Nowhere Directory Club', statement: '   ' })

    const unset = await clubsOf(await invoke(clubsGet, { path: '/api/clubs' }))
    flags.pagesOn = true
    const result = await invoke(clubsGet, { path: '/api/clubs' })
    expect(result.status).toBe(200)
    expect(result.response.headers.get('Cache-Control')).toBe(DIRECTORY_READER_CACHE_CONTROL)
    const body = await expectContract(result, contract.response)
    expect(clubDirectoryResponseSchema.safeParse(body).success).toBe(true)
    const clubs = await clubsOf(result)

    // Exactly the clubs the base lists, each with today's nine values unchanged and in their order, then the directory's.
    expect(clubs.map((c) => c.id).sort()).toEqual(unset.map((c) => c.id).sort())
    for (const club of clubs) {
      expect(Object.keys(club), String(club.id)).toEqual(DIRECTORY_KEYS)
      const today = unset.find((c) => c.id === club.id)!
      expect(Object.fromEntries(LIST_KEYS.map((k) => [k, club[k]])), String(club.id)).toEqual(today)
    }
    const byId = (id: string) => clubs.find((c) => c.id === id)!
    expect(byId(full)).toMatchObject({
      slug: 'example-full-directory-club', statement: 'Tuesdays at 7:00 PM at the Example Library.', description: null,
      point: { latitude: 32.5, longitude: -93.75 }, weekend_play: true, scholastic_friendly: true,
    })
    expect(byId(aboutOnly)).toMatchObject({ slug: aboutOnly, statement: null, description: 'We play rapid games and talk chess.', point: { latitude: 30.2, longitude: -91.2 }, weekend_play: false })
    expect(byId(bare)).toMatchObject({ statement: null, description: 'Chess club in Example Town, Louisiana · Lafayette / South Central', point: { latitude: 30.22, longitude: -92.02 } })
    // A first place with no point gives none: the club's own pin is not read once it has a place, as on its page.
    expect(byId(unplaced).point).toBeNull()
    expect(byId(nowhere)).toMatchObject({ statement: null, point: null, description: 'Chess club in Example City, Louisiana' })

    // The card and the page say one thing: the slug, the statement, the ticks and the description are the page's own.
    for (const id of [full, aboutOnly, bare, unplaced, nowhere]) {
      const club = await clubNamedBy(env.DB, id)
      const page = await clubPageAnswer(env.DB, club!)
      const row = byId(id)
      expect(row.slug, id).toBe(page.club.slug)
      expect(row.statement, id).toBe(page.statement.text)
      expect([row.weekend_play, row.scholastic_friendly], id).toEqual([page.about.weekend_play, page.about.scholastic_friendly])
      if (row.statement === null) expect(row.description, id).toBe(pageDescription(page))
    }
  })

  it('lists A to Z as SQLite orders the names, capitals before small letters and marks after them, as the order file does', async () => {
    const names = ['example tiny club', 'Example Tiny Club', 'Éxample Tiny Club', 'Example Tiny Club Ｚ', 'Example Tiny Club 😀', 'Example Tiny Club']
    const ids: string[] = []
    for (const name of names) ids.push(await writeClub({ name }))
    const ours = (clubs: Array<Record<string, unknown>>) => clubs.filter((c) => ids.includes(String(c.id))).map((c) => String(c.id))
    const expected = aToZ(ids.map((id, i) => ({ id, name: names[i] }))).map((c) => c.id)
    expect(expected.map((id) => names[ids.indexOf(id)])).toEqual([
      'Example Tiny Club', 'Example Tiny Club', 'Example Tiny Club Ｚ', 'Example Tiny Club 😀', 'example tiny club', 'Éxample Tiny Club',
    ])
    flags.pagesOn = true
    expect(ours(await clubsOf(await invoke(clubsGet, { path: '/api/clubs' })))).toEqual(expected)
    // Today's list orders the names the same way; only its order of two clubs of one name is the database's own.
    flags.pagesOn = false
    const today = ours(await clubsOf(await invoke(clubsGet, { path: '/api/clubs' })))
    expect(today.map((id) => names[ids.indexOf(id)])).toEqual(expected.map((id) => names[ids.indexOf(id)]))
  })

  it('answers every reader alike, signed out, a member and an LCA admin, with or without a cookie, built afresh each time', async () => {
    await writeClub({ name: 'Example Reader Club', statement: 'Saturdays at 10:00 AM.' })
    const member = await seedMember({ fullName: 'Player One', email: 'player-one@example.org' })
    const admin = await seedAdmin()
    flags.pagesOn = true
    const bodies: string[] = []
    for (const [as, headers] of [[undefined, {}], [member, { Cookie: 'example=1' }], [admin, { 'Accept-Language': 'fr' }]] as const) {
      await caches.default.delete(KEY)
      const result = await invoke(clubsGet, { as, path: '/api/clubs', headers })
      expect(result.status, as ?? 'signed out').toBe(200)
      bodies.push(await result.response.text())
      await flushWaitUntil()
    }
    expect(new Set(bodies).size).toBe(1)
  })

  it('keeps the answer five minutes under the one plain key, and answers from it with no query', async () => {
    const id = await writeClub({ name: 'Example Cached Club' })
    flags.pagesOn = true
    const first = await invoke(clubsGet, { path: '/api/clubs' })
    const sent = await first.response.clone().text()
    // The reader's browser keeps no copy; the edge's copy carries the five minutes.
    expect(first.response.headers.get('Cache-Control')).toBe('no-cache')
    await flushWaitUntil()
    const kept = await caches.default.match(KEY)
    expect(kept?.headers.get('Cache-Control')).toBe('public, max-age=300')
    expect(DIRECTORY_CACHE_CONTROL).toBe('public, max-age=300')
    expect(await kept?.text()).toBe(sent)

    await env.DB.prepare('UPDATE clubs SET name = ? WHERE id = ?').bind('Example Renamed Cached Club', id).run()
    const { db, ran } = countingDb()
    const second = await invoke(clubsGet, { path: '/api/clubs', env: { DB: db } })
    expect(await second.response.text()).toBe(sent)
    expect(ran).toEqual([])

    await caches.default.delete(KEY)
    const fresh = await clubsOf(await invoke(clubsGet, { path: '/api/clubs' }))
    expect(fresh.find((c) => c.id === id)?.name).toBe('Example Renamed Cached Club')
  })

  it('no near parameter is read: a near, a city and a ZIP code give the same bytes, the one key, no write and no log line', async () => {
    await writeClub({ name: 'Example Near Club', pin: [30.45, -91.15] })
    flags.pagesOn = true
    const logged = (['log', 'info', 'warn', 'error', 'debug'] as const).map((name) => vi.spyOn(console, name))
    const plain = await invoke(clubsGet, { path: '/api/clubs' })
    const plainText = await plain.response.text()
    await flushWaitUntil()
    const asked = ['/api/clubs?near=70808', '/api/clubs?city=Baton%20Rouge', '/api/clubs?zip=70808&near=30.45,-91.15&sort=nearest']
    for (const path of asked) {
      await caches.default.delete(KEY)
      const { db, ran } = countingDb()
      const result = await invoke(clubsGet, { path, env: { DB: db } })
      expect(await result.response.text(), path).toBe(plainText)
      expect(ran.map((r) => r.sql.trim().slice(0, 6)), path).toEqual(['SELECT'])
      expect(ran[0].binds, path).toBe(0)
      await flushWaitUntil()
      expect(await caches.default.match(`${ORIGIN}${path}`), path).toBeUndefined()
      expect(await caches.default.match(KEY), path).toBeDefined()
    }
    for (const spy of logged) expect(spy).not.toHaveBeenCalled()
  })

  it('names no keeper, seat or person in any key or value, and no row carries an email address', async () => {
    const region = 'North Louisiana'
    const id = await writeClub({ name: 'Example Kept Club', region, statement: 'Mondays at 6:00 PM.', about: 'A made-up club.' })
    const officer = await seedMember({ fullName: 'Player Two', email: 'player-two@example.org' })
    await env.DB.prepare(`INSERT INTO club_officers (id, club_id, member_id, role) VALUES (?, ?, ?, 'President')`).bind(`dir-officer-${id}`, id, officer).run()
    const holder = await seedMember({ fullName: 'Player Three', email: 'player-three@example.org' })
    const seat = await seedSeat({ slug: `example-dir-seat-${id}`, role: 'Example Regional Seat' }, [holder])
    await env.DB.prepare('INSERT INTO seat_regions (seat_id, region) VALUES (?, ?)').bind(seat, region).run()

    for (const on of [true, false]) {
      flags.pagesOn = on
      await caches.default.delete(KEY)
      const result = await invoke(clubsGet, { path: '/api/clubs' })
      const text = await result.response.clone().text()
      const body = JSON.parse(text) as Record<string, unknown>
      expect(Object.keys(body), String(on)).toEqual(['clubs'])
      const keys = new Set<string>()
      const walk = (value: unknown) => {
        if (Array.isArray(value)) value.forEach(walk)
        else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) { keys.add(k); walk(v) }
      }
      walk(body)
      for (const key of keys) expect(key, String(on)).not.toMatch(/keep|rep|seat|officer|contact|person|member|email|owner|told|name_public/i)
      for (const words of ['Player One', 'Player Two', 'Player Three', 'Example Regional Seat', 'LCA admins', 'Kept by', '@']) expect(text, `${on} ${words}`).not.toContain(words)
      await flushWaitUntil()
    }
  })

  it('role safety: every role reads the one public answer, and the list has no write method', async () => {
    await writeClub({ name: 'Example Role Club' })
    const member = await seedMember()
    const admin = await seedAdmin()
    flags.pagesOn = true
    for (const as of [undefined, member, admin]) {
      await caches.default.delete(KEY)
      const result = await invoke(clubsGet, { as, path: '/api/clubs' })
      expect(result.status, as ?? 'signed out').toBe(200)
      await expectContract(result, contract.response)
      await flushWaitUntil()
    }
    expect(Object.keys(clubsModule).sort()).toEqual(['onRequestGet', 'onRequestOptions'])
    expect(Object.keys(contracts['clubs'])).toEqual(['GET'])
    const options = await invoke(clubsOptions, { method: 'OPTIONS', path: '/api/clubs' })
    expect(options.status).toBe(204)
  })
})
