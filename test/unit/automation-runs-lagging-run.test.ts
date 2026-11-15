// test/unit/automation-runs-lagging-run.test.ts
//
// The run record and the tokens of WS09 step 13, apart from what D1 itself
// answers (test/integration/automation-runs.test.ts holds that):
// - on a real SQLite database built from migrations 0001 to 0067 alone, as
//   production would stand if the site's build reached it before the
//   migration run that adds automation_runs: the member delete, the one
//   path live with every switch off that reads the table, goes on with one
//   log line naming no member, and recordRun still runs its job and gives
//   back its answer with one log line; on a database built from every
//   migration neither writes a log line, and the member delete clears
//   seen_by and keeps the row;
// - plainDetail, the one plain line a run's detail is cut to: no address,
//   no token, no secret and no line break, at most 200 characters;
// - functions/utils/tokens.ts and functions/utils/admin/automations.ts
//   name no package, walked as test/unit/mail-worker-closure.test.ts walks
//   the daily-emails worker, so the worker can import either; and no file
//   outside the tests imports them yet, a list a later step that calls
//   them grows by its own line.
//
// The handler is called with a small D1 over node:sqlite; the admin's
// sign-in and the sign-in service's account delete are stood in for. Every
// person and address is made up.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import type { DatabaseSync, SQLInputValue } from 'node:sqlite'
import { dirname, join, relative, resolve } from 'node:path'
import ts from 'typescript'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { migrationFiles, openMigratedDb } from './helpers/sqlite'

vi.mock('../../functions/utils/auth', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../functions/utils/auth')>()
  return { ...real, requireAdmin: async () => ({ member: { id: 'example-admin', role: 'lca_admin' } }) }
})
vi.mock('../../functions/utils/supabase', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../functions/utils/supabase')>()
  return { ...real, deleteSupabaseUser: async () => false }
})

const { CLUB_REFERENCES_UNCLEARED_LOG, RUN_MARKS_UNCLEARED_LOG, onRequestDelete: memberDelete } = await import('../../functions/api/admin/members/[id]')
const { MAX_DETAIL_LENGTH, RUN_NOT_RECORDED_LOG, lastRun, plainDetail, recordRun } = await import('../../functions/utils/admin/automations')

afterEach(() => {
  vi.restoreAllMocks()
})

const ROOT = resolve(__dirname, '../..')
const TO_0067 = migrationFiles().filter((f) => f < '0068')
const ANSWER = '{"success":true,"authDeleted":false}'

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

/** A database with an admin who marked a run as seen and a member, built to 0067 alone or from every migration. */
function database(files: string[]): DatabaseSync {
  const withRuns = files.includes('0068_automation_runs.sql')
  return openMigratedDb({
    files,
    extra: `
      INSERT INTO members (id, email, full_name, role) VALUES ('player-one', 'player.one@example.org', 'Player One', 'lca_admin');
      INSERT INTO members (id, email, full_name) VALUES ('player-two', 'player.two@example.org', 'Player Two');
      ${withRuns ? `INSERT INTO automation_runs (job, outcome, finished_at, seen_at, seen_by) VALUES ('clearinghouse_sync', 'ok', '2026-11-14 18:00:00', '2026-11-14 19:00:00', 'player-one');` : ''}
    `,
  })
}

async function deleteMember(db: DatabaseSync, id: string): Promise<Response> {
  const request = new Request('https://lca-website.pages.dev/api/test', { method: 'DELETE' })
  return (memberDelete as PagesFunction<never>)({
    request, env: { DB: d1Over(db) }, params: { id }, data: {}, functionPath: '/api/test',
    waitUntil: () => {}, passThroughOnException: () => {}, next: async () => new Response(null, { status: 404 }),
  } as unknown as Parameters<PagesFunction<never>>[0])
}
const quiet = () => vi.spyOn(console, 'warn').mockImplementation(() => {})
const lines = (warn: ReturnType<typeof quiet>) => warn.mock.calls.map(([line]) => line)

