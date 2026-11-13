// test/unit/migration-0061-newsletter-issues.test.ts
//
// Migration 0061 (WS16 part two, page step 3) on a real SQLite database with
// foreign keys on, as on D1, and its record in drizzle/meta:
// - migrations 0001 to 0060 run first, then rows in the tables 0061 names or
//   could reach (members, among them an LCA admin, a member and a child
//   account, a campaign on the newsletter list and one of Group email with
//   its recipients, a choice on a list), then 0061;
// - it adds one table, newsletter_issues, with the twenty columns
//   functions/db/schema.ts gives it and no mark of a test, its three member
//   columns emptied when that account goes, and one index, the partial
//   unique index that holds one open letter for a list;
// - it rebuilds nothing and changes no other table: every row keeps its
//   values and its rowid, and every other table's, index's and trigger's
//   definition is as it was; it holds no CHECK and no data statement;
// - run a second time it stops at its first statement and changes nothing,
//   so it runs once, as wrangler runs every migration;
// - drizzle/meta: the journal's eleventh entry and 0010_snapshot.json, which
//   follows 0009's and differs from it by the one table alone.
// Every name and address here is made up.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import { beforeAll, describe, expect, it } from 'vitest'
import { splitSql } from '../shared/splitSql'
import { applyMigrations, foreignKeysOn, migrationFiles, MIGRATIONS_DIR, openMigratedDb, userTables } from './helpers/sqlite'

const FILE = '0061_newsletter_issues.sql'
const BEFORE = migrationFiles().filter((f) => f < '0061')
const TABLE = 'newsletter_issues'
const COLUMNS = [
  'id', 'list_id', 'month_label', 'subject', 'preheader', 'body_html', 'version', 'created_by', 'created_at', 'updated_by', 'updated_at',
  'campaign_id', 'set_aside_at', 'send_at', 'scheduled_by', 'scheduled_at', 'link_check', 'held_reason', 'pinned_at', 'pinned_name',
]

type Row = Record<string, unknown>
const all = <T = Row>(db: DatabaseSync, sql: string, ...args: Array<string | number | null>) => db.prepare(sql).all(...args) as unknown as T[]
const one = <T = Row>(db: DatabaseSync, sql: string, ...args: Array<string | number | null>) => db.prepare(sql).get(...args) as unknown as T

