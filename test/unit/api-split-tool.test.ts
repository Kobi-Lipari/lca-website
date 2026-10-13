// test/unit/api-split-tool.test.ts
//
// scripts/split-api.ts (K3c) on a small unsplit client in a temporary
// folder, and on the real tree:
//
// - the plan moves every declaration byte for byte, with the comments above
//   it, keeps their order, and writes the imports each module needs: the
//   http helpers, the supabase client, a type another area owns (type-only)
//   and the original type import that goes with the scan call
// - a private helper used by one area goes with it; one used by several
//   areas must be mapped to http, and is then exported by name at the end
// - the run stops, with nothing written, for an export the map does not
//   name, a map entry the file lacks, a target that is not an area, a module
//   left empty, areas that would import each other, http importing an area,
//   a statement kind the script does not move, and a comment it would strand
// - --dry-run prints the per-area counts and writes nothing; the real run
//   writes the nine modules and the barrel, and refuses to overwrite
// - --check passes on its own output and, with --compare against the commit
//   before, proves the text is the same; it fails for a name missing from the
//   barrel, a name in two modules, a module importing the barrel, an index
//   file re-exporting an api module, and an edited declaration
// - --check passes on the committed map and the real tree
import { afterAll, describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { AREAS, checkSplit, parseApi, planSplit, statementText } from '../../scripts/split-api'

const ROOT = join(__dirname, '../..')
const work = mkdtempSync(join(tmpdir(), 'split-api-'))
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

const tool = (args: string[]) =>
  spawnSync(process.execPath, ['--no-warnings', '--experimental-strip-types', 'scripts/split-api.ts', ...args], { cwd: ROOT, encoding: 'utf8', env: cleanEnv() })

const NAMES = {
  events: 'Event',
  registration: 'Entry',
  households: 'Child',
  live: 'Game',
  membership: 'Member',
  clubs: 'Club',
  admin: 'Ticket',
  governance: 'Seat',
} as const

/** An unsplit client: header, imports, the http helpers, and one type and one call per area. */
function unsplit(): string {
  const parts = [
    '// src/lib/api.ts',
    '',
    "import { supabase } from '@/lib/supabase'",
    '// Only the scan call uses this.',
    "import type { RawScan } from '@/lib/scanner/types'",
    '',
    'async function authHeaders(): Promise<HeadersInit> {',
    '  const { data } = await supabase.auth.getSession()',
    "  return data.session ? { Authorization: 'Bearer ' + data.session.access_token } : {}",
    '}',
    '',
    '/** Carries the HTTP status. */',
    'export class ApiError extends Error {',
    '  constructor(message: string, readonly status: number) {',
    '    super(message)',
    '  }',
    '}',
    '',
    'async function handleResponse<T>(response: Response): Promise<T> {',
    '  if (!response.ok) throw new ApiError(`Request failed (${response.status})`, response.status)',
    '  return (await response.json()) as T',
    '}',
    '',
  ]
  for (const [area, n] of Object.entries(NAMES)) {
    parts.push(
      `// ── ${area} ─────`,
      '',
      `/** A ${n.toLowerCase()}. */`,
      `export interface Api${n} {`,
      '  id: string',
      '\tnote?: string   ',
      '}',
      '',
      `export async function get${n}s(): Promise<Api${n}[]> {`,
      `  const response = await fetch('/api/${area}', { headers: await authHeaders() })`,
      '  return handleResponse(response)',
      '}',
      '',
    )
  }
  parts.push(
    '/** Send a photo. */',
    'export async function scan(photo: Blob): Promise<{ scan: RawScan }> {',
    "  const response = await fetch('/api/scan', { method: 'POST', headers: await authHeaders(), body: photo })",
    '  return handleResponse(response)',
    '}',
    '',
    '// Used only by the member calls.',
    'function memberQuery(o: { who: string }): string {',
    '  return `who=${o.who}`',
    '}',
    '',
    'export async function exportMembers(o: { who: string }): Promise<string> {',
    '  const response = await fetch(`/api/members/export?${memberQuery(o)}`, { headers: await authHeaders() })',
    '  return response.text()',
    '}',
    '',
    '// A club type built on a member (a cross-area type).',
    'export interface ApiClubMember extends ApiMember {',
    '  club: string',
    '}',
    '',
  )
  return parts.join('\n')
}

/** The map with one name left out. */
const without = (name: string): Record<string, string> => Object.fromEntries(Object.entries(MAP).filter(([n]) => n !== name))

const MAP: Record<string, string> = {
  authHeaders: 'http',
  ApiError: 'http',
  handleResponse: 'http',
  scan: 'live',
  memberQuery: 'membership',
  exportMembers: 'membership',
  ApiClubMember: 'clubs',
}
for (const [area, n] of Object.entries(NAMES)) {
  MAP[`Api${n}`] = area
  MAP[`get${n}s`] = area
}

const read = (dir: string, rel: string) => readFileSync(join(dir, rel), 'utf8')

/** Writes the files into a fresh repository with one commit and returns its folder. */
function repo(name: string, files: Record<string, string>): string {
  const dir = join(work, name)
  for (const [rel, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, rel)), { recursive: true })
    writeFileSync(join(dir, rel), text)
  }
  git(dir, 'init', '-q')
  git(dir, 'add', '-A')
  git(dir, 'commit', '-qm', 'fixture')
  return dir
}

