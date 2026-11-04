// test/unit/migration-0059-ticket-kinds.test.ts
//
// Migration 0059 (WS08 step 2) on a real SQLite database with foreign keys
// on, as on D1, and its record in drizzle/meta:
// - migrations 0001 to 0058 run first, then rows of every kind the two
//   tables hold (an LCA-run event and a club's hidden draft, with sections,
//   round times, an entry and a director; a general ticket, a ticket routed
//   to a board seat and a member's ticket, with their messages), then 0059;
// - the three columns go on the end of their tables, text and nullable, with
//   no default and no part in the key, and read NULL on every row already
//   there;
// - no table is rebuilt and no row changes: every row keeps its values and
//   its rowid, every index and trigger is as it was, and no other table's
//   definition moves, which is what lets the code already deployed read the
//   database as before when the merge migrates production;
// - what that code writes still goes in and leaves the three NULL, and what
//   the later steps write goes in too: each ticket kind, an about_id naming
//   a tournament or a clearinghouse listing, and the mark as datetime('now')
//   writes it, which sets off none of the 0053 triggers;
// - a ticket outlives the event it is about, since about_id has no foreign
//   key;
// - run a second time it stops at its first statement and changes nothing,
//   so it runs once, as wrangler runs every migration;
// - drizzle/meta: the journal's ninth entry and 0008_snapshot.json, which
//   follows 0007's and differs from it by the three columns alone.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import { beforeAll, describe, expect, it } from 'vitest'
import { storedTimestampSchema } from '../../domain/contracts/common'
import { applyMigrations, foreignKeysOn, migrationFiles, MIGRATIONS_DIR, openMigratedDb, userTables } from './helpers/sqlite'

const FILE = '0059_ticket_kinds.sql'
const BEFORE = migrationFiles().filter((f) => f < '0059')
const NEW_COLUMNS: Record<string, string[]> = {
  support_tickets: ['kind', 'about_id'],
  tournaments: ['review_notified_at'],
}

type Row = Record<string, unknown>
const all = <T = Row>(db: DatabaseSync, sql: string, ...args: Array<string | number | null>) =>
  db.prepare(sql).all(...args) as unknown as T[]
const one = <T = Row>(db: DatabaseSync, sql: string, ...args: Array<string | number | null>) =>
  db.prepare(sql).get(...args) as unknown as T

