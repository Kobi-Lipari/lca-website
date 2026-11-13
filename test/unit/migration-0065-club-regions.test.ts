// test/unit/migration-0065-club-regions.test.ts
//
// Migration 0065 (WS09 step 3) on a real SQLite database with foreign keys
// on, as on D1, built from migrations 0001 to 0060 and then 0065:
// - the 25 clubs the migrations seed, every one with a blank region before,
//   gain the region the brief's Appendix C gives them, 8, 3, 5, 2, 2, 2 and
//   3 clubs in its seven regions;
// - a region already set stands, the empty string counts as blank, and a
//   club named by its id is placed even when its name has been changed;
// - a club the file does not name stays blank;
// - run a second time it changes no row;
// - every region it writes is one of the seven of domain/clubs/regions.ts;
// - it touches clubs.region alone: no other column or row of any table
//   moves, and no table, column, index or trigger is added or changed;
// - its header names the staged file its journal entry names, and that
//   entry's snapshot follows the one before and records the same schema.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import { describe, expect, it } from 'vitest'
import { REGIONS } from '../../domain/clubs/regions'
import { splitSql } from '../shared/splitSql'
import { applyMigrations, MIGRATIONS_DIR, migrationFiles, openMigratedDb, userTables } from './helpers/sqlite'

const FILE = '0065_club_regions.sql'
const BEFORE = migrationFiles().filter((f) => f < '0061')
const TEXT = readFileSync(join(MIGRATIONS_DIR, FILE), 'utf8')
const STATEMENTS = splitSql(TEXT)

/** Appendix C by club id: the region each of the 25 clubs is given. */
const PLACED: Record<string, string[]> = {
  'New Orleans Metro': [
    'downriver-chess-club', 'greater-new-orleans-chess-club', 'new-orleans-westbank-chess-club', 'marrero-chess-organization',
    'north-kenner-library-chess-club', 'metairie', 'knight-light-chess', 'strategic-thoughts-nola',
  ],
  'North of Lake Pontchartrain': ['mandeville-chess-club', 'slidell', 'picayune-chess-club'],
  'South Central Louisiana': ['baton-rouge', 'bluebonnet-chess-club', 'gonzales-chess-club', 'lafayette-chess-club', 'heart-of-worship-church-chess'],
  'Bayou Region': ['houma-chess-club', 'morgan-city-chess-club'],
  'Southwest Louisiana': ['casa-de-ajedrez', 'beauregard-parish-youth-chess'],
  'Central Louisiana': ['bunkie-chess-club', 'pineville-homeschool-chess-club'],
  'North Louisiana': ['shreveport', 'monroe', 'ruston'],
}
const ALL_IDS = Object.values(PLACED).flat()
const regionOf = (id: string) => Object.entries(PLACED).find(([, ids]) => ids.includes(id))?.[0]

type Row = Record<string, unknown>
const all = <T = Row>(db: DatabaseSync, sql: string, ...args: Array<string | number | null>) =>
  db.prepare(sql).all(...args) as unknown as T[]

/** The database as it stands before 0065, with any rows a case adds. */
function before(extra = ''): DatabaseSync {
  return openMigratedDb({ files: BEFORE, extra })
}
/** Runs 0065's statements and answers how many rows they changed. */
function run(db: DatabaseSync): number {
  let changed = 0
  for (const stmt of STATEMENTS) changed += Number(db.prepare(stmt).run().changes)
  return changed
}
const regions = (db: DatabaseSync) =>
  Object.fromEntries(all<{ id: string; region: string | null }>(db, 'SELECT id, region FROM clubs ORDER BY id').map((r) => [r.id, r.region]))

/** Every row of every table, with the clubs' region left out, and the schema's every definition. */
function everythingButRegion(db: DatabaseSync) {
  const rows: Record<string, Row[]> = {}
  for (const table of userTables(db)) {
    rows[table] = all(db, `SELECT rowid AS _rowid, * FROM "${table}" ORDER BY rowid`).map((row) => {
      if (table !== 'clubs') return row
      const rest = { ...row }
      delete rest.region
      return rest
    })
  }
  return { rows, schema: all(db, 'SELECT type, name, tbl_name, sql FROM sqlite_master ORDER BY type, name') }
}