const SNAPSHOT = Object.keys(MAP).filter((n) => !['authHeaders', 'handleResponse', 'memberQuery'].includes(n))

function fixtureFiles(extra: Record<string, string> = {}): Record<string, string> {
  const files: Record<string, string> = {
    'src/lib/api.ts': unsplit(),
    'scripts/moves/api-split.json': JSON.stringify(MAP),
    'test/unit/fixtures/api-exports.json': JSON.stringify(SNAPSHOT),
    'src/lib/supabase.ts': 'export const supabase = { auth: { getSession: async () => ({ data: { session: null as null | { access_token: string } } }) } }\n',
    'src/lib/scanner/types.ts': 'export interface RawScan { rows: string[] }\n',
  }
  for (const a of AREAS) files[`src/areas/${a}/index.ts`] = `export const ${a} = true\n`
  return { ...files, ...extra }
}

describe('the plan for an unsplit client', () => {
  const plan = planSplit(unsplit(), MAP)
  const byTarget = Object.fromEntries(plan.modules.map((m) => [m.target, m]))

  it('has no problems and puts each declaration in the module the map names', () => {
    expect(plan.problems).toEqual([])
    expect(plan.modules.map((m) => m.target)).toEqual(['http', ...AREAS])
    for (const m of plan.modules) {
      expect(m.declarations.map((d) => d.name).sort(), m.path).toEqual(Object.entries(MAP).filter(([, t]) => t === m.target).map(([n]) => n).sort())
    }
  })

  it('moves every declaration byte for byte, with the comment above it', () => {
    const before = parseApi(unsplit())
    for (const d of before.declarations) {
      const m = byTarget[MAP[d.name]]
      expect(m.text, d.name).toContain(d.text)
    }
    // Trailing spaces, a tab and the doc comments are inside the moved text, not normalised.
    expect(byTarget.events.text).toContain('/** A event. */\nexport interface ApiEvent {\n  id: string\n\tnote?: string   \n}')
    expect(byTarget.http.text).toContain('/** Carries the HTTP status. */\nexport class ApiError')
    expect(byTarget.membership.text).toContain('// Used only by the member calls.\nfunction memberQuery')
    expect(byTarget.events.text).toContain('// ── events ─────\n\n/** A event. */')
  })

  it('keeps the original order inside a module', () => {
    const names = byTarget.membership.declarations.map((d) => d.name)
    expect(names).toEqual(['ApiMember', 'getMembers', 'memberQuery', 'exportMembers'])
    const text = byTarget.membership.text
    expect(text.indexOf('function memberQuery')).toBeLessThan(text.indexOf('function exportMembers'))
  })

  it('writes the imports each module needs and no others', () => {
    expect(byTarget.http.importLines).toEqual(["import { supabase } from '@/lib/supabase'"])
    expect(byTarget.events.importLines).toEqual(["import { authHeaders, handleResponse } from '@/lib/http'"])
    expect(byTarget.live.importLines).toEqual([
      '// Only the scan call uses this.',
      "import type { RawScan } from '@/lib/scanner/types'",
      "import { authHeaders, handleResponse } from '@/lib/http'",
    ])
    expect(byTarget.clubs.importLines).toEqual([
      "import { authHeaders, handleResponse } from '@/lib/http'",
      "import type { ApiMember } from '@/areas/membership/api'",
    ])
    for (const m of plan.modules) expect(m.importLines.join('\n'), m.path).not.toContain('@/lib/api')
    expect(byTarget.events.text).not.toContain('supabase')
  })

  it('exports an http helper the areas use by name at the end, leaving its text alone', () => {
    expect(byTarget.http.exportList).toEqual(['authHeaders', 'handleResponse'])
    expect(byTarget.http.text.trimEnd().endsWith('export { authHeaders, handleResponse }')).toBe(true)
    expect(byTarget.http.text).toContain('\nasync function authHeaders(): Promise<HeadersInit> {')
    // A helper used inside one area stays private.
    expect(byTarget.membership.exportList).toEqual([])
    expect(byTarget.membership.text).not.toMatch(/export\s+(async\s+)?function memberQuery/)
  })

  it('writes the barrel: ApiError by name, then export * from each area, and not the helpers', () => {
    const lines = plan.barrel.split('\n').filter((l) => l.startsWith('export'))
    expect(lines).toEqual(["export { ApiError } from '@/lib/http'", ...AREAS.map((a) => `export * from '@/areas/${a}/api'`)])
  })

  it('gives every module a header naming its own path', () => {
    for (const m of plan.modules) expect(m.text.startsWith(`// ${m.path}\n//\n`), m.path).toBe(true)
  })

  it('statementText leaves out the blank lines above a statement and keeps its comments', () => {
    const sf = parseApi(unsplit()).declarations.find((d) => d.name === 'ApiError')!
    expect(sf.text.startsWith('/** Carries the HTTP status. */')).toBe(true)
    expect(typeof statementText).toBe('function')
  })
})