describe('before migration 0068 has run', () => {
  it('has no automation_runs table, so the paths meet it missing', () => {
    const db = database(TO_0067)
    expect(TO_0067.at(-1)).toBe('0067_club_pages_seed.sql')
    expect(db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'automation_runs'`).get()).toBeUndefined()
  })

  it('deletes a member with one log line, naming no member, and clears the club tables of 0066 as before', async () => {
    const db = database(TO_0067)
    db.exec(`UPDATE clubs SET told_by = 'player-two' WHERE id = (SELECT id FROM clubs ORDER BY id LIMIT 1)`)
    const warn = quiet()
    const res = await deleteMember(db, 'player-two')
    expect(res.status).toBe(200)
    expect(await res.text()).toBe(ANSWER)
    expect(lines(warn).filter((l) => typeof l === 'string' && l.startsWith('member delete: '))).toEqual([RUN_MARKS_UNCLEARED_LOG])
    expect(RUN_MARKS_UNCLEARED_LOG).not.toMatch(/player|@/i)
    expect(RUN_MARKS_UNCLEARED_LOG).not.toBe(CLUB_REFERENCES_UNCLEARED_LOG)
    expect(db.prepare(`SELECT COUNT(*) AS n FROM members WHERE id = 'player-two'`).get()).toEqual({ n: 0 })
    expect(db.prepare(`SELECT COUNT(*) AS n FROM clubs WHERE told_by = 'player-two'`).get()).toEqual({ n: 0 })
  })

  it('runs the job and gives back its answer, with one log line', async () => {
    const db = database(TO_0067)
    const warn = quiet()
    const job = vi.fn(async () => ({ outcome: 'partial' as const, sentCount: 3, failedCount: 1 }))
    expect(await recordRun(d1Over(db), 'daily:reminders', job)).toEqual({ outcome: 'partial', sentCount: 3, failedCount: 1 })
    expect(job).toHaveBeenCalledTimes(1)
    expect(lines(warn)).toEqual([RUN_NOT_RECORDED_LOG])
  })
})

describe('with every migration', () => {
  it('clears a member\'s seen_by and keeps the row, with no log line', async () => {
    const db = database(migrationFiles())
    const warn = quiet()
    const res = await deleteMember(db, 'player-one')
    expect(res.status).toBe(200)
    expect(await res.text()).toBe(ANSWER)
    expect(lines(warn)).not.toContain(RUN_MARKS_UNCLEARED_LOG)
    expect(lines(warn)).not.toContain(RUN_NOT_RECORDED_LOG)
    expect(db.prepare('SELECT job, outcome, seen_at, seen_by FROM automation_runs').all().map((r) => ({ ...r }))).toEqual([
      { job: 'clearinghouse_sync', outcome: 'ok', seen_at: '2026-11-14 19:00:00', seen_by: null },
    ])
  })

  it('records a run and reads it back as the latest', async () => {
    const db = database(migrationFiles())
    const warn = quiet()
    await recordRun(d1Over(db), 'daily:reminders', async () => ({ outcome: 'ok' as const, sentCount: 2, failedCount: 0, detail: 'Two reminders sent.' }))
    expect(lines(warn)).toEqual([])
    expect(await lastRun(d1Over(db), 'daily:reminders')).toMatchObject({ job: 'daily:reminders', outcome: 'ok', sent_count: 2, failed_count: 0, detail: 'Two reminders sent.' })
    expect(await lastRun(d1Over(db), 'five_minute:offers')).toBeNull()
  })
})

describe('plainDetail', () => {
  it('masks an address, a token, a secret after its name, a link\'s query and a line break', () => {
    const said = plainDetail('Failed for player.one@example.org\nwith token=v1.s.eyJwIjoiY2x1Yl9jb25maXJtIn0.AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-AbCd and Bearer abc123 at https://example.org/confirm?t=abc#x')
    expect(said).toBe('Failed for [address] with token=[hidden] and Bearer [hidden] at https://example.org/confirm?[hidden]')
    expect(plainDetail('The key is example-signing-key-not-a-real-one-0001 now')).toBe('The key is [hidden] now')
    expect(plainDetail('secret: "two words" left')).toBe('secret: [hidden] left')
    expect(plainDetail('One reminder failed: the address bounced.')).toBe('One reminder failed: the address bounced.')
  })

  it('cuts to 200 characters, and answers text for anything it is given', () => {
    expect(MAX_DETAIL_LENGTH).toBe(200)
    const long = plainDetail('word '.repeat(100))
    expect(long.length).toBeLessThanOrEqual(200)
    expect(long.endsWith('...')).toBe(true)
    for (const value of [undefined, null, 42, { a: 1 }, ['x'], '']) expect(typeof plainDetail(value)).toBe('string')
    expect(plainDetail('a\u0000b\u2028c\td')).toBe('a b c d')
  })
})

/** The specifiers a file names, as its bundler reads them: imports, re-exports and import(), types included. */
const specifiersOf = (file: string) => ts.preProcessFile(readFileSync(join(ROOT, file), 'utf8'), true, true).importedFiles.map((f) => f.fileName)

/** The file a relative import names, as a bundler finds it: the path, with .ts or .tsx, or its folder's index. */
function resolveImport(from: string, specifier: string): string | null {
  const base = resolve(dirname(join(ROOT, from)), specifier)
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts')]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return relative(ROOT, candidate).split('\\').join('/')
  }
  return null
}

/** Every file an entry reaches through relative imports, the packages it names, and the specifiers none of them could find. */
function closure(entry: string): { files: Set<string>; packages: string[]; missing: string[] } {
  const files = new Set<string>()
  const packages: string[] = []
  const missing: string[] = []
  const queue = [entry]
  while (queue.length > 0) {
    const file = queue.shift()!
    if (files.has(file)) continue
    files.add(file)
    for (const specifier of specifiersOf(file)) {
      if (!specifier.startsWith('.')) {
        packages.push(`${file}: ${specifier}`)
        continue
      }
      const found = resolveImport(file, specifier)
      if (found) queue.push(found)
      else missing.push(`${file}: ${specifier}`)
    }
  }
  return { files, packages, missing }
}

const TOKENS = 'functions/utils/tokens.ts'
const RUNS = 'functions/utils/admin/automations.ts'

/**
 * The files outside the tests that import either helper. None in this step: the step that first calls one adds its
 * file here, one line.
 */
const IMPORTERS: string[] = []

/** Every code file under the folders the site, the functions and the workers are built from. */
function codeFiles(): string[] {
  const out: string[] = []
  const walk = (dir: string) => {
    for (const name of readdirSync(join(ROOT, dir))) {
      if (name === 'node_modules' || name.startsWith('.')) continue
      const path = `${dir}/${name}`
      if (statSync(join(ROOT, path)).isDirectory()) walk(path)
      else if (/\.(ts|tsx)$/.test(name)) out.push(path)
    }
  }
  for (const dir of ['functions', 'src', 'workers', 'domain', 'scripts', 'shared']) if (existsSync(join(ROOT, dir))) walk(dir)
  return out
}

describe('package-free, as the worker\'s closure walk reads it', () => {
  it('names no package and finds every import, for each helper', () => {
    for (const entry of [TOKENS, RUNS]) {
      const { files, packages, missing } = closure(entry)
      expect(packages, entry).toEqual([])
      expect(missing, entry).toEqual([])
      expect([...files], entry).toEqual([entry])
    }
  })

  it('reads only Web Crypto, and no environment, clock or log in the tokens', () => {
    const code = readFileSync(join(ROOT, TOKENS), 'utf8')
    expect(code).toContain('crypto.subtle')
    expect(code).toContain('crypto.getRandomValues')
    expect(code).not.toMatch(/\bconsole\.|\bprocess\.|\benv\b|Date\.now\(|node:|Buffer/)
  })

  it('is imported by no file outside the tests yet', () => {
    const importers = codeFiles().filter((file) => specifiersOf(file).some((s) => s.startsWith('.') && [TOKENS, RUNS].includes(resolveImport(file, s) ?? '')))
    expect(importers.sort()).toEqual(IMPORTERS)
  })
})
