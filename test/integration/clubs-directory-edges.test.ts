// test/integration/clubs-directory-edges.test.ts
//
// The edges of GET /api/clubs while CLUB_PAGES_ON is set (WS09 step 32),
// beside test/integration/clubs-directory.test.ts:
// - the kept answer: served as it was kept, stale for its five minutes,
//   with the headers of the first answer; never read, and never written,
//   while the constant is unset; a cache that cannot be read or written, or
//   none at all, changes nothing but the saving;
// - empty data: no club at all gives an empty list, in both shapes;
// - many readers at once: the same bytes, whoever was first;
// - the first place's point by the editor's order, a pin with one half, a
//   long About cut as the club page cuts it;
// - every role gets the one answer, and a reader's headers and cookies
//   change nothing.
// The constant is turned on through a getter on the mocked module, as the
// handler reads it at each call. Every club and person is made up.
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clubDirectoryResponseSchema, clubListResponseSchema, contracts } from '../../domain/contracts'
import { onRequestGet as clubsGet } from '../../functions/api/clubs'
import {
  DIRECTORY_CACHE_CONTROL, DIRECTORY_READER_CACHE_CONTROL, answerDirectory, directoryCacheKey, type DirectoryCache, type DirectoryContext,
} from '../../functions/utils/clubs/directory'
import { clubNamedBy, clubPageAnswer } from '../../functions/utils/clubs/pageAnswer'
import { pageDescription } from '../../functions/utils/clubs/pageHtml'
import { seedAdmin, seedClub, seedMember } from './factories'
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

const ORIGIN = 'https://lca-website.pages.dev'
const KEY = directoryCacheKey(ORIGIN)
const contract = contracts['clubs'].GET

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

let made = 0
/** A made-up club as the club editor saves one; answers its id. */
async function writeClub(opts: {
  name: string
  about?: string | null
  pin?: [number | null, number | null]
  places?: Array<{ sort: number; at: [number | null, number | null] }>
}): Promise<string> {
  made += 1
  const id = await seedClub({ id: `edge-club-${made}`, name: opts.name, city: 'Example City' })
  await env.DB.prepare('UPDATE clubs SET about_text = ?, latitude = ?, longitude = ? WHERE id = ?')
    .bind(opts.about ?? null, opts.pin?.[0] ?? null, opts.pin?.[1] ?? null, id).run()
  for (const place of opts.places ?? []) {
    await env.DB.prepare('INSERT INTO club_places (club_id, name, sort, latitude, longitude) VALUES (?, ?, ?, ?, ?)')
      .bind(id, `Example Hall at ${place.sort}`, place.sort, place.at[0], place.at[1]).run()
  }
  return id
}

type Row = Record<string, unknown>
const rowsOf = async (result: { response: Response }): Promise<Row[]> =>
  (JSON.parse(await result.response.clone().text()) as { clubs: Row[] }).clubs

/** A database that answers a given shape for the list's one query, and counts nothing else. */
function stubDb(answer: { results?: unknown[] | undefined }): D1Database {
  return { prepare: () => ({ all: async () => answer }) } as unknown as D1Database
}

/** What answerDirectory reads of a request, with its waitUntil collected. */
function contextFor(db: D1Database, path = '/api/clubs'): { context: DirectoryContext; scheduled: Array<Promise<unknown>> } {
  const scheduled: Array<Promise<unknown>> = []
  const context = {
    request: new Request(`${ORIGIN}${path}`),
    env: { DB: db },
    waitUntil: (work: Promise<unknown>) => { scheduled.push(work) },
  } as unknown as DirectoryContext
  return { context, scheduled }
}

