// test/unit/regions-by-seat.test.ts
//
// The club regions as the five regional representatives' seats (K's decision
// 14 of Wednesday, November 18, 2026):
// - the list is the five seats' titles, in order, and isRegion takes each of
//   them and none of the names that are gone;
// - the short names in src/lib/nav.ts point at the region that holds those
//   towns' clubs;
// - migration 0072 on a real SQLite database with foreign keys on, as on
//   D1: it is data alone (no table, column, index or trigger moves), it
//   touches clubs.region, club_reports.region and seat_regions and nothing
//   else, and a second run changes no row;
// - its header says what it does, why, that the placement is a best guess
//   K may correct, and where the way back is written.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import { describe, expect, it } from 'vitest'
import { REGIONS, isRegion } from '../../domain/clubs/regions'
import { REGIONS as SITE_REGIONS, isRegion as siteIsRegion } from '../../src/lib/regions'
import { REGIONS as SERVER_REGIONS, isRegion as serverIsRegion } from '../../functions/utils/regions'
import { REGION_ALIASES } from '../../src/lib/nav'
import { splitSql } from '../shared/splitSql'
import { MIGRATIONS_DIR, migrationFiles, openMigratedDb } from './helpers/sqlite'

const FILE = '0072_regions_by_seat.sql'
const TEXT = readFileSync(join(MIGRATIONS_DIR, FILE), 'utf8')
const STATEMENTS = splitSql(TEXT)
const GONE = ['Central Louisiana', 'North of Lake Pontchartrain', 'Southwest Louisiana', 'South Central Louisiana', 'Bayou Region']

function schemaOf(db: DatabaseSync): string {
  return JSON.stringify(db.prepare(
    `SELECT type, name, tbl_name, sql FROM sqlite_master
      WHERE name NOT LIKE 'sqlite\\_%' ESCAPE '\\' ORDER BY type, name`,
  ).all())
}

/** Every row of every user table, so a change anywhere shows. */
function everyRow(db: DatabaseSync): Record<string, string> {
  const tables = (db.prepare(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite\\_%' ESCAPE '\\' ORDER BY name`,
  ).all() as Array<{ name: string }>).map((r) => r.name)
  const out: Record<string, string> = {}
  for (const name of tables) out[name] = JSON.stringify(db.prepare(`SELECT * FROM "${name}" ORDER BY rowid`).all())
  return out
}

function run(db: DatabaseSync): number {
  let changed = 0
  for (const stmt of STATEMENTS) changed += Number(db.prepare(stmt).run().changes)
  return changed
}

describe('the five regions', () => {
  it('are the five regional seats\' titles, in order', () => {
    expect([...REGIONS]).toEqual([
      'New Orleans Metro',
      'Baton Rouge / East Central',
      'Lafayette / South Central',
      'Lake Charles / Southwestern',
      'North Louisiana',
    ])
  })

  it('are the one list the site and the server read', () => {
    expect(SITE_REGIONS).toBe(REGIONS)
    expect(SERVER_REGIONS).toBe(REGIONS)
    expect(siteIsRegion).toBe(isRegion)
    expect(serverIsRegion).toBe(isRegion)
  })

  it('isRegion takes each of the five and none of the names that are gone', () => {
    for (const region of REGIONS) expect(isRegion(region), region).toBe(true)
    for (const region of GONE) expect(isRegion(region), region).toBe(false)
    for (const value of ['', 'new orleans metro', 'Baton Rouge', 'Lafayette / South Central Representative', null, 5]) {
      expect(isRegion(value), String(value)).toBe(false)
    }
  })

  it('the short names point at the region that holds those towns\' clubs', () => {
    expect(REGION_ALIASES).toEqual({
      nola: 'New Orleans Metro',
      northshore: 'New Orleans Metro',
      acadiana: 'Lafayette / South Central',
    })
    for (const region of Object.values(REGION_ALIASES)) expect(isRegion(region), region).toBe(true)
  })
})

describe('migration 0072', () => {
  it('comes after every file numbered before it and is applied by name', () => {
    // Held against the files numbered below 0073, so that a later migration, or 0071 when its branch lands, moves nothing here.
    const files = migrationFiles()
    expect(files.filter((f) => f < '0073').at(-1)).toBe(FILE)
  })

  it('opens with a header that says what it does, why, that the placement is a best guess K may correct, and the way back', () => {
    const header = TEXT.split('\n').filter((l) => l.startsWith('--')).join(' ')
    expect(TEXT.startsWith(`-- ${FILE}\n`)).toBe(true)
    expect(header).toContain('No table, column, index or trigger changes')
    expect(header).toContain('decision 14 of Wednesday, November 18, 2026')
    expect(header).toContain('best guess')
    expect(header).toContain('club\'s editor')
    expect(header).toContain('The way back')
    expect(header).toContain('safe to run again')
    expect(TEXT).not.toMatch(new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`))
  })

  it('is plain UPDATE, DELETE and INSERT statements on clubs, club_reports and seat_regions, and nothing else', () => {
    expect(STATEMENTS.length).toBeGreaterThan(0)
    for (const stmt of STATEMENTS) {
      expect(stmt, stmt).toMatch(/^(UPDATE (clubs|club_reports)\s+SET region =|DELETE FROM seat_regions|INSERT OR IGNORE INTO seat_regions \(seat_id, region\))/)
      expect(stmt, stmt).not.toMatch(/\b(CREATE|ALTER|DROP|PRAGMA|TRIGGER)\b/i)
    }
  })

  it('changes no table, column, index or trigger, and touches no row outside the three tables', () => {
    const db = openMigratedDb({ files: migrationFiles().filter((f) => f < '0072') })
    db.exec(`INSERT INTO board_members (id, role, name, sort_order, slug, category, is_active)
             VALUES ('ex-seat', 'Lafayette / South Central Representative', '', 99, 'ex-seat', 'regional_rep', 1)`)
    db.exec(`INSERT INTO seat_regions (seat_id, region) VALUES ('ex-seat', 'Bayou Region')`)
    db.exec(`INSERT INTO club_reports (club_id, kind, message, region) VALUES (NULL, 'new_club', 'An example report.', 'Bayou Region')`)
    const schema = schemaOf(db)
    const before = everyRow(db)

    expect(run(db)).toBeGreaterThan(0)

    expect(schemaOf(db)).toBe(schema)
    const after = everyRow(db)
    const moved = Object.keys(after).filter((t) => after[t] !== before[t]).sort()
    expect(moved).toEqual(['club_reports', 'clubs', 'seat_regions'])
    const regions = db.prepare('SELECT DISTINCT region FROM clubs WHERE region IS NOT NULL ORDER BY region').all() as Array<{ region: string }>
    for (const { region } of regions) expect(REGIONS as readonly string[]).toContain(region)
    expect(db.prepare('SELECT seat_id, region FROM seat_regions').all()).toEqual([
      { seat_id: 'ex-seat', region: 'Lafayette / South Central' },
    ])
    expect(db.prepare('SELECT region FROM club_reports').all()).toEqual([{ region: 'Lafayette / South Central' }])

    const settled = everyRow(db)
    expect(run(db)).toBe(0)
    expect(everyRow(db)).toEqual(settled)
    db.close()
  })
})
