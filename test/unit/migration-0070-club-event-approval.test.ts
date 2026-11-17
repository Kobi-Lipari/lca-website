// test/unit/migration-0070-club-event-approval.test.ts
//
// Migration 0070 (WS09 step 16) on a real SQLite database with foreign keys
// on, as on D1, and its record in drizzle/meta:
// - migrations 0001 to 0069 run first, then rows of the kinds tournaments
//   holds (an LCA-run event with sections, round times, an entry and a
//   director, and a club's hidden draft), then 0070;
// - exactly four columns go on the end of tournaments: needs_lca_approval,
//   INTEGER NOT NULL DEFAULT 0, and three nullable TEXT columns, approved_by
//   referencing members(id) with no delete action; every row already there
//   reads 0 and three NULLs;
// - no table is rebuilt and no row changes: every row of every table keeps
//   its values and its rowid, and every index, trigger and other table's
//   definition is as it was;
// - a member named in approved_by cannot be deleted until it is cleared,
//   which is why the member delete clears it;
// - the member delete, run on a database built to 0069 alone and on one
//   built from every migration, answers as before: with one log line naming
//   no member where the column is not there, and clearing approved_by where
//   it is;
// - drizzle/meta: the journal's sixteenth entry and 0015_snapshot.json.
// Every club, person and event here is made up.
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { DatabaseSync, SQLInputValue } from 'node:sqlite'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { splitSql } from '../shared/splitSql'
import { applyMigrations, foreignKeysOn, migrationFiles, MIGRATIONS_DIR, openMigratedDb, userTables } from './helpers/sqlite'

vi.mock('../../functions/utils/auth', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../functions/utils/auth')>()
  return { ...real, requireAdmin: async () => ({ member: { id: 'example-admin', role: 'lca_admin' } }) }
})
vi.mock('../../functions/utils/supabase', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../functions/utils/supabase')>()
  return { ...real, deleteSupabaseUser: async () => false }
})

const { APPROVALS_UNCLEARED_LOG, onRequestDelete: memberDelete } = await import('../../functions/api/admin/members/[id]')

afterEach(() => {
  vi.restoreAllMocks()
})

const ROOT = resolve(__dirname, '../..')
const FILE = '0070_club_event_approval.sql'
const BEFORE = migrationFiles().filter((f) => f < '0070')
const ADDED = [
  { name: 'needs_lca_approval', type: 'INTEGER', notnull: 1, dflt_value: '0', pk: 0 },
  { name: 'approval_requested_at', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 },
  { name: 'approved_at', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 },
  { name: 'approved_by', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 },
]
const ANSWER = '{"success":true,"authDeleted":false}'

type Row = Record<string, unknown>
const all = <T = Row>(db: DatabaseSync, sql: string, ...args: SQLInputValue[]) => db.prepare(sql).all(...args) as unknown as T[]
const one = <T = Row>(db: DatabaseSync, sql: string, ...args: SQLInputValue[]) => db.prepare(sql).get(...args) as unknown as T

/** The rows the setup writes, as the deployed code would have written them before 0070. */
const ROWS = `
  INSERT INTO clubs (id, name, city) VALUES ('example-chess-club', 'Example Chess Club', 'Baton Rouge');
  INSERT INTO members (id, email, full_name, role) VALUES ('player-one', 'player.one@example.org', 'Player One', 'lca_admin');
  INSERT INTO members (id, email, full_name, role, club_id) VALUES ('player-two', 'player.two@example.org', 'Player Two', 'club_rep', 'example-chess-club');
  INSERT INTO members (id, email, full_name) VALUES ('player-three', 'player.three@example.org', 'Player Three');
  INSERT INTO tournaments (id, name, location, date, entry_fee, sections, round_schedule, club_id, created_by, is_visible, registration_status)
    VALUES ('example-fall-open', 'Example Fall Open', 'Baton Rouge, LA', '2026-10-24', 25, '[{"name":"Open","entryFee":25},{"name":"U1200","entryFee":15}]',
            '[{"round":1,"date":"2026-10-24","time":"10:00"}]', NULL, 'player-one', 1, 'open');
  INSERT INTO tournaments (id, name, location, date, entry_fee, sections, club_id, created_by, is_visible, registration_status)
    VALUES ('example-club-blitz', 'Example Blitz Night', 'Baton Rouge, LA', '2026-12-10', 0, '[{"name":"Blitz","entryFee":0}]', 'example-chess-club', 'player-two', 0, 'draft');
  INSERT INTO tournament_directors (tournament_id, member_id) VALUES ('example-fall-open', 'player-three');
  INSERT INTO registrations (id, tournament_id, member_id, section, payment_status) VALUES ('example-entry', 'example-fall-open', 'player-three', 'Open', 'paid');
`