/** The rows each step of the setup writes, as the deployed code would have written them before 0059. */
function insertRows(db: DatabaseSync): void {
  db.exec(`INSERT INTO clubs (id, name, city) VALUES ('club-a', 'Acadiana Knights', 'Lafayette')`)
  const member = db.prepare('INSERT INTO members (id, email, full_name, role, club_id) VALUES (?, ?, ?, ?, ?)')
  member.run('m-player', 'pat.player@example.org', 'Pat Player', 'member', null)
  member.run('m-rep', 'robin.rep@example.org', 'Robin Rep', 'club_rep', 'club-a')
  member.run('m-td', 'dana.director@example.org', 'Dana Director', 'tournament_director', null)
  const event = db.prepare(
    `INSERT INTO tournaments (id, name, location, date, entry_fee, sections, round_schedule, club_id, created_by, is_visible, registration_status)
     VALUES (?, ?, 'Lafayette, LA', ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
  event.run(
    'lca-1', 'Lafayette Winter Quads', '2026-12-05', 25,
    JSON.stringify([{ name: 'Open', entryFee: 25 }, { name: 'U1200', entryFee: 15 }]),
    JSON.stringify([{ round: 1, date: '2026-12-05', time: '10:00' }, { round: 2, date: '2026-12-05', time: '14:30' }]),
    null, null, 1, 'open',
  )
  event.run('club-1', 'Acadiana Blitz Night', '2026-12-10', 10, JSON.stringify([{ name: 'Blitz', entryFee: 10 }]), null, 'club-a', 'm-rep', 0, 'draft')
  db.exec(`INSERT INTO tournament_directors (tournament_id, member_id) VALUES ('lca-1', 'm-td')`)
  db.exec(`INSERT INTO registrations (id, tournament_id, member_id, section, payment_status) VALUES ('r-1', 'lca-1', 'm-player', 'Open', 'paid')`)
  const seat = one<{ id: string }>(db, `SELECT id FROM board_members WHERE slug = 'treasurer'`).id
  const ticket = db.prepare('INSERT INTO support_tickets (id, number, member_id, name, email, subject, status, seat_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
  ticket.run('t-general', 1001, null, 'Lee Visitor', 'lee.visitor@example.org', 'Parking at the Winter Quads', 'open', null)
  ticket.run('t-seat', 1002, null, 'Sam Sponsor', 'sam.sponsor@example.org', 'A donation receipt', 'in_progress', seat)
  ticket.run('t-member', 1003, 'm-player', 'Pat Player', 'pat.player@example.org', 'My rating after the Fall Open', 'resolved', null)
  const message = db.prepare(`INSERT INTO support_messages (id, ticket_id, sender_id, sender_type, body) VALUES (?, ?, ?, ?, ?)`)
  message.run('msg-1', 't-general', null, 'guest', 'Where do we park?')
  message.run('msg-2', 't-member', 'm-player', 'member', 'My rating has not moved.')
}

/** Every row of every table, with its rowid, in rowid order. */
const contents = (db: DatabaseSync) =>
  Object.fromEntries(userTables(db).map((t) => [t, all(db, `SELECT rowid AS _rowid, * FROM "${t}" ORDER BY rowid`)]))

/** Everything sqlite_master records, keyed by type and name. */
const schemaRows = (db: DatabaseSync) =>
  Object.fromEntries(all<{ type: string; name: string; tbl_name: string; sql: string | null }>(db, 'SELECT type, name, tbl_name, sql FROM sqlite_master ORDER BY type, name')
    .map((r) => [`${r.type} ${r.name}`, r]))

const columnsOf = (db: DatabaseSync, table: string) =>
  all<{ name: string; type: string; notnull: number; dflt_value: string | null; pk: number }>(db, `SELECT name, type, "notnull", dflt_value, pk FROM pragma_table_info('${table}')`)

/** A row without the columns 0059 adds. */
const withoutNew = (table: string, row: Row) => {
  const rest = { ...row }
  for (const column of NEW_COLUMNS[table] ?? []) delete rest[column]
  return rest
}

describe('0059_ticket_kinds.sql on a database that holds rows', () => {
  let db: DatabaseSync
  let before: ReturnType<typeof contents>
  let after: ReturnType<typeof contents>
  let schemaBefore: ReturnType<typeof schemaRows>
  let schemaAfter: ReturnType<typeof schemaRows>
  const columnsBefore: Record<string, ReturnType<typeof columnsOf>> = {}

  beforeAll(() => {
    db = openMigratedDb({ files: BEFORE })
    insertRows(db)
    before = contents(db)
    schemaBefore = schemaRows(db)
    for (const table of Object.keys(NEW_COLUMNS)) columnsBefore[table] = columnsOf(db, table)
    applyMigrations(db, [FILE])
    after = contents(db)
    schemaAfter = schemaRows(db)
  })

  it('runs straight after 0058, with foreign keys on and every reference still whole', () => {
    expect(BEFORE.at(-1)).toBe('0058_state_champion_2026.sql')
    expect(migrationFiles()[BEFORE.length]).toBe(FILE)
    expect(foreignKeysOn(db)).toBe(1)
    expect(all(db, 'PRAGMA foreign_key_check')).toEqual([])
  })

  it('puts the three columns on the end of their tables, each TEXT and nullable, with no default and no part in the key', () => {
    for (const [table, added] of Object.entries(NEW_COLUMNS)) {
      const now = columnsOf(db, table)
      expect(now.slice(0, columnsBefore[table].length), table).toEqual(columnsBefore[table])
      expect(now.slice(columnsBefore[table].length), table).toEqual(added.map((name) => ({ name, type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 })))
    }
  })

  it('changes no row: every row of every table keeps its values and its rowid, and the three columns read NULL', () => {
    expect(Object.keys(after)).toEqual(Object.keys(before))
    for (const table of Object.keys(before)) {
      expect(after[table].map((row) => withoutNew(table, row)), table).toEqual(before[table])
    }
    expect(after.tournaments.map((t) => [t.id, t.review_notified_at])).toEqual([['lca-1', null], ['club-1', null]])
    expect(after.support_tickets.map((t) => [t.id, t.kind, t.about_id])).toEqual([
      ['t-general', null, null], ['t-seat', null, null], ['t-member', null, null],
    ])
    // The setup reached the tables the 0053 triggers fill, so their rows were compared too.
    expect(before.tournament_sections.length).toBe(3)
    expect(before.tournament_schedule_rounds.length).toBe(2)
    expect(before.registrations.map((r) => r.section_id)).not.toContain(null)
  })

  it('rebuilds no table: every index and trigger is as it was, and only the two tables\' definitions gain the three columns', () => {
    expect(Object.keys(schemaAfter)).toEqual(Object.keys(schemaBefore))
    const definitions: Record<string, string> = {
      'table support_tickets': ', `kind` text, `about_id` text)',
      'table tournaments': ', `review_notified_at` text)',
    }
    for (const [key, row] of Object.entries(schemaBefore)) {
      if (definitions[key]) expect(schemaAfter[key].sql, key).toBe(row.sql!.replace(/\)$/, definitions[key]))
      else expect(schemaAfter[key], key).toEqual(row)
    }
    const triggers = Object.values(schemaAfter).filter((r) => r.type === 'trigger' && Object.keys(NEW_COLUMNS).includes(r.tbl_name)).map((r) => r.name).sort()
    expect(triggers).toEqual(['tournaments_sections_sync_insert', 'tournaments_sections_sync_update'])
  })

  it('takes what the code deployed before it writes, columns named as today, and leaves the three NULL', () => {
    db.exec(
      `INSERT INTO support_tickets (id, number, member_id, name, email, subject, seat_id)
       SELECT 't-later', COALESCE(MAX(number), 1000) + 1, NULL, 'Kim Parent', 'kim.parent@example.org', 'Scholastic sections', NULL FROM support_tickets`,
    )
    db.exec(
      `INSERT INTO tournaments (id, name, location, date, entry_fee, rounds, status, club_id, created_by, is_rated, is_visible, requires_lca_membership)
       VALUES ('later-1', 'Baton Rouge Open', 'Baton Rouge, LA', '2027-01-09', 30, 5, 'upcoming', NULL, 'm-rep', 1, 0, 1)`,
    )
    expect(one(db, `SELECT number, kind, about_id FROM support_tickets WHERE id = 't-later'`)).toEqual({ number: 1004, kind: null, about_id: null })
    expect(one(db, `SELECT review_notified_at FROM tournaments WHERE id = 'later-1'`)).toEqual({ review_notified_at: null })
    // A whole-row read, as the handlers make, gains exactly the three keys.
    expect(Object.keys(one(db, `SELECT * FROM support_tickets WHERE id = 't-later'`)).slice(-2)).toEqual(['kind', 'about_id'])
    expect(Object.keys(one(db, `SELECT * FROM tournaments WHERE id = 'later-1'`)).at(-1)).toBe('review_notified_at')
    db.exec(`DELETE FROM support_tickets WHERE id = 't-later'`)
    db.exec(`DELETE FROM tournaments WHERE id = 'later-1'`)
  })

  it('takes what the later steps write: each ticket kind, an about_id for a tournament or a listing, and the mark as datetime(\'now\') writes it', () => {
    const setKind = db.prepare('UPDATE support_tickets SET kind = ?, about_id = ? WHERE id = ?')
    for (const [kind, about] of [['listing_report', 'ch-2026-1188'], ['event_report', 'club-1'], ['payout_request', 'lca-1'], [null, null]] as const) {
      setKind.run(kind, about, 't-general')
      expect(one(db, `SELECT kind, about_id FROM support_tickets WHERE id = 't-general'`), String(kind)).toEqual({ kind, about_id: about })
    }
    // No CHECK holds the list, so the code that writes a kind owns it.
    setKind.run('some_later_kind', null, 't-general')
    expect(one(db, `SELECT kind FROM support_tickets WHERE id = 't-general'`)).toEqual({ kind: 'some_later_kind' })
    setKind.run(null, null, 't-general')
    expect(all(db, 'PRAGMA foreign_key_check')).toEqual([])

    const synced = () => ({
      tournaments: all(db, `SELECT * FROM tournaments ORDER BY id`).map((row) => withoutNew('tournaments', row)),
      sections: all(db, 'SELECT * FROM tournament_sections ORDER BY rowid'),
      schedules: all(db, 'SELECT * FROM tournament_schedules ORDER BY rowid'),
      rounds: all(db, 'SELECT * FROM tournament_schedule_rounds ORDER BY rowid'),
      registrations: all(db, 'SELECT * FROM registrations ORDER BY rowid'),
    })
    const unmarked = synced()
    db.exec(`UPDATE tournaments SET review_notified_at = datetime('now') WHERE id = 'lca-1'`)
    const { review_notified_at: mark } = one<{ review_notified_at: string }>(db, `SELECT review_notified_at FROM tournaments WHERE id = 'lca-1'`)
    expect(storedTimestampSchema.safeParse(mark).success, mark).toBe(true)
    // Writing the mark sets off no sync: the sections, the round times and the entries are as they were.
    expect(synced()).toEqual(unmarked)
    db.exec(`UPDATE tournaments SET review_notified_at = NULL WHERE id = 'lca-1'`)
  })

  it('keeps a ticket when the event it is about is deleted: about_id has no foreign key, so nothing cascades to it', () => {
    db.exec(`INSERT INTO tournaments (id, name, location, date, sections) VALUES ('gone-1', 'Cancelled Quads', 'Houma, LA', '2027-02-06', '[{"name":"Quads","entryFee":0}]')`)
    db.exec(`INSERT INTO support_tickets (id, number, name, email, subject, kind, about_id) VALUES ('t-about', 1010, 'Lee Visitor', 'lee.visitor@example.org', 'This event looks wrong', 'event_report', 'gone-1')`)
    db.exec(`DELETE FROM tournaments WHERE id = 'gone-1'`)
    expect(one(db, `SELECT kind, about_id FROM support_tickets WHERE id = 't-about'`)).toEqual({ kind: 'event_report', about_id: 'gone-1' })
    expect(all(db, `SELECT id FROM tournament_sections WHERE tournament_id = 'gone-1'`)).toEqual([])
    db.exec(`DELETE FROM support_tickets WHERE id = 't-about'`)
  })

  it('stops at its first statement when run a second time, with the database as it was, so it is run once, as wrangler runs every migration', () => {
    const state = { rows: contents(db), schema: schemaRows(db) }
    let failure: unknown
    try {
      applyMigrations(db, [FILE])
    } catch (err) {
      failure = err
    }
    expect(failure).toBeInstanceOf(Error)
    expect((failure as Error).message).toContain(`Migration ${FILE} failed on statement:\nALTER TABLE \`support_tickets\` ADD \`kind\` text`)
    expect(((failure as Error).cause as Error).message).toMatch(/duplicate column name: kind/)
    expect({ rows: contents(db), schema: schemaRows(db) }).toEqual(state)
  })
})

