// test/unit/club-tables-lagging-run.test.ts
//
// The three paths that are live with every switch off and read migration
// 0066's tables and columns (WS09 step 4), the member delete, the club
// delete and the club create, run on a real SQLite database built from
// migrations 0001 to 0060 alone, as production would stand if the site's
// build reached it before the migration run: each catches the missing
// table or column, writes its one log line and goes on as before 0066. On a
// database built from every migration the same three write no log line.
// isMissingTableOrColumn, which tells a missing table or column from any
// other failure, is held here as well.
//
// The handlers are called with a small D1 over node:sqlite; the admin's
// sign-in and the sign-in service's account delete are stood in for, since
// neither is what is tested. Every club, person and address is made up.
import type { DatabaseSync, SQLInputValue } from 'node:sqlite'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { migrationFiles, openMigratedDb } from './helpers/sqlite'

vi.mock('../../functions/utils/auth', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../functions/utils/auth')>()
  return { ...real, requireAdmin: async () => ({ member: { id: 'example-admin', role: 'lca_admin' } }) }
})
vi.mock('../../functions/utils/supabase', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../functions/utils/supabase')>()
  return { ...real, deleteSupabaseUser: async () => false }
})

const { CLUB_SLUGS_UNREAD_LOG, onRequestPost: clubCreate } = await import('../../functions/api/admin/clubs')
const { CLUB_ROWS_UNCLEARED_LOG, onRequestDelete: clubDelete } = await import('../../functions/api/admin/clubs/[id]')
const { CLUB_REFERENCES_UNCLEARED_LOG, onRequestDelete: memberDelete } = await import('../../functions/api/admin/members/[id]')
const { isMissingTableOrColumn } = await import('../../functions/utils/clubs/migrationLag')

afterEach(() => {
  vi.restoreAllMocks()
})

const TO_0060 = migrationFiles().filter((f) => f < '0061')

/** A D1 over a node:sqlite database: prepare, bind, first, all, run and a batch that runs as one transaction. */
function d1Over(db: DatabaseSync): D1Database {
  const plain = (row: unknown) => (row ? { ...(row as Record<string, unknown>) } : null)
  const statement = (sql: string, args: SQLInputValue[] = []) => ({
    bind: (...values: SQLInputValue[]) => statement(sql, values),
    first: async (column?: string) => {
      const row = plain(db.prepare(sql).get(...args))
      return column === undefined ? row : row?.[column] ?? null
    },
    all: async () => ({ results: db.prepare(sql).all(...args).map(plain), success: true, meta: {} }),
    run: async () => ({ success: true, meta: { changes: Number(db.prepare(sql).run(...args).changes) } }),
  })
  return {
    prepare: (sql: string) => statement(sql),
    batch: async (statements: Array<ReturnType<typeof statement>>) => {
      db.exec('BEGIN')
      try {
        const out = []
        for (const s of statements) out.push(await s.run())
        db.exec('COMMIT')
        return out
      } catch (err) {
        db.exec('ROLLBACK')
        throw err
      }
    },
  } as unknown as D1Database
}

/** A database with a made up club and member, built to 0060 alone or from every migration. */
function database(files: string[]): DatabaseSync {
  return openMigratedDb({
    files,
    extra: `
      INSERT INTO clubs (id, name, city) VALUES ('example-chess-club', 'Example Chess Club', 'Example City');
      INSERT INTO members (id, email, full_name, club_id) VALUES ('player-one', 'player.one@example.org', 'Player One', 'example-chess-club');
    `,
  })
}

/** Calls a handler as Pages would, with the database and the address part given. */
async function call(handler: PagesFunction<never>, db: DatabaseSync, init: { method: string; id?: string; body?: unknown }): Promise<Response> {
  const request = new Request('https://lca-website.pages.dev/api/test', {
    method: init.method,
    headers: init.body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  })
  return handler({
    request, env: { DB: d1Over(db) }, params: init.id === undefined ? {} : { id: init.id }, data: {}, functionPath: '/api/test',
    waitUntil: () => {}, passThroughOnException: () => {}, next: async () => new Response(null, { status: 404 }),
  } as unknown as Parameters<PagesFunction<never>>[0])
}
const quiet = () => vi.spyOn(console, 'warn').mockImplementation(() => {})
const lines = (warn: ReturnType<typeof quiet>) => warn.mock.calls.map(([line]) => line)

describe('isMissingTableOrColumn', () => {
  it('reads SQLite\'s and D1\'s words for a missing table or column, in the error or its cause, and nothing else', () => {
    expect(isMissingTableOrColumn(new Error('no such table: club_places'))).toBe(true)
    expect(isMissingTableOrColumn(new Error('D1_ERROR: no such column: told_by: SQLITE_ERROR'))).toBe(true)
    expect(isMissingTableOrColumn(new Error('D1_ERROR', { cause: new Error('no such table: club_rep_requests') }))).toBe(true)
    expect(isMissingTableOrColumn('no such column: slug')).toBe(true)
    expect(isMissingTableOrColumn(new Error('D1_ERROR: database is locked: SQLITE_BUSY'))).toBe(false)
    expect(isMissingTableOrColumn(new Error('FOREIGN KEY constraint failed'))).toBe(false)
    expect(isMissingTableOrColumn(new Error('UNIQUE constraint failed: clubs.slug'))).toBe(false)
    expect(isMissingTableOrColumn(undefined)).toBe(false)
  })
})

