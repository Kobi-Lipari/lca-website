// test/unit/migration-0053-backfill.test.ts
//
// Migrations 0052 (the sections and schedules tables) and 0053 (their
// backfill and the triggers that keep them filled) on a real SQLite database
// with foreign keys on, as on D1. Migrations 0001 to 0051 run first, then
// legacy rows in every shape production may hold go in, then 0052 and 0053:
//
// - object sections, plain string sections, malformed JSON and '[]'
// - a name given twice (the first wins), nameless and non-text elements
// - entry and game section names the JSON does not name
// - round_schedule null, malformed, empty and valid, with a repeated round
// - sections with and without entryFee, and keys of unexpected types
//
// It checks the rows, that fee_early, fee_late and cap are null everywhere,
// that nothing was dropped or changed in the old columns, and that running
// 0053 again adds nothing. The triggers are checked here on plain SQL; the
// Workers runtime test (test/integration/sections-triggers.test.ts) runs the
// real handlers against them.
import { beforeAll, describe, expect, it } from 'vitest'
import type { DatabaseSync } from 'node:sqlite'
import { applyMigrations, foreignKeysOn, migrationFiles, openMigratedDb } from './helpers/sqlite'

const NEW_FILES = ['0052_sections_schedules.sql', '0053_sections_schedules_backfill.sql']
const BEFORE = migrationFiles().filter((f) => f < '0052')

interface SectionRow {
  id: string
  tournament_id: string
  position: number
  name: string
  fee_regular: number | null
  fee_early: number | null
  fee_late: number | null
  cap: number | null
  prize_fund: string | null
  rating_min: number | null
  rating_max: number | null
  unrated_ok: number | null
  grade_min: number | null
  grade_max: number | null
  rules_set: number
  prizes_json: string | null
  extra_json: string | null
  archived_at: string | null
}

const all = <T>(db: DatabaseSync, sql: string, ...args: Array<string | number | null>) =>
  db.prepare(sql).all(...args) as unknown as T[]
const one = <T>(db: DatabaseSync, sql: string, ...args: Array<string | number | null>) =>
  db.prepare(sql).get(...args) as unknown as T

const sectionsOf = (db: DatabaseSync, tournamentId: string) =>
  all<SectionRow>(db, 'SELECT * FROM tournament_sections WHERE tournament_id = ? ORDER BY archived_at IS NOT NULL, position, name', tournamentId)
const liveNames = (db: DatabaseSync, tournamentId: string) =>
  sectionsOf(db, tournamentId).filter((s) => s.archived_at === null).map((s) => s.name)
const archivedNames = (db: DatabaseSync, tournamentId: string) =>
  sectionsOf(db, tournamentId).filter((s) => s.archived_at !== null).map((s) => s.name).sort()
const roundsOf = (db: DatabaseSync, tournamentId: string) =>
  all<{ round: number; date: string | null; time: string | null }>(db,
    `SELECT r.round, r.date, r.time FROM tournament_schedule_rounds r
       JOIN tournament_schedules p ON p.id = r.schedule_id
      WHERE p.tournament_id = ? AND p.is_primary = 1 AND p.archived_at IS NULL
      ORDER BY r.round`, tournamentId)

/** The fields compared for a live row: what the JSON said, in the table's terms. */
const shape = (s: SectionRow) => ({
  name: s.name,
  position: s.position,
  fee_regular: s.fee_regular,
  prize_fund: s.prize_fund,
  rating_min: s.rating_min,
  rating_max: s.rating_max,
  unrated_ok: s.unrated_ok,
  grade_min: s.grade_min,
  grade_max: s.grade_max,
  rules_set: s.rules_set,
  prizes: s.prizes_json === null ? null : JSON.parse(s.prizes_json),
  extra: s.extra_json === null ? null : JSON.parse(s.extra_json),
})
const blank = { prize_fund: null, rating_min: null, rating_max: null, unrated_ok: null, grade_min: null, grade_max: null, rules_set: 0, prizes: null, extra: null }

const PRIZES = { place: [{ label: '1st', amount: 300 }] }

