// test/unit/club-seed-sheet.test.ts
//
// scripts/db/club-seed-sheet.ts, the check sheet of today's clubs as
// migration 0067 seeds them, run on a database built from the migrations by
// the repository's own script, scripts/db/build-local-sqlite.ts:
// - it lists all 25 clubs A to Z, each with its address, old address, region,
//   statement, About text, places and told month, and the figures in one line;
// - it opens the file read-only and leaves it as it was;
// - it refuses in words anything that names a remote database, a second
//   argument or an option, a file that is not there and a database the seed
//   has not run on;
// - run as a process, it prints the sheet, or the refusal with exit code 1;
// - it reaches no network and no wrangler command, and npm run
//   db:club-seed-sheet builds the local database before it reads it.
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildLocalSqlite } from '../../scripts/db/build-local-sqlite'
import { clubSeedSheet, REMOTE_REFUSAL, sheetRefusal } from '../../scripts/db/club-seed-sheet'
import { migrationFiles, openMigratedDb } from './helpers/sqlite'

const ROOT = join(__dirname, '../..')
const SCRIPT = 'scripts/db/club-seed-sheet.ts'
// Each build applies every migration, about a second each; the cases get room, as the repository's other long cases do.
const BUILD_TIME = 60_000

let dir = ''
let built = ''
let sheet = ''
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'club-seed-sheet-'))
  built = join(dir, 'introspect.sqlite')
  buildLocalSqlite(built)
  sheet = clubSeedSheet(built)
}, BUILD_TIME)
afterAll(() => {
  rmSync(dir, { recursive: true, force: true })
})

const entriesOf = (text: string) => text.split(/\n(?=\d+\. )/).slice(1).map((e) => e.trimEnd())
const hash = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex')

