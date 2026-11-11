// test/unit/migration-0060-mail-lists.test.ts
//
// Migration 0060 (WS16 step 2) on a real SQLite database with foreign keys
// on, as on D1, and its record in drizzle/meta:
// - migrations 0001 to 0059 run first, then rows of every kind the two
//   campaign tables hold (a campaign sending, one completed and one failed,
//   by an LCA admin; recipients pending with a live claim, pending with an
//   error after a try, sent and failed, a member's and a typed-in address),
//   then 0060;
// - the four mail tables are created with the columns, keys and indexes
//   functions/db/schema.ts gives them, and the four columns go on the end
//   of the two campaign tables, reading NULL, or 0 for skipped_count, on
//   every row already there;
// - no table is rebuilt and no row of today's changes: every row keeps its
//   values and its rowid, every index and trigger is as it was, and no
//   other table's definition moves, so the code already deployed reads the
//   database as before when the merge migrates production; the campaign
//   tables' status CHECKs of 0021 and 0038 stay;
// - the two list rows are written once, each one of LCA's main mailers,
//   and the data statement run again changes nothing;
// - no CHECK holds the mail tables' values, a choice goes with its contact
//   or its list, a club with a list cannot be deleted from under it, and
//   two contacts never share an address;
// - run a second time the migration stops at its first statement and
//   changes nothing, so it runs once, as wrangler runs every migration;
// - drizzle/meta: the journal's tenth entry and 0009_snapshot.json, which
//   follows 0008's and differs from it by the four tables and the four
//   columns alone.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import { beforeAll, describe, expect, it } from 'vitest'
import { splitSql } from '../shared/splitSql'
import { applyMigrations, foreignKeysOn, migrationFiles, MIGRATIONS_DIR, openMigratedDb, userTables } from './helpers/sqlite'

const FILE = '0060_mail_lists.sql'
const BEFORE = migrationFiles().filter((f) => f < '0060')
const NEW_TABLES = ['mail_contacts', 'mail_do_not_send', 'mail_list_choices', 'mail_lists']
const NEW_COLUMNS: Record<string, string[]> = {
  email_campaigns: ['list_id', 'skipped_count'],
  email_campaign_recipients: ['contact_id', 'sending_at'],
}

type Row = Record<string, unknown>
const all = <T = Row>(db: DatabaseSync, sql: string, ...args: Array<string | number | null>) =>
  db.prepare(sql).all(...args) as unknown as T[]
const one = <T = Row>(db: DatabaseSync, sql: string, ...args: Array<string | number | null>) =>
  db.prepare(sql).get(...args) as unknown as T