describe('what stops the plan', () => {
  const reasons = (api: string, map: Record<string, string>) => planSplit(api, map).problems.map((p) => p.reason)

  it('an export the map does not name', () => {
    const map = without('getEvents')
    expect(reasons(unsplit(), map).filter((r) => r.includes('getEvents'))).toEqual(['export getEvents is not named in the map'])
  })

  it('a private helper the map does not name', () => {
    const map = without('memberQuery')
    expect(reasons(unsplit(), map)).toContain('private helper memberQuery is not named in the map')
  })

  it('a map entry the file lacks', () => {
    expect(reasons(unsplit(), { ...MAP, ghost: 'events' })).toContain('ghost is in the map but not declared in src/lib/api.ts')
  })

  it('a target that is not http or an area', () => {
    expect(reasons(unsplit(), { ...MAP, getEvents: 'news' }).some((r) => r.includes("'news'"))).toBe(true)
  })

  it('a module the map leaves empty', () => {
    const map = { ...MAP, ApiChild: 'events', getChilds: 'events' }
    expect(planSplit(unsplit(), map).problems).toContainEqual({ where: 'src/areas/households/api.ts', reason: 'the map gives this module nothing' })
  })

  it('a private helper one area owns but another uses', () => {
    const api = unsplit().replace("return `who=${o.who}`", "return `who=${o.who}`\n}\nexport function twin(o: { who: string }): string {\n  return memberQuery(o)")
    const map = { ...MAP, twin: 'clubs' }
    expect(reasons(api, map).some((r) => r.includes('private helper memberQuery (membership) is used by twin (clubs); map it to http'))).toBe(true)
  })

  it('areas that would import each other', () => {
    const api = unsplit().replace('export interface ApiMember {', 'export interface ApiMember extends ApiClub {')
    expect(reasons(api, MAP).some((r) => r.startsWith('the areas would import each other in a cycle: '))).toBe(true)
  })

  it('http importing an area', () => {
    const api = unsplit().replace("if (!response.ok)", "if (!response.ok && ({} as ApiEvent))")
    expect(reasons(api, MAP).some((r) => r.includes('would make http.ts import ApiEvent from the events area'))).toBe(true)
  })

  it('a statement kind it does not move', () => {
    const api = unsplit() + "\nexport const LIMIT = 5\n"
    expect(reasons(api, MAP).some((r) => r.includes('is not a statement this script moves'))).toBe(true)
  })

  it('a default export, an unnamed declaration and a redeclared name', () => {
    expect(reasons(unsplit() + '\nexport default function () {}\n', MAP).some((r) => r.includes('unnamed') || r.includes('default export'))).toBe(true)
    expect(reasons(unsplit() + '\nexport interface ApiEvent { more: string }\n', MAP).some((r) => r.includes('ApiEvent is declared more than once'))).toBe(true)
  })

  it('a comment it would strand: on the same line after a statement, or at the end of the file', () => {
    expect(reasons(unsplit().replace('\tnote?: string   \n}', '\tnote?: string   \n} // trailing'), MAP).some((r) => r.includes('comment after it on the same line'))).toBe(true)
    expect(reasons(unsplit() + '\n// left over\n', MAP).some((r) => r.includes('a comment at the end of the file'))).toBe(true)
  })

  it('an import it cannot carry: default, namespace, relative, renamed', () => {
    expect(reasons(unsplit().replace("import { supabase } from '@/lib/supabase'", "import supabase from '@/lib/supabase'"), MAP).some((r) => r.includes('only named imports'))).toBe(true)
    expect(reasons(unsplit().replace("'@/lib/supabase'", "'./supabase'"), MAP).some((r) => r.includes('relative import'))).toBe(true)
    expect(reasons(unsplit().replace('{ supabase }', '{ supabase as sb }'), MAP).some((r) => r.includes('renamed import'))).toBe(true)
  })
})