// ── drizzle/meta ─────────────────────────────────────────────────────

const META = join(__dirname, '../../drizzle/meta')
interface Snapshot {
  id: string
  prevId: string
  version: string
  dialect: string
  tables: Record<string, Record<string, unknown> & { columns: Record<string, Record<string, unknown>> }>
  [key: string]: unknown
}
const snapshot = (n: number) => JSON.parse(readFileSync(join(META, `${String(n).padStart(4, '0')}_snapshot.json`), 'utf8')) as Snapshot
const journal = JSON.parse(readFileSync(join(META, '_journal.json'), 'utf8')) as {
  entries: Array<{ idx: number; version: string; when: number; tag: string; breakpoints: boolean }>
}

describe('drizzle/meta records 0059', () => {
  it('gives the journal a ninth entry, 0008_ticket_kinds, written after 0007\'s, in the form of the others', () => {
    expect(journal.entries.map((e) => e.idx)).toEqual(journal.entries.map((_, i) => i))
    const entry = journal.entries[8]
    expect(entry).toEqual({ idx: 8, version: '6', when: expect.any(Number), tag: '0008_ticket_kinds', breakpoints: true })
    expect(entry.when).toBeGreaterThan(journal.entries[7].when)
    // The generator ran on Tuesday, November 3, 2026, in UTC, or later.
    expect(entry.when).toBeGreaterThanOrEqual(Date.UTC(2026, 10, 3))
    // The migration's header names the staged file the journal's tag names.
    expect(readFileSync(join(MIGRATIONS_DIR, FILE), 'utf8')).toContain(`-- staged as drizzle/${entry.tag}.sql.`)
  })

  it('makes 0008_snapshot.json follow 0007\'s, and no other snapshot follow 0007\'s', () => {
    const files = readdirSync(META).filter((f) => f.endsWith('_snapshot.json')).sort()
    expect(files.slice(0, 9)).toEqual(Array.from({ length: 9 }, (_, i) => `${String(i).padStart(4, '0')}_snapshot.json`))
    const snapshots = files.map((_, i) => snapshot(i))
    expect(new Set(snapshots.map((s) => s.id)).size).toBe(snapshots.length)
    expect(snapshot(8).prevId).toBe(snapshot(7).id)
    expect(snapshots.filter((s) => s.prevId === snapshot(7).id).map((s) => s.id)).toEqual([snapshot(8).id])
    expect([snapshot(8).version, snapshot(8).dialect]).toEqual([snapshot(7).version, snapshot(7).dialect])
  })

  it('differs from 0007\'s by the three columns alone, each text and nullable with no default, at the end of its table', () => {
    const was = snapshot(7)
    const now = snapshot(8)
    const rest = (s: Snapshot) => {
      const copy = structuredClone(s) as Partial<Snapshot>
      delete copy.id
      delete copy.prevId
      for (const [table, columns] of Object.entries(NEW_COLUMNS)) {
        for (const column of columns) delete copy.tables![table].columns[column]
      }
      return copy
    }
    expect(rest(now)).toEqual(rest(was))
    for (const [table, columns] of Object.entries(NEW_COLUMNS)) {
      expect(Object.keys(now.tables[table].columns), table).toEqual([...Object.keys(was.tables[table].columns), ...columns])
      for (const column of columns) {
        expect(now.tables[table].columns[column], `${table}.${column}`).toEqual({ name: column, type: 'text', primaryKey: false, notNull: false, autoincrement: false })
      }
    }
  })
})
