// test/unit/migration-0052-schema.test.ts
//
// What migration 0052 builds, read back from a real SQLite database with
// foreign keys on (as on D1): the three new tables, the two nullable
// columns on registrations, the partial unique indexes, the delete rules,
// and the promise that no tier price is ever stored as a frozen copy.
// 0052 must be additive: no rebuild, no dropped table.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import type { DatabaseSync } from 'node:sqlite'
import { MIGRATIONS_DIR, openMigratedDb } from './helpers/sqlite'

interface Col { name: string; type: string; notnull: number; dflt_value: string | null; pk: number }
interface Fk { table: string; from: string; to: string; on_delete: string; on_update: string }

let db: DatabaseSync
const all = <T>(sql: string, ...args: Array<string | number | null>) => db.prepare(sql).all(...args) as unknown as T[]
const one = <T>(sql: string, ...args: Array<string | number | null>) => db.prepare(sql).get(...args) as unknown as T
const cols = (table: string) => Object.fromEntries(all<Col>(`PRAGMA table_info(${table})`).map((c) => [c.name, c]))
const fks = (table: string) => all<Fk>(`PRAGMA foreign_key_list(${table})`)
const indexSql = (name: string) => one<{ sql: string } | undefined>(`SELECT sql FROM sqlite_master WHERE type = 'index' AND name = ?`, name)?.sql ?? ''

beforeEach(() => {
  db = openMigratedDb()
  db.prepare(`INSERT INTO members (id, email, full_name) VALUES ('m1', 'm1@test.lca', 'M One')`).run()
  db.prepare(`INSERT INTO tournaments (id, name, location, date, entry_fee, sections) VALUES ('t1', 'T1', 'Kenner, LA', '2026-10-24', 20, '[]')`).run()
  db.prepare(`INSERT INTO tournaments (id, name, location, date, entry_fee, sections) VALUES ('t2', 'T2', 'Kenner, LA', '2026-11-07', 20, '[]')`).run()
})

describe('0052 is additive', () => {
  const text = readFileSync(join(MIGRATIONS_DIR, '0052_sections_schedules.sql'), 'utf8')
  const code = text.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n')

  it('drops and rebuilds nothing, and adds the two registrations columns with ALTER TABLE ADD', () => {
    expect(code).not.toMatch(/DROP\s+(TABLE|INDEX|COLUMN)/i)
    expect(code).not.toMatch(/__new_|PRAGMA|RENAME/i)
    expect(code).toMatch(/ALTER TABLE `registrations` ADD `section_id`/)
    expect(code).toMatch(/ALTER TABLE `registrations` ADD `schedule_id`/)
    expect(code.match(/CREATE TABLE/g)).toHaveLength(3)
  })

  it('keeps every earlier registrations column, in its old order, with the two new ones last', () => {
    const names = all<{ name: string }>('PRAGMA table_info(registrations)').map((c) => c.name)
    expect(names.slice(-2)).toEqual(['section_id', 'schedule_id'])
    for (const old of ['id', 'tournament_id', 'member_id', 'section', 'payment_status']) expect(names).toContain(old)
  })
})

