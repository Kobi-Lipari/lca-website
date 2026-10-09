// scripts/db/generate.ts
//
// Turns a change to functions/db/schema.ts into the next numbered file in
// migrations/, so wrangler, the production migrate workflow and the test
// setup keep reading migrations/*.sql exactly as before.
//
//   npm run db:generate -- <name>            schema change, written by drizzle-kit
//   npm run db:generate -- <name> --custom   hand-written migration (data, or a
//                                            change drizzle-kit must not write)
//
// How it works:
// 1. drizzle-kit generate writes into the staging folder drizzle/ (its own
//    numbering) and records a snapshot in drizzle/meta.
// 2. The new file is numbered after the highest prefix in migrations/ (0052
//    next), given a header comment, and written to migrations/. The staging
//    SQL is removed; drizzle/meta is kept and committed.
// 3. A generated file containing DROP TABLE, __new_ or PRAGMA foreign_keys
//    is refused. That is drizzle-kit rebuilding a SQLite table to add or
//    change a constraint, and on D1 the DROP TABLE deletes the rows of every
//    table that cascades from it (migrations/README.md). Nothing is written
//    and the staging folder is put back as it was.
// 4. With --custom the file is written for a person to fill in. If the schema
//    changed, drizzle-kit's proposal is included as comments to work from,
//    and drizzle/meta records the new schema, so the next run does not offer
//    the same change again.
//
// 5. drizzle-kit asks whether a column or table was renamed when one goes and
//    another arrives. Run from a terminal, it is given the terminal to ask.
//    Anywhere else it cannot ask, prints an "Error:" line and still exits 0;
//    that line stops the run, so a rename is never reported as "no changes".
//
// It only writes local files; it never talks to a database.
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

/** What a generated file may not contain, and why, in plain words. */
export const REFUSED: Array<{ pattern: RegExp; what: string }> = [
  { pattern: /\bDROP\s+TABLE\b/i, what: 'DROP TABLE' },
  { pattern: /__new_/i, what: 'a __new_ table (drizzle-kit rebuilding a table)' },
  { pattern: /\bPRAGMA\s+foreign_keys\b/i, what: 'PRAGMA foreign_keys' },
]

/** The part of a drizzle-kit snapshot this script reads. */
export interface SnapshotLike {
  tables?: Record<string, {
    foreignKeys?: Record<string, { columnsFrom?: string[]; onDelete?: string; onUpdate?: string }>
  }>
}

const NAME = '[`"]?(\\w+)[`"]?'

/**
 * drizzle-kit (0.31) writes a column added with a foreign key as
 * `ALTER TABLE x ADD y ... REFERENCES t(id);` and leaves out the ON DELETE
 * and ON UPDATE actions, while its snapshot records them. The database would
 * then never cascade although the schema says it does. Each such column is
 * reported here.
 */
export function droppedReferenceActions(sql: string, snapshot: SnapshotLike | null): string[] {
  const found: string[] = []
  const alter = new RegExp(`ALTER TABLE\\s+${NAME}\\s+ADD(?:\\s+COLUMN)?\\s+${NAME}([^;]*?\\bREFERENCES\\b[^;]*)`, 'gi')
  for (const m of sql.matchAll(alter)) {
    const [, table, column, rest] = m
    const fks = Object.values(snapshot?.tables?.[table]?.foreignKeys ?? {})
    const fk = fks.find((f) => f.columnsFrom?.length === 1 && f.columnsFrom[0] === column)
    for (const [clause, action] of [['ON DELETE', fk?.onDelete], ['ON UPDATE', fk?.onUpdate]] as const) {
      if (!action || action.toLowerCase() === 'no action') continue
      if (!new RegExp(`${clause}\\s+${action.replace(/\s+/g, '\\s+')}`, 'i').test(rest)) {
        found.push(`${table}.${column} without its ${clause} ${action}`)
      }
    }
  }
  return found
}

/** Every reason a generated file must not be written, empty when it is fine. */
export function refusalReasons(sql: string, snapshot: SnapshotLike | null = null): string[] {
  return [
    ...REFUSED.filter((r) => r.pattern.test(sql)).map((r) => r.what),
    ...droppedReferenceActions(sql, snapshot),
  ]
}

/** The explanation printed when a file is refused. */
export function refusalMessage(reasons: string[]): string {
  return [
    `Stopped: the generated migration contains ${reasons.join('; ')}.`,
    'drizzle-kit rebuilds a SQLite table (copy, DROP TABLE, rename) to add or change a constraint.',
    'On D1 foreign keys are always on, so DROP TABLE deletes the rows of every table that cascades',
    'from it, and PRAGMA foreign_keys cannot be switched off inside a D1 migration. It also leaves',
    'ON DELETE and ON UPDATE off a column it adds with ALTER TABLE.',
    'Nothing was written to migrations/ and drizzle/ is as it was.',
    'Read migrations/README.md ("Never rebuild a table other tables cascade from") and write the',
    'change by hand with: npm run db:generate -- <name> --custom',
  ].join('\n')
}