/** Every row of every table, with its rowid, in rowid order. */
const contents = (db: DatabaseSync) =>
  Object.fromEntries(userTables(db).map((t) => [t, all(db, `SELECT rowid AS _rowid, * FROM "${t}" ORDER BY rowid`)]))
/** Everything sqlite_master records, keyed by type and name. */
const schemaRows = (db: DatabaseSync) =>
  Object.fromEntries(all<{ type: string; name: string; tbl_name: string; sql: string | null }>(db, 'SELECT type, name, tbl_name, sql FROM sqlite_master ORDER BY type, name')
    .map((r) => [`${r.type} ${r.name}`, r]))
const columnsOf = (db: DatabaseSync) =>
  all<{ name: string; type: string; notnull: number; dflt_value: string | null; pk: number }>(db, `SELECT name, type, "notnull", dflt_value, pk FROM pragma_table_info('tournaments')`)
const withoutNew = (table: string, row: Row) => {
  if (table !== 'tournaments') return row
  const rest = { ...row }
  for (const { name } of ADDED) delete rest[name]
  return rest
}

describe('0070_club_event_approval.sql on a database that holds rows', () => {
  let db: DatabaseSync
  let before: ReturnType<typeof contents>
  let after: ReturnType<typeof contents>
  let schemaBefore: ReturnType<typeof schemaRows>
  let schemaAfter: ReturnType<typeof schemaRows>
  let columnsBefore: ReturnType<typeof columnsOf>

  beforeAll(() => {
    db = openMigratedDb({ files: BEFORE, extra: ROWS })
    before = contents(db)
    schemaBefore = schemaRows(db)
    columnsBefore = columnsOf(db)
    applyMigrations(db, [FILE])
    after = contents(db)
    schemaAfter = schemaRows(db)
  })

  it('runs straight after 0069, the last file, with foreign keys on and every reference whole', () => {
    expect(BEFORE.at(-1)).toBe('0069_club_check_marks.sql')
    expect(migrationFiles().at(-1)).toBe(FILE)
    expect(foreignKeysOn(db)).toBe(1)
    expect(all(db, 'PRAGMA foreign_key_check')).toEqual([])
  })

  it('adds exactly the four columns, on the end of tournaments, as the brief writes them', () => {
    const now = columnsOf(db)
    expect(now.slice(0, columnsBefore.length)).toEqual(columnsBefore)
    expect(now.slice(columnsBefore.length)).toEqual(ADDED)
    const keys = all<{ from: string; table: string; to: string; on_delete: string }>(db, `SELECT "from", "table", "to", on_delete FROM pragma_foreign_key_list('tournaments')`)
    expect(keys.filter((k) => k.from === 'approved_by')).toEqual([{ from: 'approved_by', table: 'members', to: 'id', on_delete: 'NO ACTION' }])
  })

  it('changes no row: every row keeps its values and its rowid, and the rows there read 0 and three NULLs', () => {
    expect(Object.keys(after)).toEqual(Object.keys(before))
    for (const table of Object.keys(before)) expect(after[table].map((row) => withoutNew(table, row)), table).toEqual(before[table])
    expect(after.tournaments.map((t) => [t.id, t.needs_lca_approval, t.approval_requested_at, t.approved_at, t.approved_by])).toEqual([
      ['example-fall-open', 0, null, null, null], ['example-club-blitz', 0, null, null, null],
    ])
    expect(before.tournament_sections.length).toBe(3)
    expect(before.registrations.length).toBe(1)
  })

  it('rebuilds no table: only the tournaments definition gains the four columns, and every index and trigger is as it was', () => {
    expect(Object.keys(schemaAfter)).toEqual(Object.keys(schemaBefore))
    const added = ', needs_lca_approval INTEGER NOT NULL DEFAULT 0, approval_requested_at TEXT, approved_at TEXT, approved_by TEXT REFERENCES members(id))'
    for (const [key, row] of Object.entries(schemaBefore)) {
      if (key === 'table tournaments') expect(schemaAfter[key].sql, key).toBe(row.sql!.replace(/\)$/, added))
      else expect(schemaAfter[key], key).toEqual(row)
    }
  })

  it('holds four statements that add and nothing else: no rebuild, no data change and no switch of foreign keys', () => {
    const statements = splitSql(readFileSync(join(MIGRATIONS_DIR, FILE), 'utf8'))
    expect(statements).toHaveLength(4)
    for (const statement of statements) expect(statement).toMatch(/^ALTER TABLE tournaments ADD COLUMN \w+ /)
    const code = readFileSync(join(MIGRATIONS_DIR, FILE), 'utf8').replace(/--.*$/gm, '')
    expect(code).not.toMatch(/\b(?:DROP|UPDATE|INSERT|DELETE|PRAGMA|CREATE)\b|__new_/i)
  })

  it('stops at its first statement if run again, so it runs once, as wrangler runs every file', () => {
    expect(() => applyMigrations(db, [FILE])).toThrow(/0070_club_event_approval\.sql/)
    expect(columnsOf(db).slice(columnsBefore.length)).toEqual(ADDED)
  })

  it('keeps a member named in approved_by until it is cleared, the reason the member delete clears it', () => {
    db.exec(`UPDATE tournaments SET needs_lca_approval = 1, approved_at = datetime('now'), approved_by = 'player-one' WHERE id = 'example-club-blitz'`)
    expect(() => db.exec(`DELETE FROM members WHERE id = 'player-one'`)).toThrow(/FOREIGN KEY/)
    db.exec(`UPDATE tournaments SET approved_by = NULL WHERE approved_by = 'player-one'`)
    expect(one(db, `SELECT needs_lca_approval, approved_by FROM tournaments WHERE id = 'example-club-blitz'`)).toEqual({ needs_lca_approval: 1, approved_by: null })
    expect(all(db, `PRAGMA foreign_key_check`)).toEqual([])
  })
})