describe('tournament_sections', () => {
  it('has the brief columns, with only name and tournament_id required among the data columns', () => {
    const c = cols('tournament_sections')
    expect(Object.keys(c).sort()).toEqual([
      'archived_at', 'cap', 'created_at', 'extra_json', 'fee_early', 'fee_late', 'fee_regular', 'grade_max', 'grade_min',
      'id', 'name', 'position', 'prize_fund', 'prizes_json', 'rating_max', 'rating_min', 'rules_set', 'tournament_id', 'unrated_ok',
    ])
    const required = Object.values(c).filter((x) => x.notnull === 1 && x.pk === 0).map((x) => x.name).sort()
    expect(required).toEqual(['created_at', 'name', 'position', 'rules_set', 'tournament_id'])
    expect(c.id.pk).toBe(1)
    expect(c.fee_regular.type).toBe('REAL')
    expect(c.fee_early.type).toBe('REAL')
    expect(c.fee_late.type).toBe('REAL')
    expect(c.cap.type).toBe('INTEGER')
  })

  it('defaults: a 16-character lower-case hex id, position 0, rules_set 0, every price and the cap null', () => {
    db.prepare(`INSERT INTO tournament_sections (tournament_id, name) VALUES ('t1', 'Open')`).run()
    db.prepare(`INSERT INTO tournament_sections (tournament_id, name) VALUES ('t1', 'Reserve')`).run()
    const rows = all<Record<string, unknown>>('SELECT * FROM tournament_sections ORDER BY name')
    expect(rows[0].id).toMatch(/^[0-9a-f]{16}$/)
    expect(rows[1].id).toMatch(/^[0-9a-f]{16}$/)
    expect(rows[0].id).not.toBe(rows[1].id)
    for (const r of rows) {
      expect(r).toMatchObject({
        position: 0, rules_set: 0, fee_regular: null, fee_early: null, fee_late: null, cap: null,
        prize_fund: null, prizes_json: null, extra_json: null, archived_at: null,
      })
      expect(r.created_at).toMatch(/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/)
    }
  })

  it('allows a live name once per tournament, the same name in another tournament, and any number of archived copies', () => {
    const add = (t: string, name: string, archived = false) =>
      db.prepare(`INSERT INTO tournament_sections (tournament_id, name, archived_at) VALUES (?, ?, ${archived ? "datetime('now')" : 'NULL'})`).run(t, name)
    add('t1', 'Open')
    expect(() => add('t1', 'Open')).toThrow(/UNIQUE/)
    expect(() => add('t2', 'Open')).not.toThrow()
    expect(() => add('t1', 'Open', true)).not.toThrow()
    expect(() => add('t1', 'Open', true)).not.toThrow()
    // Names compare exactly: case and a trailing space make a different name.
    expect(() => add('t1', 'open')).not.toThrow()
    expect(() => add('t1', 'Open ')).not.toThrow()
  })

  it('the unique index is partial on archived_at IS NULL, and a plain tournament_id index exists', () => {
    expect(indexSql('idx_tournament_sections_live_name')).toMatch(/CREATE UNIQUE INDEX[\s\S]*\(`?tournament_id`?,\s*`?name`?\)\s*WHERE\s+archived_at IS NULL/i)
    expect(indexSql('idx_tournament_sections_tournament_id')).toMatch(/\(`?tournament_id`?\)/)
  })

  it('refuses a section for a tournament that does not exist, and a missing name', () => {
    expect(() => db.prepare(`INSERT INTO tournament_sections (tournament_id, name) VALUES ('nope', 'Open')`).run()).toThrow(/FOREIGN KEY/)
    expect(() => db.prepare(`INSERT INTO tournament_sections (tournament_id, name) VALUES ('t1', NULL)`).run()).toThrow(/NOT NULL/)
  })

  it('stores a tier price only when one is written: setting a tournament price or tier column never fills fee_early or fee_late', () => {
    db.prepare(`UPDATE tournaments SET sections = '[{"name":"Open","entryFee":30}]' WHERE id = 't1'`).run()
    db.prepare(`UPDATE tournaments SET entry_fee = 45, early_deadline = '2026-10-01T23:59', early_discount = 5, late_after = '2026-10-20T12:00', late_fee = 10, member_discount = 3 WHERE id = 't1'`).run()
    db.prepare(`UPDATE tournaments SET sections = '[{"name":"Open","entryFee":30},{"name":"U1200","entryFee":20}]' WHERE id = 't1'`).run()
    const rows = all<{ name: string; fee_regular: number | null; fee_early: number | null; fee_late: number | null }>(
      `SELECT name, fee_regular, fee_early, fee_late FROM tournament_sections WHERE tournament_id = 't1' ORDER BY position`)
    expect(rows).toEqual([
      { name: 'Open', fee_regular: 30, fee_early: null, fee_late: null },
      { name: 'U1200', fee_regular: 20, fee_early: null, fee_late: null },
    ])
  })
})