const LEGACY_TOURNAMENTS: Array<{ id: string; entryFee: number; sections: string; roundSchedule: string | null }> = [
  {
    id: 't-objects',
    entryFee: 40,
    sections: JSON.stringify([
      { name: 'Open', entryFee: 40, prizeFund: '$600', prizes: PRIZES },
      { name: 'U1600', entryFee: 35, ratingMax: 1599, unratedOk: true, rulesSet: true },
      { name: 'K-5', gradeMin: 0, gradeMax: 5, colour: 'blue' },
    ]),
    roundSchedule: JSON.stringify([
      { round: 1, date: '2026-10-24', time: '09:00' },
      { round: 2, date: '2026-10-24', time: '13:30' },
      { round: 3, date: '2026-10-25', time: '' },
    ]),
  },
  { id: 't-strings', entryFee: 20, sections: '["Open","Reserve"]', roundSchedule: null },
  { id: 't-invalid', entryFee: 15, sections: '[{"name":"Open"', roundSchedule: 'not json' },
  { id: 't-empty', entryFee: 0, sections: '[]', roundSchedule: '[]' },
  {
    id: 't-dupes',
    entryFee: 30,
    sections: JSON.stringify([
      { name: 'Open', entryFee: 30 },
      { name: 'Open', entryFee: 99 },
      'U1200',
      { name: 'U1200', entryFee: 5 },
      { entryFee: 10 },
      5,
      '',
      { name: 'Odd', entryFee: '25', ratingMax: '1599', unratedOk: 'yes', prizeFund: null },
    ]),
    roundSchedule: JSON.stringify([
      { round: 1, date: '2026-11-07', time: '10:00' },
      { round: 1, date: '2026-12-01', time: '23:00' },
      { round: '2', date: '2026-11-07', time: '14:00' },
      { date: '2026-11-08', time: '10:00' },
      'round three',
    ]),
  },
  { id: 't-orphans', entryFee: 25, sections: '[{"name":"Open","entryFee":25}]', roundSchedule: '{"round":1}' },
  { id: 't-object-json', entryFee: 10, sections: '{"name":"Open"}', roundSchedule: null },
]

const LEGACY_ENTRIES: Array<[id: string, tournament: string, member: string, section: string]> = [
  ['r1', 't-objects', 'm1', 'Open'],
  ['r2', 't-objects', 'm2', 'U1600'],
  ['r3', 't-strings', 'm1', 'Reserve'],
  ['r4', 't-invalid', 'm1', 'Open'],
  ['r5', 't-dupes', 'm1', 'Open'],
  ['r6', 't-dupes', 'm2', 'U1200'],
  ['r7', 't-orphans', 'm1', 'Open'],
  ['r8', 't-orphans', 'm2', 'U1000'],
  ['r9', 't-orphans', 'm3', 'U1000'],
  ['r10', 't-object-json', 'm1', 'Open'],
]

const LEGACY_GAMES: Array<[id: string, tournament: string, section: string]> = [
  ['g1', 't-objects', 'Open'],
  ['g2', 't-orphans', 'Blitz'],
  ['g3', 't-orphans', 'U1000'],
]

function insertLegacyRows(db: DatabaseSync): void {
  for (const m of ['m1', 'm2', 'm3']) {
    db.prepare('INSERT INTO members (id, email, full_name) VALUES (?, ?, ?)').run(m, `${m}@test.lca`, `Member ${m}`)
  }
  const tournament = db.prepare(
    `INSERT INTO tournaments (id, name, location, date, entry_fee, sections, round_schedule)
     VALUES (?, ?, 'Kenner, LA', '2026-10-24', ?, ?, ?)`,
  )
  for (const t of LEGACY_TOURNAMENTS) tournament.run(t.id, `Tournament ${t.id}`, t.entryFee, t.sections, t.roundSchedule)
  const entry = db.prepare(`INSERT INTO registrations (id, tournament_id, member_id, section, payment_status) VALUES (?, ?, ?, ?, 'paid')`)
  for (const r of LEGACY_ENTRIES) entry.run(...r)
  const game = db.prepare(`INSERT INTO tournament_games (id, tournament_id, round, board, section) VALUES (?, ?, 1, 1, ?)`)
  for (const g of LEGACY_GAMES) game.run(...g)
}

