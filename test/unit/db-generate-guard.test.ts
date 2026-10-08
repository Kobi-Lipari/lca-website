// test/unit/db-generate-guard.test.ts
//
// scripts/db/generate.ts (npm run db:generate -- <name> [--custom]) numbers
// drizzle-kit's output into migrations/ and refuses what would hurt D1: a
// table rebuild (DROP TABLE, a __new_ table, PRAGMA foreign_keys) and a column
// added without the ON DELETE / ON UPDATE action the schema asks for.
//
// drizzle-kit itself is replaced by a stand-in that writes into a temporary
// staging folder the way drizzle-kit does (an NNNN_name.sql file, a snapshot
// and a journal entry), using real drizzle-kit output from
// test/unit/fixtures/drizzle-sql. Nothing here touches the real drizzle/ or
// migrations/ folders.
import { describe, expect, it } from 'vitest'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  droppedReferenceActions,
  generateMigration,
  kitFailed,
  migrationText,
  nextMigrationNumber,
  refusalReasons,
  slugName,
  type KitResult,
} from '../../scripts/db/generate'
import { splitSql } from '../shared/splitSql'

const ROOT = join(__dirname, '../..')
const fixture = (f: string) => readFileSync(join(__dirname, 'fixtures/drizzle-sql', f), 'utf8')
const REBUILD = fixture('drop-quoted-parent.sql')
const NEW_TABLE = fixture('create-table-fk.sql')
// What drizzle-kit really writes for the added column: no ON DELETE.
const ALTER_AS_GENERATED = fixture('alter-add-fk.sql').replace('REFERENCES tournaments(id) ON DELETE cascade;', 'REFERENCES tournaments(id);')
const CASCADE_SNAPSHOT = {
  tables: {
    clubs: {
      foreignKeys: {
        clubs_featured_tournament_id_tournaments_id_fk: { columnsFrom: ['featured_tournament_id'], onDelete: 'cascade', onUpdate: 'no action' },
      },
    },
  },
}

/** A temporary repo: migrations/ with three files, drizzle/meta with the real baseline. */
function sandbox() {
  const root = mkdtempSync(join(tmpdir(), 'db-generate-'))
  const migrationsDir = join(root, 'migrations')
  const stagingDir = join(root, 'drizzle')
  mkdirSync(migrationsDir)
  for (const f of ['0001_schema.sql', '0022_a.sql', '0051_club_map_location.sql', 'README.md']) writeFileSync(join(migrationsDir, f), '-- x\n')
  cpSync(join(ROOT, 'drizzle/meta'), join(stagingDir, 'meta'), { recursive: true })
  return { root, migrationsDir, stagingDir }
}

/**
 * Stands in for drizzle-kit: each call writes the next output (null means
 * "no schema changes"), with a snapshot and a journal entry, and records the
 * arguments it was given.
 */
function fakeKit(stagingDir: string, outputs: Array<string | null>, snapshot: object = { tables: {} }, status = 0) {
  const calls: string[][] = []
  const run = (args: string[]): KitResult => {
    calls.push(args)
    const sql = outputs[calls.length - 1] ?? null
    if (status !== 0) {
      writeFileSync(join(stagingDir, '0001_broken.sql'), 'half written')
      return { status, output: 'Error: could not read the schema' }
    }
    if (sql === null) return { status: 0, output: 'No schema changes, nothing to migrate' }
    const journalPath = join(stagingDir, 'meta/_journal.json')
    const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as { entries: Array<{ idx: number; tag: string }> }
    const idx = journal.entries.length
    const tag = `${String(idx).padStart(4, '0')}_${args[args.indexOf('--name') + 1]}`
    writeFileSync(join(stagingDir, `${tag}.sql`), sql)
    writeFileSync(join(stagingDir, 'meta', `${String(idx).padStart(4, '0')}_snapshot.json`), JSON.stringify(snapshot))
    journal.entries.push({ idx, tag })
    writeFileSync(journalPath, JSON.stringify(journal, null, 2))
    return { status: 0, output: `Your SQL migration file ➜ drizzle/${tag}.sql` }
  }
  return { run, calls }
}