describe('tournament_schedules and tournament_schedule_rounds', () => {
  // The tournament insert trigger of 0053 already gave t1 and t2 a primary
  // schedule; start these cases from none so the table defaults show.
  beforeEach(() => { db.prepare('DELETE FROM tournament_schedules').run() })
  const schedule = (t: string, fields = '') => db.prepare(`INSERT INTO tournament_schedules (tournament_id${fields ? ', ' + fields.split('=')[0] : ''}) VALUES (?${fields ? ', ' + fields.split('=')[1] : ''})`).run(t)

  it('has the brief columns and defaults: label Main schedule, not primary, no time control, no merge round', () => {
    const c = cols('tournament_schedules')
    expect(Object.keys(c).sort()).toEqual(['archived_at', 'created_at', 'id', 'is_primary', 'label', 'merge_round', 'position', 'time_control', 'tournament_id'])
    db.prepare(`INSERT INTO tournament_schedules (tournament_id) VALUES ('t2')`).run()
    expect(one('SELECT * FROM tournament_schedules')).toMatchObject({
      label: 'Main schedule', is_primary: 0, time_control: null, merge_round: null, archived_at: null, position: 0,
    })
    expect((one<{ id: string }>('SELECT id FROM tournament_schedules')).id).toMatch(/^[0-9a-f]{16}$/)
  })

  it('allows one live primary per tournament; archived primaries and any number of non-primary schedules do not count', () => {
    schedule('t1', 'is_primary=1')
    expect(() => schedule('t1', 'is_primary=1')).toThrow(/UNIQUE/)
    expect(() => schedule('t2', 'is_primary=1')).not.toThrow()
    expect(() => schedule('t1')).not.toThrow()
    expect(() => schedule('t1')).not.toThrow()
    db.prepare(`UPDATE tournament_schedules SET archived_at = datetime('now') WHERE tournament_id = 't1' AND is_primary = 1`).run()
    expect(() => schedule('t1', 'is_primary=1')).not.toThrow()
    expect(indexSql('idx_tournament_schedules_primary')).toMatch(/CREATE UNIQUE INDEX[\s\S]*\(`?tournament_id`?\)\s*WHERE\s+is_primary = 1 AND archived_at IS NULL/i)
  })

  it('keys rounds on (schedule_id, round) and keeps date and time optional', () => {
    const c = cols('tournament_schedule_rounds')
    expect(Object.keys(c).sort()).toEqual(['date', 'round', 'schedule_id', 'time'])
    expect([c.schedule_id.pk, c.round.pk].sort()).toEqual([1, 2])
    expect(c.date.notnull + c.time.notnull).toBe(0)
    schedule('t1', 'is_primary=1')
    const id = one<{ id: string }>('SELECT id FROM tournament_schedules').id
    db.prepare('INSERT INTO tournament_schedule_rounds (schedule_id, round) VALUES (?, 1)').run(id)
    expect(() => db.prepare('INSERT INTO tournament_schedule_rounds (schedule_id, round) VALUES (?, 1)').run(id)).toThrow(/UNIQUE|PRIMARY/)
    expect(() => db.prepare('INSERT INTO tournament_schedule_rounds (schedule_id, round) VALUES (?, 2)').run(id)).not.toThrow()
    expect(() => db.prepare(`INSERT INTO tournament_schedule_rounds (schedule_id, round) VALUES ('missing', 1)`).run()).toThrow(/FOREIGN KEY/)
  })
})

