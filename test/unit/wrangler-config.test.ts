// test/unit/wrangler-config.test.ts
//
// Branch previews on Cloudflare Pages read their bindings from
// [env.preview] in wrangler.toml. Before that block existed, every preview
// was bound to the production database, so clicking around a preview wrote
// real data. These tests hold the line:
//
// - production's binding is unchanged (DB -> lca-db)
// - previews bind DB to lca-db-preview, never to lca-db or its id
// - Pages does not carry vars, d1_databases or r2_buckets into an
//   environment, so every one of them is repeated under [env.preview]
// - scripts/db/preview-guard.ts refuses a placeholder id, production's id
//   and production's name, and every preview npm script runs it first
import { describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parse } from 'smol-toml'
import { findPreviewProblems, isPlaceholderId } from '../../scripts/db/preview-guard'

const ROOT = join(__dirname, '../..')
const GUARD = join(ROOT, 'scripts/db/preview-guard.ts')
const tomlText = readFileSync(join(ROOT, 'wrangler.toml'), 'utf8')

interface D1 { binding: string; database_name: string; database_id: string }
interface R2 { binding: string; bucket_name: string }
interface Wrangler {
  d1_databases: D1[]
  r2_buckets: R2[]
  vars: Record<string, string>
  env?: { preview?: { d1_databases?: D1[]; r2_buckets?: R2[]; vars?: Record<string, string> } }
  [key: string]: unknown
}

const config = parse(tomlText) as unknown as Wrangler
const preview = config.env?.preview ?? {}

const PROD_ID = 'e891b93f-e7fe-48d0-9afc-8570d805ef08'
const PREVIEW_ID = '28e13174-3a06-47a7-ab0f-b4ac7f24af6f'

// Keys Pages does not inherit from the top level into [env.preview].
const NON_INHERITABLE = [
  'vars', 'd1_databases', 'r2_buckets', 'kv_namespaces', 'durable_objects',
  'services', 'queues', 'analytics_engine_datasets', 'ai', 'vectorize', 'hyperdrive',
]

describe('wrangler.toml: production', () => {
  it('still binds DB to lca-db with the production id', () => {
    expect(config.d1_databases).toEqual([
      { binding: 'DB', database_name: 'lca-db', database_id: PROD_ID },
    ])
  })

  it('still binds CLUB_LOGOS to lca-club-logos', () => {
    expect(config.r2_buckets).toEqual([{ binding: 'CLUB_LOGOS', bucket_name: 'lca-club-logos' }])
  })

  it('has the ten [vars] keys the preview block repeats', () => {
    expect(Object.keys(config.vars)).toHaveLength(10)
  })
})

describe('wrangler.toml: [env.preview]', () => {
  it('binds DB to lca-db-preview, under the same binding name', () => {
    expect(preview.d1_databases).toEqual([
      { binding: 'DB', database_name: 'lca-db-preview', database_id: PREVIEW_ID },
    ])
  })

  it('never names or points at the production database', () => {
    for (const db of preview.d1_databases ?? []) {
      expect(db.database_id).not.toBe(PROD_ID)
      expect(db.database_name).not.toBe('lca-db')
      for (const prod of config.d1_databases) {
        expect(db.database_id).not.toBe(prod.database_id)
        expect(db.database_name).not.toBe(prod.database_name)
      }
    }
  })

  it('repeats every top-level [vars] key', () => {
    expect(Object.keys(preview.vars ?? {}).sort()).toEqual(Object.keys(config.vars).sort())
    for (const value of Object.values(preview.vars ?? {})) expect(value).not.toBe('')
  })

  it('keeps SITE_URL on the production origin', () => {
    expect(preview.vars?.SITE_URL).toBe(config.vars.SITE_URL)
    expect(preview.vars?.VITE_SITE_URL).toBe(config.vars.VITE_SITE_URL)
  })

  it('repeats the CLUB_LOGOS bucket', () => {
    expect(preview.r2_buckets).toEqual(config.r2_buckets)
  })

  it('repeats every non-inheritable key the top level sets', () => {
    for (const key of NON_INHERITABLE) {
      if (key in config) expect(preview, `[env.preview] is missing ${key}`).toHaveProperty(key)
    }
  })
})

/** The real wrangler.toml with one string swapped, for the guard fixtures. */
const swap = (from: string, to: string) => {
  expect(tomlText).toContain(from)
  return tomlText.split(from).join(to)
}

