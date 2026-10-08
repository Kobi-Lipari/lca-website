// test/unit/migration-0053-edges.test.ts
//
// The edges of the 0053 backfill and its four triggers that
// migration-0053-backfill.test.ts leaves out, on node:sqlite with foreign
// keys on:
//
// - backfill values: a fee of 0 is a fee (not "inherit"), decimals, quotes,
//   accents, case and a trailing space in names, JSON that is valid but not
//   an array, bad round numbers and bad dates
// - a re-run after later edits keeps ids, caps and archived rows
// - an empty database, and a larger one
// - entries never cross tournaments, and a live row beats an archived one
// - sync edges: reorder, replay, remove all, a JSON object, null rounds,
//   a name change on the tournament, an entry update that is not a move
import { beforeAll, describe, expect, it } from 'vitest'
import type { DatabaseSync } from 'node:sqlite'
import { applyMigrations, migrationFiles, openMigratedDb } from './helpers/sqlite'

const NEW_FILES = ['0052_sections_schedules.sql', '0053_sections_schedules_backfill.sql']
const BEFORE = migrationFiles().filter((f) => f < '0052')

type Arg = string | number | null
const all = <T>(db: DatabaseSync, sql: string, ...args: Arg[]) => db.prepare(sql).all(...args) as unknown as T[]
const one = <T>(db: DatabaseSync, sql: string, ...args: Arg[]) => db.prepare(sql).get(...args) as unknown as T

interface Sec {
  id: string; name: string; position: number; fee_regular: number | null; fee_early: number | null; fee_late: number | null
  cap: number | null; rules_set: number; unrated_ok: number | null; rating_min: number | null; rating_max: number | null
  extra_json: string | null; prizes_json: string | null; archived_at: string | null
}
const live = (db: DatabaseSync, t: string) =>
  all<Sec>(db, 'SELECT * FROM tournament_sections WHERE tournament_id = ? AND archived_at IS NULL ORDER BY position, name', t)
const archived = (db: DatabaseSync, t: string) =>
  all<Sec>(db, 'SELECT * FROM tournament_sections WHERE tournament_id = ? AND archived_at IS NOT NULL ORDER BY name, rowid', t)
const rounds = (db: DatabaseSync, t: string) =>
  all<{ round: number; date: string | null; time: string | null }>(db,
    `SELECT r.round, r.date, r.time FROM tournament_schedule_rounds r JOIN tournament_schedules p ON p.id = r.schedule_id
      WHERE p.tournament_id = ? AND p.is_primary = 1 AND p.archived_at IS NULL ORDER BY r.round`, t)

function seed(db: DatabaseSync, id: string, sections: unknown, roundSchedule: unknown = null, fee = 20) {
  db.prepare(`INSERT INTO tournaments (id, name, location, date, entry_fee, sections, round_schedule) VALUES (?, ?, 'Kenner, LA', '2026-10-24', ?, ?, ?)`)
    .run(id, id, fee, typeof sections === 'string' ? sections : JSON.stringify(sections), roundSchedule === null ? null : typeof roundSchedule === 'string' ? roundSchedule : JSON.stringify(roundSchedule))
}
function members(db: DatabaseSync, n: number) {
  for (let i = 1; i <= n; i++) db.prepare(`INSERT INTO members (id, email, full_name) VALUES (?, ?, ?)`).run(`m${i}`, `m${i}@test.lca`, `Member ${i}`)
}