describe('migration 0065: the regions fill', () => {
  it('25 blank regions are set, 8, 3, 5, 2, 2, 2 and 3', () => {
    const db = before()
    const ids = all<{ id: string; region: string | null }>(db, 'SELECT id, region FROM clubs ORDER BY id')
    expect(ids.map((r) => r.id)).toEqual([...ALL_IDS].sort())
    expect(ids.filter((r) => r.region !== null && r.region !== '')).toEqual([])

    expect(run(db)).toBe(25)
    const counts = all<{ region: string; n: number }>(db, 'SELECT region, COUNT(*) AS n FROM clubs GROUP BY region')
    expect(Object.fromEntries(counts.map((c) => [c.region, Number(c.n)]))).toEqual({
      'New Orleans Metro': 8, 'North of Lake Pontchartrain': 3, 'South Central Louisiana': 5, 'Bayou Region': 2,
      'Southwest Louisiana': 2, 'Central Louisiana': 2, 'North Louisiana': 3,
    })
    expect(Object.values(PLACED).map((list) => list.length)).toEqual([8, 3, 5, 2, 2, 2, 3])
    for (const [id, region] of Object.entries(regions(db))) expect(region, id).toBe(regionOf(id))
  })

  it('a region already set stands', () => {
    const db = before("UPDATE clubs SET region = 'Bayou Region' WHERE id = 'metairie'")
    expect(run(db)).toBe(24)
    const after = regions(db)
    expect(after.metairie).toBe('Bayou Region')
    for (const id of ALL_IDS.filter((i) => i !== 'metairie')) expect(after[id], id).toBe(regionOf(id))
  })

  it('counts the empty string as blank, and places a club by its id when its name has changed', () => {
    const db = before([
      "UPDATE clubs SET region = '' WHERE id = 'ruston'",
      "UPDATE clubs SET name = 'Example Renamed Chess Club' WHERE id = 'baton-rouge'",
    ].join(';\n'))
    expect(run(db)).toBe(25)
    expect(regions(db).ruston).toBe('North Louisiana')
    expect(regions(db)['baton-rouge']).toBe('South Central Louisiana')
  })

  it('a club not on the list stays blank', () => {
    const db = before([
      "INSERT INTO clubs (id, name, city) VALUES ('example-chess-club', 'Example Chess Club', 'Example City')",
      "INSERT INTO clubs (id, name, city, region) VALUES ('example-empty-club', 'Example Empty Club', 'Example City', '')",
    ].join(';\n'))
    expect(run(db)).toBe(25)
    const after = regions(db)
    expect(after['example-chess-club']).toBeNull()
    expect(after['example-empty-club']).toBe('')
  })

  it('a second run changes nothing', () => {
    const db = before()
    expect(run(db)).toBe(25)
    const once = { regions: regions(db), rest: everythingButRegion(db) }
    expect(run(db)).toBe(0)
    expect({ regions: regions(db), rest: everythingButRegion(db) }).toEqual(once)
  })

  it('every region is one of the seven', () => {
    const written = [...TEXT.matchAll(/SET region = '([^']*)'/g)].map((m) => m[1])
    expect(written).toEqual(Object.keys(PLACED))
    expect([...written].sort()).toEqual([...REGIONS].sort())
    const db = before()
    run(db)
    for (const [id, region] of Object.entries(regions(db))) expect(REGIONS as readonly string[], id).toContain(region)
  })

  it('touches clubs.region alone, and only where it is blank, naming each club by its id', () => {
    expect(STATEMENTS).toHaveLength(7)
    for (const stmt of STATEMENTS) {
      expect(stmt, stmt).toMatch(/^UPDATE clubs SET region = '[^']+'\s+WHERE id IN \('[a-z-]+'(?:, '[a-z-]+')*\)\s+AND \(region IS NULL OR region = ''\)$/)
    }
    const named = STATEMENTS.flatMap((s) => [...s.matchAll(/'([a-z-]+)'(?=[,)])/g)].map((m) => m[1]))
    expect(named).toEqual(ALL_IDS)

    const db = before()
    const was = everythingButRegion(db)
    run(db)
    expect(everythingButRegion(db)).toEqual(was)
  })

  it('names in its header the staged file its journal entry names, whose snapshot follows the one before with the same schema', () => {
    const META = join(MIGRATIONS_DIR, '../drizzle/meta')
    const journal = JSON.parse(readFileSync(join(META, '_journal.json'), 'utf8')) as {
      entries: Array<{ idx: number; version: string; when: number; tag: string; breakpoints: boolean }>
    }
    const entry = journal.entries.find((e) => e.tag.endsWith('_club_regions'))
    expect(entry, 'the journal entry').toBeDefined()
    expect(entry).toEqual({ idx: entry!.idx, version: '6', when: expect.any(Number), tag: `${String(entry!.idx).padStart(4, '0')}_club_regions`, breakpoints: true })
    expect(TEXT).toContain(`-- drizzle/${entry!.tag}.sql.`)
    const snapshot = (n: number) => JSON.parse(readFileSync(join(META, `${String(n).padStart(4, '0')}_snapshot.json`), 'utf8')) as Row
    expect(readdirSync(META)).toContain(`${entry!.tag.slice(0, 4)}_snapshot.json`)
    const now = snapshot(entry!.idx)
    const was = snapshot(entry!.idx - 1)
    expect(now.prevId).toBe(was.id)
    const rest = (s: Row) => {
      const others = { ...s }
      delete others.id
      delete others.prevId
      return others
    }
    expect(rest(now)).toEqual(rest(was))
  })

  it('is the only file with its number, applied after every file it was written against', () => {
    const files = migrationFiles()
    expect(files.filter((f) => f.startsWith('0065_'))).toEqual([FILE])
    for (const f of BEFORE) expect(files.indexOf(f), f).toBeLessThan(files.indexOf(FILE))
    const db = before()
    applyMigrations(db, [FILE])
    expect(Object.values(regions(db)).every((r) => typeof r === 'string' && r !== '')).toBe(true)
  })
})
