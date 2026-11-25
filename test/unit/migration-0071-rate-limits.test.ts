// test/unit/migration-0071-rate-limits.test.ts
//
// Migration 0071 (WS09 step 25) on a real SQLite database with foreign keys
// on, as on D1, and its record in drizzle/meta:
// - migrations 0001 to 0070 run first, then rows of a few kinds, then 0071;
// - exactly one table is added, rate_limits, with the brief's three columns
//   and nothing more: bucket TEXT PRIMARY KEY, hits INTEGER NOT NULL and
//   window_start TEXT NOT NULL, no index of its own, no reference either way;
// - no table is rebuilt and no row changes: every row of every table keeps
//   its values and its rowid, and every other definition is as it was;
// - the two statements the limiter runs work on it: the count that adds and
//   reads back, and the delete of the hours that have ended;
// - the file is drizzle-kit's, made by npm run db:generate with --number, and
//   drizzle/meta holds the journal's nineteenth entry and 0018_snapshot.json,
//   staged on top of main's 0017_snapshot.json, the seat listing.
// Every club and person here is made up.
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { DatabaseSync, SQLInputValue } from 'node:sqlite'
import { beforeAll, describe, expect, it } from 'vitest'
import { splitSql } from '../shared/splitSql'
import { applyMigrations, foreignKeysOn, migrationFiles, MIGRATIONS_DIR, openMigratedDb, userTables } from './helpers/sqlite'

const ROOT = resolve(__dirname, '../..')
const FILE = '0071_rate_limits.sql'
const BEFORE = migrationFiles().filter((f) => f < '0071')
const COLUMNS = [
  { name: 'bucket', type: 'TEXT', notnull: 1, dflt_value: null, pk: 1 },
  { name: 'hits', type: 'INTEGER', notnull: 1, dflt_value: null, pk: 0 },
  { name: 'window_start', type: 'TEXT', notnull: 1, dflt_value: null, pk: 0 },
]

type Row = Record<string, unknown>
const all = <T = Row>(db: DatabaseSync, sql: string, ...args: SQLInputValue[]) => db.prepare(sql).all(...args) as unknown as T[]

const ROWS = `
  INSERT INTO clubs (id, name, city) VALUES ('example-chess-club', 'Example Chess Club', 'Baton Rouge');
  INSERT INTO members (id, email, full_name, role) VALUES ('player-one', 'player.one@example.org', 'Player One', 'lca_admin');
  INSERT INTO tournaments (id, name, location, date, entry_fee, sections) VALUES ('example-fall-open', 'Example Fall Open', 'Baton Rouge, LA', '2026-10-24', 25, '[{"name":"Open","entryFee":25}]');
  INSERT INTO club_check_marks (member_id, month) VALUES ('player-one', '2026-12-07');
`
const contents = (db: DatabaseSync) =>
  Object.fromEntries(userTables(db).map((t) => [t, all(db, `SELECT rowid AS _rowid, * FROM "${t}" ORDER BY rowid`)]))
const schemaRows = (db: DatabaseSync) =>
  Object.fromEntries(all<{ type: string; name: string; tbl_name: string; sql: string | null }>(db, 'SELECT type, name, tbl_name, sql FROM sqlite_master ORDER BY type, name')
    .map((r) => [`${r.type} ${r.name}`, r]))

