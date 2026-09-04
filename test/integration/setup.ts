// test/integration/setup.ts
import { env } from 'cloudflare:test'
import { beforeAll } from 'vitest'
import { installFetchInterceptor } from './harness'

// Vite pulls every migration in as raw SQL text at build time.
const migrationModules = import.meta.glob('../../migrations/*.sql', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

/**
 * Split a .sql file into individual statements.
 * Aware of single-quoted string literals (with '' escaping) so data
 * containing semicolons doesn't get split mid-statement.
 * Strips -- line comments (outside strings) and PRAGMA statements
 * (D1 rejects most PRAGMAs).
 */
function splitSql(sql: string): string[] {
  const statements: string[] = []
  let current = ''
  let inString = false

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i]

    if (inString) {
      current += ch
      if (ch === "'") {
        if (sql[i + 1] === "'") {
          current += "'"
          i++
        } else {
          inString = false
        }
      }
      continue
    }

    if (ch === "'") {
      inString = true
      current += ch
      continue
    }

    // line comment outside a string: skip to end of line
    if (ch === '-' && sql[i + 1] === '-') {
      while (i < sql.length && sql[i] !== '\n') i++
      current += '\n'
      continue
    }

    if (ch === ';') {
      statements.push(current.trim())
      current = ''
      continue
    }

    current += ch
  }
  if (current.trim()) statements.push(current.trim())

  return statements.filter(
    (s) => s.length > 0 && !/^PRAGMA\b/i.test(s),
  )
}

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