/** A D1 over a node:sqlite database: prepare, bind, first, all, run and a batch that runs as one transaction. */
function d1Over(db: DatabaseSync): D1Database {
  const plain = (row: unknown) => (row ? { ...(row as Record<string, unknown>) } : null)
  const statement = (sql: string, args: SQLInputValue[] = []) => ({
    bind: (...values: SQLInputValue[]) => statement(sql, values),
    first: async (column?: string) => {
      const row = plain(db.prepare(sql).get(...args))
      return column === undefined ? row : row?.[column] ?? null
    },
    all: async () => ({ results: db.prepare(sql).all(...args).map(plain), success: true, meta: {} }),
    run: async () => ({ success: true, meta: { changes: Number(db.prepare(sql).run(...args).changes) } }),
  })
  return {
    prepare: (sql: string) => statement(sql),
    batch: async (statements: Array<ReturnType<typeof statement>>) => {
      db.exec('BEGIN')
      try {
        const out = []
        for (const s of statements) out.push(await s.run())
        db.exec('COMMIT')
        return out
      } catch (err) {
        db.exec('ROLLBACK')
        throw err
      }
    },
  } as unknown as D1Database
}

async function deleteMember(db: DatabaseSync, id: string): Promise<Response> {
  const request = new Request('https://lca-website.pages.dev/api/test', { method: 'DELETE' })
  return (memberDelete as PagesFunction<never>)({
    request, env: { DB: d1Over(db) }, params: { id }, data: {}, functionPath: '/api/test',
    waitUntil: () => {}, passThroughOnException: () => {}, next: async () => new Response(null, { status: 404 }),
  } as unknown as Parameters<PagesFunction<never>>[0])
}
const quiet = () => vi.spyOn(console, 'warn').mockImplementation(() => {})
const deleteLines = (warn: ReturnType<typeof quiet>) => warn.mock.calls.map(([line]) => line).filter((l) => typeof l === 'string' && l.startsWith('member delete: '))