describe('0071_rate_limits.sql on a database that holds rows', () => {
  let db: DatabaseSync
  let before: ReturnType<typeof contents>
  let schemaBefore: ReturnType<typeof schemaRows>

  beforeAll(() => {
    db = openMigratedDb({ files: BEFORE, extra: ROWS })
    before = contents(db)
    schemaBefore = schemaRows(db)
    applyMigrations(db, [FILE])
  })

  it('runs straight after 0070, with foreign keys on and every reference whole', () => {
    expect(BEFORE.at(-1)).toBe('0070_club_event_approval.sql')
    expect(migrationFiles().filter((f) => f < '0072').at(-1)).toBe(FILE)
    expect(migrationFiles().filter((f) => f.startsWith('0071_'))).toEqual([FILE])
    expect(foreignKeysOn(db)).toBe(1)
    expect(all(db, 'PRAGMA foreign_key_check')).toEqual([])
  })

  it('adds exactly the one table, with the brief\'s three columns and nothing more', () => {
    expect(userTables(db).filter((t) => !Object.keys(before).includes(t))).toEqual(['rate_limits'])
    expect(all(db, `SELECT name, type, "notnull", dflt_value, pk FROM pragma_table_info('rate_limits')`)).toEqual(COLUMNS)
    expect(all(db, `SELECT * FROM pragma_foreign_key_list('rate_limits')`)).toEqual([])
    // The primary key's own index, and no other.
    expect(all<{ name: string }>(db, `SELECT name FROM pragma_index_list('rate_limits')`).map((i) => i.name)).toEqual(['sqlite_autoindex_rate_limits_1'])
    for (const table of Object.keys(before)) {
      const refs = all<{ table: string }>(db, `SELECT "table" FROM pragma_foreign_key_list('${table}')`)
      expect(refs.map((r) => r.table), table).not.toContain('rate_limits')
    }
    expect(all(db, 'SELECT * FROM rate_limits')).toEqual([])
  })

  it('changes no row and rebuilds no table: every row keeps its values and its rowid, and every other definition is as it was', () => {
    const after = contents(db)
    for (const table of Object.keys(before)) expect(after[table], table).toEqual(before[table])
    const schemaAfter = schemaRows(db)
    expect(Object.keys(schemaAfter).filter((k) => !(k in schemaBefore)).sort()).toEqual(['index sqlite_autoindex_rate_limits_1', 'table rate_limits'])
    for (const [key, row] of Object.entries(schemaBefore)) expect(schemaAfter[key], key).toEqual(row)
  })

  it('holds one statement, the table\'s CREATE, and nothing that drops, changes rows or switches foreign keys', () => {
    const text = readFileSync(join(MIGRATIONS_DIR, FILE), 'utf8')
    const statements = splitSql(text)
    expect(statements).toHaveLength(1)
    expect(statements[0]).toMatch(/^CREATE TABLE `rate_limits` \(/)
    expect(text.replace(/--.*$/gm, '')).not.toMatch(/\b(?:DROP|UPDATE|INSERT|DELETE|PRAGMA|ALTER|REFERENCES)\b|__new_/i)
  })

  it('stops at its statement if run again, so it runs once, as wrangler runs every file', () => {
    expect(() => applyMigrations(db, [FILE])).toThrow(/0071_rate_limits\.sql/)
  })

  it('takes the limiter\'s two statements: the count that adds and reads back, and the delete of the hours that have ended', () => {
    const count = db.prepare('INSERT INTO rate_limits (bucket, hits, window_start) VALUES (?, 1, ?) ON CONFLICT (bucket) DO UPDATE SET hits = hits + 1 RETURNING hits')
    expect([1, 2, 3].map(() => (count.get('a'.repeat(64), '2026-11-17 15:00:00') as { hits: number }).hits)).toEqual([1, 2, 3])
    count.get('b'.repeat(64), '2026-11-17 16:00:00')
    db.prepare('DELETE FROM rate_limits WHERE window_start < ?').run('2026-11-17 16:00:00')
    expect(all(db, 'SELECT bucket, hits, window_start FROM rate_limits')).toEqual([{ bucket: 'b'.repeat(64), hits: 1, window_start: '2026-11-17 16:00:00' }])
    expect(() => db.prepare('INSERT INTO rate_limits (bucket, window_start) VALUES (?, ?)').run('c', '2026-11-17 16:00:00')).toThrow(/NOT NULL/)
  })
})

describe('drizzle/meta', () => {
  it('records the change as the journal\'s nineteenth entry, with its snapshot, and the file is drizzle-kit\'s, its header naming the staged file', () => {
    const journal = JSON.parse(readFileSync(join(ROOT, 'drizzle/meta/_journal.json'), 'utf8')) as { entries: Array<{ idx: number; tag: string; when: number }> }
    // Since checkpoint X took checkpoint W in a third time: main's seat listing is entry 17, and the rate limits are staged after it as 18.
    expect(journal.entries).toHaveLength(19)
    expect(journal.entries[18]).toMatchObject({ idx: 18, tag: '0018_rate_limits' })
    expect(journal.entries[18].when).toBeGreaterThan(journal.entries[17].when)
    expect(existsSync(join(ROOT, 'drizzle/meta/0018_snapshot.json'))).toBe(true)
    const text = readFileSync(join(MIGRATIONS_DIR, FILE), 'utf8')
    expect(text.split('\n')[0]).toBe('-- 0071_rate_limits.sql')
    expect(text).toContain('-- Written by drizzle-kit from functions/db/schema.ts (npm run db:generate),\n-- staged as drizzle/0018_rate_limits.sql.')
    const snapshot = JSON.parse(readFileSync(join(ROOT, 'drizzle/meta/0018_snapshot.json'), 'utf8')) as {
      prevId: string; tables: Record<string, { columns: Record<string, { type: string; primaryKey: boolean; notNull: boolean }>; foreignKeys: Record<string, unknown> }>
    }
    expect(snapshot.prevId).toBe((JSON.parse(readFileSync(join(ROOT, 'drizzle/meta/0017_snapshot.json'), 'utf8')) as { id: string }).id)
    const table = snapshot.tables.rate_limits
    expect(Object.keys(table.columns)).toEqual(['bucket', 'hits', 'window_start'])
    expect(table.columns.bucket).toMatchObject({ type: 'text', primaryKey: true, notNull: true })
    expect(table.columns.hits).toMatchObject({ type: 'integer', primaryKey: false, notNull: true })
    expect(table.columns.window_start).toMatchObject({ type: 'text', primaryKey: false, notNull: true })
    expect(table.foreignKeys).toEqual({})
  })
})
