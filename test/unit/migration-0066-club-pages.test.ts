// test/unit/migration-0066-club-pages.test.ts
//
// Migration 0066 (WS09 step 4) on a real SQLite database with foreign keys
// on, as on D1, and its record in drizzle/meta:
// - migrations 0001 to 0065 run first, with a made up club and member of
//   their own, then 0066;
// - the fifteen club page columns go on the end of clubs, each nullable or
//   with its default, reading NULL, or 0 for the two flags, on every club
//   already there, so slug is NULL for every club until migration 0067
//   fills it; the unique index idx_clubs_slug refuses two clubs with one
//   slug and takes any number of NULLs;
// - club_slug_history, club_places, club_reports (with escalated_at) and
//   club_rep_requests are created with their columns, keys and defaults;
// - their CHECKs refuse a kind, a status or a connection off the brief's
//   lists, a suggestion with no club and a new club with one;
// - every reference to clubs or members the file adds has no delete action,
//   and each is cleared by the member delete or the club delete; with no
//   delete action written, test/unit/migration-safety.test.ts counts no new
//   link;
// - no table is rebuilt and no row of today's changes; the tables the brief
//   gives later steps (club_photos, zip_regions, club_distances and the four
//   tournaments columns) are not here;
// - run a second time it stops at its first statement and changes nothing;
// - drizzle/meta: the journal's twelfth entry and 0011_snapshot.json, which
//   follows 0010's and records the four tables and the fifteen columns.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import { beforeAll, describe, expect, it } from 'vitest'
import { applyMigrations, foreignKeysOn, migrationFiles, MIGRATIONS_DIR, openMigratedDb, userTables } from './helpers/sqlite'

const FILE = '0066_club_pages.sql'
const BEFORE = migrationFiles().filter((f) => f < '0066')
const ROOT = join(MIGRATIONS_DIR, '..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')

/** The fifteen columns on clubs, in the brief's order: name, declared type, NOT NULL and default. */
const CLUB_COLUMNS: Array<[string, string, number, string | null]> = [
  ['slug', 'TEXT', 0, null],
  ['about_text', 'TEXT', 0, null],
  ['how_we_meet_text', 'TEXT', 0, null],
  ['cost_text', 'TEXT', 0, null],
  ['welcome_text', 'TEXT', 0, null],
  ['weekend_play', 'INTEGER', 1, '0'],
  ['scholastic_friendly', 'INTEGER', 1, '0'],
  ['contact_name_public', 'TEXT', 0, null],
  ['facebook_url', 'TEXT', 0, null],
  ['website_url', 'TEXT', 0, null],
  ['other_url', 'TEXT', 0, null],
  ['told_updated_at', 'TEXT', 0, null],
  ['told_by', 'TEXT', 0, null],
  ['last_confirmed_at', 'TEXT', 0, null],
  ['confirmed_by', 'TEXT', 0, null],
]
/** Each new table's columns in order, with the primary key and the defaults the brief gives. */
const TABLES: Record<string, { columns: string[]; pk: string[]; defaults: Record<string, string> }> = {
  club_slug_history: { columns: ['old_slug', 'club_id'], pk: ['old_slug'], defaults: {} },
  club_places: { columns: ['id', 'club_id', 'name', 'street', 'note', 'latitude', 'longitude', 'sort'], pk: ['id'], defaults: { sort: '0' } },
  club_reports: {
    columns: ['id', 'club_id', 'kind', 'field', 'message', 'proposed_json', 'region', 'reporter_email', 'status', 'resolved_by', 'resolved_at', 'created_at', 'escalated_at'],
    pk: ['id'],
    defaults: { status: '\'open\'', created_at: 'datetime(\'now\')' },
  },
  club_rep_requests: {
    columns: ['id', 'club_id', 'member_id', 'connection', 'note', 'status', 'decided_by', 'decided_at', 'created_at'],
    pk: ['id'],
    defaults: { status: '\'open\'', created_at: 'datetime(\'now\')' },
  },
}
/** Every reference the file adds, as child table and column to parent table. */
const REFERENCES = [
  'club_places.club_id -> clubs', 'club_rep_requests.club_id -> clubs', 'club_rep_requests.decided_by -> members',
  'club_rep_requests.member_id -> members', 'club_reports.club_id -> clubs', 'club_reports.resolved_by -> members',
  'club_slug_history.club_id -> clubs', 'clubs.confirmed_by -> members', 'clubs.told_by -> members',
]
/** The statement in a delete handler that clears each reference before the row it points at goes. */
const CLEARED_BY: Record<string, [string, string]> = {
  'clubs.told_by -> members': ['functions/api/admin/members/[id].ts', 'UPDATE clubs SET told_by = NULL WHERE told_by = ?'],
  'clubs.confirmed_by -> members': ['functions/api/admin/members/[id].ts', 'UPDATE clubs SET confirmed_by = NULL WHERE confirmed_by = ?'],
  'club_reports.resolved_by -> members': ['functions/api/admin/members/[id].ts', 'UPDATE club_reports SET resolved_by = NULL WHERE resolved_by = ?'],
  'club_rep_requests.decided_by -> members': ['functions/api/admin/members/[id].ts', 'UPDATE club_rep_requests SET decided_by = NULL WHERE decided_by = ?'],
  'club_rep_requests.member_id -> members': ['functions/api/admin/members/[id].ts', 'DELETE FROM club_rep_requests WHERE member_id = ?'],
  'club_places.club_id -> clubs': ['functions/api/admin/clubs/[id].ts', 'DELETE FROM club_places WHERE club_id = ?'],
  'club_slug_history.club_id -> clubs': ['functions/api/admin/clubs/[id].ts', 'DELETE FROM club_slug_history WHERE club_id = ?'],
  'club_reports.club_id -> clubs': ['functions/api/admin/clubs/[id].ts', 'DELETE FROM club_reports WHERE club_id = ?'],
  'club_rep_requests.club_id -> clubs': ['functions/api/admin/clubs/[id].ts', 'DELETE FROM club_rep_requests WHERE club_id = ?'],
}

