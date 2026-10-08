// test/unit/db-generate-real-kit.test.ts
//
// db-generate-guard.test.ts drives scripts/db/generate.ts with a stand-in for
// drizzle-kit. This file runs the real drizzle-kit (the pinned version in
// node_modules) against a throwaway copy of the repo's schema, snapshot and
// migrations, so the guard is proved on what drizzle-kit actually writes:
//
// - right after the pull, with nothing edited, it reports no schema changes
//   and writes nothing
// - a safe change becomes the next numbered file in migrations/
// - a constraint change (it rebuilds the table) is refused and leaves
//   migrations/ and drizzle/ exactly as they were
// - a column added with ON DELETE cascade, which this drizzle-kit writes
//   without the cascade, is refused too
// - a renamed column, which drizzle-kit can only ask about in a terminal,
//   stops the run instead of reading as "no schema changes"
//
// Nothing here touches the real drizzle/ or migrations/ folders.
import { afterAll, describe, expect, it } from 'vitest'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { generateMigration, runDrizzleKit } from '../../scripts/db/generate'
import { splitSql } from '../shared/splitSql'
import { applyMigrations, foreignKeysOn, migrationFiles } from './helpers/sqlite'
import { DatabaseSync } from 'node:sqlite'

const ROOT = join(__dirname, '../..')
const TIMEOUT = 60_000
const roots: string[] = []

/** A temporary repo root: the real schema, snapshot, config and migrations. */
function sandbox(editSchema?: (source: string) => string) {
  const root = mkdtempSync(join(tmpdir(), 'db-generate-kit-'))
  roots.push(root)
  mkdirSync(join(root, 'functions'))
  cpSync(join(ROOT, 'functions/db'), join(root, 'functions/db'), { recursive: true })
  cpSync(join(ROOT, 'drizzle'), join(root, 'drizzle'), { recursive: true })
  cpSync(join(ROOT, 'migrations'), join(root, 'migrations'), { recursive: true })
  cpSync(join(ROOT, 'drizzle.config.ts'), join(root, 'drizzle.config.ts'))
  cpSync(join(ROOT, 'package.json'), join(root, 'package.json'))
  symlinkSync(join(ROOT, 'node_modules'), join(root, 'node_modules'), 'dir')
  if (editSchema) {
    const file = join(root, 'functions/db/schema.ts')
    const before = readFileSync(file, 'utf8')
    const after = editSchema(before)
    if (after === before) throw new Error('the schema edit changed nothing')
    writeFileSync(file, after)
  }
  return root
}

/** Every file under a folder with its text, to prove a folder is unchanged. */
function tree(dir: string): Record<string, string> {
  const out: Record<string, string> = {}
  const walk = (d: string) => {
    for (const f of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, f.name)
      if (f.isDirectory()) walk(p)
      else out[p.slice(dir.length)] = readFileSync(p, 'utf8')
    }
  }
  walk(dir)
  return out
}

afterAll(() => {
  for (const r of roots) rmSync(r, { recursive: true, force: true })
})

const addClubColumn = (src: string) => src.replace("  longitude: real(),\n})", "  longitude: real(),\n  nickname: text(),\n})")
const addNotesTable = (src: string) => `${src}
export const tournamentNotes = sqliteTable('tournament_notes', {
  id: text().primaryKey(),
  tournamentId: text('tournament_id').notNull().references(() => tournaments.id, { onDelete: 'cascade' }),
  body: text().notNull(),
  createdAt: text('created_at').default(sql\`(datetime('now'))\`).notNull(),
})
`
// tournaments.club_id: no action -> set null. SQLite cannot alter a
// constraint, so drizzle-kit rebuilds the table.
const clubIdSetNull = (src: string) => src.replace(
  "clubId: text('club_id').references(() => clubs.id),",
  "clubId: text('club_id').references(() => clubs.id, { onDelete: 'set null' }),",
)
const addFkColumn = (src: string) => src.replace(
  "  longitude: real(),\n})",
  "  longitude: real(),\n  featuredTournamentId: text('featured_tournament_id').references(() => tournaments.id, { onDelete: 'cascade' }),\n})",
)
// clubs.longitude renamed to lng: drizzle-kit asks whether it is a rename.
const renameLongitude = (src: string) => src.replace('  longitude: real(),\n})', '  lng: real(),\n})')

