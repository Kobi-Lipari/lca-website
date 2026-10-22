// test/unit/migration-0054-requirement.test.ts
//
// Migration 0054 on a real SQLite database with foreign keys on, as on D1:
// migrations 0001 to 0053 run first, then LCA-run and club-run tournaments
// (with entries and sections, through the 0053 triggers) go in, then 0054.
// tournaments.requires_lca_membership is added as NOT NULL DEFAULT 1, every
// club-run event is set to 0, LCA-run events keep 1, nothing else changes,
// the 0053 triggers do not fire, and running the backfill again changes
// nothing.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import type { DatabaseSync } from 'node:sqlite'
import { splitSql } from '../shared/splitSql'
import { applyMigrations, foreignKeysOn, migrationFiles, MIGRATIONS_DIR, openMigratedDb } from './helpers/sqlite'

const FILE = '0054_requires_lca_membership.sql'
const BEFORE = migrationFiles().filter((f) => f < '0054')

const all = <T>(db: DatabaseSync, sql: string, ...args: Array<string | number | null>) =>
  db.prepare(sql).all(...args) as unknown as T[]

function insertRows(db: DatabaseSync): void {
  db.exec(`INSERT INTO clubs (id, name, city) VALUES ('club-a', 'Club A', 'Baton Rouge'), ('club-b', 'Club B', 'Lafayette')`)
  db.exec(`INSERT INTO members (id, email, full_name) VALUES ('m1', 'm1@test.lca', 'Pat Player')`)
  const add = db.prepare(
    `INSERT INTO tournaments (id, name, location, date, entry_fee, sections, club_id, member_discount)
     VALUES (?, ?, 'Kenner, LA', '2026-10-24', 25, ?, ?, ?)`,
  )
  add.run('lca-1', 'State Open', '[{"name":"Open","entryFee":25}]', null, 3)
  add.run('lca-2', 'Fall Scholastic', '["K-5"]', null, 0)
  add.run('club-1', 'Club A Quads', '[{"name":"Quads","entryFee":10}]', 'club-a', 2)
  add.run('club-2', 'Club B Blitz', '[]', 'club-b', 0)
  db.exec(`INSERT INTO registrations (id, tournament_id, member_id, section, payment_status) VALUES ('r1', 'club-1', 'm1', 'Quads', 'paid')`)
}

const snapshot = (db: DatabaseSync) => ({
  tournaments: all<Record<string, unknown>>(db, 'SELECT * FROM tournaments ORDER BY id'),
  sections: all<Record<string, unknown>>(db, 'SELECT * FROM tournament_sections ORDER BY id'),
  schedules: all<Record<string, unknown>>(db, 'SELECT * FROM tournament_schedules ORDER BY id'),
  rounds: all<Record<string, unknown>>(db, 'SELECT * FROM tournament_schedule_rounds ORDER BY schedule_id, round'),
  registrations: all<Record<string, unknown>>(db, 'SELECT * FROM registrations ORDER BY id'),
})

describe('0054_requires_lca_membership.sql', () => {
  let db: DatabaseSync
  let before: ReturnType<typeof snapshot>
  let after: ReturnType<typeof snapshot>

  beforeAll(() => {
    db = openMigratedDb({ files: BEFORE })
    insertRows(db)
    before = snapshot(db)
    applyMigrations(db, [FILE])
    after = snapshot(db)
  })

  it('runs after 0053 with foreign keys on', () => {
    expect(BEFORE.at(-1)).toBe('0053_sections_schedules_backfill.sql')
    expect(migrationFiles().at(-1)).toBe(FILE)
    expect(foreignKeysOn(db)).toBe(1)
    expect(all(db, 'PRAGMA foreign_key_check')).toEqual([])
  })

  it('adds the column as INTEGER NOT NULL DEFAULT 1', () => {
    const column = all<{ name: string; type: string; notnull: number; dflt_value: string }>(db, `SELECT name, type, "notnull", dflt_value FROM pragma_table_info('tournaments') WHERE name = 'requires_lca_membership'`)
    expect(column).toEqual([{ name: 'requires_lca_membership', type: 'INTEGER', notnull: 1, dflt_value: '1' }])
  })

  it('sets every club-run event to 0 and leaves every LCA-run event at 1', () => {
    expect(all(db, 'SELECT id, club_id, requires_lca_membership FROM tournaments ORDER BY id')).toEqual([
      { id: 'club-1', club_id: 'club-a', requires_lca_membership: 0 },
      { id: 'club-2', club_id: 'club-b', requires_lca_membership: 0 },
      { id: 'lca-1', club_id: null, requires_lca_membership: 1 },
      { id: 'lca-2', club_id: null, requires_lca_membership: 1 },
    ])
  })

  it('changes no other column or row, member_discount included, and fires no 0053 trigger', () => {
    const without = (rows: Array<Record<string, unknown>>) => rows.map((row) => {
      const rest = { ...row }
      delete rest.requires_lca_membership
      return rest
    })
    expect(without(after.tournaments)).toEqual(before.tournaments)
    expect(after.tournaments.map((t) => t.member_discount)).toEqual([2, 0, 3, 0])
    expect(after.sections).toEqual(before.sections)
    expect(after.schedules).toEqual(before.schedules)
    expect(after.rounds).toEqual(before.rounds)
    expect(after.registrations).toEqual(before.registrations)
  })

  it('a new row takes 1 by default, club or not, since only the create endpoint chooses 0 for a club', () => {
    db.exec(`INSERT INTO tournaments (id, name, location, date, club_id) VALUES ('later', 'Later', 'Kenner, LA', '2026-11-07', 'club-a')`)
    expect(all(db, `SELECT requires_lca_membership FROM tournaments WHERE id = 'later'`)).toEqual([{ requires_lca_membership: 1 }])
    db.exec(`DELETE FROM tournaments WHERE id = 'later'`)
  })

  it('the backfill run again straight after changes nothing', () => {
    const statements = splitSql(readFileSync(join(MIGRATIONS_DIR, FILE), 'utf8'))
    expect(statements).toHaveLength(2)
    expect(statements[0]).toMatch(/^ALTER TABLE `tournaments` ADD `requires_lca_membership` integer DEFAULT 1 NOT NULL;?$/)
    const backfill = statements[1]
    expect(backfill).toMatch(/^UPDATE `tournaments` SET `requires_lca_membership` = 0 WHERE `club_id` IS NOT NULL/)
    const result = db.prepare(backfill.replace(/;$/, '')).run()
    expect(Number(result.changes)).toBe(0)
    expect(snapshot(db)).toEqual(after)
  })

  it('records the hand edit in its header', () => {
    const text = readFileSync(join(MIGRATIONS_DIR, FILE), 'utf8')
    expect(text).toMatch(/^-- 0054_requires_lca_membership\.sql\n/)
    expect(text).toContain('Edited by hand after generating')
    expect(text).toContain('--> statement-breakpoint')
  })
})
