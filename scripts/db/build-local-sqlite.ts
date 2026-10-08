// scripts/db/build-local-sqlite.ts
//
// Builds .drizzle/introspect.sqlite (gitignored) from migrations/*.sql in
// filename order, with foreign keys on as D1 has them. drizzle-kit pull reads
// this file (see drizzle.config.ts), so the Drizzle schema is introspected
// from exactly what the migrations produce, never from a remote database.
//
// Usage:
//   node --no-warnings --experimental-strip-types scripts/db/build-local-sqlite.ts [out.sqlite]
//
// It only writes the local file; it never talks to Cloudflare.
import { mkdirSync, rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { migrationFiles, openMigratedDb, userTables } from '../../test/unit/helpers/sqlite.ts'

export const DEFAULT_OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../../.drizzle/introspect.sqlite')

export function buildLocalSqlite(out = DEFAULT_OUT): { files: number; tables: number } {
  mkdirSync(dirname(out), { recursive: true })
  // Start clean every time, so a table dropped by a later migration never lingers.
  for (const suffix of ['', '-wal', '-shm', '-journal']) rmSync(out + suffix, { force: true })
  const db = openMigratedDb({ path: out })
  try {
    return { files: migrationFiles().length, tables: userTables(db).length }
  } finally {
    db.close()
  }
}

const isMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMain) {
  const out = process.argv[2] ? resolve(process.argv[2]) : DEFAULT_OUT
  const { files, tables } = buildLocalSqlite(out)
  console.log(`Applied ${files} migrations into ${out} (${tables} tables).`)
}