describe('backfill values', () => {
  let db: DatabaseSync
  beforeAll(() => {
    db = openMigratedDb({ files: BEFORE })
    members(db, 2)
    seed(db, 'fees', [
      { name: 'Free', entryFee: 0 },
      { name: 'Cents', entryFee: 12.5 },
      { name: 'Nulled', entryFee: null },
      { name: 'Absent' },
    ])
    seed(db, 'names', [
      { name: `O'Brien "Elite"`, entryFee: 10 },
      { name: 'Ñandú Open', entryFee: 10 },
      { name: 'Open', entryFee: 10 },
      { name: 'open', entryFee: 11 },
      { name: 'Open ', entryFee: 12 },
      { name: ' ', entryFee: 13 },
    ])
    seed(db, 'notarray', 'null')
    seed(db, 'string-json', '"Open"')
    seed(db, 'number-json', '5')
    seed(db, 'nested', '[["Open"],[],{"name":7},{"name":null},{"name":["Open"]},null,true,"Real"]')
    seed(db, 'rounds', '["Open"]', [
      { round: 0, date: '2026-10-24', time: '09:00' },
      { round: -1, date: '2026-10-24', time: '09:00' },
      { round: 2.9, date: '2026-10-24', time: '09:00' },
      { round: 3, date: 20261025, time: 900 },
      { round: 4 },
      { round: null, date: '2026-10-26', time: '09:00' },
      { round: 'x', date: '2026-10-26', time: '09:00' },
    ])
    seed(db, 'rounds-object', '["Open"]', '{"rounds":[{"round":1}]}')
    seed(db, 'rules', [{ name: 'Open', rulesSet: true, unratedOk: false, ratingMin: 1200.0, prizes: [1, 2] }, { name: 'Quick', rulesSet: false }, { name: 'Odd', rulesSet: 'true', prizes: 'none' }])
    // Entries under names that differ from the JSON by a space or by case.
    for (const [id, t, m, section] of [['x1', 'names', 'm1', 'Open  '], ['x2', 'names', 'm2', 'OPEN'], ['x3', 'fees', 'm1', 'Free']]) {
      db.prepare(`INSERT INTO registrations (id, tournament_id, member_id, section) VALUES (?, ?, ?, ?)`).run(id, t, m, section)
    }
    applyMigrations(db, NEW_FILES)
  })

  it('a fee of 0 is kept as 0 and a missing or null entryFee inherits (null); decimals survive', () => {
    expect(live(db, 'fees').map((s) => [s.name, s.fee_regular])).toEqual([['Free', 0], ['Cents', 12.5], ['Nulled', null], ['Absent', null]])
    expect(live(db, 'fees').every((s) => s.extra_json === null)).toBe(true)
  })

  it('names are kept exactly: quotes, accents, case, a trailing space and a lone space each make their own row', () => {
    expect(live(db, 'names').map((s) => [s.name, s.fee_regular])).toEqual([
      [`O'Brien "Elite"`, 10], ['Ñandú Open', 10], ['Open', 10], ['open', 11], ['Open ', 12], [' ', 13],
    ])
  })

  it('JSON that is valid but not an array gives no rows and no error', () => {
    for (const t of ['notarray', 'string-json', 'number-json']) {
      expect(live(db, t), t).toEqual([])
      expect(archived(db, t), t).toEqual([])
    }
  })

  it('array elements that are not a string or an object with a text name are skipped', () => {
    expect(live(db, 'nested').map((s) => [s.name, s.position])).toEqual([['Real', 7]])
  })

  it('entries under a name that differs by a space or by case get an archived row of that exact name', () => {
    expect(archived(db, 'names').map((s) => s.name)).toEqual(['OPEN', 'Open  '])
    const x = all<{ id: string; section: string; name: string; archived_at: string | null }>(db,
      `SELECT r.id, r.section, s.name, s.archived_at FROM registrations r JOIN tournament_sections s ON s.id = r.section_id WHERE r.id IN ('x1','x2') ORDER BY r.id`)
    expect(x.map((r) => [r.section, r.name, r.archived_at !== null])).toEqual([['Open  ', 'Open  ', true], ['OPEN', 'OPEN', true]])
  })

  it('a name used by an entry that a live row already has does not get a second row', () => {
    expect(archived(db, 'fees')).toEqual([])
    expect(one<{ n: number }>(db, `SELECT COUNT(*) AS n FROM tournament_sections WHERE tournament_id = 'fees' AND name = 'Free'`).n).toBe(1)
  })

  it('rounds: 0, negative, nameless and non-numeric rounds are skipped; a fractional round is cut to its whole part; non-text date and time become null', () => {
    expect(rounds(db, 'rounds')).toEqual([
      { round: 2, date: '2026-10-24', time: '09:00' },
      { round: 3, date: null, time: null },
      { round: 4, date: null, time: null },
    ])
  })

  it('a round_schedule that is valid JSON but not an array gives no rounds, and the tournament still has its one primary schedule', () => {
    expect(rounds(db, 'rounds-object')).toEqual([])
    expect(one<{ n: number }>(db, `SELECT COUNT(*) AS n FROM tournament_schedules WHERE tournament_id = 'rounds-object' AND is_primary = 1`).n).toBe(1)
  })

  it('booleans and limits: rulesSet true is 1; a string "true" stays in extra_json; unratedOk false is 0; a whole-number float limit is kept', () => {
    const rows = Object.fromEntries(live(db, 'rules').map((s) => [s.name, s]))
    expect(rows.Open).toMatchObject({ rules_set: 1, unrated_ok: 0, rating_min: 1200 })
    expect(JSON.parse(rows.Open.prizes_json as string)).toEqual([1, 2])
    expect(rows.Quick).toMatchObject({ rules_set: 0, unrated_ok: null })
    expect(rows.Odd.rules_set).toBe(0)
    expect(JSON.parse(rows.Odd.extra_json as string)).toEqual({ rulesSet: 'true', prizes: 'none' })
    expect(rows.Odd.prizes_json).toBeNull()
  })

  it('no row anywhere has a tier price or a cap', () => {
    expect(one<{ n: number }>(db, 'SELECT COUNT(*) AS n FROM tournament_sections WHERE fee_early IS NOT NULL OR fee_late IS NOT NULL OR cap IS NOT NULL').n).toBe(0)
  })
})

