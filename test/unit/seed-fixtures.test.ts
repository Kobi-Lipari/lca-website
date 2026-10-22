// scripts/seed/fixtures.sql is the synthetic data the accessibility tests
// run on (npm run test:a11y) and that npm run db:seed:preview loads into the
// branch preview database. This loads it into a database built from
// migrations/*.sql on node:sqlite, with foreign keys on, and checks:
//
// - it loads after migration 0054, twice, and the second load leaves the
//   same rows (it is re-runnable, as a preview seed must be)
// - the rows the migrations add are untouched
// - the 0053 triggers build the section and schedule rows from the JSON
//   columns, entries get their section ids, and the early and late prices
//   land on the section the file names
// - the finished event has half-point results, and the guardian has two
//   children
// - nothing in it is real: example.org addresses and links only, no US
//   Chess IDs, every person named "<first name> Fixture"
// - db:seed:preview loads it only after scripts/db/preview-guard.ts passes
//   (wrangler is swapped for an echo, and the script runs with a PATH whose
//   only wrangler is a stub that exits 99, so nothing reaches any database)
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import { describe, expect, it } from 'vitest'
import { splitSql } from '../shared/splitSql'
import { migrationFiles, openMigratedDb, userTables } from './helpers/sqlite'

const ROOT = resolve(__dirname, '../..')
const SEED_PATH = 'scripts/seed/fixtures.sql'
const SEED = readFileSync(join(ROOT, SEED_PATH), 'utf8')

const load = (db: DatabaseSync) => {
  for (const stmt of splitSql(SEED)) db.exec(stmt)
}
const all = <T = Record<string, unknown>>(db: DatabaseSync, sql: string, ...params: Array<string | number | null>) =>
  db.prepare(sql).all(...params) as T[]
const one = <T = Record<string, unknown>>(db: DatabaseSync, sql: string, ...params: Array<string | number | null>) =>
  db.prepare(sql).get(...params) as T

/** Every row of every table, as text, for comparing two states of the database. */
function snapshot(db: DatabaseSync, keep: (table: string, row: Record<string, unknown>) => boolean): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const table of userTables(db)) {
    out[table] = all(db, `SELECT * FROM "${table}"`)
      .filter((row) => keep(table, row))
      // created_at and the like default to the time of the insert
      .map((row) => JSON.stringify(row, (k, v) => (/(_at|cached_at)$/.test(k) && k !== 'archived_at' ? undefined : v)))
      .sort()
  }
  return out
}

/**
 * True for a row the seed owns: its id, or the id of the tournament or seat
 * it hangs off, starts with fx-. A schedule's rounds hang off a schedule
 * whose id is random, so the comparisons below leave those tables out.
 */
const isFixtureRow = (_table: string, row: Record<string, unknown>) =>
  ['id', 'tournament_id', 'seat_id'].some((k) => typeof row[k] === 'string' && (row[k] as string).startsWith('fx-'))

describe('scripts/seed/fixtures.sql loads on the migrated schema', () => {
  it('is written against migrations 0001 to 0054', () => {
    const files = migrationFiles()
    expect(files[0]).toMatch(/^0001_/)
    expect(files.at(-1)).toMatch(/^0054_/)
  })

  it('loads, and loads again with the same result, leaving the migrations\' own rows alone', () => {
    const db = openMigratedDb()
    const before = snapshot(db, (t, r) => !isFixtureRow(t, r))
    load(db)
    const once = snapshot(db, () => true)
    load(db)
    const twice = snapshot(db, () => true)

    // The section and schedule rows are rebuilt with new random ids on each
    // load, so compare them without their ids.
    const withoutIds = (s: Record<string, string[]>) =>
      Object.fromEntries(
        Object.entries(s).map(([t, rows]) => [
          t,
          rows.map((r) => JSON.stringify({ ...JSON.parse(r), id: undefined, section_id: undefined, schedule_id: undefined })).sort(),
        ]),
      )
    expect(withoutIds(twice)).toEqual(withoutIds(once))

    // Rows that are not the seed's own are exactly as the migrations left them.
    const after = snapshot(db, (t, r) => !isFixtureRow(t, r))
    for (const table of Object.keys(before)) {
      if (table === 'tournament_sections' || table === 'tournament_schedules' || table === 'tournament_schedule_rounds') continue
      expect(after[table], table).toEqual(before[table])
    }
    expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([])
  })
})