type Row = Record<string, unknown>
const all = <T = Row>(db: DatabaseSync, sql: string, ...args: Array<string | number | null>) =>
  db.prepare(sql).all(...args) as unknown as T[]
const one = <T = Row>(db: DatabaseSync, sql: string, ...args: Array<string | number | null>) =>
  db.prepare(sql).get(...args) as unknown as T
const columnsOf = (db: DatabaseSync, table: string) =>
  all<{ name: string; type: string; notnull: number; dflt_value: string | null; pk: number }>(db, `SELECT name, type, "notnull", dflt_value, pk FROM pragma_table_info('${table}')`)
const contents = (db: DatabaseSync, tables: string[]) =>
  Object.fromEntries(tables.map((t) => [t, all(db, `SELECT rowid AS _rowid, * FROM "${t}" ORDER BY rowid`)]))
const throws = (db: DatabaseSync, sql: string) => {
  try {
    db.exec(sql)
  } catch (err) {
    return (err as Error).message
  }
  return null
}
const unbracket = (value: string | null) => (value === null ? null : value.replace(/^\((.*)\)$/, '$1'))

/** A made up club and member, written before 0066 as today's code writes them. */
function insertRows(db: DatabaseSync): void {
  db.exec(`INSERT INTO clubs (id, name, city, contact_email) VALUES ('example-chess-club', 'Example Chess Club', 'Example City', 'club@example.org')`)
  db.exec(`INSERT INTO members (id, email, full_name, club_id) VALUES ('player-one', 'player.one@example.org', 'Player One', 'example-chess-club')`)
}