describe('scripts/split-api.ts as a command', () => {
  it('--dry-run prints the counts per module and the barrel, and writes nothing', () => {
    const dir = repo('dry', fixtureFiles())
    const r = tool(['--dry-run', '--root', dir])
    expect(r.status).toBe(0)
    expect(r.stdout).toContain('Plan (dry run, nothing written): 23 declarations from src/lib/api.ts into 9 modules.')
    expect(r.stdout).toContain('src/lib/http.ts: 1 export (1 function or class, 0 types), private: authHeaders, handleResponse')
    expect(r.stdout).toContain('src/areas/membership/api.ts: 3 exports (2 functions or classes, 1 type), private: memberQuery')
    expect(r.stdout).toContain('Problems: 0')
    expect(existsSync(join(dir, 'src/lib/http.ts'))).toBe(false)
    expect(existsSync(join(dir, 'src/areas/events/api.ts'))).toBe(false)
    expect(read(dir, 'src/lib/api.ts')).toBe(unsplit())
  })

  it('--dry-run fails and names an export the map lacks and a map entry the file lacks, writing nothing', () => {
    const map = without('getClubs')
    const dir = repo('dry-bad', fixtureFiles({ 'scripts/moves/api-split.json': JSON.stringify({ ...map, ghost: 'events' }) }))
    const r = tool(['--dry-run', '--root', dir])
    expect(r.status).toBe(1)
    expect(r.stdout).toContain('export getClubs is not named in the map')
    expect(r.stdout).toContain('ghost is in the map but not declared in src/lib/api.ts')
    expect(r.stderr).toContain('Nothing was written.')
    expect(existsSync(join(dir, 'src/lib/http.ts'))).toBe(false)
    expect(read(dir, 'src/lib/api.ts')).toBe(unsplit())
  })

  it('stops for a map that is not a JSON object, a stray flag, and a file that is already split', () => {
    const dir = repo('args', fixtureFiles({ 'scripts/moves/api-split.json': '[]' }))
    const bad = tool(['--dry-run', '--root', dir])
    expect(bad.status).toBe(1)
    expect(bad.stderr).toContain('Stopped: the map cannot be used.')
    expect(tool(['--nonsense']).status).toBe(1)
    // The real tree is split already: planning it says so.
    const split = tool(['--dry-run'])
    expect(split.status).toBe(1)
    expect(split.stderr).toContain('looks split already')
  })

  describe('the real run', () => {
    const dir = repo('real', fixtureFiles())
    const run = tool(['--root', dir])

    it('writes the nine modules and the barrel', () => {
      expect(run.status, run.stderr).toBe(0)
      for (const f of ['src/lib/http.ts', ...AREAS.map((a) => `src/areas/${a}/api.ts`)]) expect(existsSync(join(dir, f)), f).toBe(true)
      expect(read(dir, 'src/lib/api.ts')).toContain("export * from '@/areas/live/api'")
      expect(read(dir, 'src/lib/api.ts')).not.toContain('async function')
    })

    it('matches the plan byte for byte', () => {
      const plan = planSplit(unsplit(), MAP)
      for (const m of plan.modules) expect(read(dir, m.path), m.path).toBe(m.text)
      expect(read(dir, 'src/lib/api.ts')).toBe(plan.barrel)
    })

    it('refuses to run again over the files it wrote', () => {
      git(dir, 'checkout', '-q', '--', 'src/lib/api.ts')
      const again = tool(['--root', dir])
      expect(again.status).toBe(1)
      expect(again.stderr).toContain('these files exist already')
      expect(again.stderr).toContain('Nothing was written.')
    })
  })
})

