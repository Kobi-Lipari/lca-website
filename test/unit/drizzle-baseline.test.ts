// test/unit/drizzle-baseline.test.ts
//
// The rest of what the Drizzle baseline (REDESIGN_SPEC K4) promises, not
// covered by the drift, splitter, safety and generator tests:
//
// - the guard in scripts/db/generate.ts on more spellings of what it refuses
// - the introspection database script and the drizzle.config.ts filter
// - functions/db stays out of Pages routing and out of runtime code
// - the splitter is shared, and the runners still read migrations/*.sql
// - the README and the status file say what they should
import { afterAll, describe, expect, it } from 'vitest'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { DatabaseSync } from 'node:sqlite'
import { droppedReferenceActions, refusalReasons } from '../../scripts/db/generate'
import { buildLocalSqlite } from '../../scripts/db/build-local-sqlite'
import { migrationFiles } from './helpers/sqlite'

const ROOT = join(__dirname, '../..')
const text = (rel: string) => readFileSync(join(ROOT, rel), 'utf8')
const dirs: string[] = []
const scratch = () => {
  const d = mkdtempSync(join(tmpdir(), 'drizzle-baseline-'))
  dirs.push(d)
  return d
}
afterAll(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true })
})

describe('the generate guard reads every spelling', () => {
  it.each([
    ['lower case', 'drop table `members`;'],
    ['double quotes', 'DROP TABLE "members";'],
    ['IF EXISTS', 'DROP TABLE IF EXISTS members;'],
    ['extra spaces and a new line', 'DROP   TABLE\n  members;'],
  ])('refuses DROP TABLE: %s', (_label, sql) => {
    expect(refusalReasons(sql)).toEqual(['DROP TABLE'])
  })

  it.each([
    ['PRAGMA foreign_keys=OFF;'],
    ['PRAGMA foreign_keys = ON;'],
    ['pragma  foreign_keys=off;'],
  ])('refuses %s', (sql) => {
    expect(refusalReasons(sql)).toEqual(['PRAGMA foreign_keys'])
  })

  it('refuses a __new_ table in any case', () => {
    expect(refusalReasons('ALTER TABLE `__NEW_members` RENAME TO `members`;')).toEqual(['a __new_ table (drizzle-kit rebuilding a table)'])
  })

  it('lets through DROP INDEX, CREATE INDEX, ADD COLUMN and a column named like a keyword', () => {
    expect(refusalReasons([
      'DROP INDEX `idx_old`;',
      'CREATE INDEX `idx_new` ON `members` (`email`);',
      'ALTER TABLE `members` ADD `drop_table_count` integer;',
      'ALTER TABLE `members` ADD `pragma_foreign_keys` integer;',
    ].join('\n'))).toEqual([])
  })

  it('reports every reason at once', () => {
    expect(refusalReasons('PRAGMA foreign_keys=OFF;\nCREATE TABLE `__new_t` (`id` text);\nDROP TABLE `t`;')).toHaveLength(3)
  })

  const snapshot = (fk: object) => ({ tables: { clubs: { foreignKeys: { k: { columnsFrom: ['owner_id'], ...fk } } } } })

  it('finds a lost action with ADD COLUMN, with double quotes, and for ON UPDATE', () => {
    const cascade = snapshot({ onDelete: 'cascade', onUpdate: 'no action' })
    expect(droppedReferenceActions('ALTER TABLE clubs ADD COLUMN owner_id text REFERENCES members(id);', cascade))
      .toEqual(['clubs.owner_id without its ON DELETE cascade'])
    expect(droppedReferenceActions('ALTER TABLE "clubs" ADD "owner_id" text REFERENCES "members"("id");', cascade))
      .toEqual(['clubs.owner_id without its ON DELETE cascade'])
    const both = snapshot({ onDelete: 'set null', onUpdate: 'cascade' })
    expect(droppedReferenceActions('ALTER TABLE `clubs` ADD `owner_id` text REFERENCES members(id);', both))
      .toEqual(['clubs.owner_id without its ON DELETE set null', 'clubs.owner_id without its ON UPDATE cascade'])
    expect(droppedReferenceActions('ALTER TABLE `clubs` ADD `owner_id` text REFERENCES members(id) ON UPDATE cascade ON DELETE set null;', both)).toEqual([])
  })

  it('does not guess without a snapshot, and ignores columns without REFERENCES', () => {
    expect(droppedReferenceActions('ALTER TABLE clubs ADD owner_id text REFERENCES members(id);', null)).toEqual([])
    expect(droppedReferenceActions('ALTER TABLE `clubs` ADD `nickname` text;', snapshot({ onDelete: 'cascade' }))).toEqual([])
  })
})