describe('0052 and 0053 on a database with no tournaments', () => {
  it('create the tables and triggers and add no rows; a second run of 0053 is a no-op', () => {
    const db = openMigratedDb()
    for (const t of ['tournament_sections', 'tournament_schedules', 'tournament_schedule_rounds']) {
      expect(one<{ n: number }>(db, `SELECT COUNT(*) AS n FROM ${t}`).n, t).toBe(0)
    }
    applyMigrations(db, ['0053_sections_schedules_backfill.sql'])
    expect(all<{ name: string }>(db, `SELECT name FROM sqlite_master WHERE type = 'trigger' AND name LIKE '%section%' ORDER BY name`).map((t) => t.name)).toEqual([
      'registrations_fill_section_insert', 'registrations_fill_section_update', 'tournaments_sections_sync_insert', 'tournaments_sections_sync_update',
    ])
  })
})

describe('0053 run again after the tables have been edited', () => {
  it('keeps ids, caps, archived rows and tier prices the later code wrote, and links entries added since', () => {
    const db = openMigratedDb({ files: BEFORE })
    members(db, 2)
    seed(db, 'a', [{ name: 'Open', entryFee: 30 }, { name: 'U1200', entryFee: 20 }], [{ round: 1, date: '2026-10-24', time: '09:00' }])
    db.prepare(`INSERT INTO registrations (id, tournament_id, member_id, section) VALUES ('r1', 'a', 'm1', 'Open')`).run()
    applyMigrations(db, NEW_FILES)
    const open = live(db, 'a').find((s) => s.name === 'Open') as Sec
    db.prepare('UPDATE tournament_sections SET cap = 24, fee_early = 25, fee_late = 35 WHERE id = ?').run(open.id)
    db.prepare(`UPDATE tournament_schedules SET time_control = 'G/90+30', label = 'Saturday' WHERE tournament_id = 'a'`).run()
    const before = {
      sections: all(db, 'SELECT * FROM tournament_sections ORDER BY id'),
      schedules: all(db, 'SELECT * FROM tournament_schedules ORDER BY id'),
      rounds: all(db, 'SELECT * FROM tournament_schedule_rounds ORDER BY schedule_id, round'),
      regs: all(db, 'SELECT * FROM registrations ORDER BY id'),
    }
    applyMigrations(db, ['0053_sections_schedules_backfill.sql'])
    applyMigrations(db, ['0053_sections_schedules_backfill.sql'])
    expect({
      sections: all(db, 'SELECT * FROM tournament_sections ORDER BY id'),
      schedules: all(db, 'SELECT * FROM tournament_schedules ORDER BY id'),
      rounds: all(db, 'SELECT * FROM tournament_schedule_rounds ORDER BY schedule_id, round'),
      regs: all(db, 'SELECT * FROM registrations ORDER BY id'),
    }).toEqual(before)
    expect(live(db, 'a').find((s) => s.name === 'Open')).toMatchObject({ cap: 24, fee_early: 25, fee_late: 35 })
  })
})