/** The next four-digit prefix after the highest one in the folder. */
export function nextMigrationNumber(files: string[]): string {
  let highest = 0
  for (const f of files) {
    const m = /^(\d{4})_.*\.sql$/.exec(f)
    if (m) highest = Math.max(highest, Number(m[1]))
  }
  return String(highest + 1).padStart(4, '0')
}

/** A migration name as a file name: lower case, words joined by underscores. */
export function slugName(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

/** Puts every line behind `-- `, for drizzle-kit's proposal in a custom file. */
export function commentOut(sql: string): string {
  return sql.trimEnd().split('\n').map((l) => (l ? `-- ${l}` : '--')).join('\n')
}

export interface HeaderInput {
  file: string
  staged: string
  custom: boolean
  proposal?: string
}

/** The finished file: a header comment, then the SQL (or the space to write it). */
export function migrationText(sql: string, input: HeaderInput): string {
  if (!input.custom) {
    return [
      `-- ${input.file}`,
      '--',
      '-- Written by drizzle-kit from functions/db/schema.ts (npm run db:generate),',
      `-- staged as drizzle/${input.staged}. The "--> statement-breakpoint" markers are`,
      '-- comments. Review it before committing; edit the schema and generate again',
      '-- rather than editing this file.',
      '',
      sql.trimEnd(),
      '',
    ].join('\n')
  }
  const lines = [
    `-- ${input.file}`,
    '--',
    '-- Hand-written migration (npm run db:generate -- <name> --custom), staged as',
    `-- drizzle/${input.staged}. drizzle/meta now records functions/db/schema.ts as it`,
    '-- is, so write the SQL that brings the database to match it. Triggers, data',
    '-- changes and table rebuilds belong here; see migrations/README.md.',
  ]
  if (input.proposal) {
    lines.push(
      '--',
      "-- drizzle-kit's own version, which must not run as it is (it rebuilds tables",
      '-- or switches foreign keys off). Work from it:',
      '--',
      commentOut(input.proposal),
    )
  }
  lines.push('', sql.trimEnd(), '')
  return lines.join('\n').replace(/\n{3,}$/, '\n')
}

export interface KitResult {
  status: number
  output: string
}

/**
 * True when drizzle-kit reported an error. It exits 0 after some of them, for
 * example when it needs to ask whether a column was renamed and has no
 * terminal to ask in, so its output is read as well as its exit status.
 */
export function kitFailed(result: KitResult): boolean {
  return result.status !== 0 || /^\s*Error:/m.test(result.output)
}

/** The message for a failed drizzle-kit run, with a hint when it could not ask its question. */
export function kitFailureMessage(output: string): string {
  const lines = [`drizzle-kit failed:\n${output.trim()}`]
  if (/Interactive prompts require a TTY/i.test(output)) {
    lines.push(
      '',
      'drizzle-kit needs to ask whether a table or column was renamed or replaced.',
      'Run npm run db:generate -- <name> in a terminal so it can ask. Nothing was written.',
    )
  }
  return lines.join('\n')
}

export interface KitRunOptions {
  /**
   * Hand drizzle-kit this terminal so it can ask its rename questions. Its
   * errors (stderr) are still captured, and shown after it exits.
   */
  interactive?: boolean
}

/** Runs drizzle-kit with the repo's drizzle.config.ts. */
export function runDrizzleKit(args: string[], root: string, options: KitRunOptions = {}): KitResult {
  const bin = join(root, 'node_modules/drizzle-kit/bin.cjs')
  const r = spawnSync(process.execPath, [bin, ...args], {
    cwd: root,
    encoding: 'utf8',
    stdio: options.interactive ? ['inherit', 'inherit', 'pipe'] : 'pipe',
  })
  const result = { status: r.status ?? 1, output: `${r.stdout ?? ''}${r.stderr ?? ''}` }
  return kitFailed(result) ? { ...result, status: result.status || 1 } : result
}

export interface GenerateOptions {
  name: string
  custom?: boolean
  root?: string
  migrationsDir?: string
  stagingDir?: string
  runKit?: (args: string[], root: string) => KitResult
}

export type GenerateResult =
  | { ok: true; file: string | null; message: string }
  | { ok: false; message: string }

/** The snapshot drizzle-kit added in this run, if it can be read. */
function newSnapshot(staging: string, before: StagingState): SnapshotLike | null {
  const added = stagingState(staging).meta
  const file = [...added].find((f) => f.endsWith('_snapshot.json') && !before.meta.has(f))
  if (!file) return null
  try {
    return JSON.parse(readFileSync(join(staging, 'meta', file), 'utf8')) as SnapshotLike
  } catch {
    return null
  }
}

interface StagingState {
  sql: Set<string>
  meta: Set<string>
  journal: string | null
}

function stagingState(staging: string): StagingState {
  const list = (dir: string) => (existsSync(dir) ? readdirSync(dir) : [])
  const journal = join(staging, 'meta/_journal.json')
  return {
    sql: new Set(list(staging).filter((f) => f.endsWith('.sql'))),
    meta: new Set(list(join(staging, 'meta'))),
    journal: existsSync(journal) ? readFileSync(journal, 'utf8') : null,
  }
}

/** Removes whatever drizzle-kit added to the staging folder since `before`. */
function restoreStaging(staging: string, before: StagingState): void {
  const now = stagingState(staging)
  for (const f of now.sql) if (!before.sql.has(f)) rmSync(join(staging, f), { force: true })
  for (const f of now.meta) if (!before.meta.has(f)) rmSync(join(staging, 'meta', f), { force: true })
  if (before.journal !== null) writeFileSync(join(staging, 'meta/_journal.json'), before.journal)
}

/** One drizzle-kit run; the new staging file, or null when nothing changed. */
function kitStep(args: string[], options: Required<GenerateOptions>): { staged: string | null; failure?: string } {
  const before = stagingState(options.stagingDir)
  const result = options.runKit(args, options.root)
  const added = [...stagingState(options.stagingDir).sql].filter((f) => !before.sql.has(f))
  if (kitFailed(result)) {
    restoreStaging(options.stagingDir, before)
    return { staged: null, failure: kitFailureMessage(result.output) }
  }
  if (added.length > 1) {
    restoreStaging(options.stagingDir, before)
    return { staged: null, failure: `drizzle-kit wrote ${added.length} files (${added.join(', ')}); expected one.` }
  }
  return { staged: added[0] ?? null }
}

export function generateMigration(input: GenerateOptions): GenerateResult {
  const root = input.root ?? ROOT
  const options: Required<GenerateOptions> = {
    name: input.name,
    custom: input.custom ?? false,
    root,
    migrationsDir: input.migrationsDir ?? join(root, 'migrations'),
    stagingDir: input.stagingDir ?? join(root, 'drizzle'),
    runKit: input.runKit ?? runDrizzleKit,
  }
  const slug = slugName(options.name)
  if (!slug) return { ok: false, message: 'Give the migration a name: npm run db:generate -- <name> [--custom]' }

  const before = stagingState(options.stagingDir)
  const first = kitStep(['generate', '--name', slug], options)
  if (first.failure) return { ok: false, message: first.failure }

  let staged = first.staged
  let sql = staged ? readFileSync(join(options.stagingDir, staged), 'utf8') : ''
  let proposal: string | undefined

  if (!options.custom) {
    if (!staged) return { ok: true, file: null, message: 'No schema changes, so no migration was written.' }
    const reasons = refusalReasons(sql, newSnapshot(options.stagingDir, before))
    if (reasons.length > 0) {
      restoreStaging(options.stagingDir, before)
      return { ok: false, message: refusalMessage(reasons) }
    }
  } else if (staged) {
    // The schema changed: keep drizzle-kit's snapshot of it, and its SQL only
    // as comments for the person writing the real migration.
    proposal = sql
    sql = ''
  } else {
    // Nothing changed in the schema: an empty file for a data migration.
    const second = kitStep(['generate', '--custom', '--name', slug], options)
    if (second.failure) return { ok: false, message: second.failure }
    if (!second.staged) return { ok: false, message: 'drizzle-kit did not write a custom migration file.' }
    staged = second.staged
    sql = readFileSync(join(options.stagingDir, staged), 'utf8')
      .replace(/^-- Custom SQL migration file, put your code below! --\s*/m, '')
  }

  const file = `${nextMigrationNumber(readdirSync(options.migrationsDir))}_${slug}.sql`
  const target = join(options.migrationsDir, file)
  if (existsSync(target)) {
    restoreStaging(options.stagingDir, before)
    return { ok: false, message: `migrations/${file} already exists. Nothing was written.` }
  }
  writeFileSync(target, migrationText(sql, { file, staged: staged as string, custom: options.custom, proposal }))
  rmSync(join(options.stagingDir, staged as string), { force: true })
  const next = options.custom
    ? 'Write the SQL in it, then run npm run test:all.'
    : 'Review it, then run npm run test:all.'
  return { ok: true, file, message: `Wrote migrations/${file}. ${next}` }
}

function main(argv: string[]): number {
  const custom = argv.includes('--custom')
  const name = argv.filter((a) => a !== '--custom').join(' ')
  // From a terminal drizzle-kit gets it, so it can ask whether a column was
  // renamed; anywhere else (CI, a pipe) its output is captured and its
  // "Error:" lines stop the run.
  const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY)
  const result = generateMigration({
    name,
    custom,
    runKit: (args, root) => runDrizzleKit(args, root, { interactive }),
  })
  if (result.ok) console.log(result.message)
  else console.error(result.message)
  return result.ok ? 0 : 1
}

const isMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMain) process.exit(main(process.argv.slice(2)))