describe('scripts/db/build-local-sqlite.ts', () => {
  it('writes one database holding the 29 tables and both triggers, built from all 52 migrations', () => {
    const out = join(scratch(), 'nested/introspect.sqlite')
    expect(buildLocalSqlite(out)).toEqual({ files: 52, tables: 29 })
    expect(migrationFiles()).toHaveLength(52)
    const db = new DatabaseSync(out, { readOnly: true })
    const names = (type: string) => (db.prepare('SELECT name FROM sqlite_master WHERE type = ? ORDER BY name').all(type) as Array<{ name: string }>).map((r) => r.name)
    expect(names('trigger')).toEqual(['members_role_insert', 'members_role_update'])
    expect(names('table')).toEqual(expect.arrayContaining(['members', 'tournaments', 'tournament_directors']))
    db.close()
  })

  it('starts clean every time', () => {
    const out = join(scratch(), 'introspect.sqlite')
    buildLocalSqlite(out)
    const db = new DatabaseSync(out)
    db.exec('CREATE TABLE leftover (id text)')
    db.close()
    expect(buildLocalSqlite(out).tables).toBe(29)
    const again = new DatabaseSync(out, { readOnly: true })
    expect(again.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name = 'leftover'").get()).toEqual({ n: 0 })
    again.close()
  })

  it('is ignored by git, while the drizzle snapshot is not', () => {
    const ignored = (p: string) => spawnSync('git', ['check-ignore', '-q', p], { cwd: ROOT }).status === 0
    expect(ignored('.drizzle/introspect.sqlite')).toBe(true)
    expect(ignored('drizzle/meta/0000_snapshot.json')).toBe(false)
    expect(ignored('drizzle/meta/_journal.json')).toBe(false)
  })
})

describe('drizzle.config.ts filter, run through drizzle-kit pull', () => {
  it('leaves out d1_migrations, _cf_* and sqlite_* tables', () => {
    const root = scratch()
    mkdirSync(join(root, '.drizzle'))
    cpSync(join(ROOT, 'drizzle.config.ts'), join(root, 'drizzle.config.ts'))
    cpSync(join(ROOT, 'package.json'), join(root, 'package.json'))
    symlinkSync(join(ROOT, 'node_modules'), join(root, 'node_modules'), 'dir')
    buildLocalSqlite(join(root, '.drizzle/introspect.sqlite'))
    const db = new DatabaseSync(join(root, '.drizzle/introspect.sqlite'))
    db.exec('CREATE TABLE d1_migrations (id INTEGER PRIMARY KEY, name TEXT); CREATE TABLE _cf_KV (key TEXT PRIMARY KEY, value BLOB); CREATE TABLE counter_note (id INTEGER PRIMARY KEY AUTOINCREMENT)')
    db.close()
    const run = spawnSync(process.execPath, [join(root, 'node_modules/drizzle-kit/bin.cjs'), 'pull'], { cwd: root, encoding: 'utf8' })
    const out = `${run.stdout}${run.stderr}`
    expect(run.status, out).toBe(0)
    const pulled = readdirSync(join(root, 'drizzle')).filter((f) => f.endsWith('schema.ts'))
    expect(pulled).toHaveLength(1)
    const schema = readFileSync(join(root, 'drizzle', pulled[0]), 'utf8')
    expect(schema).toContain('sqliteTable("members"')
    expect(schema).toContain('counter_note')
    expect(schema).not.toMatch(/d1_migrations|_cf_KV|sqlite_sequence/)
    expect((schema.match(/= sqliteTable\(/g) ?? []).length).toBe(30)
  }, 60_000)
})

describe('functions/db stays out of the way', () => {
  const files = readdirSync(join(ROOT, 'functions/db'))

  it('holds only the schema, the relations and the client', () => {
    expect(files.sort()).toEqual(['client.ts', 'relations.ts', 'schema.ts'])
  })

  it('exports no onRequest handler, so Pages Functions makes no route from it', () => {
    for (const f of files) expect(text(`functions/db/${f}`), f).not.toMatch(/export\s+(?:async\s+)?(?:const|function)\s+onRequest/)
  })

  it('has a header that says what is not modelled, and that triggers stay in migrations', () => {
    const header = text('functions/db/schema.ts').split('\nimport ')[0]
    for (const word of ['CHECK', 'UNIQUE', 'triggers', 'members_role_insert', 'members_role_update', 'No runtime code imports this']) {
      expect(header, word).toContain(word)
    }
  })

  it('exposes getDb(d1) over the tables and the relations together', () => {
    const client = text('functions/db/client.ts')
    expect(client).toMatch(/export function getDb\(d1: D1Database\)/)
    expect(client).toMatch(/drizzle\(d1, \{ schema \}\)/)
    expect(client).toMatch(/\.\.\.tables, \.\.\.relations/)
  })
})

describe('the runners', () => {
  it('shares the splitter: setup.ts defines none of its own, and the shared one imports nothing', () => {
    const setup = text('test/integration/setup.ts')
    expect(setup).toMatch(/import \{ splitSql \} from '\.\.\/shared\/splitSql'/)
    expect(setup).not.toMatch(/function splitSql/)
    expect(setup).toMatch(/export \{ splitSql \}/)
    const shared = text('test/shared/splitSql.ts').replace(/^\s*(?:\/\/|\*|\/\*).*$/gm, '')
    expect(shared).not.toMatch(/^import\b/m)
    expect(shared).not.toMatch(/cloudflare:test|import\.meta\.glob/)
    expect(text('test/unit/helpers/sqlite.ts')).toMatch(/from '\.\.\/\.\.\/shared\/splitSql\.ts'/)
  })

  it('has no drizzle SQL or journal inside migrations/', () => {
    const inMigrations = readdirSync(join(ROOT, 'migrations'))
    expect(inMigrations.filter((f) => !/^\d{4}_[a-z0-9_]+\.sql$/.test(f))).toEqual(['README.md'])
    expect(inMigrations.some((f) => /meta|journal|snapshot/.test(f))).toBe(false)
    expect(existsSync(join(ROOT, 'migrations/meta'))).toBe(false)
  })

  it('does not change what wrangler runs: the same 52 files, one duplicate 0022 prefix, none past 0051', () => {
    const sql = readdirSync(join(ROOT, 'migrations')).filter((f) => f.endsWith('.sql')).sort()
    expect(sql).toHaveLength(52)
    expect(sql[0].startsWith('0001_')).toBe(true)
    expect(sql.filter((f) => f.startsWith('0022_'))).toHaveLength(2)
    expect(sql.at(-1)?.startsWith('0051_')).toBe(true)
  })
})

describe('the written record', () => {
  const readme = text('migrations/README.md')
  const status = text('REDESIGN_STATUS.md')

  it('migrations/README.md documents the generate flow and that triggers stay hand-written', () => {
    expect(readme).toContain('npm run db:generate -- <name>')
    expect(readme).toContain('--custom')
    expect(readme).toContain('0052')
    expect(readme).toContain('DROP TABLE')
    expect(readme).toContain('__new_')
    expect(readme).toContain('PRAGMA foreign_keys')
    expect(readme).toMatch(/Triggers\.\*\* Drizzle does not model triggers/)
    expect(readme).toMatch(/Do not run `drizzle-kit pull` again/)
  })

  it('REDESIGN_STATUS.md has the K4 row and the output of drizzle-kit generate', () => {
    expect(status).toMatch(/^\| K4 \| Drizzle for schema and queries \| 6 \|/m)
    expect(status).toContain('No schema changes, nothing to migrate')
    expect(status).toContain('### Step 6: Drizzle schema and migration generator')
    expect(status).toContain('Drizzle baseline (step 6)')
  })

  it('names nobody but the project in the new files', () => {
    const files = [
      'functions/db/schema.ts', 'functions/db/relations.ts', 'functions/db/client.ts', 'drizzle.config.ts',
      'scripts/db/generate.ts', 'scripts/db/build-local-sqlite.ts', 'test/shared/splitSql.ts', 'migrations/README.md',
      ...readdirSync(join(ROOT, 'test/unit/fixtures/drizzle-sql')).map((f) => `test/unit/fixtures/drizzle-sql/${f}`),
    ]
    for (const f of files) expect(text(f), f).not.toMatch(/\b(?:claude|anthropic|chatgpt|openai|copilot|AI-generated|language model|LLM)\b/i)
  })
})
