// test/unit/helpers/sqlite.ts
//
// A real SQLite database for unit tests, built from migrations/*.sql in
// filename order, without Miniflare. It uses node:sqlite (Node 22.22 ships
// SQLite 3.50), which needs no native package.
//
// D1 always enforces foreign keys, but a fresh SQLite connection does not,
// and splitSql drops every PRAGMA line in the migrations. So foreign keys
// are switched on here, before the first migration runs, or a cascade that
// would delete rows on D1 would silently do nothing in these tests.
//
// scripts/db/build-local-sqlite.ts uses this to write the file drizzle-kit
// introspects, so imports carry their .ts extension (Node runs that script
// without a bundler).
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { fileURLToPath } from 'node:url'
import { splitSql } from '../../shared/splitSql.ts'

export const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../migrations')

/** Every migration file name, in the order D1 and the test runner apply them. */
export function migrationFiles(dir = MIGRATIONS_DIR): string[] {
  return readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()
}

/** Runs every statement of every file, naming the file and statement that fails. */
export function applyMigrations(db: DatabaseSync, files = migrationFiles(), dir = MIGRATIONS_DIR): void {
  for (const file of files) {
    for (const stmt of splitSql(readFileSync(join(dir, file), 'utf8'))) {
      try {
        db.exec(stmt)
      } catch (err) {
        throw new Error(`Migration ${file} failed on statement:\n${stmt.slice(0, 300)}`, { cause: err })
      }
    }
  }
}

export interface MigratedDbOptions {
  /** Where to write the database; in memory when left out. */
  path?: string
  /** Only these migration files (default: all of them). */
  files?: string[]
  /** Extra SQL run after the migrations, split the same way. */
  extra?: string
}

/** A database with foreign keys on and the migrations applied. */
export function openMigratedDb(options: MigratedDbOptions = {}): DatabaseSync {
  const db = new DatabaseSync(options.path ?? ':memory:')
  db.exec('PRAGMA foreign_keys = ON')
  applyMigrations(db, options.files)
  if (options.extra) for (const stmt of splitSql(options.extra)) db.exec(stmt)
  return db
}

/** PRAGMA foreign_keys as a number: 1 when foreign keys are enforced. */
export function foreignKeysOn(db: DatabaseSync): number {
  return Number((db.prepare('PRAGMA foreign_keys').get() as { foreign_keys: number }).foreign_keys)
}

/** The user tables, without SQLite's own and D1's bookkeeping tables. */
export function userTables(db: DatabaseSync): string[] {
  return (db.prepare(
    `SELECT name FROM sqlite_master WHERE type = 'table'
       AND name NOT LIKE 'sqlite\\_%' ESCAPE '\\'
       AND name NOT LIKE '\\_cf\\_%' ESCAPE '\\'
       AND name <> 'd1_migrations'
     ORDER BY name`,
  ).all() as Array<{ name: string }>).map((r) => r.name)
}
