// test/unit/move-files.test.ts
//
// scripts/move-files.ts and scripts/verify-move.ts on a small fixture tree in
// a temporary git repository: relative and '@/' specifiers, export-from,
// dynamic import(), typeof import(), vi.mock and vi.doMock, ?raw imports of
// a code file and of a Markdown file, a specifier with .js written for a .ts
// file, a folder imported for its index file, a folder moved whole, and a
// moved file importing files that stay. Comments and other strings that
// name a moved file are left alone by the mover. A specifier that cannot be
// resolved stops the dry run and the real run with nothing written. The
// committed map for the server helpers is checked for what it may move.
import { afterAll, describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { findSpecifiers } from '../../scripts/move-files'
import { compareFile, mentionPairs, replaceMentions } from '../../scripts/verify-move'

const ROOT = join(__dirname, '../..')
const work = mkdtempSync(join(tmpdir(), 'move-files-'))
afterAll(() => rmSync(work, { recursive: true, force: true }))

const cleanEnv = () => {
  const env = { ...process.env }
  delete env.GIT_DIR
  delete env.GIT_WORK_TREE
  delete env.GIT_INDEX_FILE
  return env
}

const git = (cwd: string, ...args: string[]) => {
  const r = spawnSync('git', ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null', ...args], { cwd, encoding: 'utf8', env: cleanEnv() })
  if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`)
  return r.stdout
}

const script = (name: string, ...args: string[]) =>
  spawnSync(process.execPath, ['--no-warnings', '--experimental-strip-types', `scripts/${name}.ts`, ...args], { cwd: ROOT, encoding: 'utf8', env: cleanEnv() })

const FILES: Record<string, string> = {
  'tsconfig.app.json': JSON.stringify({
    compilerOptions: { baseUrl: '.', paths: { '@/*': ['./src/*'] }, moduleResolution: 'bundler', allowImportingTsExtensions: true, noEmit: true },
    include: ['src'],
  }),
  'functions/types.ts': 'export interface Env { DB: unknown }\n',
  'functions/utils/sectionRules.ts': 'export const rules = 1\n',
  'functions/utils/prizes.ts': [
    '// functions/utils/prizes.ts',
    "import type { Env } from '../types'",
    "import { rules } from './sectionRules'",
    'export const prize = (e?: Env) => rules + (e ? 1 : 0)',
    '',
  ].join('\n'),
  'functions/utils/notes.md': '# Notes\n',
  'functions/utils/swiss/engine.ts': 'export const pair = () => 1\n',
  'functions/utils/swiss/tiebreaks.ts': "import { pair } from './engine'\nexport const tb = pair\n",
  'functions/utils/swiss/index.ts': "export * from './engine'\n",
  'functions/utils/auth.ts': [
    "import { prize } from './prizes'",
    "export { tb } from './swiss/tiebreaks'",
    "export * from './swiss'",
    'export async function later() {',
    "  const m = await import('./prizes')",
    '  return m.prize === prize',
    '}',
    '// see ./prizes and functions/utils/prizes.ts for the rules',
    "export const NAME = 'functions/utils/prizes.ts'",
    '',
  ].join('\n'),
  'functions/api/a.ts': [
    "import { prize } from '../utils/prizes.ts'",
    "import notes from '../utils/notes.md?raw'",
    "import source from '../utils/prizes.ts?raw'",
    "import type { tb } from '../utils/swiss/tiebreaks.js'",
    "import { Hono } from 'hono'",
    'export const all: unknown[] = [prize, notes, source, Hono]',
    'export type T = typeof tb',
    '',
  ].join('\n'),
  'src/lib/old.ts': 'export const x = 1\n',
  'src/pages/p.ts': "import { x } from '@/lib/old'\nexport const y = x\n",
  'test/unit/z.test.ts': [
    "import { vi } from 'vitest'",
    "import { prize } from '../../functions/utils/prizes'",
    "vi.mock('../../functions/utils/prizes', () => ({ prize: () => 0 }))",
    "vi.doMock('../../functions/utils/swiss/engine')",
    "type P = typeof import('../../functions/utils/prizes')",
    "export const z: P['prize'] = prize",
    '',
  ].join('\n'),
}

const MAP = {
  'functions/utils/prizes.ts': 'functions/utils/events/prizes.ts',
  'functions/utils/notes.md': 'functions/utils/events/notes.md',
  'functions/utils/swiss': 'functions/utils/live/swiss',
  'src/lib/old.ts': 'src/areas/events/old.ts',
}

/** Writes the fixture (with `extra` files laid over it) into a fresh repository with one commit. */
function fixture(name: string, extra: Record<string, string> = {}): { dir: string; map: string } {
  const dir = join(work, name)
  for (const [rel, text] of Object.entries({ ...FILES, ...extra })) {
    mkdirSync(dirname(join(dir, rel)), { recursive: true })
    writeFileSync(join(dir, rel), text)
  }
  git(dir, 'init', '-q')
  git(dir, 'add', '-A')
  git(dir, 'commit', '-qm', 'fixture')
  const map = join(work, `${name}.json`)
  writeFileSync(map, JSON.stringify(MAP))
  return { dir, map }
}

const read = (dir: string, rel: string) => readFileSync(join(dir, rel), 'utf8')

describe('scripts/move-files.ts on a fixture tree', () => {
  const { dir, map } = fixture('clean')

  it('prints the plan on --dry-run and writes nothing', () => {
    const r = script('move-files', map, '--dry-run', '--root', dir)
    expect(r.stderr).toBe('')
    expect(r.status).toBe(0)
    expect(r.stdout).toContain('Plan (dry run, nothing written): 4 moves (6 files)')
    expect(r.stdout).toContain("1: './prizes' -> './events/prizes'")
    expect(r.stdout).toContain('Specifiers that could not be resolved: 0')
    expect(git(dir, 'status', '--porcelain')).toBe('')
    expect(existsSync(join(dir, 'functions/utils/prizes.ts'))).toBe(true)
  })

  it('moves the files with git mv and rewrites every kind of specifier', () => {
    const r = script('move-files', map, '--root', dir)
    expect(r.stderr).toBe('')
    expect(r.status).toBe(0)

    expect(existsSync(join(dir, 'functions/utils/prizes.ts'))).toBe(false)
    expect(existsSync(join(dir, 'functions/utils/swiss'))).toBe(false)
    const staged = git(dir, 'diff', '--cached', '-M', '--name-status')
    expect(staged).toContain('functions/utils/prizes.ts\tfunctions/utils/events/prizes.ts')
    expect(staged).toContain('functions/utils/notes.md\tfunctions/utils/events/notes.md')
    expect(staged).toContain('functions/utils/swiss/engine.ts\tfunctions/utils/live/swiss/engine.ts')
    expect(staged).toContain('src/lib/old.ts\tsrc/areas/events/old.ts')

    // A moved file's imports of files that stay, its comments untouched.
    expect(read(dir, 'functions/utils/events/prizes.ts')).toBe([
      '// functions/utils/prizes.ts',
      "import type { Env } from '../../types'",
      "import { rules } from '../sectionRules'",
      'export const prize = (e?: Env) => rules + (e ? 1 : 0)',
      '',
    ].join('\n'))
    // Static, export-from, a folder's index, dynamic; comments and strings left alone.
    expect(read(dir, 'functions/utils/auth.ts')).toBe([
      "import { prize } from './events/prizes'",
      "export { tb } from './live/swiss/tiebreaks'",
      "export * from './live/swiss'",
      'export async function later() {',
      "  const m = await import('./events/prizes')",
      '  return m.prize === prize',
      '}',
      '// see ./prizes and functions/utils/prizes.ts for the rules',
      "export const NAME = 'functions/utils/prizes.ts'",
      '',
    ].join('\n'))
    // The extension as written, ?raw on code and on Markdown, .js for .ts; packages untouched.
    expect(read(dir, 'functions/api/a.ts')).toBe([
      "import { prize } from '../utils/events/prizes.ts'",
      "import notes from '../utils/events/notes.md?raw'",
      "import source from '../utils/events/prizes.ts?raw'",
      "import type { tb } from '../utils/live/swiss/tiebreaks.js'",
      "import { Hono } from 'hono'",
      'export const all: unknown[] = [prize, notes, source, Hono]',
      'export type T = typeof tb',
      '',
    ].join('\n'))
    // The alias stays an alias.
    expect(read(dir, 'src/pages/p.ts')).toBe("import { x } from '@/areas/events/old'\nexport const y = x\n")
    // vi.mock, vi.doMock and typeof import().
    expect(read(dir, 'test/unit/z.test.ts')).toBe([
      "import { vi } from 'vitest'",
      "import { prize } from '../../functions/utils/events/prizes'",
      "vi.mock('../../functions/utils/events/prizes', () => ({ prize: () => 0 }))",
      "vi.doMock('../../functions/utils/live/swiss/engine')",
      "type P = typeof import('../../functions/utils/events/prizes')",
      "export const z: P['prize'] = prize",
      '',
    ].join('\n'))
    // Files that moved together keep their sibling imports.
    expect(read(dir, 'functions/utils/live/swiss/tiebreaks.ts')).toBe(FILES['functions/utils/swiss/tiebreaks.ts'])
  })

  it('verify-move passes the result, with a path mention in a comment', () => {
    const header = read(dir, 'functions/utils/events/prizes.ts').replace('// functions/utils/prizes.ts', '// functions/utils/events/prizes.ts')
    writeFileSync(join(dir, 'functions/utils/events/prizes.ts'), header)
    const r = script('verify-move', map, '--root', dir)
    expect(r.stderr).toBe('')
    expect(r.stdout).toContain('Renamed: 6 files')
    expect(r.stdout).toContain("[specifier] import { rules } from '../sectionRules'")
    expect(r.stdout).toContain('[path] // functions/utils/events/prizes.ts')
    expect(r.stdout).toContain('The move is renames plus specifier and path-mention lines only.')
    expect(r.status).toBe(0)
  })

  it('verify-move fails on any other change, in a moved file or elsewhere', () => {
    const moved = 'functions/utils/events/prizes.ts'
    const before = read(dir, moved)
    writeFileSync(join(dir, moved), before.replace('rules + (e ? 1 : 0)', 'rules + (e ? 2 : 0)'))
    let r = script('verify-move', map, '--root', dir)
    expect(r.status).toBe(1)
    expect(r.stdout).toContain('FAIL line 4 changed beyond a specifier or a moved path')
    writeFileSync(join(dir, moved), before)

    const other = 'functions/types.ts'
    writeFileSync(join(dir, other), 'export interface Env { DB: string }\n')
    r = script('verify-move', map, '--root', dir)
    expect(r.status).toBe(1)
    expect(r.stdout).toContain(`  ${other}\n    FAIL line 1`)
    r = script('verify-move', map, '--root', dir, '--ignore', other)
    expect(r.status).toBe(0)
    expect(r.stdout).toContain(`Left out with --ignore: ${other}`)
  })
})

describe('a specifier that cannot be resolved', () => {
  const { dir, map } = fixture('unresolved', {
    'functions/utils/auth.ts': `${FILES['functions/utils/auth.ts']}import { gone } from './missing'\nexport const g = gone\n`,
  })

  it('fails the dry run, names the specifier and writes nothing', () => {
    const r = script('move-files', map, '--dry-run', '--root', dir)
    expect(r.status).toBe(1)
    expect(r.stdout).toContain("functions/utils/auth.ts:10 './missing' cannot be resolved")
    expect(r.stderr).toContain('1 specifier(s) could not be resolved. Nothing was moved or written.')
    expect(git(dir, 'status', '--porcelain')).toBe('')
  })

  it('stops the real run the same way', () => {
    const r = script('move-files', map, '--root', dir)
    expect(r.status).toBe(1)
    expect(git(dir, 'status', '--porcelain')).toBe('')
    expect(read(dir, 'functions/utils/auth.ts')).toContain("import { prize } from './prizes'")
  })
})

describe('the pieces', () => {
  it('finds specifiers in code only, never in comments or other strings', () => {
    const source = [
      "// import { a } from './commented'",
      "const s = 'functions/utils/prizes'",
      "import a from './a'",
      "export { b } from './b'",
      "const c = await import('./c')",
      "vi.mock('./d')",
      "vi.doMock('./e', () => ({}))",
      "const f = require('./f')",
      "type G = typeof import('./g')",
      "const h = import(name)",
    ].join('\n')
    expect(findSpecifiers('x.ts', source).map((s) => [s.text, s.kind, s.line])).toEqual([
      ['./a', 'import', 2],
      ['./b', 'export', 3],
      ['./c', 'dynamic', 4],
      ['./d', 'mock', 5],
      ['./e', 'mock', 6],
      ['./f', 'require', 7],
      ['./g', 'type', 8],
    ])
  })

  it('accepts a moved path in prose only when it is the moved path, whole', () => {
    const pairs = mentionPairs([{ from: 'functions/utils/swiss', to: 'functions/utils/live/swiss' }], [
      { from: 'functions/utils/swiss/engine.ts', to: 'functions/utils/live/swiss/engine.ts' },
    ])
    expect(replaceMentions('// (utils/swiss/engine): rules', pairs)).toBe('// (utils/live/swiss/engine): rules')
    expect(replaceMentions("'functions/utils/swiss/**/*.test.ts',", pairs)).toBe("'functions/utils/live/swiss/**/*.test.ts',")
    expect(replaceMentions('// functions/utils/swissknife.ts', pairs)).toBe('// functions/utils/swissknife.ts')
    const check = compareFile('a.ts', "import x from './a'\nconst n = 1\n", 'a.ts', "import x from './b'\nconst n = 2\n", pairs)
    expect(check.changes.map((c) => c.kind)).toEqual(['specifier'])
    expect(check.failures).toHaveLength(1)
    expect(compareFile('a.ts', 'a\n', 'a.ts', 'a\nb\n', pairs).failures).toEqual(['the line count changed (2 to 3)'])
  })
})

describe('scripts/moves/server-areas.json', () => {
  const map = JSON.parse(readFileSync(join(ROOT, 'scripts/moves/server-areas.json'), 'utf8')) as Record<string, string>
  const AREAS = ['events', 'registration', 'membership', 'live', 'admin']

  it('moves server helpers into area folders under functions/utils only', () => {
    for (const [from, to] of Object.entries(map)) {
      expect(from.startsWith('functions/utils/')).toBe(true)
      expect(AREAS).toContain(to.split('/')[2])
      expect(to.split('/').slice(0, 2)).toEqual(['functions', 'utils'])
    }
  })

  it('leaves the platform files, the shared-rule re-exports and the scanner code where they are', () => {
    const stay = ['auth', 'response', 'json', 'csv', 'email', 'emailLayout', 'site', 'supabase', 'stripe', 'uscf', 'posts', 'pricing', 'sectionRules', 'regions', 'family', 'time']
    for (const name of stay) expect(map).not.toHaveProperty(`functions/utils/${name}.ts`)
    for (const from of Object.keys(map)) expect(from.startsWith('functions/utils/scan')).toBe(false)
  })
})