describe('the member delete on either side of 0070', () => {
  const people = `
    INSERT INTO members (id, email, full_name, role) VALUES ('player-four', 'player.four@example.org', 'Player Four', 'lca_admin');
    INSERT INTO tournaments (id, name, location, date, entry_fee, sections) VALUES ('example-winter-open', 'Example Winter Open', 'Baton Rouge, LA', '2026-12-12', 0, '[]');
  `

  it('before 0070 has run: deletes the member as before, with one log line naming no member', async () => {
    const db = openMigratedDb({ files: BEFORE, extra: people })
    const warn = quiet()
    const res = await deleteMember(db, 'player-four')
    expect(res.status).toBe(200)
    expect(await res.text()).toBe(ANSWER)
    expect(deleteLines(warn)).toEqual([APPROVALS_UNCLEARED_LOG])
    expect(APPROVALS_UNCLEARED_LOG).not.toMatch(/player|@/i)
    expect(one(db, `SELECT COUNT(*) AS n FROM members WHERE id = 'player-four'`)).toEqual({ n: 0 })
  })

  it('with every migration: clears approved_by on the events the member approved, keeps approved_at, and writes no log line', async () => {
    const db = openMigratedDb({ extra: people })
    db.exec(`UPDATE tournaments SET needs_lca_approval = 1, approved_at = '2026-11-15 18:00:00', approved_by = 'player-four' WHERE id = 'example-winter-open'`)
    const warn = quiet()
    const res = await deleteMember(db, 'player-four')
    expect(res.status).toBe(200)
    expect(await res.text()).toBe(ANSWER)
    expect(deleteLines(warn)).toEqual([])
    expect(one(db, `SELECT needs_lca_approval, approved_at, approved_by FROM tournaments WHERE id = 'example-winter-open'`)).toEqual({ needs_lca_approval: 1, approved_at: '2026-11-15 18:00:00', approved_by: null })
    expect(one(db, `SELECT COUNT(*) AS n FROM members WHERE id = 'player-four'`)).toEqual({ n: 0 })
  })
})

describe('drizzle/meta', () => {
  it('records the change as the journal\'s sixteenth entry, with its snapshot, and the file\'s header names the staged file', () => {
    const journal = JSON.parse(readFileSync(join(ROOT, 'drizzle/meta/_journal.json'), 'utf8')) as { entries: Array<{ idx: number; tag: string }> }
    expect(journal.entries).toHaveLength(16)
    expect(journal.entries.at(-1)).toMatchObject({ idx: 15, tag: '0015_club_event_approval' })
    expect(existsSync(join(ROOT, 'drizzle/meta/0015_snapshot.json'))).toBe(true)
    const header = readFileSync(join(MIGRATIONS_DIR, FILE), 'utf8')
    expect(header.split('\n')[0]).toBe('-- 0070_club_event_approval.sql')
    expect(header).toContain('-- drizzle/0015_club_event_approval.sql.')
    const snapshot = JSON.parse(readFileSync(join(ROOT, 'drizzle/meta/0015_snapshot.json'), 'utf8')) as { tables: Record<string, { columns: Record<string, unknown> }> }
    for (const { name } of ADDED) expect(Object.keys(snapshot.tables.tournaments.columns), name).toContain(name)
  })
})