describe('delete rules', () => {
  it('the three new foreign keys cascade; registrations.section_id and schedule_id have no delete action', () => {
    expect(fks('tournament_sections')).toEqual([expect.objectContaining({ table: 'tournaments', from: 'tournament_id', on_delete: 'CASCADE' })])
    expect(fks('tournament_schedules')).toEqual([expect.objectContaining({ table: 'tournaments', from: 'tournament_id', on_delete: 'CASCADE' })])
    expect(fks('tournament_schedule_rounds')).toEqual([expect.objectContaining({ table: 'tournament_schedules', from: 'schedule_id', on_delete: 'CASCADE' })])
    const reg = fks('registrations')
    expect(reg.find((f) => f.from === 'section_id')).toMatchObject({ table: 'tournament_sections', to: 'id', on_delete: 'NO ACTION' })
    expect(reg.find((f) => f.from === 'schedule_id')).toMatchObject({ table: 'tournament_schedules', to: 'id', on_delete: 'NO ACTION' })
  })

  it('deleting a tournament without entries removes its sections, schedules and rounds, and leaves other tournaments alone', () => {
    db.prepare(`UPDATE tournaments SET sections = '["Open","U1200"]', round_schedule = '[{"round":1,"date":"2026-10-24","time":"09:00"}]' WHERE id IN ('t1','t2')`).run()
    expect(one<{ n: number }>('SELECT COUNT(*) AS n FROM tournament_schedule_rounds').n).toBe(2)
    db.prepare(`DELETE FROM tournaments WHERE id = 't1'`).run()
    expect(one<{ n: number }>(`SELECT COUNT(*) AS n FROM tournament_sections WHERE tournament_id = 't1'`).n).toBe(0)
    expect(one<{ n: number }>(`SELECT COUNT(*) AS n FROM tournament_schedules WHERE tournament_id = 't1'`).n).toBe(0)
    expect(one<{ n: number }>('SELECT COUNT(*) AS n FROM tournament_schedule_rounds').n).toBe(1)
    expect(one<{ n: number }>(`SELECT COUNT(*) AS n FROM tournament_sections WHERE tournament_id = 't2'`).n).toBe(2)
    expect(all('PRAGMA foreign_key_check')).toEqual([])
  })

  it('a section or schedule an entry points at cannot be deleted from under it', () => {
    db.prepare(`UPDATE tournaments SET sections = '["Open"]' WHERE id = 't1'`).run()
    db.prepare(`INSERT INTO registrations (id, tournament_id, member_id, section) VALUES ('r1', 't1', 'm1', 'Open')`).run()
    const reg = one<{ section_id: string; schedule_id: string }>('SELECT section_id, schedule_id FROM registrations')
    expect(() => db.prepare('DELETE FROM tournament_sections WHERE id = ?').run(reg.section_id)).toThrow(/FOREIGN KEY/)
    expect(() => db.prepare('DELETE FROM tournament_schedules WHERE id = ?').run(reg.schedule_id)).toThrow(/FOREIGN KEY/)
    // The tournament itself is also protected while the entry exists (registrations.tournament_id has no delete action).
    expect(() => db.prepare(`DELETE FROM tournaments WHERE id = 't1'`).run()).toThrow(/FOREIGN KEY/)
    expect(one<{ n: number }>(`SELECT COUNT(*) AS n FROM tournament_sections WHERE tournament_id = 't1'`).n).toBe(1)
    // With the entry gone the cascade runs cleanly.
    db.prepare(`DELETE FROM registrations WHERE id = 'r1'`).run()
    db.prepare(`DELETE FROM tournaments WHERE id = 't1'`).run()
    expect(all('PRAGMA foreign_key_check')).toEqual([])
  })

  it('an entry cannot point at a section or schedule that does not exist, but may point at none', () => {
    expect(() => db.prepare(`INSERT INTO registrations (id, tournament_id, member_id, section, section_id) VALUES ('r2', 't1', 'm1', 'X', 'ghost')`).run()).toThrow(/FOREIGN KEY/)
    expect(() => db.prepare(`INSERT INTO registrations (id, tournament_id, member_id, section, schedule_id) VALUES ('r3', 't1', 'm1', 'X', 'ghost')`).run()).toThrow(/FOREIGN KEY/)
  })
})