describe('a larger database', () => {
  it('links every one of 300 entries across 20 tournaments, with one primary schedule each', () => {
    const db = openMigratedDb({ files: BEFORE })
    members(db, 15)
    for (let t = 0; t < 20; t++) {
      seed(db, `t${t}`, [{ name: 'Open', entryFee: 20 }, 'Reserve'], [{ round: 1, date: '2026-10-24', time: '09:00' }, { round: 2, date: '2026-10-24', time: '14:00' }])
      for (let m = 1; m <= 15; m++) {
        db.prepare(`INSERT INTO registrations (id, tournament_id, member_id, section) VALUES (?, ?, ?, ?)`).run(`r-${t}-${m}`, `t${t}`, `m${m}`, m % 3 === 0 ? 'Reserve' : m % 7 === 0 ? 'Old name' : 'Open')
      }
    }
    applyMigrations(db, NEW_FILES)
    expect(one<{ n: number }>(db, 'SELECT COUNT(*) AS n FROM registrations').n).toBe(300)
    expect(one<{ n: number }>(db, 'SELECT COUNT(*) AS n FROM registrations WHERE section_id IS NULL OR schedule_id IS NULL').n).toBe(0)
    expect(one<{ n: number }>(db,
      `SELECT COUNT(*) AS n FROM registrations r JOIN tournament_sections s ON s.id = r.section_id
        WHERE s.name <> r.section OR s.tournament_id <> r.tournament_id`).n).toBe(0)
    expect(one<{ n: number }>(db,
      `SELECT COUNT(*) AS n FROM tournaments t WHERE (SELECT COUNT(*) FROM tournament_schedules p WHERE p.tournament_id = t.id AND p.is_primary = 1 AND p.archived_at IS NULL) <> 1`).n).toBe(0)
    expect(one<{ n: number }>(db, 'SELECT COUNT(*) AS n FROM tournament_schedule_rounds').n).toBe(40)
    expect(one<{ n: number }>(db, 'SELECT COUNT(*) AS n FROM tournament_sections WHERE archived_at IS NOT NULL').n).toBe(20)
  })
})