describe('--check on a split fixture', () => {
  /** A fresh copy of the split fixture in its own repository, the unsplit file as the commit. */
  function splitFixture(name: string): string {
    const dir = repo(name, fixtureFiles())
    const r = tool(['--root', dir])
    expect(r.status, r.stderr).toBe(0)
    return dir
  }
  const check = (dir: string, ...extra: string[]) => tool(['--check', '--root', dir, ...extra])

  it('passes, and with --compare proves every declaration equal to the commit before', () => {
    const dir = splitFixture('check-ok')
    const plain = check(dir)
    expect(plain.status, plain.stdout).toBe(0)
    expect(plain.stdout).toContain('Barrel: 20 names, snapshot 20: the same set.')
    const compared = check(dir, '--compare', 'HEAD')
    expect(compared.status, compared.stdout).toBe(0)
    expect(compared.stdout).toMatch(/Compared: 23 declarations \(\d+ characters\) byte for byte/)
    expect(compared.stdout).toContain('Problems: 0')
  })

  it('fails when a declaration was edited after the split', () => {
    const dir = splitFixture('check-edit')
    const file = join(dir, 'src/areas/events/api.ts')
    writeFileSync(file, readFileSync(file, 'utf8').replace("'/api/events'", "'/api/event'"))
    expect(check(dir).status).toBe(0)
    const r = check(dir, '--compare', 'HEAD')
    expect(r.status).toBe(1)
    expect(r.stdout).toMatch(/getEvents \(line \d+ before\) differs from its text in src\/areas\/events\/api\.ts/)
  })

  it('fails when the barrel misses a name', () => {
    const dir = splitFixture('check-barrel')
    const file = join(dir, 'src/lib/api.ts')
    writeFileSync(file, readFileSync(file, 'utf8').replace("export * from '@/areas/live/api'\n", ''))
    const r = check(dir)
    expect(r.status).toBe(1)
    expect(r.stdout).toMatch(/'@\/lib\/api' no longer exports: .*\bscan\b/)
    for (const name of ['ApiGame', 'getGames', 'scan']) expect(r.stdout).toContain(name)
  })

  it('fails when the barrel gains a name, or holds anything but export-from lines', () => {
    const dir = splitFixture('check-extra')
    const extraName = 'export interface ApiGame2 { id: string }\n'
    writeFileSync(join(dir, 'src/areas/live/api.ts'), read(dir, 'src/areas/live/api.ts') + '\n' + extraName)
    expect(check(dir).stdout).toContain("'@/lib/api' now also exports: ApiGame2")
    writeFileSync(join(dir, 'src/lib/api.ts'), read(dir, 'src/lib/api.ts') + 'export const x = 1\n')
    const r = check(dir)
    expect(r.status).toBe(1)
    expect(r.stdout).toMatch(/src\/lib\/api\.ts:\d+ is not an export-from line/)
  })

  it('fails when a name is exported by two modules', () => {
    const dir = splitFixture('check-twice')
    writeFileSync(join(dir, 'src/areas/clubs/api.ts'), read(dir, 'src/areas/clubs/api.ts') + '\nexport interface ApiEvent { id: string }\n')
    const r = check(dir)
    expect(r.status).toBe(1)
    expect(r.stdout).toContain('ApiEvent is exported by 2 modules: events, clubs')
    expect(r.stdout).toContain('re-exports ApiEvent from 2 modules')
    expect(r.stdout).toContain('declares names the map gives elsewhere or not at all: ApiEvent')
  })

  it('fails when an area module imports the barrel, by alias or by relative path', () => {
    const dir = splitFixture('check-barrel-import')
    writeFileSync(join(dir, 'src/areas/clubs/api.ts'), read(dir, 'src/areas/clubs/api.ts').replace("from '@/lib/http'", "from '@/lib/http'\nimport type { ApiEvent } from '@/lib/api'"))
    expect(check(dir).stdout).toContain("src/areas/clubs/api.ts imports '@/lib/api' (src/lib/api.ts)")
    writeFileSync(join(dir, 'src/areas/clubs/api.ts'), read(dir, 'src/areas/clubs/api.ts').replace("import type { ApiEvent } from '@/lib/api'", "import type { ApiEvent } from '../../lib/api'"))
    const r = check(dir)
    expect(r.status).toBe(1)
    expect(r.stdout).toContain("src/areas/clubs/api.ts imports '../../lib/api' (src/lib/api.ts)")
  })

  it('fails when http imports an area, or an area index re-exports its api', () => {
    const dir = splitFixture('check-http')
    writeFileSync(join(dir, 'src/lib/http.ts'), read(dir, 'src/lib/http.ts').replace("from '@/lib/supabase'", "from '@/lib/supabase'\nimport type { ApiGame } from '@/areas/live/api'"))
    expect(check(dir).stdout).toContain("src/lib/http.ts imports '@/areas/live/api' from src/areas")
    writeFileSync(join(dir, 'src/areas/events/index.ts'), "export * from './api'\n")
    const r = check(dir)
    expect(r.status).toBe(1)
    expect(r.stdout).toContain("src/areas/events/index.ts re-exports './api'")
  })

  it('fails when a module lacks a file or a name the map gives it', () => {
    const dir = splitFixture('check-missing')
    rmSync(join(dir, 'src/areas/households/api.ts'))
    const r = check(dir)
    expect(r.status).toBe(1)
    expect(r.stdout).toContain('src/areas/households/api.ts does not exist')
  })

  it('stops with a plain message when the revision cannot be read', () => {
    const dir = splitFixture('check-rev')
    const r = check(dir, '--compare', 'no-such-revision')
    expect(r.status).toBe(1)
    expect(r.stderr).toContain('cannot read src/lib/api.ts at no-such-revision')
  })

  it('fails with --compare when the old file held text outside its imports and declarations', () => {
    const dir = splitFixture('check-leftover')
    const compared = checkSplit(dir, MAP, SNAPSHOT, unsplit() + '\nsetup()\n')
    expect(compared.problems.some((p) => p.includes('the old file holds text outside its imports and declarations'))).toBe(true)
  })
})