const listing = (dir: string) => readdirSync(dir).sort()
const stagingFiles = (dir: string) => ({ top: listing(dir), meta: listing(join(dir, 'meta')), journal: readFileSync(join(dir, 'meta/_journal.json'), 'utf8') })

describe('what the guard refuses', () => {
  it.each([
    ['DROP TABLE', 'DROP TABLE `members`;', 'DROP TABLE'],
    ['a __new_ table', 'CREATE TABLE `__new_members` (`id` text);', '__new_'],
    ['PRAGMA foreign_keys', 'PRAGMA foreign_keys=OFF;', 'PRAGMA foreign_keys'],
  ])('refuses %s on its own', (_label, sql, word) => {
    const reasons = refusalReasons(sql)
    expect(reasons).toHaveLength(1)
    expect(reasons[0]).toContain(word)
  })

  it("refuses drizzle-kit's real table rebuild for all three reasons", () => {
    expect(refusalReasons(REBUILD)).toHaveLength(3)
  })

  it('accepts a new table and an index', () => {
    expect(refusalReasons(NEW_TABLE)).toEqual([])
    expect(refusalReasons('CREATE INDEX `i` ON `members` (`email`);')).toEqual([])
  })

  it('refuses a column added without the ON DELETE action its snapshot records', () => {
    expect(ALTER_AS_GENERATED).toMatch(/REFERENCES tournaments\(id\);/)
    expect(droppedReferenceActions(ALTER_AS_GENERATED, CASCADE_SNAPSHOT)).toEqual(['clubs.featured_tournament_id without its ON DELETE cascade'])
    expect(refusalReasons(ALTER_AS_GENERATED, CASCADE_SNAPSHOT)).toHaveLength(1)
  })

  it('accepts the added column once the action is written, or when it has none', () => {
    expect(droppedReferenceActions(fixture('alter-add-fk.sql'), CASCADE_SNAPSHOT)).toEqual([])
    const plain = { tables: { clubs: { foreignKeys: { k: { columnsFrom: ['featured_tournament_id'], onDelete: 'no action', onUpdate: 'no action' } } } } }
    expect(droppedReferenceActions(ALTER_AS_GENERATED, plain)).toEqual([])
  })
})

describe('numbering and naming', () => {
  it('numbers the next file after the highest prefix in migrations/ (0052 today)', () => {
    expect(nextMigrationNumber(readdirSync(join(ROOT, 'migrations')))).toBe('0052')
  })

  it('ignores files without a four-digit prefix and copes with a duplicate prefix', () => {
    expect(nextMigrationNumber(['0022_a.sql', '0022_b.sql', 'README.md', '0009_x.sql'])).toBe('0023')
    expect(nextMigrationNumber([])).toBe('0001')
  })

  it('turns a name into lower-case words joined by underscores', () => {
    expect(slugName('Tournament Sections')).toBe('tournament_sections')
    expect(slugName('  add-club--owner! ')).toBe('add_club_owner')
    expect(slugName('!!')).toBe('')
  })

  it('heads a generated file with its name and where it came from', () => {
    const text = migrationText('CREATE INDEX i ON t (x);', { file: '0052_x.sql', staged: '0001_x.sql', custom: false })
    expect(text.split('\n')[0]).toBe('-- 0052_x.sql')
    expect(text).toContain('functions/db/schema.ts')
    expect(text).toContain('drizzle/0001_x.sql')
    expect(text.trimEnd().endsWith('CREATE INDEX i ON t (x);')).toBe(true)
  })
})

