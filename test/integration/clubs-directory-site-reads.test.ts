// test/integration/clubs-directory-site-reads.test.ts
//
// What the site makes of GET /api/clubs (WS09 step 33), with the real
// handler's answer in both shapes and the site's own plain code reading it:
// - with CLUB_PAGES_ON set, every row passes the test that tells the
//   directory's answer from today's (src/areas/clubs/directoryRows.ts), so
//   the page draws the directory, and the directory's own order, a plain
//   A to Z by code points with the club's id breaking a tie, is the order
//   the server wrote, so the list does not move once the page has it;
// - with it unset, as it ships, no row passes, so the site draws today's
//   Clubs page whole and never half a directory;
// - the pins the directory draws are exactly the rows that have a point,
//   a pin with one half set or a first place with none giving no pin;
// - a kept answer, stale after a save, still draws the directory;
// - every role reads the same answer and so draws the same page.
// There is no new endpoint here, so this is the role-safety and shape
// check of the one the directory reads. Every club here is made up.
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NO_FILTERS, directoryView } from '../../domain/clubs/order'
import { onRequestGet as clubsGet } from '../../functions/api/clubs'
import { directoryCacheKey } from '../../functions/utils/clubs/directory'
import { directoryRowsOf, isDirectoryRow } from '../../src/areas/clubs/directoryRows'
import { seedAdmin, seedClub, seedMember } from './factories'
import { flushWaitUntil, invoke, resetHarness } from './harness'

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

const KEY = directoryCacheKey('https://lca-website.pages.dev')

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
/** A made-up club written as the club editor saves one; answers its id. */
async function writeClub(opts: { name: string; city?: string; statement?: string | null; pin?: [number | null, number | null]; places?: Array<[number | null, number | null]> }): Promise<string> {
  made += 1
  const id = await seedClub({ id: `site-read-${made}`, name: opts.name, city: opts.city ?? 'Example City' })
  await env.DB.prepare('UPDATE clubs SET how_we_meet_text = ?, latitude = ?, longitude = ? WHERE id = ?')
    .bind(opts.statement ?? null, opts.pin?.[0] ?? null, opts.pin?.[1] ?? null, id).run()
  for (const [i, [latitude, longitude]] of (opts.places ?? []).entries()) {
    await env.DB.prepare('INSERT INTO club_places (club_id, name, sort, latitude, longitude) VALUES (?, ?, ?, ?, ?)')
      .bind(id, `Example Hall ${i + 1}`, i, latitude, longitude).run()
  }
  return id
}

type Row = Record<string, unknown>
const rowsOf = async (result: { response: Response }): Promise<Row[]> =>
  (JSON.parse(await result.response.clone().text()) as { clubs: Row[] }).clubs

/** The made-up clubs of this file, in the order the server wrote them, with their pins in the order the directory draws them. */
const ours = (rows: Row[], ids: string[]) => rows.filter((r) => ids.includes(String(r.id)))

async function seedMixed() {
  return [
    await writeClub({ name: 'example Lowercase Club', statement: 'Fridays at 5:00 PM.', pin: [30.2, -91.2] }),
    await writeClub({ name: 'Example Same Name Club', statement: null, places: [[30.5, -91.5]] }),
    await writeClub({ name: 'Example Same Name Club', statement: 'Mondays at 6:30 PM.', pin: [30.6, -91.6] }),
    await writeClub({ name: 'Example Half Pin Club', statement: 'Saturdays at 10:00 AM.', pin: [30.7, null] }),
    await writeClub({ name: 'Example No Point Club', statement: '   ' }),
    await writeClub({ name: 'Éxample Accent Club', statement: 'Sundays at 2:00 PM.', pin: [29.9, -90.1] }),
    await writeClub({ name: 'Example Unplaced Club', statement: null, pin: [30.3, -91.3], places: [[null, null]] }),
  ]
}

