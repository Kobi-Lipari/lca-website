// test/integration/club-create-slug.test.ts
//
// POST /api/admin/clubs with the slug rule (WS09 step 4):
// - a new club's id is the slug of its name, and its slug is the same value,
//   written in the same insert;
// - a name whose slug another club holds as its id, its slug or an old slug,
//   or that is one of the words the club pages keep, gets the first free
//   short suffix, on its id and its slug alike, and never a failed save on
//   the unique slug index;
// - a club with a free name is created as before, its answer the 13
//   columns the handler answered before migration 0066, byte for byte;
// - only an LCA admin may create a club;
// - before 0066 has run, with no slug column or no old slugs table, the
//   club is made against the ids alone, with no slug and one log line.
// Every club, person and address here is made up.
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CLUB_SLUGS_UNREAD_LOG, onRequestPost as clubCreate } from '../../functions/api/admin/clubs'
import { laggingDb } from './clubTables'
import { seedAdmin, seedClub, seedMember } from './factories'
import { invoke, resetHarness } from './harness'

beforeEach(resetHarness)
afterEach(() => {
  vi.restoreAllMocks()
})

/** Today's 13 columns, in the table's own order: what the create answered before 0066. */
const COLUMNS = 'id, name, city, location, description, meeting_schedule, contact_email, created_at, color, image_url, region, latitude, longitude'
const create = (as: string | undefined, body: unknown, db?: D1Database) =>
  invoke(clubCreate, { method: 'POST', as, body, env: db ? { DB: db } : undefined })
const created = async (res: Awaited<ReturnType<typeof create>>) => (await res.json<{ club: { id: string } }>()).club.id
const slugOf = async (id: string) => (await env.DB.prepare('SELECT slug FROM clubs WHERE id = ?').bind(id).first<{ slug: string | null }>())?.slug

describe('a new club\'s slug', () => {
  it('a new club whose name\'s slug is another club\'s slug, old slug or a reserved word gets a suffix, on its id and its slug alike', async () => {
    const admin = await seedAdmin()
    // As after WS09 step 5: a club whose slug differs from its id, and its id kept as an old slug.
    await seedClub({ id: 'example-river', name: 'Example River Chess Club', city: 'Example City' })
    await env.DB.prepare(`UPDATE clubs SET slug = 'example-river-chess-club' WHERE id = 'example-river'`).run()
    await env.DB.prepare(`INSERT INTO club_slug_history (old_slug, club_id) VALUES ('example-river', 'example-river'), ('example-river-club', 'example-river')`).run()
    for (const [name, expected] of [
      ['Example River Chess Club', 'example-river-chess-club-2'],
      ['Example River', 'example-river-2'],
      ['Example River Club', 'example-river-club-2'],
      ['Logo', 'logo-2'],
      ['Contact!', 'contact-2'],
    ] as const) {
      const res = await create(admin, { name, city: 'Example Town' })
      expect(res.status, name).toBe(201)
      const id = await created(res)
      expect(id, name).toBe(expected)
      expect(await slugOf(id), name).toBe(expected)
    }
  })

  it('a new club with a free name is created as today', async () => {
    const admin = await seedAdmin()
    const res = await create(admin, { name: 'Example Free Chess Club', city: 'Example City', region: 'Bayou Region', contactEmail: 'club@example.org' })
    expect(res.status).toBe(201)
    const text = await res.response.text()
    const row = await env.DB.prepare(`SELECT ${COLUMNS} FROM clubs WHERE id = 'example-free-chess-club'`).first()
    expect(text).toBe(JSON.stringify({ club: row }))
    const { club } = JSON.parse(text) as { club: Record<string, unknown> }
    expect(Object.keys(club)).toEqual(COLUMNS.split(', '))
    expect(club).toMatchObject({ id: 'example-free-chess-club', name: 'Example Free Chess Club', city: 'Example City', region: 'Bayou Region', contact_email: 'club@example.org', color: '#c8a94a' })
    expect(await env.DB.prepare(
      'SELECT slug, about_text, weekend_play, scholastic_friendly, told_by, told_updated_at, confirmed_by, last_confirmed_at FROM clubs WHERE id = ?',
    ).bind('example-free-chess-club').first()).toEqual({
      slug: 'example-free-chess-club', about_text: null, weekend_play: 0, scholastic_friendly: 0, told_by: null, told_updated_at: null, confirmed_by: null, last_confirmed_at: null,
    })
  })

  it('gives clubs of one name the next free suffix each, and a name with no letter or digit the slug "club"', async () => {
    const admin = await seedAdmin()
    const ids: string[] = []
    for (const city of ['Example City', 'Example Town', 'Example Village']) ids.push(await created(await create(admin, { name: 'Example Twin Club', city })))
    expect(ids).toEqual(['example-twin-club', 'example-twin-club-2', 'example-twin-club-3'])
    for (const id of ids) expect(await slugOf(id)).toBe(id)
    const first = await create(admin, { name: '!!!', city: 'Example City' })
    expect(await created(first)).toBe('club')
    expect(await created(await create(admin, { name: '???', city: 'Example City' }))).toBe('club-2')
  })

  it('still refuses a missing name or city and a bad email, and writes no club', async () => {
    const admin = await seedAdmin()
    const before = await env.DB.prepare('SELECT COUNT(*) AS n FROM clubs').first()
    expect((await create(admin, { name: 'Example Club' })).status).toBe(400)
    expect((await create(admin, { city: 'Example City' })).status).toBe(400)
    const bad = await create(admin, { name: 'Example Club', city: 'Example City', contactEmail: 'not an address' })
    expect(bad.status).toBe(400)
    expect(await bad.json()).toEqual({ error: 'Contact email is not a valid address' })
    expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM clubs').first()).toEqual(before)
  })
})