describe('on a database built to 0060 alone', () => {
  it('has none of 0066\'s tables and columns, so the three paths meet them missing', () => {
    const db = database(TO_0060)
    const tables = (db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`).all() as Array<{ name: string }>).map((r) => r.name)
    for (const table of ['club_slug_history', 'club_places', 'club_reports', 'club_rep_requests']) expect(tables, table).not.toContain(table)
    const columns = (db.prepare(`SELECT name FROM pragma_table_info('clubs')`).all() as Array<{ name: string }>).map((r) => r.name)
    for (const column of ['slug', 'told_by', 'confirmed_by']) expect(columns, column).not.toContain(column)
  })

  it('deletes a member with one log line, naming no member', async () => {
    const db = database(TO_0060)
    const warn = quiet()
    const res = await call(memberDelete as PagesFunction<never>, db, { method: 'DELETE', id: 'player-one' })
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('{"success":true,"authDeleted":false}')
    expect(lines(warn).filter((l) => l === CLUB_REFERENCES_UNCLEARED_LOG)).toHaveLength(1)
    expect(CLUB_REFERENCES_UNCLEARED_LOG).not.toMatch(/player|@/i)
    expect(db.prepare(`SELECT COUNT(*) AS n FROM members WHERE id = 'player-one'`).get()).toEqual({ n: 0 })
  })

  it('deletes a club with one log line, naming no club', async () => {
    const db = database(TO_0060)
    const warn = quiet()
    const res = await call(clubDelete as PagesFunction<never>, db, { method: 'DELETE', id: 'example-chess-club' })
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('{"success":true}')
    expect(lines(warn)).toEqual([CLUB_ROWS_UNCLEARED_LOG])
    expect(CLUB_ROWS_UNCLEARED_LOG).not.toContain('example')
    expect(db.prepare(`SELECT COUNT(*) AS n FROM clubs WHERE id = 'example-chess-club'`).get()).toEqual({ n: 0 })
    expect(db.prepare(`SELECT club_id FROM members WHERE id = 'player-one'`).get()).toEqual({ club_id: null })
  })

  it('creates a club against the ids alone, with one log line, its answer today\'s 13 columns', async () => {
    const db = database(TO_0060)
    const warn = quiet()
    const res = await call(clubCreate as PagesFunction<never>, db, { method: 'POST', body: { name: 'Example Chess Club', city: 'Example Town' } })
    expect(res.status).toBe(201)
    const { club } = await res.json() as { club: Record<string, unknown> }
    expect(club.id).toBe('example-chess-club-2')
    expect(Object.keys(club)).toEqual(['id', 'name', 'city', 'location', 'description', 'meeting_schedule', 'contact_email', 'created_at', 'color', 'image_url', 'region', 'latitude', 'longitude'])
    expect(lines(warn)).toEqual([CLUB_SLUGS_UNREAD_LOG])
    expect(CLUB_SLUGS_UNREAD_LOG).not.toContain('example')
  })
})

describe('on a database built from every migration', () => {
  it('runs the three paths with no log line of theirs, and gives the new club its slug', async () => {
    const db = database(migrationFiles())
    const warn = quiet()
    db.exec(`UPDATE clubs SET told_by = 'player-one' WHERE id = 'example-chess-club'`)
    expect((await call(memberDelete as PagesFunction<never>, db, { method: 'DELETE', id: 'player-one' })).status).toBe(200)
    expect(db.prepare(`SELECT told_by FROM clubs WHERE id = 'example-chess-club'`).get()).toEqual({ told_by: null })
    const made = await call(clubCreate as PagesFunction<never>, db, { method: 'POST', body: { name: 'Example Chess Club', city: 'Example Town' } })
    expect(made.status).toBe(201)
    expect(db.prepare(`SELECT slug FROM clubs WHERE id = 'example-chess-club-2'`).get()).toEqual({ slug: 'example-chess-club-2' })
    db.exec(`INSERT INTO club_places (club_id, name) VALUES ('example-chess-club', 'Example Library')`)
    expect((await call(clubDelete as PagesFunction<never>, db, { method: 'DELETE', id: 'example-chess-club' })).status).toBe(200)
    expect(db.prepare('SELECT COUNT(*) AS n FROM club_places').get()).toEqual({ n: 0 })
    for (const line of [CLUB_REFERENCES_UNCLEARED_LOG, CLUB_ROWS_UNCLEARED_LOG, CLUB_SLUGS_UNREAD_LOG]) expect(lines(warn)).not.toContain(line)
  })
})