describe('0066_club_pages.sql on a database that holds rows', () => {
  let db: DatabaseSync
  let tablesBefore: string[]
  let before: ReturnType<typeof contents>
  let schemaBefore: Record<string, string | null>

  beforeAll(() => {
    db = openMigratedDb({ files: BEFORE })
    insertRows(db)
    tablesBefore = userTables(db)
    before = contents(db, tablesBefore)
    schemaBefore = Object.fromEntries(all<{ type: string; name: string; sql: string | null }>(db, 'SELECT type, name, sql FROM sqlite_master').map((r) => [`${r.type} ${r.name}`, r.sql]))
    applyMigrations(db, [FILE])
  })

  it('runs straight after 0065, with foreign keys on and every reference still whole', () => {
    const files = migrationFiles()
    expect(files.filter((f) => f.startsWith('0066_'))).toEqual([FILE])
    expect(files.indexOf(FILE)).toBe(files.indexOf('0065_club_regions.sql') + 1)
    expect(foreignKeysOn(db)).toBe(1)
    expect(all(db, 'PRAGMA foreign_key_check')).toEqual([])
  })

  it('puts the fifteen columns on the end of clubs, each nullable or with its default, and no part of the key', () => {
    const columns = columnsOf(db, 'clubs')
    expect(columns.slice(0, 13).map((c) => c.name)).toEqual([
      'id', 'name', 'city', 'location', 'description', 'meeting_schedule', 'contact_email', 'created_at', 'color', 'image_url', 'region', 'latitude', 'longitude',
    ])
    expect(columns.slice(13).map((c) => [c.name, c.type, c.notnull, c.dflt_value])).toEqual(CLUB_COLUMNS)
    expect(columns.slice(13).every((c) => c.pk === 0)).toBe(true)
  })

  it('leaves every club with no slug and the two flags at 0, so the unique index holds any number of clubs before 0067 fills them', () => {
    const clubs = all<Row>(db, 'SELECT * FROM clubs')
    expect(clubs.length).toBeGreaterThan(20)
    for (const club of clubs) {
      for (const [name, , , dflt] of CLUB_COLUMNS) expect(club[name], `${String(club.id)}.${name}`).toBe(dflt === null ? null : Number(dflt))
    }
    const index = all<{ name: string; unique: number; partial: number }>(db, 'PRAGMA index_list(clubs)').find((i) => i.name === 'idx_clubs_slug')
    expect(index).toMatchObject({ unique: 1, partial: 0 })
    expect(all<{ name: string }>(db, 'PRAGMA index_info(idx_clubs_slug)').map((c) => c.name)).toEqual(['slug'])
    expect(one(db, 'SELECT COUNT(*) AS n FROM clubs WHERE slug IS NULL')).toEqual({ n: clubs.length })
  })

  it('refuses two clubs with one slug and takes a slug a club gives up', () => {
    const scratch = openMigratedDb({ files: [...BEFORE, FILE] })
    scratch.exec(`INSERT INTO clubs (id, name, city, slug) VALUES ('club-a', 'Example Chess Club', 'Example City', 'example-chess-club')`)
    expect(throws(scratch, `INSERT INTO clubs (id, name, city, slug) VALUES ('club-b', 'Example Chess Club', 'Example Town', 'example-chess-club')`)).toMatch(/UNIQUE constraint failed: clubs\.slug/)
    scratch.exec(`UPDATE clubs SET slug = 'example-chess-club-old' WHERE id = 'club-a'`)
    expect(throws(scratch, `INSERT INTO clubs (id, name, city, slug) VALUES ('club-b', 'Example Chess Club', 'Example Town', 'example-chess-club')`)).toBeNull()
  })

  it('creates the four tables, each column in the brief\'s order with its key and defaults', () => {
    for (const [table, shape] of Object.entries(TABLES)) {
      const columns = columnsOf(db, table)
      expect(columns.map((c) => c.name), table).toEqual(shape.columns)
      expect(columns.filter((c) => c.pk > 0).map((c) => c.name), table).toEqual(shape.pk)
      expect(Object.fromEntries(columns.filter((c) => c.dflt_value !== null).map((c) => [c.name, unbracket(c.dflt_value)])), table).toEqual(shape.defaults)
    }
    expect(userTables(db).filter((t) => !tablesBefore.includes(t)).sort()).toEqual(Object.keys(TABLES).sort())
  })

  it('fills the defaults: a place sorts at 0, and a report and a rep request open, with the time they were made', () => {
    const scratch = openMigratedDb({ files: [...BEFORE, FILE], extra: `
      INSERT INTO clubs (id, name, city) VALUES ('club-a', 'Example Chess Club', 'Example City');
      INSERT INTO members (id, email, full_name) VALUES ('m-one', 'player.one@example.org', 'Player One');
      INSERT INTO club_places (club_id, name) VALUES ('club-a', 'Example Library');
      INSERT INTO club_reports (club_id, kind, message) VALUES ('club-a', 'suggestion', 'They meet on Tuesdays now.');
      INSERT INTO club_rep_requests (club_id, member_id, connection) VALUES ('club-a', 'm-one', 'runs_it');
    ` })
    expect(one(scratch, 'SELECT id, sort, street, note, latitude, longitude FROM club_places')).toEqual({ id: 1, sort: 0, street: null, note: null, latitude: null, longitude: null })
    expect(one(scratch, 'SELECT status, resolved_by, escalated_at, created_at IS NOT NULL AS stamped FROM club_reports')).toEqual({ status: 'open', resolved_by: null, escalated_at: null, stamped: 1 })
    expect(one(scratch, 'SELECT status, decided_by, created_at IS NOT NULL AS stamped FROM club_rep_requests')).toEqual({ status: 'open', decided_by: null, stamped: 1 })
  })

  it('refuses a report of a bad kind or status, a suggestion with no club and a new club with one, and a request of a bad connection or status', () => {
    const scratch = openMigratedDb({ files: [...BEFORE, FILE], extra: `
      INSERT INTO clubs (id, name, city) VALUES ('club-a', 'Example Chess Club', 'Example City');
      INSERT INTO members (id, email, full_name) VALUES ('m-one', 'player.one@example.org', 'Player One');
    ` })
    const report = (club: string | null, kind: string, status = 'open') =>
      throws(scratch, `INSERT INTO club_reports (club_id, kind, message, status) VALUES (${club === null ? 'NULL' : `'${club}'`}, '${kind}', 'A made up message.', '${status}')`)
    expect(report('club-a', 'complaint')).toMatch(/CHECK constraint failed/)
    expect(report('club-a', 'suggestion', 'lost')).toMatch(/CHECK constraint failed/)
    expect(report(null, 'suggestion')).toMatch(/CHECK constraint failed/)
    expect(report('club-a', 'new_club')).toMatch(/CHECK constraint failed/)
    expect(report('club-a', 'start_club')).toMatch(/CHECK constraint failed/)
    for (const status of ['open', 'applied', 'answered', 'dismissed']) expect(report('club-a', 'suggestion', status), status).toBeNull()
    expect(report(null, 'new_club')).toBeNull()
    expect(report(null, 'start_club')).toBeNull()
    const request = (connection: string, status = 'open') =>
      throws(scratch, `INSERT INTO club_rep_requests (club_id, member_id, connection, status) VALUES ('club-a', 'm-one', '${connection}', '${status}')`)
    expect(request('owns_it')).toMatch(/CHECK constraint failed/)
    expect(request('runs_it', 'maybe')).toMatch(/CHECK constraint failed/)
    for (const connection of ['runs_it', 'helps_run_it', 'keeps_page', 'other']) expect(request(connection), connection).toBeNull()
    for (const status of ['approved', 'declined']) expect(request('other', status), status).toBeNull()
  })

  it('gives every reference to clubs or members no delete action, and the member delete or the club delete clears each one', () => {
    const found: string[] = []
    for (const table of ['clubs', ...Object.keys(TABLES)]) {
      for (const fk of all<{ table: string; from: string; on_delete: string; on_update: string }>(db, `PRAGMA foreign_key_list(${table})`)) {
        if (table === 'clubs' && !CLUB_COLUMNS.some(([name]) => name === fk.from)) continue
        expect([fk.on_delete, fk.on_update], `${table}.${fk.from}`).toEqual(['NO ACTION', 'NO ACTION'])
        found.push(`${table}.${fk.from} -> ${fk.table}`)
      }
    }
    expect(found.sort()).toEqual([...REFERENCES].sort())
    expect(Object.keys(CLEARED_BY).sort()).toEqual([...REFERENCES].sort())
    for (const [reference, [handler, statement]] of Object.entries(CLEARED_BY)) expect(read(handler), reference).toContain(`prepare('${statement}')`)
    // No delete action is written, so test/unit/migration-safety.test.ts, which counts ON DELETE CASCADE and SET NULL, finds no new link.
    expect(read(`migrations/${FILE}`).replace(/--[^\n]*/g, '')).not.toMatch(/\bON\s+(?:DELETE|UPDATE)\b/i)
  })

  it('keeps a club or a member that a new row names from being deleted from under it', () => {
    const scratch = openMigratedDb({ files: [...BEFORE, FILE], extra: `
      INSERT INTO clubs (id, name, city) VALUES ('club-a', 'Example Chess Club', 'Example City');
      INSERT INTO members (id, email, full_name) VALUES ('m-one', 'player.one@example.org', 'Player One');
      INSERT INTO members (id, email, full_name) VALUES ('m-two', 'player.two@example.org', 'Player Two');
      UPDATE clubs SET told_by = 'm-one' WHERE id = 'club-a';
      INSERT INTO club_places (club_id, name) VALUES ('club-a', 'Example Library');
    ` })
    expect(throws(scratch, `DELETE FROM members WHERE id = 'm-one'`)).toMatch(/FOREIGN KEY constraint failed/)
    expect(throws(scratch, `DELETE FROM clubs WHERE id = 'club-a'`)).toMatch(/FOREIGN KEY constraint failed/)
    expect(throws(scratch, `DELETE FROM members WHERE id = 'm-two'`)).toBeNull()
  })

  it('changes no row: every row already there keeps its values and its rowid, clubs with the fifteen columns added', () => {
    const after = contents(db, tablesBefore)
    for (const table of tablesBefore) {
      const rows = table === 'clubs'
        ? after[table].map((row) => Object.fromEntries(Object.entries(row).filter(([key]) => !CLUB_COLUMNS.some(([name]) => name === key))))
        : after[table]
      expect(rows, table).toEqual(before[table])
    }
  })

  it('rebuilds no table: every table, index and trigger already there is as it was, but for clubs\' own definition, which gains the fifteen columns', () => {
    const now = Object.fromEntries(all<{ type: string; name: string; sql: string | null }>(db, 'SELECT type, name, sql FROM sqlite_master').map((r) => [`${r.type} ${r.name}`, r.sql]))
    for (const [key, sql] of Object.entries(schemaBefore)) {
      if (key === 'table clubs') continue
      expect(now[key], key).toBe(sql)
    }
    expect(now['table clubs']!.startsWith(schemaBefore['table clubs']!.replace(/\)\s*$/, ''))).toBe(true)
    const added = Object.keys(now).filter((k) => !(k in schemaBefore)).sort()
    expect(added).toEqual(['index idx_clubs_slug', 'index sqlite_autoindex_club_slug_history_1', 'table club_places', 'table club_rep_requests', 'table club_reports', 'table club_slug_history', 'table sqlite_sequence'])
  })

  it('adds none of what the brief gives later steps: no club_photos, zip_regions or club_distances, and no tournaments column', () => {
    const tables = userTables(db)
    for (const table of ['club_photos', 'zip_regions', 'club_distances']) expect(tables, table).not.toContain(table)
    const tournaments = columnsOf(db, 'tournaments').map((c) => c.name)
    for (const column of ['needs_lca_approval', 'approval_requested_at', 'approved_at', 'approved_by']) expect(tournaments, column).not.toContain(column)
  })

  it('stops at its first statement when run a second time, with the database as it was', () => {
    const scratch = openMigratedDb({ files: [...BEFORE, FILE] })
    const was = contents(scratch, userTables(scratch))
    expect(() => applyMigrations(scratch, [FILE])).toThrow(/Migration 0066_club_pages\.sql failed on statement:\nALTER TABLE clubs ADD COLUMN slug TEXT/)
    expect(contents(scratch, userTables(scratch))).toEqual(was)
  })
})