describe('who may create a club', () => {
  it('refuses a club\'s rep, a member and a visitor, and writes no club', async () => {
    const clubId = await seedClub({ name: 'Example Rep Club' })
    const rep = await seedMember({ role: 'club_rep', clubId, fullName: 'Club Rep One', email: 'club.rep.one@example.org' })
    const plain = await seedMember({ fullName: 'Player One', email: 'player.one@example.org' })
    for (const [who, as, status] of [['a club\'s rep', rep, 403], ['a member', plain, 403], ['a visitor', undefined, 401]] as const) {
      const res = await create(as, { name: 'Example Refused Club', city: 'Example City' })
      expect(res.status, who).toBe(status)
    }
    expect(await env.DB.prepare(`SELECT COUNT(*) AS n FROM clubs WHERE name = 'Example Refused Club'`).first()).toEqual({ n: 0 })
  })
})

describe('before migration 0066 has run', () => {
  it('makes the club against the ids alone, with no slug and one log line, when the slug column or the old slugs table is missing', async () => {
    const admin = await seedAdmin()
    await seedClub({ id: 'example-lagging-club', name: 'Example Lagging Club' })
    for (const [missing, expected] of [
      [{ name: 'slug', kind: 'column' }, 'example-lagging-club-2'],
      [{ name: 'club_slug_history', kind: 'table' }, 'example-lagging-club-3'],
    ] as const) {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const res = await create(admin, { name: 'Example Lagging Club', city: 'Example City' }, laggingDb(missing))
      expect(res.status, missing.name).toBe(201)
      const id = await created(res)
      expect(id, missing.name).toBe(expected)
      expect(await slugOf(id), missing.name).toBeNull()
      expect(warn.mock.calls, missing.name).toEqual([[CLUB_SLUGS_UNREAD_LOG]])
      expect(JSON.stringify(warn.mock.calls)).not.toContain('example-lagging')
      warn.mockRestore()
    }
  })

  it('writes no log line when the tables are there, and does not take another failure for a missing table', async () => {
    const admin = await seedAdmin()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect((await create(admin, { name: 'Example Quiet Club', city: 'Example City' })).status).toBe(201)
    expect(warn).not.toHaveBeenCalled()
    const db = env.DB
    const failing = {
      prepare: (sql: string) => (sql.includes('UNION') ? { all: async () => { throw new Error('D1_ERROR: database is locked: SQLITE_BUSY') } } : db.prepare(sql)),
      batch: (statements: D1PreparedStatement[]) => db.batch(statements),
      exec: (sql: string) => db.exec(sql),
      dump: () => db.dump(),
    } as unknown as D1Database
    await expect(create(admin, { name: 'Example Locked Club', city: 'Example City' }, failing)).rejects.toThrow(/database is locked/)
    expect(warn).not.toHaveBeenCalled()
    expect(await env.DB.prepare(`SELECT COUNT(*) AS n FROM clubs WHERE name = 'Example Locked Club'`).first()).toEqual({ n: 0 })
  })
})