/** Everything the backfill writes, for comparing two runs. */
function snapshot(db: DatabaseSync) {
  return {
    sections: all(db, 'SELECT * FROM tournament_sections ORDER BY id'),
    schedules: all(db, 'SELECT * FROM tournament_schedules ORDER BY id'),
    rounds: all(db, 'SELECT * FROM tournament_schedule_rounds ORDER BY schedule_id, round'),
    registrations: all(db, 'SELECT * FROM registrations ORDER BY id'),
  }
}

describe('0052 and 0053 on legacy rows', () => {
  let db: DatabaseSync
  let legacyTournaments: unknown[]
  let afterFirstRun: ReturnType<typeof snapshot>

  beforeAll(() => {
    db = openMigratedDb({ files: BEFORE })
    insertLegacyRows(db)
    legacyTournaments = all(db, 'SELECT * FROM tournaments ORDER BY id')
    applyMigrations(db, NEW_FILES)
    afterFirstRun = snapshot(db)
  })

  it('runs with foreign keys on, from 0001 to 0051 before the legacy rows', () => {
    expect(BEFORE).toHaveLength(52)
    expect(BEFORE.at(-1)).toBe('0051_club_map_location.sql')
    expect(foreignKeysOn(db)).toBe(1)
    expect(all(db, 'PRAGMA foreign_key_check')).toEqual([])
  })

  it('drops and changes nothing: tournaments keep every column and value, the JSON included', () => {
    const now = all<Record<string, unknown>>(db, 'SELECT * FROM tournaments ORDER BY id')
    expect(now).toEqual(legacyTournaments)
    expect(all(db, 'SELECT id, section FROM registrations ORDER BY id')).toEqual(
      [...LEGACY_ENTRIES].sort((a, b) => a[0].localeCompare(b[0])).map(([id, , , section]) => ({ id, section })),
    )
    expect(one(db, 'SELECT COUNT(*) AS n FROM tournament_games')).toEqual({ n: LEGACY_GAMES.length })
  })

  it('turns object sections into rows, keeping every key in a column or in extra_json', () => {
    expect(sectionsOf(db, 't-objects').map(shape)).toEqual([
      { ...blank, name: 'Open', position: 0, fee_regular: 40, prize_fund: '$600', prizes: PRIZES },
      { ...blank, name: 'U1600', position: 1, fee_regular: 35, rating_max: 1599, unrated_ok: 1, rules_set: 1 },
      { ...blank, name: 'K-5', position: 2, fee_regular: null, grade_min: 0, grade_max: 5, extra: { colour: 'blue' } },
    ])
  })

  it('turns plain string sections into named rows that inherit the entry fee', () => {
    expect(sectionsOf(db, 't-strings').map(shape)).toEqual([
      { ...blank, name: 'Open', position: 0, fee_regular: null },
      { ...blank, name: 'Reserve', position: 1, fee_regular: null },
    ])
  })

  it('reads malformed JSON, a JSON object and [] as no sections, without an error', () => {
    expect(liveNames(db, 't-invalid')).toEqual([])
    expect(liveNames(db, 't-object-json')).toEqual([])
    expect(sectionsOf(db, 't-empty')).toEqual([])
  })

  it('keeps the first of a name given twice and skips elements without a usable name', () => {
    const rows = sectionsOf(db, 't-dupes')
    expect(rows.map(shape)).toEqual([
      { ...blank, name: 'Open', position: 0, fee_regular: 30 },
      { ...blank, name: 'U1200', position: 2, fee_regular: null },
      // Keys of an unexpected type stay in extra_json rather than being guessed at.
      { ...blank, name: 'Odd', position: 7, fee_regular: null, extra: { entryFee: '25', ratingMax: '1599', unratedOk: 'yes' } },
    ])
  })

  it('gives names used by entries or games but missing from the JSON an archived row', () => {
    expect(liveNames(db, 't-orphans')).toEqual(['Open'])
    expect(archivedNames(db, 't-orphans')).toEqual(['Blitz', 'U1000'])
    expect(archivedNames(db, 't-invalid')).toEqual(['Open'])
    expect(archivedNames(db, 't-object-json')).toEqual(['Open'])
    expect(archivedNames(db, 't-objects')).toEqual([])
    for (const row of sectionsOf(db, 't-orphans').filter((s) => s.archived_at !== null)) {
      expect(row.fee_regular).toBeNull()
      expect(row.archived_at).toMatch(/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/)
    }
  })

  it('stores no tier price and no cap: fee_early, fee_late and cap are null on every row', () => {
    expect(one(db, 'SELECT COUNT(*) AS n FROM tournament_sections')).toEqual({ n: 13 })
    expect(one(db, 'SELECT COUNT(*) AS n FROM tournament_sections WHERE fee_early IS NOT NULL OR fee_late IS NOT NULL OR cap IS NOT NULL')).toEqual({ n: 0 })
  })

  it('gives every tournament exactly one live primary schedule, labelled and with no time control of its own', () => {
    const rows = all<{ tournament_id: string; n: number; label: string; time_control: string | null; merge_round: number | null }>(db,
      `SELECT tournament_id, COUNT(*) AS n, label, time_control, merge_round FROM tournament_schedules
        WHERE is_primary = 1 AND archived_at IS NULL GROUP BY tournament_id ORDER BY tournament_id`)
    expect(rows.map((r) => r.tournament_id)).toEqual(LEGACY_TOURNAMENTS.map((t) => t.id).sort())
    for (const r of rows) expect(r).toMatchObject({ n: 1, label: 'Main schedule', time_control: null, merge_round: null })
    expect(one(db, 'SELECT COUNT(*) AS n FROM tournament_schedules')).toEqual({ n: LEGACY_TOURNAMENTS.length })
  })

  it('copies round_schedule into the primary rounds, keeping the first of a repeated round', () => {
    expect(roundsOf(db, 't-objects')).toEqual([
      { round: 1, date: '2026-10-24', time: '09:00' },
      { round: 2, date: '2026-10-24', time: '13:30' },
      { round: 3, date: '2026-10-25', time: '' },
    ])
    expect(roundsOf(db, 't-dupes')).toEqual([
      { round: 1, date: '2026-11-07', time: '10:00' },
      { round: 2, date: '2026-11-07', time: '14:00' },
    ])
    for (const id of ['t-strings', 't-invalid', 't-empty', 't-orphans', 't-object-json']) expect(roundsOf(db, id), id).toEqual([])
  })

  it('sets section_id and schedule_id on every registration, to the row of its own name', () => {
    const rows = all<{ id: string; section: string; tournament_id: string; name: string; sec_tournament: string; is_primary: number; sch_tournament: string }>(db,
      `SELECT r.id, r.section, r.tournament_id, s.name, s.tournament_id AS sec_tournament, p.is_primary, p.tournament_id AS sch_tournament
         FROM registrations r
         JOIN tournament_sections s ON s.id = r.section_id
         JOIN tournament_schedules p ON p.id = r.schedule_id`)
    expect(rows).toHaveLength(LEGACY_ENTRIES.length)
    for (const r of rows) {
      expect(r.name, r.id).toBe(r.section)
      expect(r.sec_tournament, r.id).toBe(r.tournament_id)
      expect(r.sch_tournament, r.id).toBe(r.tournament_id)
      expect(r.is_primary, r.id).toBe(1)
    }
    expect(one(db, 'SELECT COUNT(*) AS n FROM registrations WHERE section_id IS NULL OR schedule_id IS NULL')).toEqual({ n: 0 })
    // The two U1000 entries share one archived row.
    const u1000 = all<{ section_id: string }>(db, `SELECT section_id FROM registrations WHERE section = 'U1000'`)
    expect(new Set(u1000.map((r) => r.section_id)).size).toBe(1)
  })

  it('adds nothing when 0053 runs again', () => {
    applyMigrations(db, ['0053_sections_schedules_backfill.sql'])
    expect(snapshot(db)).toEqual(afterFirstRun)
  })
})