describe('0066_club_pages.sql and drizzle/meta', () => {
  const text = readFileSync(join(MIGRATIONS_DIR, FILE), 'utf8')
  const META = join(ROOT, 'drizzle/meta')
  const journal = JSON.parse(readFileSync(join(META, '_journal.json'), 'utf8')) as {
    entries: Array<{ idx: number; version: string; when: number; tag: string; breakpoints: boolean }>
  }
  const snapshot = (n: number) => JSON.parse(readFileSync(join(META, `${String(n).padStart(4, '0')}_snapshot.json`), 'utf8')) as {
    id: string
    prevId: string
    tables: Record<string, { columns: Record<string, unknown>; indexes: Record<string, unknown> }>
  }

  it('was made by the generator with --custom, and its header names the staged file its journal entry names', () => {
    expect(text.split('\n')[0]).toBe('-- 0066_club_pages.sql')
    expect(text).toContain('-- Hand-written migration (npm run db:generate -- <name> --custom), staged as\n-- drizzle/0011_club_pages.sql.')
    const entry = journal.entries.find((e) => e.tag.endsWith('_club_pages'))
    expect(entry).toEqual({ idx: 11, version: '6', when: expect.any(Number), tag: '0011_club_pages', breakpoints: true })
    expect(journal.entries[11]).toEqual(entry)
  })

  it('has a snapshot that follows 0010\'s and records the four tables and the fifteen columns alone', () => {
    const now = snapshot(11)
    const was = snapshot(10)
    expect(now.prevId).toBe(was.id)
    expect(Object.keys(now.tables).filter((t) => !(t in was.tables)).sort()).toEqual(Object.keys(TABLES).sort())
    expect(Object.keys(was.tables).filter((t) => !(t in now.tables))).toEqual([])
    const clubs = Object.keys(now.tables.clubs.columns)
    expect(clubs.filter((c) => !(c in was.tables.clubs.columns))).toEqual(CLUB_COLUMNS.map(([name]) => name))
    expect(Object.keys(now.tables.clubs.indexes)).toEqual(['idx_clubs_slug'])
    for (const [table, shape] of Object.entries(TABLES)) expect(Object.keys(now.tables[table].columns), table).toEqual(shape.columns)
    for (const table of Object.keys(was.tables).filter((t) => t !== 'clubs')) expect(now.tables[table], table).toEqual(was.tables[table])
  })
})
