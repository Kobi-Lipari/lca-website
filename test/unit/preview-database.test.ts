// test/unit/preview-database.test.ts
//
// Companion to wrangler-config.test.ts for the preview database slice.
// It covers what that file does not:
//
// - the guard run through the real npm script text, with wrangler swapped
//   for an echo, so a failing guard is shown to stop the chain (nothing
//   here ever calls wrangler or touches a remote database)
// - guard edges: ids differing only in case, a second preview entry,
//   unreadable TOML, an empty target, a missing config file
// - smol-toml pinned exactly, in devDependencies, matching the lockfile
// - REDESIGN_STATUS.md: both ordering rules, one block per workstream, the
//   AC1-AC14 / K1a-K6 table, this slice's row and its verify items
// - README.md: the Safe previews section
import { describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { findPreviewProblems } from '../../scripts/db/preview-guard'

const ROOT = join(__dirname, '../..')
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8')
const tomlText = read('wrangler.toml')
const pkg = JSON.parse(read('package.json')) as {
  scripts: Record<string, string>
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

const PROD_ID = 'e891b93f-e7fe-48d0-9afc-8570d805ef08'
const PREVIEW_ID = '28e13174-3a06-47a7-ab0f-b4ac7f24af6f'
const GUARD = 'scripts/db/preview-guard.ts'

const dir = mkdtempSync(join(tmpdir(), 'preview-db-'))
const fixture = (name: string, body: string) => {
  const path = join(dir, name)
  writeFileSync(path, body)
  return path
}
const sh = (command: string) => spawnSync('sh', ['-c', command], { cwd: ROOT, encoding: 'utf8' })

/**
 * The text of an npm script with wrangler replaced by an echo (so nothing
 * can reach a database) and an optional --config handed to the guard.
 */
function dryRun(name: string, config?: string, seed?: string): string {
  let script = pkg.scripts[name]
  expect(script, `${name} is missing`).toBeDefined()
  expect(script).toContain('wrangler ')
  script = script.replace('wrangler ', 'echo WRANGLER_WOULD_RUN ')
  if (config) script = script.replace(GUARD, `${GUARD} --config ${config}`)
  if (seed) script = script.split('scripts/seed/fixtures.sql').join(seed)
  return script
}

describe('preview scripts stop when the guard fails', () => {
  const badConfigs: Array<[string, string]> = [
    ['a placeholder id', fixture('placeholder.toml', tomlText.replace(PREVIEW_ID, 'REPLACE_WITH_LCA_DB_PREVIEW_ID'))],
    ["production's id", fixture('prod-id.toml', tomlText.replace(PREVIEW_ID, PROD_ID))],
    ["production's name", fixture('prod-name.toml', tomlText.replace('database_name = "lca-db-preview"', 'database_name = "lca-db"'))],
    ['a missing id', fixture('no-id.toml', tomlText.replace(`database_id = "${PREVIEW_ID}"\n`, ''))],
  ]

  describe.each(['db:migrate:preview', 'db:migrate:status:preview'])('%s', (name) => {
    it('runs the next step when the guard passes', () => {
      const result = sh(dryRun(name))
      expect(result.status).toBe(0)
      expect(result.stdout).toContain('WRANGLER_WOULD_RUN d1 migrations')
      expect(result.stdout).toContain('lca-db-preview --remote --env preview')
    })

    it.each(badConfigs)('does not run the next step for %s', (_label, config) => {
      const result = sh(dryRun(name, config))
      expect(result.status).not.toBe(0)
      expect(result.stdout).not.toContain('WRANGLER_WOULD_RUN')
      expect(result.stderr).toMatch(/Stopped before touching any database/)
    })
  })

  describe('db:seed:preview', () => {
    it('does not run the next step while the seed file is missing', () => {
      const result = sh(dryRun('db:seed:preview', undefined, join(dir, 'absent-fixtures.sql')))
      expect(result.status).not.toBe(0)
      expect(result.stdout).not.toContain('WRANGLER_WOULD_RUN')
      expect(result.stderr).toMatch(/no seed file yet/)
    })

    it('runs the next step once the seed file exists and the config is sound', () => {
      const seed = fixture('present-fixtures.sql', '-- sample data\n')
      const result = sh(dryRun('db:seed:preview', undefined, seed))
      expect(result.status).toBe(0)
      expect(result.stdout).toContain('WRANGLER_WOULD_RUN d1 execute lca-db-preview --remote --env preview')
    })

    it.each(badConfigs)('does not run the next step for %s even with a seed file', (_label, config) => {
      const seed = fixture('seed-for-bad-config.sql', '-- sample data\n')
      const result = sh(dryRun('db:seed:preview', config, seed))
      expect(result.status).not.toBe(0)
      expect(result.stdout).not.toContain('WRANGLER_WOULD_RUN')
    })
  })
})

describe('preview-guard edges', () => {
  const run = (args: string[]) =>
    spawnSync(process.execPath, ['--no-warnings', '--experimental-strip-types', join(ROOT, GUARD), ...args], {
      cwd: ROOT,
      encoding: 'utf8',
    })

  it('exits non-zero with a plain message for a missing id', () => {
    const config = fixture('missing-id.toml', tomlText.replace(`database_id = "${PREVIEW_ID}"\n`, ''))
    const result = run(['--config', config, 'lca-db-preview'])
    expect(result.status).not.toBe(0)
    expect(result.stderr).toMatch(/missing or a placeholder/)
  })

  it('exits non-zero when the config file does not exist', () => {
    const result = run(['--config', join(dir, 'nope.toml'), 'lca-db-preview'])
    expect(result.status).not.toBe(0)
    expect(result.stderr).toMatch(/does not exist/)
  })

  it('exits non-zero when no target database is named', () => {
    const result = run([])
    expect(result.status).not.toBe(0)
    expect(result.stderr).toMatch(/No database name was given/)
  })

  it('reports unreadable TOML instead of passing', () => {
    expect(findPreviewProblems('this is [not toml', 'lca-db-preview').join('\n')).toMatch(/could not be read/)
  })

  it('catches production\'s id written in capitals', () => {
    const problems = findPreviewProblems(tomlText.replace(PREVIEW_ID, PROD_ID.toUpperCase()), 'lca-db-preview')
    expect(problems.join('\n')).toMatch(/production database's id/)
  })

  it('catches production\'s id with stray spaces around it', () => {
    const problems = findPreviewProblems(tomlText.replace(`"${PREVIEW_ID}"`, `"  ${PROD_ID}  "`), 'lca-db-preview')
    expect(problems.join('\n')).toMatch(/production database's id/)
  })

  it('checks every database listed under [env.preview], not only DB', () => {
    const extra = `${tomlText}\n[[env.preview.d1_databases]]\nbinding = "OTHER"\ndatabase_name = "lca-db"\ndatabase_id = "${PROD_ID}"\n`
    const problems = findPreviewProblems(extra, 'lca-db-preview').join('\n')
    expect(problems).toMatch(/production database's id/)
    expect(problems).toMatch(/names lca-db, the production database/)
  })

  it('stops a target of lca-db however the config looks', () => {
    expect(findPreviewProblems(tomlText, ' lca-db ').join('\n')).toMatch(/production database/)
  })
})

describe('smol-toml dependency', () => {
  const version = pkg.devDependencies?.['smol-toml']
  const lock = JSON.parse(read('package-lock.json')) as {
    packages: Record<string, { version?: string; dev?: boolean }>
  }

  it('is an exact-pinned devDependency', () => {
    expect(version).toMatch(/^\d+\.\d+\.\d+$/)
    expect(pkg.dependencies?.['smol-toml']).toBeUndefined()
  })

  it('is locked at the pinned version', () => {
    expect(lock.packages['node_modules/smol-toml']?.version).toBe(version)
    expect(lock.packages['']).toBeDefined()
    expect((lock.packages[''] as { devDependencies?: Record<string, string> }).devDependencies?.['smol-toml']).toBe(version)
  })
})

describe('REDESIGN_STATUS.md', () => {
  const status = read('REDESIGN_STATUS.md')
  const workstreams = Array.from({ length: 15 }, (_, i) => `WS${String(i + 1).padStart(2, '0')}`)

  /** The text of one "## " section. */
  const section = (heading: RegExp) => {
    const parts = status.split(/^## /m)
    const found = parts.find((p) => heading.test(p))
    expect(found, `no section matching ${heading}`).toBeDefined()
    return found as string
  }

  it('records both ordering rules', () => {
    const rules = section(/^Ordering rules/)
    expect(rules).toMatch(/branch is pushed only after/i)
    expect(rules).toMatch(/preview database slice is committed/i)
    expect(rules).toMatch(/K migrates the preview database from the branch before reviewing each checkpoint/i)
    expect(rules).toContain('npm run db:migrate:preview')
    expect(rules).toMatch(/not after the merge/i)
  })

  it('has one block per workstream, WS01 to WS15, in order', () => {
    const headings = [...status.matchAll(/^## (WS\d\d):/gm)].map((m) => m[1])
    expect(headings).toEqual(workstreams)
  })

  it.each(workstreams)('%s block has status, branch, PR, decisions, deviations, follow-ups and verify items', (ws) => {
    const block = section(new RegExp(`^${ws}:`))
    for (const label of [/status:/i, /branch:/i, /PR:/i, /decisions/i, /deviations/i, /follow-ups/i, /verify items/i]) {
      expect(block).toMatch(label)
    }
  })

  it('maps AC1 to AC14 and K1a to K6, one row each', () => {
    const rows = status
      .split('\n')
      .filter((l) => /^\| (AC\d+|K\d[a-z]?) \|/.test(l))
      .map((l) => l.split('|').map((c) => c.trim()))
    const ids = rows.map((r) => r[1])
    const expected = [
      ...Array.from({ length: 14 }, (_, i) => `AC${i + 1}`),
      'K1a', 'K1b', 'K1c', 'K1d',
      'K2a', 'K2b', 'K2c', 'K2d', 'K2e', 'K2f', 'K2g',
      'K3a', 'K3b', 'K3c', 'K3d',
      'K4', 'K5', 'K6',
    ]
    expect(ids).toEqual(expected)
    for (const r of rows) expect(r[2], `${r[1]} has no description`).not.toBe('')
  })

  it('maps every item to the one step that proves it, with AC9 proved by this slice', () => {
    const rows = status
      .split('\n')
      .filter((l) => /^\| (AC\d+|K\d[a-z]?) \|/.test(l))
      .map((l) => l.split('|').map((c) => c.trim()))
    for (const r of rows) {
      expect(r[3], `${r[1]} has no step`).toMatch(/^([1-9]|[12]\d|3[0-2])$/)
      expect(r[4], `${r[1]} says nothing about what proves it`).not.toBe('')
    }
    const k1d = rows.find((r) => r[1] === 'K1d') as string[]
    expect(k1d[4]).toMatch(/partial: ratchet/i)
    const ac9 = rows.find((r) => r[1] === 'AC9') as string[]
    expect(ac9[3]).toBe('1')
    expect(ac9[4]).toContain('test/unit/wrangler-config.test.ts')
    expect(ac9[4]).toMatch(/live half/i)
    expect(ac9[4]).toMatch(/not done yet/i)
  })

  it('leaves the AC9 live check open as a follow-up, to be recorded after the first push', () => {
    expect(section(/^WS01:/)).toMatch(/AC9 live check[\s\S]*first push[\s\S]*Record the result here/)
  })

  it('records the remote-migration deviation and the resolved verify items', () => {
    const ws01 = section(/^WS01:/)
    expect(ws01).toMatch(/Remote migrations\./)
    expect(ws01).toContain('.github/workflows/migrate-db.yml')
    for (const item of ['no preview override', 'Pages environment inheritance', 'Does the preview database exist', 'Who applies remote migrations', 'Workers']) {
      expect(ws01.toLowerCase(), `verify item "${item}" missing`).toContain(item.toLowerCase())
    }
  })

  it('names the real preview id and never the production id as the preview', () => {
    const ws01 = section(/^WS01:/)
    expect(ws01).toContain(PREVIEW_ID)
    expect(ws01).toContain(PROD_ID)
  })
})

describe('README.md: Safe previews', () => {
  const readme = read('README.md')
  const start = readme.indexOf('### Safe previews')
  const end = readme.indexOf('\n### ', start + 1)
  const safe = readme.slice(start, end === -1 ? undefined : end).replace(/\s+/g, ' ')

  it('has the section', () => {
    expect(start).toBeGreaterThan(-1)
  })

  it('names the preview database, the binding and the guard', () => {
    expect(safe).toContain('lca-db-preview')
    expect(safe).toContain('[env.preview]')
    expect(safe).toContain('scripts/db/preview-guard.ts')
    for (const script of ['db:migrate:preview', 'db:migrate:status:preview', 'db:seed:preview']) {
      expect(safe).toContain(script)
      expect(pkg.scripts[script], `${script} is documented but not defined`).toBeDefined()
    }
  })

  it('says K migrates the preview from the branch before each checkpoint review, not after the merge', () => {
    expect(safe).toMatch(/K runs `npm run db:migrate:preview` from the branch/)
    expect(safe).toMatch(/own Cloudflare credentials/)
    expect(safe).toMatch(/before reviewing each checkpoint's preview, not after the merge/)
    expect(safe).toMatch(/unmigrated database shows errors/)
  })

  it('states the shared-login, secrets and logo-bucket facts', () => {
    expect(safe).toMatch(/Supabase/)
    expect(safe).toMatch(/Stripe test keys/)
    expect(safe).toMatch(/Resend key off previews/)
    expect(safe).toMatch(/lca-club-logos/)
    expect(safe).toMatch(/never target the preview database/)
  })
})