/** The rows each kind of campaign leaves, as the deployed code writes them before 0060. */
function insertRows(db: DatabaseSync): void {
  db.exec(`INSERT INTO clubs (id, name, city) VALUES ('club-a', 'Acadiana Knights', 'Lafayette')`)
  const member = db.prepare('INSERT INTO members (id, email, full_name, role, club_id) VALUES (?, ?, ?, ?, ?)')
  member.run('m-admin', 'avery.admin@example.org', 'Avery Admin', 'lca_admin', null)
  member.run('m-pat', 'pat.player@example.org', 'Pat Player', 'member', 'club-a')
  member.run('m-kim', 'kim.parent@example.org', 'Kim Parent', 'member', null)
  const campaign = db.prepare(
    `INSERT INTO email_campaigns (id, subject, body_html, filter_json, total_recipients, sent_count, failed_count, status, created_by, completed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
  campaign.run('c-sending', 'Fall news', '<p>Hi</p>', '{"all":true}', 4, 1, 1, 'sending', 'm-admin', null)
  campaign.run('c-done', 'Summer news', '<p>Hello</p>', '{"clubIds":["club-a"]}', 1, 1, 0, 'completed', 'm-admin', '2026-08-01 17:00:00')
  campaign.run('c-failed', 'Spring news', '<p>Hey</p>', '{}', 1, 0, 1, 'failed', null, '2026-04-01 17:00:00')
  const recipient = db.prepare(
    `INSERT INTO email_campaign_recipients (id, campaign_id, member_id, email, status, error, sent_at, claimed_at, attempts)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
  recipient.run('r-claimed', 'c-sending', 'm-pat', 'pat.player@example.org', 'pending', null, null, '2026-11-10 17:00:00', 1)
  recipient.run('r-retry', 'c-sending', 'm-kim', 'kim.parent@example.org', 'pending', 'Resend 503: upstream unavailable', null, null, 1)
  recipient.run('r-sent', 'c-sending', 'm-admin', 'avery.admin@example.org', 'sent', null, '2026-11-10 17:00:05', '2026-11-10 17:00:00', 1)
  recipient.run('r-typed', 'c-sending', null, 'lee.visitor@example.org', 'failed', 'Resend 422: Invalid `to` field.', null, '2026-11-10 17:00:00', 1)
  recipient.run('r-done', 'c-done', 'm-pat', 'pat.player@example.org', 'sent', null, '2026-08-01 16:59:00', '2026-08-01 16:58:00', 1)
  recipient.run('r-gone', 'c-failed', 'm-kim', 'kim.parent@example.org', 'failed', 'Resend 422: rejected', null, '2026-04-01 16:58:00', 3)
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

/** A row without the columns 0060 adds. */
const withoutNew = (table: string, row: Row) => {
  const rest = { ...row }
  for (const column of NEW_COLUMNS[table] ?? []) delete rest[column]
  return rest
}

const throws = (db: DatabaseSync, sql: string) => {
  try {
    db.exec(sql)
  } catch (err) {
    return (err as Error).message
  }
  return null
}

describe('0060_mail_lists.sql on a database that holds rows', () => {
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

  it('runs straight after 0059, with foreign keys on and every reference still whole', () => {
    expect(BEFORE.at(-1)).toBe('0059_ticket_kinds.sql')
    expect(migrationFiles()[BEFORE.length]).toBe(FILE)
    expect(foreignKeysOn(db)).toBe(1)
    expect(all(db, 'PRAGMA foreign_key_check')).toEqual([])
  })

  it('creates the four mail tables, each column as the schema gives it', () => {
    expect(userTables(db).filter((t) => !Object.keys(before).includes(t))).toEqual(NEW_TABLES)
    const col = (name: string, type: string, notnull: number, dflt_value: string | null, pk: number) => ({ name, type, notnull, dflt_value, pk })
    // SQLite reports the default (datetime('now')) without its outer brackets.
    const now = "datetime('now')"
    expect(columnsOf(db, 'mail_lists')).toEqual([
      col('id', 'TEXT', 1, null, 1), col('kind', 'TEXT', 1, null, 0), col('name', 'TEXT', 1, null, 0),
      col('main_mailer', 'INTEGER', 1, '0', 0), col('club_id', 'TEXT', 0, null, 0), col('created_at', 'TEXT', 1, now, 0),
    ])
    expect(columnsOf(db, 'mail_contacts')).toEqual([
      col('id', 'TEXT', 1, null, 1), col('address', 'TEXT', 1, null, 0), col('optional_off_at', 'TEXT', 0, null, 0),
      col('complained_at', 'TEXT', 0, null, 0), col('created_at', 'TEXT', 1, now, 0),
    ])
    expect(columnsOf(db, 'mail_list_choices')).toEqual([
      col('contact_id', 'TEXT', 1, null, 1), col('list_id', 'TEXT', 1, null, 2), col('choice', 'TEXT', 1, null, 0),
      col('source', 'TEXT', 1, null, 0), col('updated_at', 'TEXT', 1, now, 0),
    ])
    expect(columnsOf(db, 'mail_do_not_send')).toEqual([
      col('address', 'TEXT', 1, null, 1), col('reason', 'TEXT', 1, null, 0), col('detail', 'TEXT', 0, null, 0), col('created_at', 'TEXT', 1, now, 0),
    ])
    // Twenty columns in the four tables, and four on the campaign tables: 24 in all.
    expect(NEW_TABLES.reduce((n, t) => n + columnsOf(db, t).length, 0)).toBe(20)
  })

  it('gives the mail tables their foreign keys and indexes: choices cascade from a contact and a list, a list\'s club has no action', () => {
    const fks = (table: string) => all<{ table: string; from: string; to: string; on_delete: string }>(db, `SELECT "table", "from", "to", on_delete FROM pragma_foreign_key_list('${table}') ORDER BY "from"`)
    expect(fks('mail_lists')).toEqual([{ table: 'clubs', from: 'club_id', to: 'id', on_delete: 'NO ACTION' }])
    expect(fks('mail_list_choices')).toEqual([
      { table: 'mail_contacts', from: 'contact_id', to: 'id', on_delete: 'CASCADE' },
      { table: 'mail_lists', from: 'list_id', to: 'id', on_delete: 'CASCADE' },
    ])
    expect(fks('mail_contacts')).toEqual([])
    expect(fks('mail_do_not_send')).toEqual([])
    const indexes = Object.values(schemaAfter).filter((r) => r.type === 'index' && NEW_TABLES.includes(r.tbl_name) && r.sql !== null).map((r) => r.sql)
    expect(indexes.sort()).toEqual([
      'CREATE INDEX `mail_list_choices_list` ON `mail_list_choices` (`list_id`,`choice`)',
      'CREATE UNIQUE INDEX `mail_contacts_address_unique` ON `mail_contacts` (`address`)',
    ])
  })

  it('puts the four columns on the end of the two campaign tables, with no part in the key', () => {
    expect(columnsOf(db, 'email_campaigns').slice(0, columnsBefore.email_campaigns.length)).toEqual(columnsBefore.email_campaigns)
    expect(columnsOf(db, 'email_campaigns').slice(columnsBefore.email_campaigns.length)).toEqual([
      { name: 'list_id', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 },
      { name: 'skipped_count', type: 'INTEGER', notnull: 1, dflt_value: '0', pk: 0 },
    ])
    expect(columnsOf(db, 'email_campaign_recipients').slice(0, columnsBefore.email_campaign_recipients.length)).toEqual(columnsBefore.email_campaign_recipients)
    expect(columnsOf(db, 'email_campaign_recipients').slice(columnsBefore.email_campaign_recipients.length)).toEqual([
      { name: 'contact_id', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 },
      { name: 'sending_at', type: 'TEXT', notnull: 0, dflt_value: null, pk: 0 },
    ])
    // The campaign columns carry no REFERENCES, so neither table was rebuilt to add one.
    expect(all(db, `SELECT "from" FROM pragma_foreign_key_list('email_campaigns')`)).toEqual([{ from: 'created_by' }])
  })

  it('changes no row: every row of every table already there keeps its values and its rowid, and the new columns read NULL or 0', () => {
    expect(Object.keys(after).filter((t) => !NEW_TABLES.includes(t))).toEqual(Object.keys(before))
    for (const table of Object.keys(before)) {
      expect(after[table].map((row) => withoutNew(table, row)), table).toEqual(before[table])
    }
    expect(after.email_campaigns.map((c) => [c.id, c.list_id, c.skipped_count])).toEqual([
      ['c-sending', null, 0], ['c-done', null, 0], ['c-failed', null, 0],
    ])
    expect(after.email_campaign_recipients.map((r) => [r.id, r.contact_id, r.sending_at])).toEqual(
      ['r-claimed', 'r-retry', 'r-sent', 'r-typed', 'r-done', 'r-gone'].map((id) => [id, null, null]),
    )
  })

  it('rebuilds no table: every index and trigger is as it was, and only the two campaign tables\' definitions gain the four columns', () => {
    const added = Object.keys(schemaAfter).filter((key) => !(key in schemaBefore))
    expect(added.sort()).toEqual([
      'index mail_contacts_address_unique', 'index mail_list_choices_list',
      'index sqlite_autoindex_mail_contacts_1', 'index sqlite_autoindex_mail_do_not_send_1', 'index sqlite_autoindex_mail_list_choices_1', 'index sqlite_autoindex_mail_lists_1',
      'table mail_contacts', 'table mail_do_not_send', 'table mail_list_choices', 'table mail_lists',
    ])
    // SQLite writes an added column after the table's last column, ahead of its constraints, so taking the added text
    // back out of the definition must give the definition as it was.
    const definitions: Record<string, string> = {
      'table email_campaigns': ', `list_id` text, `skipped_count` integer DEFAULT 0 NOT NULL',
      'table email_campaign_recipients': ', `contact_id` text, `sending_at` text',
    }
    for (const [key, row] of Object.entries(schemaBefore)) {
      if (!definitions[key]) {
        expect(schemaAfter[key], key).toEqual(row)
        continue
      }
      const sql = schemaAfter[key].sql!
      expect(sql.split(definitions[key]), key).toHaveLength(2)
      expect(sql.replace(definitions[key], ''), key).toBe(row.sql)
    }
  })

  it('keeps the status CHECKs of 0021 and 0038, so every state the mail engine writes is one of today\'s', () => {
    expect(throws(db, `UPDATE email_campaigns SET status = 'queued' WHERE id = 'c-done'`)).toMatch(/CHECK constraint failed/)
    expect(throws(db, `UPDATE email_campaign_recipients SET status = 'sending' WHERE id = 'r-sent'`)).toMatch(/CHECK constraint failed/)
    expect(one(db, `SELECT status FROM email_campaigns WHERE id = 'c-done'`)).toEqual({ status: 'completed' })
  })

  it('takes what the code deployed before it writes, columns named as today, and gives the new columns their defaults', () => {
    db.exec(`INSERT INTO email_campaigns (id, subject, body_html, filter_json, total_recipients) VALUES ('c-later', 'Winter news', '<p>Brr</p>', '{}', 1)`)
    db.exec(`INSERT INTO email_campaign_recipients (id, campaign_id, member_id, email) VALUES ('r-later', 'c-later', 'm-pat', 'pat.player@example.org')`)
    expect(one(db, `SELECT status, list_id, skipped_count FROM email_campaigns WHERE id = 'c-later'`)).toEqual({ status: 'sending', list_id: null, skipped_count: 0 })
    expect(one(db, `SELECT status, attempts, contact_id, sending_at FROM email_campaign_recipients WHERE id = 'r-later'`)).toEqual({ status: 'pending', attempts: 0, contact_id: null, sending_at: null })
    // A whole-row read, as the handlers make, gains exactly the two keys on each table, at the end.
    expect(Object.keys(one(db, `SELECT * FROM email_campaigns WHERE id = 'c-later'`)).slice(-2)).toEqual(NEW_COLUMNS.email_campaigns)
    expect(Object.keys(one(db, `SELECT * FROM email_campaign_recipients WHERE id = 'r-later'`)).slice(-2)).toEqual(NEW_COLUMNS.email_campaign_recipients)
    db.exec(`DELETE FROM email_campaign_recipients WHERE id = 'r-later'`)
    db.exec(`DELETE FROM email_campaigns WHERE id = 'c-later'`)
  })
})

describe('0060\'s two list rows and the mail tables\' rules', () => {
  let db: DatabaseSync
  beforeAll(() => {
    db = openMigratedDb({ files: BEFORE })
    insertRows(db)
    applyMigrations(db, [FILE])
  })

  it('writes the two lists once, each one of LCA\'s main mailers, with no club', () => {
    expect(all(db, 'SELECT id, kind, name, main_mailer, club_id FROM mail_lists ORDER BY rowid')).toEqual([
      { id: 'lca-newsletter', kind: 'newsletter', name: 'LCA newsletter', main_mailer: 1, club_id: null },
      { id: 'lca-tournaments', kind: 'tournaments', name: 'LCA tournament email', main_mailer: 1, club_id: null },
    ])
    const { created_at: made } = one<{ created_at: string }>(db, `SELECT created_at FROM mail_lists WHERE id = 'lca-newsletter'`)
    expect(made).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
    for (const table of ['mail_contacts', 'mail_list_choices', 'mail_do_not_send']) expect(all(db, `SELECT * FROM ${table}`), table).toEqual([])
  })

  it('writes nothing more when its data statement runs again, even after a list\'s name was changed', () => {
    const statements = splitSql(readFileSync(join(MIGRATIONS_DIR, FILE), 'utf8'))
    const insert = statements.at(-1) as string
    expect(insert).toMatch(/^INSERT OR IGNORE INTO `mail_lists`/)
    db.exec(`UPDATE mail_lists SET name = 'A later name' WHERE id = 'lca-tournaments'`)
    const state = contents(db, ['mail_lists'])
    db.exec(insert)
    db.exec(insert)
    expect(contents(db, ['mail_lists'])).toEqual(state)
    db.exec(`UPDATE mail_lists SET name = 'LCA tournament email' WHERE id = 'lca-tournaments'`)
  })

  it('holds no CHECK on the mail tables\' values: the code that writes them takes them from domain/mail/lists.ts', () => {
    for (const table of NEW_TABLES) expect(one<{ sql: string }>(db, `SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?`, table).sql, table).not.toMatch(/CHECK/i)
    db.exec(`INSERT INTO mail_contacts (id, address) VALUES ('${'a'.repeat(32)}', 'kim.parent@example.org')`)
    db.exec(`INSERT INTO mail_list_choices (contact_id, list_id, choice, source) VALUES ('${'a'.repeat(32)}', 'lca-newsletter', 'some later choice', 'some later source')`)
    expect(one(db, 'SELECT choice, source FROM mail_list_choices')).toEqual({ choice: 'some later choice', source: 'some later source' })
    db.exec('DELETE FROM mail_list_choices')
    db.exec('DELETE FROM mail_contacts')
  })

  it('keeps one contact for an address, so a family\'s one address holds one choice a list', () => {
    db.exec(`INSERT INTO mail_contacts (id, address) VALUES ('${'b'.repeat(32)}', 'kim.parent@example.org')`)
    expect(throws(db, `INSERT INTO mail_contacts (id, address) VALUES ('${'c'.repeat(32)}', 'kim.parent@example.org')`)).toMatch(/UNIQUE constraint failed: mail_contacts\.address/)
    db.exec(`INSERT INTO mail_list_choices (contact_id, list_id, choice, source) VALUES ('${'b'.repeat(32)}', 'lca-newsletter', 'out', 'link')`)
    expect(throws(db, `INSERT INTO mail_list_choices (contact_id, list_id, choice, source) VALUES ('${'b'.repeat(32)}', 'lca-newsletter', 'in', 'preferences')`)).toMatch(/UNIQUE constraint failed/)
    db.exec('DELETE FROM mail_list_choices')
    db.exec('DELETE FROM mail_contacts')
  })

  it('takes a choice away with its contact or its list, and keeps a club with a list from being deleted from under it', () => {
    db.exec(`INSERT INTO mail_lists (id, kind, name, club_id) VALUES ('club-a-news', 'club', 'Acadiana Knights news', 'club-a')`)
    db.exec(`INSERT INTO mail_contacts (id, address) VALUES ('${'d'.repeat(32)}', 'pat.player@example.org'), ('${'e'.repeat(32)}', 'kim.parent@example.org')`)
    const choose = db.prepare(`INSERT INTO mail_list_choices (contact_id, list_id, choice, source) VALUES (?, ?, 'in', 'signup')`)
    choose.run('d'.repeat(32), 'club-a-news')
    choose.run('d'.repeat(32), 'lca-newsletter')
    choose.run('e'.repeat(32), 'club-a-news')
    expect(one(db, `SELECT main_mailer FROM mail_lists WHERE id = 'club-a-news'`)).toEqual({ main_mailer: 0 })
    expect(throws(db, `DELETE FROM clubs WHERE id = 'club-a'`)).toMatch(/FOREIGN KEY constraint failed/)
    expect(throws(db, `INSERT INTO mail_list_choices (contact_id, list_id, choice, source) VALUES ('${'e'.repeat(32)}', 'no-such-list', 'in', 'admin')`)).toMatch(/FOREIGN KEY constraint failed/)
    db.exec(`DELETE FROM mail_contacts WHERE id = '${'e'.repeat(32)}'`)
    expect(all(db, 'SELECT contact_id, list_id FROM mail_list_choices ORDER BY list_id')).toEqual([
      { contact_id: 'd'.repeat(32), list_id: 'club-a-news' }, { contact_id: 'd'.repeat(32), list_id: 'lca-newsletter' },
    ])
    db.exec(`DELETE FROM mail_lists WHERE id = 'club-a-news'`)
    expect(all(db, 'SELECT contact_id, list_id FROM mail_list_choices')).toEqual([{ contact_id: 'd'.repeat(32), list_id: 'lca-newsletter' }])
    expect(all(db, 'PRAGMA foreign_key_check')).toEqual([])
    db.exec('DELETE FROM mail_list_choices')
    db.exec('DELETE FROM mail_contacts')
  })

  it('keeps the do-not-send list to an address, its reason and the bounce\'s kind', () => {
    db.exec(`INSERT INTO mail_do_not_send (address, reason, detail) VALUES ('gone@example.org', 'bounce', 'NoEmail')`)
    expect(throws(db, `INSERT INTO mail_do_not_send (address, reason) VALUES ('gone@example.org', 'admin')`)).toMatch(/UNIQUE constraint failed|PRIMARY KEY/)
    expect(Object.keys(one(db, `SELECT * FROM mail_do_not_send`))).toEqual(['address', 'reason', 'detail', 'created_at'])
    db.exec('DELETE FROM mail_do_not_send')
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
    expect((failure as Error).message).toContain(`Migration ${FILE} failed on statement:\nCREATE TABLE \`mail_contacts\``)
    expect(((failure as Error).cause as Error).message).toMatch(/table `mail_contacts` already exists/)
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

describe('drizzle/meta records 0060', () => {
  it('gives the journal a tenth entry, 0009_mail_lists, written after 0008\'s, in the form of the others', () => {
    expect(journal.entries.map((e) => e.idx)).toEqual(journal.entries.map((_, i) => i))
    const entry = journal.entries[9]
    expect(entry).toEqual({ idx: 9, version: '6', when: expect.any(Number), tag: '0009_mail_lists', breakpoints: true })
    expect(entry.when).toBeGreaterThan(journal.entries[8].when)
    // The generator ran on Wednesday, November 11, 2026, in UTC, or later.
    expect(entry.when).toBeGreaterThanOrEqual(Date.UTC(2026, 10, 11))
    // The migration's header names the staged file the journal's tag names.
    expect(readFileSync(join(MIGRATIONS_DIR, FILE), 'utf8')).toContain(`-- staged as drizzle/${entry.tag}.sql.`)
  })

  it('makes 0009_snapshot.json follow 0008\'s, and no other snapshot follow 0008\'s', () => {
    const files = readdirSync(META).filter((f) => f.endsWith('_snapshot.json')).sort()
    expect(files.slice(0, 10)).toEqual(Array.from({ length: 10 }, (_, i) => `${String(i).padStart(4, '0')}_snapshot.json`))
    const snapshots = files.map((_, i) => snapshot(i))
    expect(new Set(snapshots.map((s) => s.id)).size).toBe(snapshots.length)
    expect(snapshot(9).prevId).toBe(snapshot(8).id)
    expect(snapshots.filter((s) => s.prevId === snapshot(8).id).map((s) => s.id)).toEqual([snapshot(9).id])
    expect([snapshot(9).version, snapshot(9).dialect]).toEqual([snapshot(8).version, snapshot(8).dialect])
  })

  it('differs from 0008\'s by the four tables and the four columns alone, the columns at the end of their tables', () => {
    const was = snapshot(8)
    const now = snapshot(9)
    const rest = (s: Snapshot) => {
      const copy = structuredClone(s) as Partial<Snapshot>
      delete copy.id
      delete copy.prevId
      for (const table of NEW_TABLES) delete copy.tables![table]
      for (const [table, columns] of Object.entries(NEW_COLUMNS)) {
        for (const column of columns) delete copy.tables![table].columns[column]
      }
      return copy
    }
    expect(rest(now)).toEqual(rest(was))
    expect(NEW_TABLES.filter((t) => t in was.tables)).toEqual([])
    expect(Object.keys(now.tables).filter((t) => !(t in was.tables)).sort()).toEqual(NEW_TABLES)
    for (const [table, columns] of Object.entries(NEW_COLUMNS)) {
      expect(Object.keys(now.tables[table].columns), table).toEqual([...Object.keys(was.tables[table].columns), ...columns])
    }
    expect(now.tables.email_campaigns.columns.skipped_count).toEqual({ name: 'skipped_count', type: 'integer', primaryKey: false, notNull: true, autoincrement: false, default: 0 })
    for (const [table, column] of [['email_campaigns', 'list_id'], ['email_campaign_recipients', 'contact_id'], ['email_campaign_recipients', 'sending_at']]) {
      expect(now.tables[table].columns[column], `${table}.${column}`).toEqual({ name: column, type: 'text', primaryKey: false, notNull: false, autoincrement: false })
    }
  })
})