describe('generateMigration', () => {
  it('writes a safe change to migrations/ as the next number and clears the staging SQL', () => {
    const box = sandbox()
    const kit = fakeKit(box.stagingDir, [NEW_TABLE])
    const result = generateMigration({ name: 'tournament notes', ...box, runKit: kit.run })
    expect(result).toMatchObject({ ok: true, file: '0052_tournament_notes.sql' })
    expect(kit.calls).toEqual([['generate', '--name', 'tournament_notes']])
    const written = readFileSync(join(box.migrationsDir, '0052_tournament_notes.sql'), 'utf8')
    expect(written).toMatch(/^-- 0052_tournament_notes\.sql\n/)
    expect(written).toContain('CREATE TABLE `tournament_notes`')
    expect(splitSql(written)).toHaveLength(1)
    // The staging SQL is gone; the snapshot and journal entry stay for the next diff.
    expect(listing(box.stagingDir)).toEqual(['meta'])
    expect(listing(join(box.stagingDir, 'meta'))).toEqual(['0000_snapshot.json', '0001_snapshot.json', '_journal.json'])
  })

  it.each([
    ['a table rebuild', REBUILD, {}],
    ['a column that loses its cascade', ALTER_AS_GENERATED, CASCADE_SNAPSHOT],
  ])('refuses %s, writes nothing and puts drizzle/ back as it was', (_label, sql, snapshot) => {
    const box = sandbox()
    const before = stagingFiles(box.stagingDir)
    const migrationsBefore = listing(box.migrationsDir)
    const kit = fakeKit(box.stagingDir, [sql], snapshot)
    const result = generateMigration({ name: 'change', ...box, runKit: kit.run })
    expect(result.ok).toBe(false)
    expect(result.message).toMatch(/^Stopped:/)
    expect(result.message).toContain('migrations/README.md')
    expect(result.message).toContain('--custom')
    expect(listing(box.migrationsDir)).toEqual(migrationsBefore)
    expect(stagingFiles(box.stagingDir)).toEqual(before)
  })

  it('writes nothing when the schema has not changed', () => {
    const box = sandbox()
    const result = generateMigration({ name: 'nothing', ...box, runKit: fakeKit(box.stagingDir, [null]).run })
    expect(result).toMatchObject({ ok: true, file: null })
    expect(listing(box.migrationsDir)).toHaveLength(4)
  })

  it('stops with drizzle-kit\'s message when it fails, and cleans up after it', () => {
    const box = sandbox()
    const before = stagingFiles(box.stagingDir)
    const result = generateMigration({ name: 'x', ...box, runKit: fakeKit(box.stagingDir, [], {}, 1).run })
    expect(result.ok).toBe(false)
    expect(result.message).toContain('could not read the schema')
    expect(stagingFiles(box.stagingDir)).toEqual(before)
  })

  it('stops when drizzle-kit prints an error but exits 0, as it does when it cannot ask about a rename', () => {
    const box = sandbox()
    const before = stagingFiles(box.stagingDir)
    const migrationsBefore = listing(box.migrationsDir)
    const runKit = (): KitResult => ({
      status: 0,
      output: "Reading config file 'drizzle.config.ts'\nError: Interactive prompts require a TTY terminal (process.stdin.isTTY or process.stdout.isTTY is false).\n    at render10 (bin.cjs:1450:31)",
    })
    const result = generateMigration({ name: 'rename', ...box, runKit })
    expect(result.ok).toBe(false)
    expect(result.message).not.toContain('No schema changes')
    expect(result.message).toContain('Interactive prompts require a TTY')
    expect(result.message).toContain('renamed')
    expect(result.message).toContain('in a terminal')
    expect(listing(box.migrationsDir)).toEqual(migrationsBefore)
    expect(stagingFiles(box.stagingDir)).toEqual(before)
  })

  it('reads an "Error:" line as a failure only at the start of a line', () => {
    expect(kitFailed({ status: 0, output: 'Error: could not read the schema' })).toBe(true)
    expect(kitFailed({ status: 0, output: 'No schema changes, nothing to migrate' })).toBe(false)
    expect(kitFailed({ status: 0, output: "[✓] table `errors` (column 'Error: kind')" })).toBe(false)
    expect(kitFailed({ status: 2, output: '' })).toBe(true)
  })

  it('refuses a missing name', () => {
    const box = sandbox()
    const kit = fakeKit(box.stagingDir, [NEW_TABLE])
    expect(generateMigration({ name: '  ', ...box, runKit: kit.run }).ok).toBe(false)
    expect(kit.calls).toEqual([])
  })

  it('--custom with a schema change: drizzle-kit\'s rebuild only as comments, and the snapshot kept', () => {
    const box = sandbox()
    const kit = fakeKit(box.stagingDir, [REBUILD])
    const result = generateMigration({ name: 'club link set null', custom: true, ...box, runKit: kit.run })
    expect(result).toMatchObject({ ok: true, file: '0052_club_link_set_null.sql' })
    const written = readFileSync(join(box.migrationsDir, '0052_club_link_set_null.sql'), 'utf8')
    expect(written).toContain('Hand-written migration')
    expect(written).toContain('-- DROP TABLE `tournaments`;')
    // Nothing runs until a person writes it: every line is a comment.
    expect(splitSql(written)).toEqual([])
    expect(listing(join(box.stagingDir, 'meta'))).toContain('0001_snapshot.json')
  })

  it('--custom with no schema change: an empty file for a data migration', () => {
    const box = sandbox()
    const kit = fakeKit(box.stagingDir, [null, '-- Custom SQL migration file, put your code below! --\n'])
    const result = generateMigration({ name: 'backfill', custom: true, ...box, runKit: kit.run })
    expect(result).toMatchObject({ ok: true, file: '0052_backfill.sql' })
    expect(kit.calls).toEqual([['generate', '--name', 'backfill'], ['generate', '--custom', '--name', 'backfill']])
    const written = readFileSync(join(box.migrationsDir, '0052_backfill.sql'), 'utf8')
    expect(written).not.toContain('Custom SQL migration file')
    expect(splitSql(written)).toEqual([])
    expect(existsSync(join(box.stagingDir, '0001_backfill.sql'))).toBe(false)
  })
})