describe('drizzle-kit generate on the committed baseline', () => {
  it('reports no schema changes and writes nothing', () => {
    const root = sandbox()
    const before = { drizzle: tree(join(root, 'drizzle')), migrations: tree(join(root, 'migrations')) }
    const run = runDrizzleKit(['generate', '--name', 'check'], root)
    expect(run.status).toBe(0)
    expect(run.output).toMatch(/No schema changes/)
    expect(run.output).toMatch(/32 tables/)
    expect({ drizzle: tree(join(root, 'drizzle')), migrations: tree(join(root, 'migrations')) }).toEqual(before)
  }, TIMEOUT)

  it('db:generate says so too and adds no migration', () => {
    const root = sandbox()
    const result = generateMigration({ name: 'check', root })
    expect(result).toEqual({ ok: true, file: null, message: 'No schema changes, so no migration was written.' })
    expect(migrationFiles(join(root, 'migrations'))).toEqual(migrationFiles())
  }, TIMEOUT)

  it('keeps the baseline and the two step 8 entries in drizzle/meta, and no SQL in drizzle/', () => {
    const journal = JSON.parse(readFileSync(join(ROOT, 'drizzle/meta/_journal.json'), 'utf8')) as { dialect: string; entries: unknown[] }
    expect(journal.dialect).toBe('sqlite')
    expect(journal.entries).toHaveLength(3)
    expect(readdirSync(join(ROOT, 'drizzle')).filter((f) => f.endsWith('.sql'))).toEqual([])
    expect(existsSync(join(ROOT, 'drizzle/meta/0000_snapshot.json'))).toBe(true)
  })
})