describe('--check on the committed map and the real tree', () => {
  it('passes', () => {
    const r = tool(['--check'])
    expect(r.status, r.stdout + r.stderr).toBe(0)
    expect(r.stdout).toContain('Barrel: 182 names, snapshot 182: the same set.')
    expect(r.stdout).toContain('Problems: 0')
  })

  it('fails on the real tree when the committed map is changed to move a name', () => {
    const dir = join(work, 'real-tree')
    for (const f of ['src/lib/api.ts', 'src/lib/http.ts', 'test/unit/fixtures/api-exports.json', ...AREAS.map((a) => `src/areas/${a}/api.ts`), ...AREAS.map((a) => `src/areas/${a}/index.ts`)]) {
      mkdirSync(dirname(join(dir, f)), { recursive: true })
      cpSync(join(ROOT, f), join(dir, f))
    }
    const map = JSON.parse(readFileSync(join(ROOT, 'scripts/moves/api-split.json'), 'utf8')) as Record<string, string>
    mkdirSync(join(dir, 'scripts/moves'), { recursive: true })
    writeFileSync(join(dir, 'scripts/moves/api-split.json'), JSON.stringify({ ...map, getClubs: 'events' }))
    const r = tool(['--check', '--root', dir])
    expect(r.status).toBe(1)
    expect(r.stdout).toContain('declares names the map gives elsewhere or not at all: getClubs')
    expect(r.stdout).toContain('lacks names the map gives it: getClubs')
  })
})