describe('the check sheet', () => {
  it('lists all 25 clubs A to Z, with the figures in one line', () => {
    const entries = entriesOf(sheet)
    expect(entries).toHaveLength(25)
    const names = entries.map((e) => /^\d+\. (.+) \(id [a-z0-9-]+\)$/m.exec(e)?.[1] ?? '')
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'en')))
    expect(names[0]).toBe('Baton Rouge Chess Club')
    expect(names.at(-1)).toBe('Strategic Thoughts NOLA')
    expect(entries.map((e) => Number(/^(\d+)\. /.exec(e)?.[1]))).toEqual(Array.from({ length: 25 }, (_, i) => i + 1))
    expect(sheet).toContain('25 clubs, 25 addresses, 6 old addresses, 18 statements of how a club meets, 7 About texts, 26 places.')
    expect(sheet.startsWith('Club check sheet: the clubs as migration 0067 seeds them\n')).toBe(true)
  }, BUILD_TIME)

  it('gives each club its address, old address, region, statement, About, places and told month, as the database holds them', () => {
    const db = openMigratedDb()
    const rows = db.prepare('SELECT id, name, region, slug, how_we_meet_text, about_text FROM clubs ORDER BY name').all() as Array<Record<string, string | null>>
    expect(rows).toHaveLength(25)
    for (const row of rows) {
      const entry = entriesOf(sheet).find((e) => e.includes(`(id ${row.id})\n`)) ?? ''
      expect(entry, String(row.id)).not.toBe('')
      expect(entry, String(row.id)).toContain(`   Address: /clubs/${row.slug}\n`)
      expect(entry, String(row.id)).toContain(`Region: ${row.region}\n`)
      expect(entry, String(row.id)).toContain(`   How we meet: ${row.how_we_meet_text ?? 'None'}\n`)
      expect(entry, String(row.id)).toContain(`   About: ${row.about_text ?? 'None'}\n`)
      expect(entry, String(row.id)).toMatch(/\n {3}Place 1: .+, pin at -?\d+\.\d+, -?\d+\.\d+/)
      expect(entry, String(row.id)).toMatch(/\n {3}Told: As told to LCA, (?:January|February|March|April|May|June|July|August|September|October|November|December) \d{4}$/)
    }
    const entry = (id: string) => entriesOf(sheet).find((e) => e.includes(`(id ${id})\n`)) ?? ''
    expect(entry('slidell')).toContain('   Old address: /clubs/slidell\n')
    expect(entry('houma-chess-club')).toContain('   Old address: None\n')
    expect(entry('shreveport')).toContain('   Place 1: Gamers XP, Shreveport, LA, pin at 32.486477, -93.7077442\n')
    expect(entry('shreveport')).toContain('   Place 2: Pierre Bossier Mall, Shreveport, LA, pin at 32.5264466, -93.70758\n')
    expect(entry('knight-light-chess')).toContain(', the same pin as Strategic Thoughts NOLA\n')
    expect(entry('strategic-thoughts-nola')).toContain(', the same pin as Knight Light Chess\n')
  })

  it('opens the database read-only and leaves the file as it was', () => {
    const was = { hash: hash(built), mtime: statSync(built).mtimeMs }
    expect(clubSeedSheet(built)).toBe(sheet)
    expect({ hash: hash(built), mtime: statSync(built).mtimeMs }).toEqual(was)
    expect(readFileSync(join(ROOT, SCRIPT), 'utf8')).toContain('new DatabaseSync(path, { readOnly: true })')
  })

  it('refuses in words anything that names a remote database, a second argument or an option', () => {
    for (const args of [['--remote'], ['--env', 'preview'], ['--preview'], ['lca-db'], ['lca-db-preview'], ['https://example.org/db'], ['wrangler'], [built, '--remote']]) {
      expect(sheetRefusal(args), args.join(' ')).toBe(REMOTE_REFUSAL)
    }
    expect(REMOTE_REFUSAL).toContain('never reads a remote database')
    expect(sheetRefusal([built, built])).toMatch(/one argument at most/)
    expect(sheetRefusal(['--verbose'])).toMatch(/takes no options/)
    expect(sheetRefusal([])).toBeNull()
    expect(sheetRefusal([built])).toBeNull()
  })

  it('says in words when there is no database, or the seed has not run on it', () => {
    expect(() => clubSeedSheet(join(dir, 'missing.sqlite'))).toThrow(/no local database at .*Run npm run db:local-sqlite first/)
    const before = join(dir, 'before-seed.sqlite')
    openMigratedDb({ path: before, files: migrationFiles().filter((f) => f < '0067') }).close()
    expect(() => clubSeedSheet(before)).toThrow(/migration 0067 has not run on it/)
  }, BUILD_TIME)

  it('run as a process, prints the sheet, or the refusal with exit code 1', () => {
    const node = (...args: string[]) => spawnSync(process.execPath, ['--no-warnings', '--experimental-strip-types', SCRIPT, ...args], { cwd: ROOT, encoding: 'utf8' })
    const ok = node(built)
    expect(ok.status).toBe(0)
    expect(ok.stdout).toBe(sheet)
    const refused = node('--remote')
    expect(refused.status).toBe(1)
    expect(refused.stdout).toBe('')
    expect(refused.stderr.trim()).toBe(REMOTE_REFUSAL)
    const missing = node(join(dir, 'missing.sqlite'))
    expect(missing.status).toBe(1)
    expect(missing.stderr).toMatch(/no local database/)
  }, BUILD_TIME)

  it('reaches no network and no wrangler command, and its npm script builds the local database first', () => {
    const code = readFileSync(join(ROOT, SCRIPT), 'utf8')
    const imports = [...code.matchAll(/^import .* from '([^']+)'/gm)].map((m) => m[1])
    expect(imports).toEqual(['node:fs', 'node:path', 'node:sqlite', 'node:url', './build-local-sqlite.ts'])
    expect(code).not.toMatch(/\bfetch\(|child_process|process\.env/)
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { scripts: Record<string, string> }
    expect(pkg.scripts['db:club-seed-sheet']).toBe(`npm run db:local-sqlite && node --no-warnings --experimental-strip-types ${SCRIPT}`)
    expect(pkg.scripts['db:club-seed-sheet']).not.toMatch(/wrangler|--remote/)
  })
})
