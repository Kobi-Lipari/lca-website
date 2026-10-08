// test/unit/redesign-status-k2a.test.ts
//
// REDESIGN_STATUS.md tells K which read-only queries to run on production
// before and after the checkpoint A merge. This test runs those exact
// queries, taken from the file, on a database built from the migrations:
//
// - before the merge (0001 to 0051 plus legacy rows): they run, only read,
//   and flag the rows the backfill will archive, skip or leave inheriting
// - after 0052 and 0053: the "expected 0" queries return 0
//
// and checks the file records the K2a row and the merge note.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { DatabaseSync } from 'node:sqlite'
import { applyMigrations, migrationFiles, openMigratedDb } from './helpers/sqlite'

const STATUS = readFileSync(join(__dirname, '../../REDESIGN_STATUS.md'), 'utf8')
const BEFORE = migrationFiles().filter((f) => f < '0052')
const NEW_FILES = ['0052_sections_schedules.sql', '0053_sections_schedules_backfill.sql']

/** The SQL fence that follows a bullet line starting with `marker`. */
function queriesAfter(marker: string): string[] {
  const at = STATUS.indexOf(marker)
  expect(at, `"${marker}" is in REDESIGN_STATUS.md`).toBeGreaterThan(-1)
  const open = STATUS.indexOf('```sql', at)
  const close = STATUS.indexOf('```', open + 6)
  const block = STATUS.slice(open + 6, close)
  return block
    .split('\n')
    .filter((l) => !l.trim().startsWith('--'))
    .join('\n')
    .split(/;\s*(?:\n|$)/)
    .map((q) => q.trim())
    .filter(Boolean)
}

const BEFORE_MARKER = 'What K runs on production, read-only, before the checkpoint A merge'
const AFTER_MARKER = 'What K runs on production after the merge, and again before checkpoint B merges'

function legacyDb(): DatabaseSync {
  const db = openMigratedDb({ files: BEFORE })
  db.prepare(`INSERT INTO members (id, email, full_name) VALUES ('m1', 'm1@test.lca', 'M1')`).run()
  const t = db.prepare(`INSERT INTO tournaments (id, name, location, date, entry_fee, sections, round_schedule) VALUES (?, ?, 'Kenner, LA', '2026-10-24', 20, ?, ?)`)
  t.run('ok', 'ok', '[{"name":"Open","entryFee":20}]', '[{"round":1,"date":"2026-10-24","time":"09:00"}]')
  t.run('bad-json', 'bad-json', '[{"name":"Open"', 'not json')
  t.run('object', 'object', '{"name":"Open"}', '{"round":1}')
  t.run('dupes', 'dupes', '[{"name":"Open"},{"name":"Open"},{"entryFee":5}," Reserve"]', null)
  t.run('fee-text', 'fee-text', '[{"name":"Open","entryFee":"25"}]', null)
  const r = db.prepare(`INSERT INTO registrations (id, tournament_id, member_id, section) VALUES (?, ?, 'm1', ?)`)
  r.run('r1', 'ok', 'Open')
  r.run('r2', 'ok', 'Missing')
  db.prepare(`INSERT INTO tournament_games (id, tournament_id, round, board, section) VALUES ('g1', 'ok', 1, 1, 'Blitz')`).run()
  return db
}

describe('the production queries in REDESIGN_STATUS.md', () => {
  it('before the merge there are read-only queries for invalid JSON, duplicate names and entries naming a missing section', () => {
    const queries = queriesAfter(BEFORE_MARKER)
    expect(queries.length).toBeGreaterThanOrEqual(5)
    for (const q of queries) expect(q, q).toMatch(/^SELECT\b/i)
    const text = queries.join('\n')
    expect(text).toMatch(/json_valid/)
    expect(text).toMatch(/GROUP BY/i)
    expect(text).toMatch(/FROM registrations/)
    expect(text).toMatch(/tournament_games/)
  })

  it('they run on the pre-merge schema and find the rows the backfill will archive or skip', () => {
    const db = legacyDb()
    const before = db.prepare('SELECT COUNT(*) AS n FROM tournaments').get()
    const rows = queriesAfter(BEFORE_MARKER).map((q) => db.prepare(q).all() as Array<Record<string, unknown>>)
    const [badSections, badRounds, dupes, missing, orphaned, badFee] = rows

    expect(badSections.map((r) => r.id).sort()).toEqual(['bad-json', 'object'])
    expect(badRounds.map((r) => r.id).sort()).toEqual(['bad-json', 'object'])
    expect(dupes.length).toBeGreaterThan(0)
    expect(JSON.stringify(dupes)).toContain('dupes')
    const names = missing.map((r) => r.section)
    expect(names).toEqual(expect.arrayContaining(['Missing', 'Blitz']))
    expect(names).not.toContain('Open')
    expect(Object.values(orphaned[0])).toEqual([0])
    expect(badFee.map((r) => r.id)).toEqual(['fee-text'])
    expect(db.prepare('SELECT COUNT(*) AS n FROM tournaments').get()).toEqual(before)
  })

  it('after the merge the four "expected 0" queries each return 0 on the backfilled database', () => {
    const db = legacyDb()
    applyMigrations(db, NEW_FILES)
    const queries = queriesAfter(AFTER_MARKER)
    expect(queries).toHaveLength(4)
    expect(queries[0]).toMatch(/section_id IS NULL/)
    for (const q of queries) {
      const row = db.prepare(q).get() as Record<string, number>
      expect(Object.values(row), q).toEqual([0])
    }
  })

  it('the after-merge queries catch a problem: an entry with no section_id, a tournament without a primary schedule, and a section of another name', () => {
    const db = legacyDb()
    applyMigrations(db, NEW_FILES)
    const [unlinked, noSchedule, noPrimary, mismatch] = queriesAfter(AFTER_MARKER)
    const n = (q: string) => Object.values(db.prepare(q).get() as Record<string, number>)[0]
    db.exec(`UPDATE registrations SET section_id = NULL WHERE id = 'r1'`)
    expect(n(unlinked)).toBe(1)
    db.exec(`UPDATE registrations SET schedule_id = NULL WHERE id = 'r1'`)
    expect(n(noSchedule)).toBe(1)
    db.exec(`UPDATE tournament_schedules SET archived_at = datetime('now') WHERE tournament_id = 'ok'`)
    expect(n(noPrimary)).toBe(1)
    db.exec(`UPDATE registrations SET section_id = (SELECT id FROM tournament_sections WHERE tournament_id = 'ok' AND name = 'Missing') WHERE id = 'r1'`)
    expect(n(mismatch)).toBe(1)
  })
})

describe('REDESIGN_STATUS.md records the slice', () => {
  it('has the K2a row, naming the two test files and checkpoint A', () => {
    const row = STATUS.split('\n').find((l) => l.startsWith('| K2a |')) ?? ''
    expect(row).toContain('Sections and schedules tables')
    expect(row).toContain('migration-0053-backfill.test.ts')
    expect(row).toContain('sections-triggers.test.ts')
  })

  it('says migrate-db.yml applies 0052 and 0053 to production on merge, and that nothing migrates the preview database for K', () => {
    expect(STATUS).toMatch(/migrate-db\.yml` applies 0052 and 0053 to production/)
    expect(STATUS).toMatch(/db:migrate:preview/)
  })

  it('keeps the soak-period note: the triggers stay until the JSON columns are retired', () => {
    expect(STATUS).toMatch(/Retiring the JSON columns/)
    expect(STATUS).toMatch(/four 0053 triggers go in the same migration/)
  })
})