/** Rows in the tables 0061 names or could reach, as the deployed code writes them before 0061. */
function insertRows(db: DatabaseSync): void {
  const member = db.prepare('INSERT INTO members (id, email, full_name, role, guardian_id) VALUES (?, ?, ?, ?, ?)')
  member.run('m-admin', 'admin.one@example.org', 'Player One', 'lca_admin', null)
  member.run('m-writer', 'writer.two@example.org', 'Player Two', 'lca_observer', null)
  member.run('m-child', 'child.three@example.org', 'Player Three', 'member', 'm-writer')
  const campaign = db.prepare(
    `INSERT INTO email_campaigns (id, subject, body_html, filter_json, total_recipients, sent_count, status, created_by, list_id, completed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
  campaign.run('c-newsletter', 'Sample newsletter one', '<p>Sample words.</p>', '{"list":"lca-newsletter"}', 2, 2, 'completed', 'm-admin', 'lca-newsletter', '2026-11-02 15:00:00')
  campaign.run('c-group', 'Sample group email', '<p>Sample words.</p>', '{"all":true}', 1, 0, 'sending', 'm-admin', null, null)
  db.exec(`INSERT INTO email_campaign_recipients (id, campaign_id, member_id, email, status) VALUES ('r-one', 'c-newsletter', NULL, 'reader.one@example.org', 'sent'), ('r-two', 'c-group', 'm-child', 'child.three@example.org', 'pending')`)
  db.exec(`INSERT INTO mail_contacts (id, address) VALUES ('${'a'.repeat(32)}', 'reader.one@example.org')`)
  db.exec(`INSERT INTO mail_list_choices (contact_id, list_id, choice, source) VALUES ('${'a'.repeat(32)}', 'lca-newsletter', 'in', 'link')`)
}

/** Every row of every table, with its rowid, in rowid order. */
const contents = (db: DatabaseSync, tables = userTables(db)) =>
  Object.fromEntries(tables.map((t) => [t, all(db, `SELECT rowid AS _rowid, * FROM "${t}" ORDER BY rowid`)]))

/** Everything sqlite_master records, keyed by type and name. */
const schemaRows = (db: DatabaseSync) =>
  Object.fromEntries(all<{ type: string; name: string; tbl_name: string; sql: string | null }>(db, 'SELECT type, name, tbl_name, sql FROM sqlite_master ORDER BY type, name')
    .map((r) => [`${r.type} ${r.name}`, r]))

const columnsOf = (db: DatabaseSync, table: string) =>
  all<{ name: string; type: string; notnull: number; dflt_value: string | null; pk: number }>(db, `SELECT name, type, "notnull", dflt_value, pk FROM pragma_table_info('${table}')`)

const throws = (db: DatabaseSync, sql: string) => {
  try {
    db.exec(sql)
  } catch (err) {
    return (err as Error).message
  }
  return null
}

describe('0061_newsletter_issues.sql on a database that holds rows', () => {
  let db: DatabaseSync
  let before: ReturnType<typeof contents>
  let after: ReturnType<typeof contents>
  let schemaBefore: ReturnType<typeof schemaRows>
  let schemaAfter: ReturnType<typeof schemaRows>

  beforeAll(() => {
    db = openMigratedDb({ files: BEFORE })
    insertRows(db)
    before = contents(db)
    schemaBefore = schemaRows(db)
    applyMigrations(db, [FILE])
    after = contents(db)
    schemaAfter = schemaRows(db)
  })

  it('runs straight after 0060, with foreign keys on and every reference still whole', () => {
    expect(BEFORE.at(-1)).toBe('0060_mail_lists.sql')
    expect(migrationFiles()[BEFORE.length]).toBe(FILE)
    expect(foreignKeysOn(db)).toBe(1)
    expect(all(db, 'PRAGMA foreign_key_check')).toEqual([])
  })

  it('holds two statements, the table and its index, and no CHECK, no data statement and no rebuild', () => {
    const statements = splitSql(readFileSync(join(MIGRATIONS_DIR, FILE), 'utf8'))
    expect(statements).toHaveLength(2)
    expect(statements[0]).toMatch(/^CREATE TABLE `newsletter_issues` \(/)
    expect(statements[1]).toMatch(/^CREATE UNIQUE INDEX `newsletter_issues_one_open` ON `newsletter_issues` \(`list_id`\) WHERE campaign_id IS NULL AND set_aside_at IS NULL;?$/)
    // Both statements create, so neither writes a row; and neither checks a value, drops, alters or rebuilds.
    for (const statement of statements) expect(statement).toMatch(/^CREATE (?:UNIQUE INDEX|TABLE) /)
    const text = statements.join('\n')
    for (const word of [/\bCHECK\s*\(/i, /\bDROP\b/i, /\bALTER\b/i, /__new_/i, /\bPRAGMA\b/i]) expect(text, String(word)).not.toMatch(word)
  })

  it('adds the one table, each column as the schema gives it, and none of them a mark of a test', () => {
    expect(userTables(db).filter((t) => !Object.keys(before).includes(t))).toEqual([TABLE])
    const col = (name: string, type: string, notnull: number, dflt_value: string | null, pk = 0) => ({ name, type, notnull, dflt_value, pk })
    // SQLite reports the default (datetime('now')) without its outer brackets.
    const now = "datetime('now')"
    expect(columnsOf(db, TABLE)).toEqual([
      col('id', 'TEXT', 1, null, 1), col('list_id', 'TEXT', 1, null), col('month_label', 'TEXT', 1, "''"), col('subject', 'TEXT', 1, "''"),
      col('preheader', 'TEXT', 1, "''"), col('body_html', 'TEXT', 1, "''"), col('version', 'INTEGER', 1, '1'), col('created_by', 'TEXT', 0, null),
      col('created_at', 'TEXT', 1, now), col('updated_by', 'TEXT', 0, null), col('updated_at', 'TEXT', 1, now), col('campaign_id', 'TEXT', 0, null),
      col('set_aside_at', 'TEXT', 0, null), col('send_at', 'TEXT', 0, null), col('scheduled_by', 'TEXT', 0, null), col('scheduled_at', 'TEXT', 0, null),
      col('link_check', 'TEXT', 0, null), col('held_reason', 'TEXT', 0, null), col('pinned_at', 'TEXT', 0, null), col('pinned_name', 'TEXT', 0, null),
    ])
    expect(columnsOf(db, TABLE).map((c) => c.name)).toEqual(COLUMNS)
    expect(COLUMNS.filter((c) => /test/i.test(c))).toEqual([])
  })

  it('gives its three member columns a foreign key that empties them when the account goes, and the list and the send none', () => {
    const fks = all<{ table: string; from: string; to: string; on_delete: string; on_update: string }>(db, `SELECT "table", "from", "to", on_delete, on_update FROM pragma_foreign_key_list('${TABLE}') ORDER BY "from"`)
    expect(fks).toEqual(['created_by', 'scheduled_by', 'updated_by'].map((from) => ({ table: 'members', from, to: 'id', on_delete: 'SET NULL', on_update: 'NO ACTION' })))
  })

  it('adds the one index, partial and unique on the list, beside the primary key\'s own', () => {
    const added = Object.keys(schemaAfter).filter((key) => !(key in schemaBefore))
    expect(added.sort()).toEqual(['index newsletter_issues_one_open', 'index sqlite_autoindex_newsletter_issues_1', `table ${TABLE}`])
    expect(schemaAfter['index newsletter_issues_one_open'].sql).toBe('CREATE UNIQUE INDEX `newsletter_issues_one_open` ON `newsletter_issues` (`list_id`) WHERE campaign_id IS NULL AND set_aside_at IS NULL')
  })

  it('rebuilds nothing and changes no other table: every definition, index and trigger is as it was, and every row keeps its values and its rowid', () => {
    for (const [key, row] of Object.entries(schemaBefore)) expect(schemaAfter[key], key).toEqual(row)
    expect(Object.keys(after).filter((t) => t !== TABLE)).toEqual(Object.keys(before))
    for (const table of Object.keys(before)) expect(after[table], table).toEqual(before[table])
    expect(after[TABLE]).toEqual([])
  })
})

describe('0061\'s table and its rules', () => {
  let db: DatabaseSync
  beforeAll(() => {
    db = openMigratedDb({ files: BEFORE })
    insertRows(db)
    applyMigrations(db, [FILE])
  })

  const letter = (on: DatabaseSync) => on.prepare('INSERT INTO newsletter_issues (id, list_id, created_by, updated_by, campaign_id, set_aside_at) VALUES (?, ?, ?, ?, ?, ?)')

  it('gives a letter its defaults: version 1, empty words, and the database\'s times', () => {
    db.exec(`INSERT INTO newsletter_issues (id, list_id) VALUES ('i-defaults', 'lca-newsletter')`)
    const row = one<Row>(db, `SELECT * FROM newsletter_issues WHERE id = 'i-defaults'`)
    expect(row).toMatchObject({ month_label: '', subject: '', preheader: '', body_html: '', version: 1, created_by: null, updated_by: null, campaign_id: null, set_aside_at: null })
    expect(row.created_at).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
    expect(row.updated_at).toBe(row.created_at)
    db.exec('DELETE FROM newsletter_issues')
  })

  it('holds one open letter for a list, and any number sent or set aside, on that list or another', () => {
    const insert = letter(db)
    insert.run('i-open', 'lca-newsletter', 'm-admin', 'm-admin', null, null)
    expect(throws(db, `INSERT INTO newsletter_issues (id, list_id) VALUES ('i-second', 'lca-newsletter')`)).toMatch(/UNIQUE constraint failed: newsletter_issues\.list_id/)
    insert.run('i-aside', 'lca-newsletter', 'm-admin', 'm-admin', null, '2026-11-03 15:00:00')
    insert.run('i-aside-two', 'lca-newsletter', 'm-admin', 'm-admin', null, '2026-11-04 15:00:00')
    insert.run('i-sent', 'lca-newsletter', 'm-writer', 'm-writer', 'c-newsletter', null)
    insert.run('i-other', 'lca-tournaments', 'm-writer', 'm-writer', null, null)
    // Setting the open letter aside frees its place, as a start does before it adds the new one.
    db.exec(`UPDATE newsletter_issues SET set_aside_at = datetime('now') WHERE id = 'i-open'`)
    insert.run('i-new', 'lca-newsletter', 'm-admin', 'm-admin', null, null)
    expect(all(db, `SELECT id FROM newsletter_issues WHERE list_id = 'lca-newsletter' AND campaign_id IS NULL AND set_aside_at IS NULL`)).toEqual([{ id: 'i-new' }])
    db.exec('DELETE FROM newsletter_issues')
  })

  it('holds no CHECK: a later step writes its own values without a rebuild', () => {
    expect(one<{ sql: string }>(db, `SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?`, TABLE).sql).not.toMatch(/\bCHECK\s*\(/i)
    db.exec(`INSERT INTO newsletter_issues (id, list_id, held_reason, link_check, pinned_name) VALUES ('i-later', 'lca-newsletter', 'Sample reason', 'abcdef0123456789', 'Sample template')`)
    db.exec('DELETE FROM newsletter_issues')
  })

  it('lets an account go with a letter that names it: the letter stays, its words whole, with no name where the person was', () => {
    db.exec(`INSERT INTO members (id, email, full_name, role) VALUES ('m-leaving', 'leaving.four@example.org', 'Player Four', 'lca_admin')`)
    db.exec(`INSERT INTO newsletter_issues (id, list_id, body_html, created_by, updated_by, scheduled_by) VALUES ('i-theirs', 'lca-newsletter', '<p>Sample words.</p>', 'm-leaving', 'm-leaving', 'm-leaving')`)
    expect(throws(db, `INSERT INTO newsletter_issues (id, list_id, set_aside_at, created_by) VALUES ('i-nobody', 'lca-newsletter', '2026-11-05 15:00:00', 'm-nobody')`)).toMatch(/FOREIGN KEY constraint failed/)
    db.exec(`DELETE FROM members WHERE id = 'm-leaving'`)
    expect(one(db, `SELECT body_html, created_by, updated_by, scheduled_by FROM newsletter_issues WHERE id = 'i-theirs'`)).toEqual({ body_html: '<p>Sample words.</p>', created_by: null, updated_by: null, scheduled_by: null })
    expect(all(db, 'PRAGMA foreign_key_check')).toEqual([])
    db.exec('DELETE FROM newsletter_issues')
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
    expect((failure as Error).message).toContain(`Migration ${FILE} failed on statement:\nCREATE TABLE \`newsletter_issues\``)
    expect(((failure as Error).cause as Error).message).toMatch(/table `newsletter_issues` already exists/)
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

describe('drizzle/meta records 0061', () => {
  it('gives the journal an eleventh entry, 0010_newsletter_issues, written after 0009\'s, in the form of the others', () => {
    expect(journal.entries.map((e) => e.idx)).toEqual(journal.entries.map((_, i) => i))
    const entry = journal.entries[10]
    expect(entry).toEqual({ idx: 10, version: '6', when: expect.any(Number), tag: '0010_newsletter_issues', breakpoints: true })
    expect(entry.when).toBeGreaterThan(journal.entries[9].when)
    // The generator ran on Friday, November 13, 2026, in UTC, or later.
    expect(entry.when).toBeGreaterThanOrEqual(Date.UTC(2026, 10, 13))
    // The migration's header names the staged file the journal's tag names, and says it was written by the generator.
    const text = readFileSync(join(MIGRATIONS_DIR, FILE), 'utf8')
    expect(text).toContain(`-- staged as drizzle/${entry.tag}.sql.`)
    expect(text.split('\n')[0]).toBe(`-- ${FILE}`)
    expect(text).toContain('Written by drizzle-kit from functions/db/schema.ts (npm run db:generate)')
  })

  it('makes 0010_snapshot.json follow 0009\'s, and no other snapshot follow 0009\'s', () => {
    const files = readdirSync(META).filter((f) => f.endsWith('_snapshot.json')).sort()
    expect(files.slice(0, 11)).toEqual(Array.from({ length: 11 }, (_, i) => `${String(i).padStart(4, '0')}_snapshot.json`))
    const snapshots = files.map((_, i) => snapshot(i))
    expect(new Set(snapshots.map((s) => s.id)).size).toBe(snapshots.length)
    expect(snapshot(10).prevId).toBe(snapshot(9).id)
    expect(snapshots.filter((s) => s.prevId === snapshot(9).id).map((s) => s.id)).toEqual([snapshot(10).id])
    expect([snapshot(10).version, snapshot(10).dialect]).toEqual([snapshot(9).version, snapshot(9).dialect])
  })

  it('differs from 0009\'s by the one table alone, its columns, keys and index as the migration writes them', () => {
    const was = snapshot(9)
    const now = snapshot(10)
    const rest = (s: Snapshot) => {
      const copy = structuredClone(s) as Partial<Snapshot>
      delete copy.id
      delete copy.prevId
      delete copy.tables![TABLE]
      return copy
    }
    expect(rest(now)).toEqual(rest(was))
    expect(TABLE in was.tables).toBe(false)
    expect(Object.keys(now.tables).filter((t) => !(t in was.tables))).toEqual([TABLE])
    expect(Object.keys(now.tables[TABLE].columns)).toEqual(COLUMNS)
    const indexes = now.tables[TABLE].indexes as Record<string, { columns: string[]; isUnique: boolean; where?: string }>
    expect(Object.keys(indexes)).toEqual(['newsletter_issues_one_open'])
    expect(indexes.newsletter_issues_one_open).toMatchObject({ columns: ['list_id'], isUnique: true, where: 'campaign_id IS NULL AND set_aside_at IS NULL' })
    const keys = Object.values(now.tables[TABLE].foreignKeys as Record<string, { columnsFrom: string[]; tableTo: string; onDelete: string }>)
    expect(keys.map((k) => [k.columnsFrom, k.tableTo, k.onDelete]).sort()).toEqual([[['created_by'], 'members', 'set null'], [['scheduled_by'], 'members', 'set null'], [['updated_by'], 'members', 'set null']])
  })
})