describe('preview-guard', () => {
  it('passes the real wrangler.toml for lca-db-preview', () => {
    expect(findPreviewProblems(tomlText, 'lca-db-preview')).toEqual([])
  })

  it('treats placeholders and empty ids as missing', () => {
    expect(isPlaceholderId('REPLACE_WITH_LCA_DB_PREVIEW_ID')).toBe(true)
    expect(isPlaceholderId('')).toBe(true)
    expect(isPlaceholderId('00000000-0000-0000-0000-000000000000')).toBe(true)
    expect(isPlaceholderId(PREVIEW_ID)).toBe(false)
  })

  it('rejects a placeholder id', () => {
    const problems = findPreviewProblems(swap(PREVIEW_ID, 'REPLACE_WITH_LCA_DB_PREVIEW_ID'), 'lca-db-preview')
    expect(problems.join('\n')).toMatch(/missing or a placeholder/)
  })

  it('rejects a missing id', () => {
    const problems = findPreviewProblems(swap(`database_id = "${PREVIEW_ID}"\n`, ''), 'lca-db-preview')
    expect(problems.join('\n')).toMatch(/missing or a placeholder/)
  })

  it("rejects production's id", () => {
    const problems = findPreviewProblems(swap(PREVIEW_ID, PROD_ID), 'lca-db-preview')
    expect(problems.join('\n')).toMatch(/production database's id/)
  })

  it("rejects production's name in [env.preview]", () => {
    const problems = findPreviewProblems(swap('database_name = "lca-db-preview"', 'database_name = "lca-db"'), 'lca-db')
    expect(problems.join('\n')).toMatch(/names lca-db, the production database/)
  })

  it('rejects a command aimed at lca-db', () => {
    expect(findPreviewProblems(tomlText, 'lca-db').join('\n')).toMatch(/aimed at lca-db, the production database/)
  })

  it('rejects a command aimed at a database the preview does not bind', () => {
    expect(findPreviewProblems(tomlText, 'some-other-db').join('\n')).toMatch(/must match/)
  })

  it('rejects a config with no [env.preview]', () => {
    const prodOnly = tomlText.slice(0, tomlText.indexOf('[env.preview]'))
    expect(findPreviewProblems(prodOnly, 'lca-db-preview').join('\n')).toMatch(/no \[env\.preview\] block/)
  })

  it('rejects a preview database bound under another name', () => {
    const problems = findPreviewProblems(swap('[[env.preview.d1_databases]]\nbinding = "DB"', '[[env.preview.d1_databases]]\nbinding = "PREVIEW_DB"'), 'lca-db-preview')
    expect(problems.join('\n')).toMatch(/does not bind a database as DB/)
  })
})

describe('preview-guard as a command', () => {
  const dir = mkdtempSync(join(tmpdir(), 'preview-guard-'))
  const run = (args: string[]) =>
    spawnSync(process.execPath, ['--no-warnings', '--experimental-strip-types', GUARD, ...args], {
      cwd: ROOT,
      encoding: 'utf8',
    })
  const fixture = (name: string, body: string) => {
    const path = join(dir, name)
    writeFileSync(path, body)
    return path
  }

  it('exits 0 for the real config', () => {
    const result = run(['lca-db-preview'])
    expect(result.stderr).toBe('')
    expect(result.status).toBe(0)
  })

  it.each([
    ['a placeholder id', () => fixture('placeholder.toml', swap(PREVIEW_ID, 'REPLACE_WITH_LCA_DB_PREVIEW_ID')), 'lca-db-preview'],
    ["production's id", () => fixture('prod-id.toml', swap(PREVIEW_ID, PROD_ID)), 'lca-db-preview'],
    ["production's name", () => fixture('real.toml', tomlText), 'lca-db'],
  ])('exits non-zero with a plain message for %s', (_label, makeConfig, target) => {
    const result = run(['--config', makeConfig(), target])
    expect(result.status).not.toBe(0)
    expect(result.stderr).toMatch(/^Stopped before touching any database:/)
  })

  it('refuses to seed when the seed file does not exist', () => {
    const result = run(['--seed', join(dir, 'no-such-fixtures.sql'), 'lca-db-preview'])
    expect(result.status).not.toBe(0)
    expect(result.stderr).toMatch(/no seed file yet/)
  })
})

describe('preview npm scripts', () => {
  const scripts = (JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { scripts: Record<string, string> }).scripts
  const guard = 'node --no-warnings --experimental-strip-types scripts/db/preview-guard.ts'

  it.each(['db:migrate:preview', 'db:migrate:status:preview', 'db:seed:preview'])('%s runs the guard first and stops if it fails', (name) => {
    const script = scripts[name]
    expect(script, `${name} is missing`).toBeDefined()
    const [first, ...rest] = script.split(' && ')
    expect(first.startsWith(guard)).toBe(true)
    expect(first.trim().endsWith(' lca-db-preview')).toBe(true)
    expect(rest.length).toBeGreaterThan(0)
    // Whatever runs after the guard acts on the preview database only.
    for (const step of rest) {
      expect(step).toMatch(/\blca-db-preview\b/)
      expect(step).toMatch(/--env preview\b/)
      expect(step).not.toMatch(/\blca-db(?!-preview)\b/)
    }
  })

  it('db:seed:preview checks for the same seed file it loads', () => {
    expect(scripts['db:seed:preview']).toContain('--seed scripts/seed/fixtures.sql')
    expect(scripts['db:seed:preview']).toContain('--file=scripts/seed/fixtures.sql')
  })
})