describe('trigger edges', () => {
  let db: DatabaseSync
  beforeAll(() => {
    db = openMigratedDb()
    members(db, 3)
  })
  const setSections = (t: string, v: unknown) => db.prepare('UPDATE tournaments SET sections = ? WHERE id = ?').run(typeof v === 'string' ? v : JSON.stringify(v), t)
  const setRounds = (t: string, v: unknown) => db.prepare('UPDATE tournaments SET round_schedule = ? WHERE id = ?').run(v === null ? null : typeof v === 'string' ? v : JSON.stringify(v), t)
  const enter = (id: string, t: string, m: string, s: string) => db.prepare(`INSERT INTO registrations (id, tournament_id, member_id, section) VALUES (?, ?, ?, ?)`).run(id, t, m, s)
  const reg = (id: string) => one<{ section: string; section_id: string; schedule_id: string }>(db, 'SELECT section, section_id, schedule_id FROM registrations WHERE id = ?', id)
  const nameOf = (sectionId: string) => one<{ name: string; tournament_id: string }>(db, 'SELECT name, tournament_id FROM tournament_sections WHERE id = ?', sectionId)

  it('a new tournament with the column default, malformed JSON or a JSON object gets a primary schedule and no sections', () => {
    db.prepare(`INSERT INTO tournaments (id, name, location, date, entry_fee) VALUES ('d1', 'D1', 'Kenner, LA', '2026-10-24', 10)`).run()
    seed(db, 'd2', '[{"name":')
    seed(db, 'd3', '{"name":"Open"}')
    for (const t of ['d1', 'd2', 'd3']) {
      expect(live(db, t), t).toEqual([])
      expect(one<{ n: number }>(db, `SELECT COUNT(*) AS n FROM tournament_schedules WHERE tournament_id = ? AND is_primary = 1 AND archived_at IS NULL`, t).n, t).toBe(1)
    }
  })

  it('reordering keeps every id and only moves positions; saving the same JSON again changes nothing', () => {
    seed(db, 'o', [{ name: 'A', entryFee: 1 }, { name: 'B', entryFee: 2 }, { name: 'C', entryFee: 3 }])
    const ids = Object.fromEntries(live(db, 'o').map((s) => [s.name, s.id]))
    setSections('o', [{ name: 'C', entryFee: 3 }, { name: 'A', entryFee: 1 }, { name: 'B', entryFee: 2 }])
    expect(live(db, 'o').map((s) => [s.name, s.position, s.id])).toEqual([['C', 0, ids.C], ['A', 1, ids.A], ['B', 2, ids.B]])
    const rows = all(db, 'SELECT * FROM tournament_sections WHERE tournament_id = ? ORDER BY id', 'o')
    setSections('o', [{ name: 'C', entryFee: 3 }, { name: 'A', entryFee: 1 }, { name: 'B', entryFee: 2 }])
    setSections('o', [{ name: 'C', entryFee: 3 }, { name: 'A', entryFee: 1 }, { name: 'B', entryFee: 2 }])
    expect(all(db, 'SELECT * FROM tournament_sections WHERE tournament_id = ? ORDER BY id', 'o')).toEqual(rows)
  })

  it('a key dropped from a section clears its column; a fee that goes from a number to nothing goes back to inheriting', () => {
    seed(db, 'k', [{ name: 'Open', entryFee: 30, prizeFund: '$500', ratingMax: 1999, colour: 'red' }])
    expect(live(db, 'k')[0]).toMatchObject({ fee_regular: 30, rating_max: 1999 })
    setSections('k', [{ name: 'Open' }])
    expect(live(db, 'k')[0]).toMatchObject({ fee_regular: null, rating_max: null, extra_json: null })
    expect(one<{ prize_fund: string | null }>(db, `SELECT prize_fund FROM tournament_sections WHERE tournament_id = 'k'`).prize_fund).toBeNull()
  })

  it('an empty array archives every live row and keeps the entries linked to them', () => {
    seed(db, 'e', ['Open', 'Reserve'])
    enter('re1', 'e', 'm1', 'Open')
    setSections('e', [])
    expect(live(db, 'e')).toEqual([])
    expect(archived(db, 'e').map((s) => s.name)).toEqual(['Open', 'Reserve'])
    expect(nameOf(reg('re1').section_id).name).toBe('Open')
    setSections('e', ['Reserve', 'Open'])
    expect(live(db, 'e').map((s) => s.name)).toEqual(['Reserve', 'Open'])
    expect(archived(db, 'e')).toEqual([])
  })

  it('JSON that is valid but not an array (an object, null, a string) archives nothing', () => {
    seed(db, 'n', ['Open'])
    const before = all(db, 'SELECT * FROM tournament_sections WHERE tournament_id = ?', 'n')
    setSections('n', '{"name":"Other"}')
    setSections('n', 'null')
    setSections('n', '"Other"')
    setSections('n', '')
    expect(all(db, 'SELECT * FROM tournament_sections WHERE tournament_id = ?', 'n')).toEqual(before)
  })

  it('a name given twice in an edit keeps the first element; a string and an object of one name count as one', () => {
    seed(db, 'w', ['Open'])
    setSections('w', [{ name: 'Open', entryFee: 11 }, { name: 'Open', entryFee: 99 }, 'Open', 'Extra', { name: 'Extra', entryFee: 4 }])
    expect(live(db, 'w').map((s) => [s.name, s.position, s.fee_regular])).toEqual([['Open', 0, 11], ['Extra', 3, null]])
  })

  it('an entry never takes a section of another tournament with the same name', () => {
    seed(db, 'x', ['Open', 'U1200'])
    seed(db, 'y', ['U1200', 'Open'])
    enter('xa', 'x', 'm1', 'Open')
    enter('ya', 'y', 'm1', 'Open')
    expect(nameOf(reg('xa').section_id)).toEqual({ name: 'Open', tournament_id: 'x' })
    expect(nameOf(reg('ya').section_id)).toEqual({ name: 'Open', tournament_id: 'y' })
    expect(reg('xa').schedule_id).not.toBe(reg('ya').schedule_id)
    db.prepare(`UPDATE registrations SET section = 'U1200' WHERE id = 'ya'`).run()
    expect(nameOf(reg('ya').section_id)).toEqual({ name: 'U1200', tournament_id: 'y' })
  })

  it('an entry under a name with a live row and an archived row takes the live one', () => {
    seed(db, 'v', ['Open'])
    db.prepare(`INSERT INTO tournament_sections (tournament_id, name, archived_at) VALUES ('v', 'Open', datetime('now'))`).run()
    enter('va', 'v', 'm1', 'Open')
    expect(nameOf(reg('va').section_id)).toMatchObject({ name: 'Open' })
    expect(one<{ archived_at: string | null }>(db, 'SELECT archived_at FROM tournament_sections WHERE id = ?', reg('va').section_id).archived_at).toBeNull()
  })

  it('saving the tournament again fills an entry that has no section_id, but never changes one that has it', () => {
    seed(db, 'f', ['Open', 'Reserve'])
    enter('fa', 'f', 'm1', 'Open')
    const fixed = reg('fa').section_id
    db.prepare(`INSERT INTO registrations (id, tournament_id, member_id, section, section_id) VALUES ('fb', 'f', 'm2', 'Open', ?)`).run(live(db, 'f')[1].id)
    db.prepare(`UPDATE registrations SET section_id = NULL, schedule_id = NULL WHERE id = 'fa'`).run()
    setSections('f', ['Open', 'Reserve', 'Blitz'])
    expect(reg('fa')).toMatchObject({ section_id: fixed })
    expect(reg('fa').schedule_id).not.toBeNull()
    expect(reg('fb').section_id).toBe(live(db, 'f')[1].id)
  })

  it('an update to an entry that is not a section move leaves section_id alone', () => {
    seed(db, 'u', ['Open', 'Reserve'])
    enter('ua', 'u', 'm1', 'Open')
    const first = reg('ua').section_id
    db.prepare(`UPDATE registrations SET payment_status = 'paid' WHERE id = 'ua'`).run()
    db.prepare(`UPDATE registrations SET section = 'Open' WHERE id = 'ua'`).run()
    expect(reg('ua').section_id).toBe(first)
    // Moving it to a name the event has never had makes an archived row for the name.
    db.prepare(`UPDATE registrations SET section = 'Walk-up' WHERE id = 'ua'`).run()
    expect(nameOf(reg('ua').section_id).name).toBe('Walk-up')
    expect(archived(db, 'u').map((s) => s.name)).toEqual(['Walk-up'])
  })

  it('round_schedule: null or JSON null clears, an empty array clears, malformed or an object leaves, and a change to sections alone leaves', () => {
    seed(db, 'rs', ['Open'], [{ round: 1, date: '2026-10-24', time: '09:00' }, { round: 2, date: '2026-10-24', time: '14:00' }])
    expect(rounds(db, 'rs')).toHaveLength(2)
    setRounds('rs', '{"round":1}')
    setRounds('rs', 'oops')
    setSections('rs', ['Open', 'U1200'])
    expect(rounds(db, 'rs')).toHaveLength(2)
    setRounds('rs', [])
    expect(rounds(db, 'rs')).toEqual([])
    setRounds('rs', [{ round: 1, date: '2026-10-25', time: '10:00' }])
    expect(rounds(db, 'rs')).toEqual([{ round: 1, date: '2026-10-25', time: '10:00' }])
    setRounds('rs', null)
    expect(rounds(db, 'rs')).toEqual([])
    // The admin PATCH stores JSON.stringify(null) for roundSchedule: null.
    setRounds('rs', [{ round: 1, date: '2026-10-25', time: '10:00' }])
    expect(rounds(db, 'rs')).toHaveLength(1)
    setRounds('rs', 'null')
    expect(rounds(db, 'rs')).toEqual([])
  })

  it('round_schedule written with rounds out of order and a repeated round: ordered by round, the first element wins', () => {
    seed(db, 'ro', ['Open'])
    setRounds('ro', [{ round: 3, date: 'c', time: '3' }, { round: 1, date: 'a', time: '1' }, { round: 3, date: 'z', time: '9' }, { round: 2, date: 'b', time: '2' }])
    expect(rounds(db, 'ro')).toEqual([{ round: 1, date: 'a', time: '1' }, { round: 2, date: 'b', time: '2' }, { round: 3, date: 'c', time: '3' }])
  })

  it('changing other tournament columns (name, entry_fee, tier prices, status) leaves every new row as it was', () => {
    seed(db, 'z', [{ name: 'Open', entryFee: 25 }], [{ round: 1, date: '2026-10-24', time: '09:00' }])
    const snap = () => [
      all(db, 'SELECT * FROM tournament_sections WHERE tournament_id = ? ORDER BY id', 'z'),
      all(db, 'SELECT * FROM tournament_schedules WHERE tournament_id = ? ORDER BY id', 'z'),
    ]
    const before = snap()
    db.prepare(`UPDATE tournaments SET name = 'Z2', entry_fee = 50, early_discount = 5, late_fee = 7, status = 'active' WHERE id = 'z'`).run()
    expect(snap()).toEqual(before)
  })

  it('deleting a tournament that was edited several times leaves no orphan and a clean foreign_key_check', () => {
    seed(db, 'del', ['Open'], [{ round: 1, date: '2026-10-24', time: '09:00' }])
    setSections('del', ['Open', 'B'])
    setSections('del', ['B'])
    db.prepare(`DELETE FROM tournaments WHERE id = 'del'`).run()
    expect(one<{ n: number }>(db, `SELECT COUNT(*) AS n FROM tournament_sections WHERE tournament_id = 'del'`).n).toBe(0)
    expect(one<{ n: number }>(db, `SELECT COUNT(*) AS n FROM tournament_schedules WHERE tournament_id = 'del'`).n).toBe(0)
    expect(all(db, 'PRAGMA foreign_key_check')).toEqual([])
  })
})