describe('wiring', () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
    scripts: Record<string, string>
    dependencies: Record<string, string>
    devDependencies: Record<string, string>
  }

  it('has the npm scripts', () => {
    expect(pkg.scripts['db:generate']).toBe('node --no-warnings --experimental-strip-types scripts/db/generate.ts')
    expect(pkg.scripts['db:local-sqlite']).toBe('node --no-warnings --experimental-strip-types scripts/db/build-local-sqlite.ts')
  })

  it('pins drizzle-orm, drizzle-kit and @libsql/client exactly', () => {
    expect(pkg.dependencies['drizzle-orm']).toBe('0.45.3')
    expect(pkg.devDependencies['drizzle-kit']).toBe('0.31.11')
    expect(pkg.devDependencies['@libsql/client']).toBe('0.17.4')
  })

  it('stages drizzle-kit output in drizzle/, never in migrations/', () => {
    const config = readFileSync(join(ROOT, 'drizzle.config.ts'), 'utf8')
    expect(config).toMatch(/out: '\.\/drizzle'/)
    expect(config).toMatch(/schema: '\.\/functions\/db\/schema\.ts'/)
    expect(config).toMatch(/dialect: 'sqlite'/)
    expect(config).toMatch(/tablesFilter: \['!d1_migrations', '!_cf_\*', '!sqlite_\*'\]/)
    expect(config).not.toMatch(/out: '\.\/migrations/)
    // The staging folder holds only drizzle-kit's bookkeeping, no SQL.
    expect(readdirSync(join(ROOT, 'drizzle'))).toEqual(['meta'])
  })

  it('leaves the runners on migrations/*.sql: the test setup, wrangler and the deploy workflow', () => {
    expect(readFileSync(join(ROOT, 'test/integration/setup.ts'), 'utf8')).toContain("import.meta.glob('../../migrations/*.sql'")
    expect(readFileSync(join(ROOT, 'wrangler.toml'), 'utf8')).not.toMatch(/migrations_dir/)
    expect(readFileSync(join(ROOT, '.github/workflows/migrate-db.yml'), 'utf8')).toMatch(/wrangler d1 migrations apply lca-db --remote/)
  })
})