describe('the 0053 triggers on plain SQL', () => {
  let db: DatabaseSync

  beforeAll(() => {
    db = openMigratedDb()
    db.prepare(`INSERT INTO members (id, email, full_name) VALUES ('m1', 'm1@test.lca', 'M One'), ('m2', 'm2@test.lca', 'M Two')`).run()
  })

  const newTournament = (id: string, sections: unknown, roundSchedule: unknown = null) =>
    db.prepare(`INSERT INTO tournaments (id, name, location, date, entry_fee, sections, round_schedule) VALUES (?, ?, 'Kenner, LA', '2026-10-24', 20, ?, ?)`)
      .run(id, id, typeof sections === 'string' ? sections : JSON.stringify(sections), roundSchedule === null ? null : JSON.stringify(roundSchedule))
  const setSections = (id: string, sections: unknown) =>
    db.prepare('UPDATE tournaments SET sections = ? WHERE id = ?').run(typeof sections === 'string' ? sections : JSON.stringify(sections), id)
  const enter = (id: string, tournament: string, member: string, section: string) =>
    db.prepare(`INSERT INTO registrations (id, tournament_id, member_id, section) VALUES (?, ?, ?, ?)`).run(id, tournament, member, section)
  const reg = (id: string) => one<{ section: string; section_id: string | null; schedule_id: string | null }>(db, 'SELECT section, section_id, schedule_id FROM registrations WHERE id = ?', id)
  const idOf = (tournament: string, name: string) =>
    one<{ id: string } | undefined>(db, 'SELECT id FROM tournament_sections WHERE tournament_id = ? AND name = ? AND archived_at IS NULL', tournament, name)?.id
  const primaryOf = (tournament: string) =>
    one<{ id: string }>(db, 'SELECT id FROM tournament_schedules WHERE tournament_id = ? AND is_primary = 1 AND archived_at IS NULL', tournament).id

  it('creates the section rows and the primary schedule with its rounds for a new tournament', () => {
    newTournament('a', [{ name: 'Open', entryFee: 30 }, 'U1400'], [{ round: 1, date: '2026-10-24', time: '09:00' }])
    expect(liveNames(db, 'a')).toEqual(['Open', 'U1400'])
    expect(sectionsOf(db, 'a').map((s) => s.fee_regular)).toEqual([30, null])
    expect(roundsOf(db, 'a')).toEqual([{ round: 1, date: '2026-10-24', time: '09:00' }])
  })

  it('fills section_id by live name and schedule_id with the primary on a new entry', () => {
    enter('e1', 'a', 'm1', 'Open')
    expect(reg('e1')).toEqual({ section: 'Open', section_id: idOf('a', 'Open'), schedule_id: primaryOf('a') })
  })

  it('leaves a section_id the writer set itself', () => {
    const u1400 = idOf('a', 'U1400') as string
    db.prepare(`INSERT INTO registrations (id, tournament_id, member_id, section, section_id) VALUES ('e2', 'a', 'm2', 'Open', ?)`).run(u1400)
    expect(reg('e2')).toMatchObject({ section_id: u1400, schedule_id: primaryOf('a') })
  })

  it('follows a changed section name, unless the same update sets section_id', () => {
    db.prepare(`UPDATE registrations SET section = 'U1400' WHERE id = 'e1'`).run()
    expect(reg('e1').section_id).toBe(idOf('a', 'U1400'))
    const open = idOf('a', 'Open') as string
    db.prepare(`UPDATE registrations SET section = 'Somewhere', section_id = ? WHERE id = 'e1'`).run(open)
    expect(reg('e1').section_id).toBe(open)
    db.prepare(`UPDATE registrations SET section = 'U1400' WHERE id = 'e1'`).run()
  })

  it('syncs an edit: adds, renames, removes and updates by name, keeping ids and caps', () => {
    const openId = idOf('a', 'Open') as string
    db.prepare(`UPDATE tournament_sections SET cap = 12, fee_early = 18 WHERE id = ?`).run(openId)
    setSections('a', [{ name: 'Open', entryFee: 35, prizeFund: '$500' }, { name: 'U1200', entryFee: 10 }, { name: 'Scholastic', entryFee: 5 }])
    expect(liveNames(db, 'a')).toEqual(['Open', 'U1200', 'Scholastic'])
    expect(archivedNames(db, 'a')).toEqual(['U1400'])
    const open = sectionsOf(db, 'a').find((s) => s.name === 'Open') as SectionRow
    expect(open).toMatchObject({ id: openId, fee_regular: 35, prize_fund: '$500', cap: 12, fee_early: 18, fee_late: null })
    // The entry under the old name keeps its archived row.
    expect(reg('e1').section_id).toBe(sectionsOf(db, 'a').find((s) => s.name === 'U1400')?.id)
  })

  it('brings back the archived row when a removed name returns', () => {
    const archived = sectionsOf(db, 'a').find((s) => s.name === 'U1400') as SectionRow
    setSections('a', [{ name: 'Open', entryFee: 35 }, { name: 'U1400', entryFee: 15 }])
    expect(liveNames(db, 'a')).toEqual(['Open', 'U1400'])
    expect(idOf('a', 'U1400')).toBe(archived.id)
    expect(reg('e1').section_id).toBe(archived.id)
  })

  it('leaves everything as it was when the new JSON is malformed', () => {
    const before = sectionsOf(db, 'a')
    setSections('a', '[{"name":')
    expect(sectionsOf(db, 'a')).toEqual(before)
  })

  it('replaces the primary rounds when round_schedule changes, and keeps them when only sections change', () => {
    db.prepare('UPDATE tournaments SET round_schedule = ? WHERE id = ?')
      .run(JSON.stringify([{ round: 1, date: '2026-10-31', time: '10:00' }, { round: 2, date: '2026-10-31', time: '14:00' }]), 'a')
    expect(roundsOf(db, 'a')).toEqual([{ round: 1, date: '2026-10-31', time: '10:00' }, { round: 2, date: '2026-10-31', time: '14:00' }])
    setSections('a', [{ name: 'Open', entryFee: 35 }])
    expect(roundsOf(db, 'a')).toHaveLength(2)
    db.prepare(`UPDATE tournaments SET round_schedule = 'oops' WHERE id = 'a'`).run()
    expect(roundsOf(db, 'a')).toHaveLength(2)
    db.prepare('UPDATE tournaments SET round_schedule = NULL WHERE id = ?').run('a')
    expect(roundsOf(db, 'a')).toEqual([])
  })

  it('gives an entry under a name no section has an archived row, so section_id is never null', () => {
    newTournament('b', '[]')
    enter('e3', 'b', 'm1', 'Walk-up')
    const row = sectionsOf(db, 'b')
    expect(row).toHaveLength(1)
    expect(row[0]).toMatchObject({ name: 'Walk-up' })
    expect(row[0].archived_at).not.toBeNull()
    expect(reg('e3').section_id).toBe(row[0].id)
    // When the name is added to the event it becomes that same live section.
    setSections('b', ['Walk-up'])
    expect(idOf('b', 'Walk-up')).toBe(row[0].id)
  })

  it('cascades the new rows when a tournament is deleted with its entries', () => {
    newTournament('c', ['Open'], [{ round: 1, date: '2026-10-24', time: '09:00' }])
    enter('e4', 'c', 'm1', 'Open')
    db.prepare(`DELETE FROM registrations WHERE tournament_id = 'c'`).run()
    db.prepare(`DELETE FROM tournaments WHERE id = 'c'`).run()
    expect(sectionsOf(db, 'c')).toEqual([])
    expect(one(db, `SELECT COUNT(*) AS n FROM tournament_schedules WHERE tournament_id = 'c'`)).toEqual({ n: 0 })
    expect(all(db, 'PRAGMA foreign_key_check')).toEqual([])
  })

  it('refuses a second live primary schedule and a second live section of the same name', () => {
    expect(() => db.prepare(`INSERT INTO tournament_schedules (tournament_id, is_primary) VALUES ('a', 1)`).run()).toThrow(/UNIQUE/)
    expect(() => db.prepare(`INSERT INTO tournament_sections (tournament_id, name) VALUES ('a', 'Open')`).run()).toThrow(/UNIQUE/)
    db.prepare(`INSERT INTO tournament_sections (tournament_id, name, archived_at) VALUES ('a', 'Open', datetime('now'))`).run()
  })
})