describe('the kept answer', () => {
  it('is served as it was kept for its five minutes, to every reader and every address, stale after a save', async () => {
    const id = await writeClub({ name: 'Example Stale Club' })
    flags.pagesOn = true
    const first = await invoke(clubsGet, { path: '/api/clubs' })
    const sent = await first.response.clone().text()
    await flushWaitUntil()
    await env.DB.prepare('UPDATE clubs SET name = ? WHERE id = ?').bind('Example Saved Stale Club', id).run()

    const member = await seedMember()
    const admin = await seedAdmin()
    for (const [as, path] of [[undefined, '/api/clubs'], [member, '/api/clubs?near=70808'], [admin, '/api/clubs?sort=nearest&zip=70112']] as const) {
      const { db, ran } = countingDb()
      const again = await invoke(clubsGet, { as, path, env: { DB: db }, headers: { Cookie: 'example=1' } })
      expect(await again.response.text(), path).toBe(sent)
      expect(ran, path).toEqual([])
    }
    expect(JSON.parse(sent).clubs.find((c: Row) => c.id === id).name).toBe('Example Stale Club')
  })

  it('serves a kept answer with the headers of the first: the type, the cross-origin lines and the reader\'s no-cache', async () => {
    await writeClub({ name: 'Example Headers Club' })
    flags.pagesOn = true
    const first = await invoke(clubsGet, { path: '/api/clubs' })
    await flushWaitUntil()
    const second = await invoke(clubsGet, { path: '/api/clubs?near=70808' })
    expect(second.status).toBe(200)
    // Only the edge keeps the list: its copy carries the five minutes, and every reader is told no-cache.
    expect(first.response.headers.get('Cache-Control')).toBe(DIRECTORY_READER_CACHE_CONTROL)
    expect(second.response.headers.get('Cache-Control')).toBe(DIRECTORY_READER_CACHE_CONTROL)
    expect(DIRECTORY_READER_CACHE_CONTROL).toBe('no-cache')
    expect((await caches.default.match(KEY))!.headers.get('Cache-Control')).toBe(DIRECTORY_CACHE_CONTROL)
    expect(DIRECTORY_CACHE_CONTROL).toBe('public, max-age=300')
    // The cache adds its own lines (age, date, length); every line the handler set is the same on the replay.
    for (const [name, value] of first.response.headers) expect(second.response.headers.get(name), name).toBe(value)
    expect(second.response.headers.get('Content-Type')).toBe('application/json')
    expect(second.response.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(second.response.headers.get('Set-Cookie')).toBeNull()
  })

  it('is never read and never written while the constant is unset, whatever is kept under the key', async () => {
    await writeClub({ name: 'Example Unset Edge Club' })
    await caches.default.put(KEY, new Response('{"clubs":[]}', { headers: { 'Content-Type': 'application/json', 'Cache-Control': DIRECTORY_CACHE_CONTROL } }))
    const result = await invoke(clubsGet, { path: '/api/clubs' })
    const clubs = await rowsOf(result)
    expect(clubs.length).toBeGreaterThan(0)
    expect(clubs.some((c) => c.name === 'Example Unset Edge Club')).toBe(true)
    expect(result.response.headers.get('Cache-Control')).toBeNull()
    await flushWaitUntil()
    // What was planted is still there, untouched, and nothing else was added under the plain key.
    expect(await (await caches.default.match(KEY))!.text()).toBe('{"clubs":[]}')
  })

  it('answers the same bytes to many readers at once, and keeps one answer that equals them', async () => {
    await writeClub({ name: 'Example Crowd Club' })
    flags.pagesOn = true
    const results = await Promise.all(Array.from({ length: 6 }, (_, i) => invoke(clubsGet, { path: i % 2 ? '/api/clubs' : `/api/clubs?near=7080${i}` })))
    const bodies = await Promise.all(results.map((r) => r.response.clone().text()))
    expect(new Set(bodies).size).toBe(1)
    await flushWaitUntil()
    expect(await (await caches.default.match(KEY))!.text()).toBe(bodies[0])
    for (let i = 0; i < 6; i++) expect(await caches.default.match(`${ORIGIN}/api/clubs?near=7080${i}`)).toBeUndefined()
  })

  it('replays the same answer however often it is asked, built once', async () => {
    await writeClub({ name: 'Example Replay Club' })
    flags.pagesOn = true
    const { db, ran } = countingDb()
    const bodies: string[] = []
    for (let i = 0; i < 4; i++) {
      bodies.push(await (await invoke(clubsGet, { path: '/api/clubs', env: { DB: db } })).response.text())
      await flushWaitUntil()
    }
    expect(new Set(bodies).size).toBe(1)
    expect(ran).toHaveLength(1)
  })
})

describe('a cache that fails, or none', () => {
  it('reads the database when the cache cannot be read, and still answers when it cannot be written', async () => {
    await writeClub({ name: 'Example Broken Cache Club' })
    const put = vi.fn(async () => { throw new Error('cache unavailable') })
    const cache: DirectoryCache = { match: async () => { throw new Error('cache unavailable') }, put }
    const { context, scheduled } = contextFor(env.DB)
    const response = await answerDirectory(context, cache)
    expect(response.status).toBe(200)
    expect(clubDirectoryResponseSchema.safeParse(await response.json()).success).toBe(true)
    await expect(Promise.all(scheduled)).resolves.toBeDefined()
    expect(put).toHaveBeenCalledTimes(1)
    expect(put.mock.calls[0][0]).toBe(KEY)
  })

  it('answers from the database with no cache at all, and schedules nothing', async () => {
    await writeClub({ name: 'Example No Cache Club' })
    const { context, scheduled } = contextFor(env.DB, '/api/clubs?near=70808')
    const response = await answerDirectory(context, null)
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe(DIRECTORY_READER_CACHE_CONTROL)
    expect(scheduled).toEqual([])
    expect((await rowsOf({ response })).some((c) => c.name === 'Example No Cache Club')).toBe(true)
  })

  it('keeps the answer under the one key, whatever address asked, from a stand-in cache', async () => {
    await writeClub({ name: 'Example Stand-in Club' })
    const kept = new Map<string, Response>()
    const cache: DirectoryCache = {
      match: async (key) => kept.get(key)?.clone(),
      put: async (key, response) => { kept.set(key, response) },
    }
    for (const path of ['/api/clubs', '/api/clubs?near=70808', '/api/clubs?a=1&b=2', '/api/clubs?near=30.45,-91.15#top']) {
      const { context, scheduled } = contextFor(env.DB, path)
      await answerDirectory(context, cache)
      await Promise.all(scheduled)
    }
    expect([...kept.keys()]).toEqual([KEY])
    expect(directoryCacheKey('https://example.org')).toBe('https://example.org/api/clubs')
  })
})

describe('empty data', () => {
  it('answers an empty list when there is no club, or the database gives none, in both shapes', async () => {
    for (const answer of [{ results: [] }, { results: undefined }]) {
      for (const on of [true, false]) {
        flags.pagesOn = on
        await caches.default.delete(KEY)
        const result = await invoke(clubsGet, { path: '/api/clubs', env: { DB: stubDb(answer) } })
        expect(result.status, `${on}`).toBe(200)
        expect(await result.response.clone().text(), `${on}`).toBe('{"clubs":[]}')
        const body = await expectContract(result, contract.response)
        expect(body.clubs).toEqual([])
        expect((on ? clubDirectoryResponseSchema : clubListResponseSchema).safeParse(body).success).toBe(true)
        await flushWaitUntil()
      }
    }
  })

  it('answers a club that has only its name and city, every other key null or false', async () => {
    const id = await writeClub({ name: 'Example Bare Edge Club' })
    flags.pagesOn = true
    const row = (await rowsOf(await invoke(clubsGet, { path: '/api/clubs' }))).find((c) => c.id === id)!
    expect(row).toMatchObject({
      id, name: 'Example Bare Edge Club', city: 'Example City', statement: null, point: null, weekend_play: false, scholastic_friendly: false,
      description: 'Chess club in Example City, Louisiana',
    })
    expect(row.slug).toBe(id)
  })
})

describe('the first place\'s point', () => {
  it('is the place first in the editor\'s order, by sort and then by id, whatever order they were saved in', async () => {
    const later = await writeClub({ name: 'Example Later Place Club', places: [{ sort: 5, at: [31.5, -92.5] }, { sort: 2, at: [30.5, -91.5] }, { sort: 9, at: [29.5, -90.5] }] })
    const tied = await writeClub({ name: 'Example Tied Place Club', places: [{ sort: 1, at: [32.1, -93.1] }, { sort: 1, at: [32.9, -93.9] }] })
    flags.pagesOn = true
    const clubs = await rowsOf(await invoke(clubsGet, { path: '/api/clubs' }))
    expect(clubs.find((c) => c.id === later)!.point).toEqual({ latitude: 30.5, longitude: -91.5 })
    expect(clubs.find((c) => c.id === tied)!.point).toEqual({ latitude: 32.1, longitude: -93.1 })
  })

  it('gives none for a pin with only one half set, and for a first place with only one half, never a half point', async () => {
    const halfPin = await writeClub({ name: 'Example Half Pin Club', pin: [30.5, null] })
    const halfPlace = await writeClub({ name: 'Example Half Place Club', pin: [30.5, -91.5], places: [{ sort: 0, at: [null, -91.5] }] })
    flags.pagesOn = true
    const clubs = await rowsOf(await invoke(clubsGet, { path: '/api/clubs' }))
    expect(clubs.find((c) => c.id === halfPin)!.point).toBeNull()
    expect(clubs.find((c) => c.id === halfPlace)!.point).toBeNull()
  })

  it('gives today\'s pin while the club has no place, and keeps today\'s latitude and longitude keys as they were', async () => {
    const pinned = await writeClub({ name: 'Example Pinned Edge Club', pin: [30.25, -91.75] })
    flags.pagesOn = true
    const row = (await rowsOf(await invoke(clubsGet, { path: '/api/clubs' }))).find((c) => c.id === pinned)!
    expect(row.point).toEqual({ latitude: 30.25, longitude: -91.75 })
    expect([row.latitude, row.longitude]).toEqual([30.25, -91.75])
  })
})

describe('the description', () => {
  it('is cut as the club page cuts it, and is the page\'s own words for a long About', async () => {
    const long = `Example Long Club plays rapid games ${'and talks about chess openings and endings '.repeat(12)}together.`
    expect(long.length).toBeGreaterThan(155)
    const id = await writeClub({ name: 'Example Long About Club', about: long })
    flags.pagesOn = true
    const row = (await rowsOf(await invoke(clubsGet, { path: '/api/clubs' }))).find((c) => c.id === id)!
    expect(typeof row.description).toBe('string')
    expect((row.description as string).length).toBeLessThanOrEqual(155)
    const page = await clubPageAnswer(env.DB, (await clubNamedBy(env.DB, id))!)
    expect(row.description).toBe(pageDescription(page))
  })

  it('is null for a club with a statement, and a statement of spaces counts as none', async () => {
    const withStatement = await writeClub({ name: 'Example Statement Edge Club', about: 'A made-up club.' })
    const spaces = await writeClub({ name: 'Example Spaces Edge Club' })
    await env.DB.prepare('UPDATE clubs SET how_we_meet_text = ? WHERE id = ?').bind('Fridays at 6:30 PM.', withStatement).run()
    await env.DB.prepare('UPDATE clubs SET how_we_meet_text = ? WHERE id = ?').bind(' \n ', spaces).run()
    flags.pagesOn = true
    const clubs = await rowsOf(await invoke(clubsGet, { path: '/api/clubs' }))
    expect(clubs.find((c) => c.id === withStatement)).toMatchObject({ statement: 'Fridays at 6:30 PM.', description: null })
    expect(clubs.find((c) => c.id === spaces)).toMatchObject({ statement: null, description: 'Chess club in Example City, Louisiana' })
  })
})

describe('role safety', () => {
  it('gives every role the one public answer, no 401 or 403 and nothing of the reader in it', async () => {
    await writeClub({ name: 'Example Role Edge Club' })
    const member = await seedMember({ fullName: 'Player One', email: 'player-one@example.org' })
    const admin = await seedAdmin()
    flags.pagesOn = true
    const bodies: string[] = []
    for (const as of [undefined, member, admin]) {
      await caches.default.delete(KEY)
      const result = await invoke(clubsGet, { as, path: '/api/clubs', headers: { 'X-Forwarded-For': '203.0.113.9' } })
      expect(result.status).toBe(200)
      bodies.push(await result.response.text())
      await flushWaitUntil()
    }
    expect(new Set(bodies).size).toBe(1)
    for (const text of ['Player One', 'player-one@example.org', '203.0.113.9', '@']) expect(bodies[0]).not.toContain(text)
  })

  it('reads a request with a bad or expired token as the same public read, never a refusal', async () => {
    await writeClub({ name: 'Example Token Edge Club' })
    flags.pagesOn = true
    const result = await invoke(clubsGet, { path: '/api/clubs', headers: { Authorization: 'Bearer not-a-token' } })
    expect(result.status).toBe(200)
    await expectContract(result, contract.response)
  })
})
