// test/unit/ws09-merged-database.test.ts
//
// The database of the tree that holds checkpoint W's side (with main's
// newsletter issues and the regions by seat) and checkpoint X's side (the
// rate limits), held as one:
// - drizzle/meta lists every migration of the journal in order, each with its
//   snapshot, and each snapshot's prevId is the one before it, so main's
//   snapshot 16 and the rate limits' snapshot 17 sit in one unbroken line;
// - snapshot 17 is snapshot 16 with the one table rate_limits added, and
//   nothing else of any table moved;
// - the journal's last snapshot (17 on this tree) names the tables and
//   columns the migrated database holds (what the generator reads to report
//   that nothing changed);
// - 0071 and 0072 each touch what they say and neither reads the other, so a
//   database that ran 0072 first and runs 0071 after it ends as one that ran
//   them the other way round, row for row.
// Every club here is made up.
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import { describe, expect, it } from 'vitest'
import * as schema from '../../functions/db/schema'
import { applyMigrations, migrationFiles, openMigratedDb, userTables } from './helpers/sqlite'
import { getTableConfig, SQLiteTable } from 'drizzle-orm/sqlite-core'
import { is } from 'drizzle-orm'

const ROOT = resolve(__dirname, '../..')
const META = join(ROOT, 'drizzle/meta')

interface Entry { idx: number; version: string; when: number; tag: string; breakpoints: boolean }
interface Column { name: string }
interface Snapshot { id: string; prevId: string; tables: Record<string, { columns: Record<string, Column> }> }

const journal = JSON.parse(readFileSync(join(META, '_journal.json'), 'utf8')) as { entries: Entry[] }
const snapshot = (n: number): Snapshot => JSON.parse(readFileSync(join(META, `${String(n).padStart(4, '0')}_snapshot.json`), 'utf8'))
const all = <T>(db: DatabaseSync, sql: string) => db.prepare(sql).all() as unknown as T[]

const before0071 = migrationFiles().filter((f) => f < '0071')