describe('what the seed holds', () => {
  const db = openMigratedDb()
  load(db)

  it('an open LCA event with object sections, fees and early and late prices', () => {
    const t = one(db, "SELECT * FROM tournaments WHERE id = 'fx-t-open'")
    expect(t).toMatchObject({ registration_status: 'open', status: 'upcoming', club_id: null, early_discount: 5, late_fee: 10 })
    expect(t.early_deadline).toBeTruthy()
    expect(t.late_after).toBeTruthy()
    const sections = all(db, "SELECT name, position, fee_regular, fee_early, fee_late, rating_max, grade_max, unrated_ok FROM tournament_sections WHERE tournament_id = 'fx-t-open' AND archived_at IS NULL ORDER BY position")
    expect(sections).toEqual([
      { name: 'Open', position: 0, fee_regular: 40, fee_early: 32, fee_late: 50, rating_max: null, grade_max: null, unrated_ok: null },
      { name: 'Under 1600', position: 1, fee_regular: 35, fee_early: null, fee_late: null, rating_max: 1599, grade_max: null, unrated_ok: null },
      { name: 'Scholastic', position: 2, fee_regular: 20, fee_early: null, fee_late: null, rating_max: null, grade_max: 12, unrated_ok: 1 },
    ])
  })

  it('an older event whose sections are plain names, with rows and no fees', () => {
    expect(JSON.parse(one<{ sections: string }>(db, "SELECT sections FROM tournaments WHERE id = 'fx-t-legacy'").sections)).toEqual(['Open', 'Reserve', 'Novice'])
    expect(all(db, "SELECT name, fee_regular FROM tournament_sections WHERE tournament_id = 'fx-t-legacy' ORDER BY position")).toEqual([
      { name: 'Open', fee_regular: null },
      { name: 'Reserve', fee_regular: null },
      { name: 'Novice', fee_regular: null },
    ])
  })

  it('an event with a round_schedule, copied into its primary schedule', () => {
    const rounds = all(db, `SELECT r.round, r.time FROM tournament_schedule_rounds r
                              JOIN tournament_schedules s ON s.id = r.schedule_id
                             WHERE s.tournament_id = 'fx-t-quads' AND s.is_primary = 1 ORDER BY r.round`)
    expect(rounds).toEqual([{ round: 1, time: '10:00' }, { round: 2, time: '11:30' }, { round: 3, time: '13:00' }])
  })

  it('every entry has the section and schedule of its name', () => {
    const entries = all<{ section: string; name: string | null; archived_at: string | null; schedule_id: string | null }>(
      db,
      `SELECT r.section, s.name, s.archived_at, r.schedule_id FROM registrations r
         LEFT JOIN tournament_sections s ON s.id = r.section_id
        WHERE r.tournament_id LIKE 'fx-%'`,
    )
    expect(entries).toHaveLength(8)
    for (const e of entries) {
      expect(e.name).toBe(e.section)
      expect(e.archived_at).toBeNull()
      expect(e.schedule_id).not.toBeNull()
    }
  })

  it('a finished event with half-point results', () => {
    expect(one(db, "SELECT status FROM tournaments WHERE id = 'fx-t-done'")).toEqual({ status: 'completed' })
    const results = all<{ result: string }>(db, "SELECT result FROM tournament_games WHERE tournament_id = 'fx-t-done'").map((r) => r.result)
    expect(results).toContain('1/2-1/2')
    expect(results).toContain('bye-half')
    expect(results).not.toContain('pending')
  })

  it('a guardian with two children, clubs, a pinned post, documents, champions and board seats', () => {
    const children = all(db, "SELECT id FROM members WHERE guardian_id = 'fx-m-guardian' ORDER BY id")
    expect(children).toEqual([{ id: 'fx-m-child-1' }, { id: 'fx-m-child-2' }])
    expect(one(db, "SELECT COUNT(*) AS n FROM clubs WHERE id LIKE 'fx-%'")).toEqual({ n: 2 })
    expect(one(db, "SELECT status, pinned FROM lca_posts WHERE id = 'fx-post-pinned'")).toEqual({ status: 'published', pinned: 1 })
    expect(all(db, "SELECT category FROM governance_documents WHERE id LIKE 'fx-%' ORDER BY category")).toEqual([
      { category: 'bylaws' },
      { category: 'minutes' },
      { category: 'treasurer' },
    ])
    expect(one(db, "SELECT COUNT(*) AS n FROM state_champions WHERE id LIKE 'fx-%'")).toEqual({ n: 2 })
    expect(one(db, "SELECT tournament_id FROM state_champions WHERE id = 'fx-champ-1'")).toEqual({ tournament_id: 'fx-t-done' })
    expect(all(db, "SELECT seat_id, member_id FROM board_seat_assignments WHERE id LIKE 'fx-%' AND ended_at IS NULL ORDER BY seat_id")).toEqual([
      { seat_id: 'fx-seat-officer', member_id: 'fx-m-p1' },
      { seat_id: 'fx-seat-rep', member_id: 'fx-m-p2' },
    ])
    expect(one(db, "SELECT link, is_lca FROM clearinghouse WHERE id = 'fx-partner-1'")).toEqual({ link: 'https://example.org/fixture-gulf-coast-open', is_lca: 0 })
  })
})