describe('with recursive triggers on', () => {
  // D1 runs with recursive_triggers off; a connection that turns it on must
  // still end with the same rows and no runaway.
  const run = (recursive: boolean) => {
    const db = openMigratedDb({ files: BEFORE })
    db.exec(`PRAGMA recursive_triggers = ${recursive ? 'ON' : 'OFF'}`)
    members(db, 1)
    seed(db, 'a', [{ name: 'Open', entryFee: 30 }, 'U1200'], [{ round: 1, date: '2026-10-24', time: '09:00' }])
    db.prepare(`INSERT INTO registrations (id, tournament_id, member_id, section) VALUES ('r1', 'a', 'm1', 'Walk-up')`).run()
    applyMigrations(db, NEW_FILES)
    db.prepare(`INSERT INTO registrations (id, tournament_id, member_id, section) VALUES ('r2', 'a', 'm1', 'Open')`).run()
    db.prepare(`UPDATE tournaments SET sections = ? WHERE id = 'a'`).run(JSON.stringify(['Open', 'Walk-up']))
    db.prepare(`UPDATE registrations SET section = 'U1200' WHERE id = 'r2'`).run()
    const strip = (rows: Array<Record<string, unknown>>) => rows.map((r) => ({ name: r.name, position: r.position, fee: r.fee_regular, archived: r.archived_at !== null }))
    return {
      sections: strip(all(db, 'SELECT * FROM tournament_sections ORDER BY name, archived_at')),
      count: one<{ n: number }>(db, 'SELECT COUNT(*) AS n FROM tournament_schedules').n,
      unlinked: one<{ n: number }>(db, 'SELECT COUNT(*) AS n FROM registrations WHERE section_id IS NULL OR schedule_id IS NULL').n,
    }
  }
  it('gives the same rows as with them off', () => {
    expect(run(true)).toEqual(run(false))
    expect(run(true).unlinked).toBe(0)
    expect(run(true).count).toBe(1)
  })
})