describe('db:generate with the real drizzle-kit', () => {
  it('writes an added column as 0054, runs on the migrated database, and leaves only meta in drizzle/', () => {
    const root = sandbox(addClubColumn)
    const result = generateMigration({ name: 'club nickname', root })
    expect(result).toMatchObject({ ok: true, file: '0054_club_nickname.sql' })
    const file = join(root, 'migrations/0054_club_nickname.sql')
    const text = readFileSync(file, 'utf8')
    expect(text).toMatch(/^-- 0054_club_nickname\.sql\n/)
    expect(text).toMatch(/ALTER TABLE `clubs` ADD `nickname` text;/)
    expect(splitSql(text)).toHaveLength(1)
    expect(readdirSync(join(root, 'drizzle'))).toEqual(['meta'])
    expect(readdirSync(join(root, 'drizzle/meta')).sort()).toEqual(['0000_snapshot.json', '0001_snapshot.json', '0002_snapshot.json', '0003_snapshot.json', '_journal.json'])

    // The runner still reads it like any other migration.
    const plain = new DatabaseSync(':memory:')
    plain.exec('PRAGMA foreign_keys = ON')
    applyMigrations(plain, migrationFiles(join(root, 'migrations')), join(root, 'migrations'))
    expect(foreignKeysOn(plain)).toBe(1)
    expect(plain.prepare("SELECT name FROM pragma_table_info('clubs') WHERE name = 'nickname'").all()).toHaveLength(1)

    // And the next run sees nothing left to generate.
    const again = generateMigration({ name: 'club nickname again', root })
    expect(again).toMatchObject({ ok: true, file: null })
  }, TIMEOUT)

  it('writes a new table with a cascading foreign key', () => {
    const root = sandbox(addNotesTable)
    const result = generateMigration({ name: 'tournament notes', root })
    expect(result).toMatchObject({ ok: true, file: '0054_tournament_notes.sql' })
    const text = readFileSync(join(root, 'migrations/0054_tournament_notes.sql'), 'utf8')
    expect(text).toMatch(/CREATE TABLE `tournament_notes`/)
    expect(text).toMatch(/REFERENCES `tournaments`\(`id`\) ON UPDATE no action ON DELETE cascade/)
  }, TIMEOUT)

  it('refuses the table rebuild drizzle-kit writes for a changed constraint, and changes nothing', () => {
    const root = sandbox(clubIdSetNull)
    const before = { drizzle: tree(join(root, 'drizzle')), migrations: tree(join(root, 'migrations')) }
    const result = generateMigration({ name: 'club set null', root })
    expect(result.ok).toBe(false)
    expect(result.message).toMatch(/^Stopped:/)
    expect(result.message).toContain('DROP TABLE')
    expect(result.message).toContain('__new_')
    expect(result.message).toContain('PRAGMA foreign_keys')
    expect({ drizzle: tree(join(root, 'drizzle')), migrations: tree(join(root, 'migrations')) }).toEqual(before)
  }, TIMEOUT)

  it('refuses a column added with ON DELETE cascade, which this drizzle-kit writes without the cascade', () => {
    const root = sandbox(addFkColumn)
    const raw = runDrizzleKit(['generate', '--name', 'probe'], root)
    expect(raw.status).toBe(0)
    const staged = readdirSync(join(root, 'drizzle')).find((f) => f.endsWith('.sql'))
    const sql = readFileSync(join(root, 'drizzle', staged as string), 'utf8')
    expect(sql).toMatch(/ALTER TABLE `clubs` ADD `featured_tournament_id` text REFERENCES tournaments\(id\);/)
    expect(sql).not.toMatch(/ON DELETE/i)

    const fresh = sandbox(addFkColumn)
    const before = { drizzle: tree(join(fresh, 'drizzle')), migrations: tree(join(fresh, 'migrations')) }
    const result = generateMigration({ name: 'featured tournament', root: fresh })
    expect(result.ok).toBe(false)
    expect(result.message).toContain('clubs.featured_tournament_id without its ON DELETE cascade')
    expect({ drizzle: tree(join(fresh, 'drizzle')), migrations: tree(join(fresh, 'migrations')) }).toEqual(before)
  }, TIMEOUT)

  it('stops on a renamed column, which drizzle-kit cannot ask about without a terminal', () => {
    const root = sandbox(renameLongitude)
    const before = { drizzle: tree(join(root, 'drizzle')), migrations: tree(join(root, 'migrations')) }
    const raw = runDrizzleKit(['generate', '--name', 'probe'], root)
    expect(raw.output).toMatch(/^Error: Interactive prompts require a TTY/m)
    expect(raw.status).not.toBe(0)

    const result = generateMigration({ name: 'rename longitude', root })
    expect(result.ok).toBe(false)
    expect(result.message).not.toContain('No schema changes')
    expect(result.message).toContain('in a terminal')
    expect({ drizzle: tree(join(root, 'drizzle')), migrations: tree(join(root, 'migrations')) }).toEqual(before)
  }, TIMEOUT)

  it('--custom keeps a rebuild out of the file: it is only comments, and the snapshot is kept', () => {
    const root = sandbox(clubIdSetNull)
    const result = generateMigration({ name: 'club set null', custom: true, root })
    expect(result).toMatchObject({ ok: true, file: '0054_club_set_null.sql' })
    const text = readFileSync(join(root, 'migrations/0054_club_set_null.sql'), 'utf8')
    expect(text).toContain('-- DROP TABLE `tournaments`;')
    expect(splitSql(text)).toEqual([])
    expect(readdirSync(join(root, 'drizzle'))).toEqual(['meta'])
  }, TIMEOUT)

  it('--custom with no schema change writes an empty file for a data migration', () => {
    const root = sandbox()
    const result = generateMigration({ name: 'backfill sections', custom: true, root })
    expect(result).toMatchObject({ ok: true, file: '0054_backfill_sections.sql' })
    const text = readFileSync(join(root, 'migrations/0054_backfill_sections.sql'), 'utf8')
    expect(text).not.toContain('Custom SQL migration file')
    expect(splitSql(text)).toEqual([])
    expect(readdirSync(join(root, 'drizzle'))).toEqual(['meta'])
  }, TIMEOUT)
})

describe('the drizzle-sql fixtures are what this drizzle-kit writes', () => {
  const body = (file: string) => readFileSync(join(__dirname, 'fixtures/drizzle-sql', file), 'utf8').replace(/^(?:--(?!>)[^\n]*\n)+/, '')
  const staged = (edit: (src: string) => string) => {
    const root = sandbox(edit)
    const run = runDrizzleKit(['generate', '--name', 'fixture'], root)
    expect(run.status, run.output).toBe(0)
    const file = readdirSync(join(root, 'drizzle')).find((f) => f.endsWith('.sql')) as string
    return readFileSync(join(root, 'drizzle', file), 'utf8')
  }

  it('create-table-fk.sql', () => {
    expect(staged(addNotesTable).trim()).toBe(body('create-table-fk.sql').trim())
  }, TIMEOUT)

  it('drop-quoted-parent.sql', () => {
    expect(staged(clubIdSetNull).trim()).toBe(body('drop-quoted-parent.sql').trim())
  }, TIMEOUT)

  it('alter-add-fk.sql, apart from the ON DELETE clause its header says was written back by hand', () => {
    expect(staged(addFkColumn).trim()).toBe(body('alter-add-fk.sql').trim().replace(' ON DELETE cascade', ''))
  }, TIMEOUT)
})