describe('nothing in the seed is real', () => {
  const db = openMigratedDb()
  load(db)

  it('uses example.org for every email address and link in the file', () => {
    const emails = SEED.match(/[\w.+-]+@[\w.-]+/g) ?? []
    expect(emails.length).toBeGreaterThan(0)
    for (const e of emails) expect(e).toMatch(/@example\.org$/)
    const links = SEED.match(/https?:\/\/[^\s'"]+/g) ?? []
    for (const l of links) expect(new URL(l).hostname).toBe('example.org')
    expect(SEED).not.toMatch(/louisianachess|gmail|supabase|stripe/i)
  })

  it('names every person "<first name> Fixture" and gives no one a US Chess ID', () => {
    const people = all<{ full_name: string; uscf_id: string | null }>(db, "SELECT full_name, uscf_id FROM members WHERE id LIKE 'fx-%'")
    expect(people.length).toBe(8)
    for (const p of people) {
      expect(p.full_name).toMatch(/^[A-Z][a-z]+ Fixture$/)
      expect(p.uscf_id).toBeNull()
    }
    for (const row of all<{ name: string }>(db, "SELECT champion AS name FROM state_champions WHERE id LIKE 'fx-%' UNION ALL SELECT name FROM board_members WHERE id LIKE 'fx-%'")) {
      expect(row.name).toMatch(/^[A-Z][a-z]+ Fixture$/)
    }
  })
})

describe('db:seed:preview', () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { scripts: Record<string, string> }
  const GUARD = 'scripts/db/preview-guard.ts'
  const toml = readFileSync(join(ROOT, 'wrangler.toml'), 'utf8')
  const dir = mkdtempSync(join(tmpdir(), 'seed-guard-'))

  // The only folder on the script's PATH. Its node runs this node, except
  // that it exits 98 for any command naming wrangler (node .../wrangler.js);
  // its wrangler is a stub that exits 99. So if the rewrite below ever misses
  // (a later `npx wrangler@x d1 ...`, a tab), the run fails instead of
  // reaching the preview database. node's own folder is left off the PATH
  // because a global npm install puts a real wrangler there.
  const bin = mkdtempSync(join(tmpdir(), 'seed-guard-bin-'))
  writeFileSync(
    join(bin, 'node'),
    `#!/bin/sh\ncase "$*" in *wrangler*) echo 'wrangler reached through node' >&2; exit 98;; esac\nexec '${process.execPath}' "$@"\n`,
    { mode: 0o755 },
  )
  writeFileSync(join(bin, 'wrangler'), '#!/bin/sh\necho "the real wrangler would have run" >&2\nexit 99\n', { mode: 0o755 })
  const run = (script: string) => spawnSync('/bin/sh', ['-c', script], { cwd: ROOT, encoding: 'utf8', env: { PATH: bin } })

  /** The script with wrangler swapped for an echo, so nothing can reach a database. */
  const dryRun = (config?: string) => {
    let script = pkg.scripts['db:seed:preview']
    script = script.replace('wrangler ', 'echo WRANGLER_WOULD_RUN ')
    if (!script.includes('echo WRANGLER_WOULD_RUN') || /wrangler(\.js|@\S*)?\s+d1/.test(script)) {
      throw new Error(`db:seed:preview still calls wrangler after the rewrite, so it is not run: ${script}`)
    }
    if (config) script = script.replace(GUARD, `${GUARD} --config ${config}`)
    return run(script)
  }

  it('runs the guard on this file before loading this file', () => {
    const script = pkg.scripts['db:seed:preview']
    expect(script.indexOf(GUARD)).toBeLessThan(script.indexOf('wrangler '))
    expect(script).toContain(`--seed ${SEED_PATH}`)
    expect(script).toContain(`--file=${SEED_PATH}`)
    expect(script).toContain('&&')
  })

  it('loads the real seed file once the guard passes', () => {
    const result = dryRun()
    expect(result.status, result.stderr).toBe(0)
    expect(result.stdout).toContain('WRANGLER_WOULD_RUN')
  })

  it('runs with a PATH whose wrangler is the stub, so a missed rewrite fails rather than loading', () => {
    const script = pkg.scripts['db:seed:preview']
    // The stub catches only wrangler found on the PATH, so the script must call it that way.
    expect(script).toMatch(/&& wrangler d1 execute /)
    expect(script).not.toMatch(/wrangler\.js|node_modules|npx/)
    const result = run(script)
    expect(result.status).toBe(99)
    expect(result.stderr).toContain('the real wrangler would have run')
  })

  it('still refuses while the preview id is a placeholder', () => {
    const config = join(dir, 'placeholder.toml')
    writeFileSync(config, toml.replace('28e13174-3a06-47a7-ab0f-b4ac7f24af6f', 'REPLACE_WITH_LCA_DB_PREVIEW_ID'))
    const result = dryRun(config)
    expect(result.status).not.toBe(0)
    expect(result.stdout).not.toContain('WRANGLER_WOULD_RUN')
    expect(result.stderr).toMatch(/placeholder/)
  })
})
