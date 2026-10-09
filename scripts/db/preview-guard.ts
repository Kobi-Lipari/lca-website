// scripts/db/preview-guard.ts
//
// Runs before every npm script that touches the preview database
// (db:migrate:preview, db:migrate:status:preview, db:seed:preview). It reads
// wrangler.toml and stops the command, with a plain message and a non-zero
// exit, unless [env.preview] binds DB to its own database:
//
//   - the preview id is missing or still a placeholder
//   - the preview id is production's id
//   - the preview database name is production's name (lca-db)
//   - the command is about to act on lca-db, or on a database the preview
//     block does not bind
//
// With --seed <file> it also stops when the seed file does not exist yet.
//
// Usage (see package.json):
//   node --no-warnings --experimental-strip-types scripts/db/preview-guard.ts \
//     [--config <wrangler.toml>] [--seed <file.sql>] <target database name>
//
// It only reads files; it never talks to Cloudflare.
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parse } from 'smol-toml'

/** The production database. A preview command never acts on it. */
export const PRODUCTION_DB_NAME = 'lca-db'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ALL_ZEROS = /^[0-]+$/

interface D1Entry {
  binding?: unknown
  database_name?: unknown
  database_id?: unknown
}

function d1List(value: unknown): D1Entry[] {
  return Array.isArray(value) ? (value as D1Entry[]) : []
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/** True when the id is empty or is not a real database id. */
export function isPlaceholderId(id: string): boolean {
  return !UUID.test(id) || ALL_ZEROS.test(id)
}

/**
 * Every reason the preview command must not run, in plain words. An empty
 * list means it is safe to go ahead against `target`.
 */
export function findPreviewProblems(tomlText: string, target: string): string[] {
  let config: Record<string, unknown>
  try {
    config = parse(tomlText) as Record<string, unknown>
  } catch (err) {
    return [`wrangler.toml could not be read: ${(err as Error).message}`]
  }

  const problems: string[] = []
  const production = d1List(config.d1_databases)
  // Ids are UUIDs, which ignore case, so compare them lower-cased.
  const productionIds = new Set(production.map((d) => text(d.database_id).toLowerCase()).filter(Boolean))
  const productionNames = new Set([PRODUCTION_DB_NAME, ...production.map((d) => text(d.database_name)).filter(Boolean)])

  const env = (config.env ?? {}) as Record<string, unknown>
  const preview = (env.preview ?? null) as Record<string, unknown> | null
  const previewDbs = d1List(preview?.d1_databases)
  const db = previewDbs.find((d) => text(d.binding) === 'DB')

  if (!preview) {
    problems.push('wrangler.toml has no [env.preview] block, so a preview would use the production database.')
  } else if (!db) {
    problems.push('[env.preview] does not bind a database as DB. Add [[env.preview.d1_databases]] with binding = "DB".')
  }

  for (const entry of previewDbs) {
    const id = text(entry.database_id)
    const name = text(entry.database_name)
    const label = name || 'the preview database'
    if (isPlaceholderId(id)) {
      problems.push(`The id for ${label} in [env.preview] is missing or a placeholder ("${id}"). Paste the real database id from the Cloudflare dashboard.`)
    } else if (productionIds.has(id.toLowerCase())) {
      problems.push(`The id for ${label} in [env.preview] is the production database's id. Previews must never use the production database.`)
    }
    if (!name) {
      problems.push('A database in [env.preview] has no database_name.')
    } else if (productionNames.has(name)) {
      problems.push(`[env.preview] names ${name}, the production database. Previews must never use the production database.`)
    }
  }

  const wanted = target.trim()
  if (!wanted) {
    problems.push('No database name was given. Say which database the command is for, for example lca-db-preview.')
  } else if (productionNames.has(wanted)) {
    problems.push(`This command is aimed at ${wanted}, the production database. Preview commands only run against the preview database.`)
  } else if (db && text(db.database_name) && wanted !== text(db.database_name)) {
    problems.push(`This command is aimed at ${wanted}, but [env.preview] binds ${text(db.database_name)}. They must match.`)
  }

  return problems
}

interface Args {
  config: string
  seed: string | null
  target: string
}

function readArgs(argv: string[]): Args {
  const args: Args = {
    config: fileURLToPath(new URL('../../wrangler.toml', import.meta.url)),
    seed: null,
    target: '',
  }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--config') args.config = argv[++i] ?? ''
    else if (arg === '--seed') args.seed = argv[++i] ?? ''
    else args.target = arg
  }
  return args
}

function main(): number {
  const args = readArgs(process.argv.slice(2))
  if (!existsSync(args.config)) {
    console.error(`Stopped: ${args.config} does not exist.`)
    return 1
  }

  const problems = findPreviewProblems(readFileSync(args.config, 'utf8'), args.target)
  if (args.seed !== null && !existsSync(args.seed)) {
    problems.push(`There is no seed file yet (${args.seed || 'none given'}). The preview seed data has not been written, so there is nothing to load. Nothing was run.`)
  }

  if (problems.length > 0) {
    console.error('Stopped before touching any database:')
    for (const p of problems) console.error(`  - ${p}`)
    return 1
  }
  console.log(`Preview check passed: ${args.target} is the preview database, not production.`)
  return 0
}

const isMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMain) process.exit(main())