describe('drizzle/meta after the join: one unbroken line from the first migration to the rate limits', () => {
  it('lists the entries by their position, in time order, each with its snapshot file', () => {
    expect(journal.entries.map((e) => e.idx)).toEqual(journal.entries.map((_, i) => i))
    for (let i = 1; i < journal.entries.length; i += 1) {
      expect(journal.entries[i].when, journal.entries[i].tag).toBeGreaterThan(journal.entries[i - 1].when)
    }
    for (const e of journal.entries) {
      expect(e.tag.startsWith(String(e.idx).padStart(4, '0') + '_'), e.tag).toBe(true)
      expect(() => snapshot(e.idx), e.tag).not.toThrow()
    }
  })

  it('links every snapshot to the one before it, so 16 is main\'s and 17 comes straight after it', () => {
    expect(snapshot(0).prevId).toBe('')
    for (let i = 1; i < journal.entries.length; i += 1) {
      expect(snapshot(i).prevId, `snapshot ${i}`).toBe(snapshot(i - 1).id)
    }
    expect(journal.entries[16].tag).toBe('0016_newsletter_issues')
    expect(journal.entries[17].tag).toBe('0017_rate_limits')
    const ids = journal.entries.map((e) => snapshot(e.idx).id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('makes 17 the same as 16 with the table rate_limits added, and no other table or column moved', () => {
    const sixteen = snapshot(16)
    const seventeen = snapshot(17)
    expect(Object.keys(sixteen.tables)).toContain('newsletter_issues')
    expect(Object.keys(sixteen.tables)).not.toContain('rate_limits')
    const { rate_limits: added, ...rest } = seventeen.tables
    expect(Object.keys(added.columns)).toEqual(['bucket', 'hits', 'window_start'])
    expect(rest).toEqual(sixteen.tables)
  })
})

describe('the joined database against its record and the schema', () => {
  const db = openMigratedDb()
  const tables = userTables(db)

  it('has the tables and columns the journal\'s last snapshot names, and no more', () => {
    // Read from the last entry, not from 17, so a later migration with its own snapshot moves nothing here.
    const latest = snapshot(journal.entries.at(-1)!.idx)
    expect(Object.keys(latest.tables).sort()).toEqual(tables)
    for (const table of tables) {
      const columns = all<{ name: string }>(db, `SELECT name FROM pragma_table_info('${table}')`).map((c) => c.name).sort()
      expect(Object.keys(latest.tables[table].columns).sort(), table).toEqual(columns)
    }
  })

  it('has both sides\' tables in functions/db/schema.ts, with each table\'s name as the database spells it', () => {
    const named = Object.values(schema).filter((v): v is SQLiteTable => is(v, SQLiteTable)).map((t) => getTableConfig(t).name).sort()
    expect(named).toEqual(tables)
    expect(named).toContain('newsletter_issues')
    expect(named).toContain('rate_limits')
  })
})

describe('0071 and 0072 in either order', () => {
  const ROWS = `
    INSERT INTO clubs (id, name, city, region) VALUES ('example-chess-club', 'Example Chess Club', 'Baton Rouge', 'South Central Louisiana');
    INSERT INTO clubs (id, name, city, region) VALUES ('example-bayou-club', 'Example Bayou Club', 'Houma', 'Bayou Region');
    INSERT INTO club_reports (club_id, kind, message, region) VALUES (NULL, 'new_club', 'An example report.', 'Bayou Region');
  `
  // The tables 0071 and 0072 can touch. The seed rows of the others carry made-up ids and times that differ from one build to the next.
  const TOUCHED = ['club_reports', 'clubs', 'rate_limits', 'seat_regions']
  // Columns that default to the clock are left out: the two builds can fall either side of a second.
  const clocked = (db: DatabaseSync, t: string) =>
    all<{ name: string; dflt_value: string | null }>(db, `SELECT name, dflt_value FROM pragma_table_info('${t}')`)
      .filter((c) => /now|current_(timestamp|date|time)/i.test(c.dflt_value ?? '')).map((c) => c.name)
  const contents = (db: DatabaseSync) => Object.fromEntries(TOUCHED.map((t) => {
    const skip = clocked(db, t)
    const rows = all<Record<string, unknown>>(db, `SELECT * FROM "${t}" ORDER BY rowid`)
    return [t, rows.map((row) => Object.fromEntries(Object.entries(row).filter(([k]) => !skip.includes(k))))]
  }))
  const definitions = (db: DatabaseSync) =>
    all<{ type: string; name: string; sql: string | null }>(db, 'SELECT type, name, sql FROM sqlite_master ORDER BY type, name')

  /** The database as it stands with 0070 and the rows, then each named file in the order given. */
  const build = (order: string[]) => {
    const db = openMigratedDb({ files: before0071 })
    db.exec(ROWS)
    applyMigrations(db, order)
    return db
  }

  it('ends in the same definitions and the same rows whichever one runs first', () => {
    const usual = build(['0071_rate_limits.sql', '0072_regions_by_seat.sql'])
    const reversed = build(['0072_regions_by_seat.sql', '0071_rate_limits.sql'])
    expect(definitions(reversed)).toEqual(definitions(usual))
    expect(contents(reversed)).toEqual(contents(usual))
    expect(all(usual, 'PRAGMA foreign_key_check')).toEqual([])
    expect(all(reversed, 'PRAGMA foreign_key_check')).toEqual([])
  })

  it('leaves rate_limits empty and gives every club one of the five regions, in either order', () => {
    for (const order of [['0071_rate_limits.sql', '0072_regions_by_seat.sql'], ['0072_regions_by_seat.sql', '0071_rate_limits.sql']]) {
      const db = build(order)
      expect(all(db, 'SELECT * FROM rate_limits'), order.join(' ')).toEqual([])
      expect(all<{ id: string; region: string }>(db, `SELECT id, region FROM clubs WHERE id LIKE 'example-%' ORDER BY id`), order.join(' ')).toEqual([
        { id: 'example-bayou-club', region: 'New Orleans Metro' },
        { id: 'example-chess-club', region: 'Baton Rouge / East Central' },
      ])
    }
  })

  it('keeps the limiter\'s rows when 0072 runs after 0071 has taken some', () => {
    const db = build(['0071_rate_limits.sql'])
    db.exec(`INSERT INTO rate_limits (bucket, hits, window_start) VALUES ('example:one', 3, '2026-11-24T10:00:00.000Z')`)
    applyMigrations(db, ['0072_regions_by_seat.sql'])
    expect(all(db, 'SELECT bucket, hits, window_start FROM rate_limits')).toEqual([{ bucket: 'example:one', hits: 3, window_start: '2026-11-24T10:00:00.000Z' }])
  })
})