describe('the answer with CLUB_PAGES_ON set', () => {
  it('passes the test for the directory\'s answer in every row, so the site draws the directory, and no row of it is today\'s', async () => {
    const ids = await seedMixed()
    flags.pagesOn = true
    const rows = await rowsOf(await invoke(clubsGet, { path: '/api/clubs' }))
    expect(ours(rows, ids)).toHaveLength(ids.length)
    for (const row of rows) expect(isDirectoryRow(row), String(row.id)).toBe(true)
    expect(directoryRowsOf(rows)).toHaveLength(rows.length)
  })

  it('is already in the directory\'s own order, ties by id, so the first paint does not reorder what the server sent', async () => {
    const ids = await seedMixed()
    flags.pagesOn = true
    const rows = await rowsOf(await invoke(clubsGet, { path: '/api/clubs' }))
    const clubs = directoryRowsOf(rows)!
    const view = directoryView(clubs, { from: null, name: '', filters: NO_FILTERS })
    expect(view.rows.map((r) => r.club.id)).toEqual(rows.map((r) => r.id))
    // Two clubs of one name: the lower id first.
    const same = ours(rows, ids).filter((r) => r.name === 'Example Same Name Club').map((r) => r.id)
    expect(same).toEqual([...same].sort())
    // A capital before a small letter, and an accented letter after both.
    const names = ours(rows, ids).map((r) => r.name)
    expect(names.indexOf('example Lowercase Club')).toBeLessThan(names.indexOf('Éxample Accent Club'))
    expect(names.indexOf('Example Same Name Club')).toBeLessThan(names.indexOf('example Lowercase Club'))
  })

  it('gives the directory a pin for exactly the rows that have a point, none for a half pin, a blank first place or no point', async () => {
    const ids = await seedMixed()
    flags.pagesOn = true
    const rows = await rowsOf(await invoke(clubsGet, { path: '/api/clubs' }))
    const view = directoryView(directoryRowsOf(rows)!, { from: null, name: '', filters: NO_FILTERS })
    const pinned = view.pins.map((c) => c.id)
    expect(pinned).toEqual(rows.filter((r) => r.point !== null).map((r) => r.id))
    const named = (name: string) => ours(rows, ids).filter((r) => r.name === name)
    expect(named('Example Half Pin Club')[0].point).toBeNull()
    expect(named('Example Unplaced Club')[0].point).toBeNull()
    expect(named('Example No Point Club')[0].point).toBeNull()
    expect(named('Example Same Name Club').map((r) => r.point)).toHaveLength(2)
    expect(named('Example Same Name Club').map((r) => (r.point as { latitude: number }).latitude).sort()).toEqual([30.5, 30.6])
    for (const id of ids) {
      const row = rows.find((r) => r.id === id)!
      expect(pinned.includes(id), String(row.name)).toBe(row.point !== null)
    }
  })

  it('still draws the directory from a kept answer that is stale after a save, and says nothing new in it', async () => {
    const id = await writeClub({ name: 'Example Kept Club', statement: 'Tuesdays at 7:00 PM.', pin: [30.2, -91.2] })
    flags.pagesOn = true
    const first = await rowsOf(await invoke(clubsGet, { path: '/api/clubs' }))
    await flushWaitUntil()
    await env.DB.prepare('UPDATE clubs SET how_we_meet_text = ?, latitude = NULL, longitude = NULL WHERE id = ?').bind('Wednesdays at 8:00 PM.', id).run()
    const later = await rowsOf(await invoke(clubsGet, { path: '/api/clubs' }))
    expect(later).toEqual(first)
    expect(later.find((r) => r.id === id)).toMatchObject({ statement: 'Tuesdays at 7:00 PM.' })
    expect(directoryRowsOf(later)).not.toBeNull()
  })

  it('role safety: signed out, a member and an LCA admin read the same rows, each the directory\'s, and none of the rows carries a keeper, a seat or an email address', async () => {
    await seedMixed()
    const member = await seedMember()
    const admin = await seedAdmin()
    flags.pagesOn = true
    const texts: string[] = []
    for (const as of [undefined, member, admin] as const) {
      const result = await invoke(clubsGet, { path: '/api/clubs', as })
      expect(result.status).toBe(200)
      texts.push(await result.response.clone().text())
      expect(directoryRowsOf(await rowsOf(result))).not.toBeNull()
      await caches.default.delete(KEY)
    }
    expect(new Set(texts).size).toBe(1)
    expect(texts[0]).not.toMatch(/@|mailto|keeper|officer|contact|seat/i)
  })
})

describe('the answer with CLUB_PAGES_ON unset, as it ships', () => {
  it('passes the test in no row, so the site draws today\'s Clubs page whole, never half a directory', async () => {
    const ids = await seedMixed()
    const rows = await rowsOf(await invoke(clubsGet, { path: '/api/clubs' }))
    expect(ours(rows, ids)).toHaveLength(ids.length)
    for (const row of rows) expect(isDirectoryRow(row), String(row.id)).toBe(false)
    expect(directoryRowsOf(rows)).toBeNull()
  })

  it('draws today\'s page for every reader too, and a wide answer from one club alone would not be taken for the whole list', async () => {
    await seedMixed()
    const admin = await seedAdmin()
    const rows = await rowsOf(await invoke(clubsGet, { path: '/api/clubs', as: admin }))
    expect(directoryRowsOf(rows)).toBeNull()
    // One row of the wider shape among today's rows is still today's answer.
    flags.pagesOn = true
    await caches.default.delete(KEY)
    const wide = await rowsOf(await invoke(clubsGet, { path: '/api/clubs' }))
    expect(directoryRowsOf([...rows.slice(0, 1), wide[0]])).toBeNull()
  })
})
