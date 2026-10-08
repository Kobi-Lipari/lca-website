// test/integration/setup.ts
import { env } from 'cloudflare:test'
import { beforeAll } from 'vitest'
import { installFetchInterceptor } from './harness'
import { splitSql } from '../shared/splitSql'

// The splitter lives in test/shared so the node:sqlite unit helper and the
// local introspection script use the same one. Re-exported for the tests
// that replay a single migration (members-rebuild.test.ts).
export { splitSql }

// Vite pulls every migration in as raw SQL text at build time.
export const migrationModules = import.meta.glob('../../migrations/*.sql', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

export async function applyAllMigrations(db: D1Database): Promise<void> {
  const paths = Object.keys(migrationModules).sort() // 0001, 0002, ... order
  for (const path of paths) {
    const statements = splitSql(migrationModules[path])
    for (const stmt of statements) {
      try {
        await db.prepare(stmt).run()
      } catch (err) {
        throw new Error(
          `Migration ${path} failed on statement:\n${stmt.slice(0, 300)}`,
          { cause: err },
        )
      }
    }
  }
}

beforeAll(async () => {
  installFetchInterceptor()
  await applyAllMigrations(env.DB)
})