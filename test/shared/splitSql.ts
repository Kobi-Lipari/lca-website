// test/shared/splitSql.ts
//
// Splits a migration file into the statements the test databases run one at
// a time. Shared by the Miniflare integration setup (test/integration/
// setup.ts), the node:sqlite helper for unit tests (test/unit/helpers/
// sqlite.ts) and scripts/db/build-local-sqlite.ts, so it must stay plain
// TypeScript: no cloudflare:test, no import.meta.glob, no imports at all.
//
// Production never uses this: wrangler sends each migration file to D1 whole.

/**
 * Split a .sql file into individual statements.
 *
 * - Single-quoted strings (with '' escaping), double-quoted and backtick
 *   identifiers are copied as they are, so a semicolon or a keyword inside
 *   one never ends or opens anything.
 * - `--` line comments outside those are stripped (this includes drizzle-kit's
 *   `--> statement-breakpoint` lines).
 * - Block depth is tracked by keyword: CASE opens a block anywhere, BEGIN
 *   opens one inside CREATE TRIGGER (a trigger body), and END closes the
 *   innermost one. A statement ends only at a semicolon at depth 0, so a
 *   trigger whose body holds `CASE ... END;` stays one statement.
 * - PRAGMA statements are dropped (D1 rejects most of them).
 */
export function splitSql(sql: string): string[] {
  const statements: string[] = []
  let current = ''
  let depth = 0

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i]

    // A quoted run: 'string', "identifier" or `identifier`. A doubled quote
    // inside it is an escaped quote, not the end.
    if (ch === "'" || ch === '"' || ch === '`') {
      let j = i + 1
      while (j < sql.length) {
        if (sql[j] === ch) {
          if (sql[j + 1] === ch) { j += 2; continue }
          break
        }
        j++
      }
      current += sql.slice(i, j + 1)
      i = j
      continue
    }

    // line comment outside a quoted run: skip to end of line
    if (ch === '-' && sql[i + 1] === '-') {
      while (i < sql.length && sql[i] !== '\n') i++
      current += '\n'
      continue
    }

    // A whole word, so `end_date` or `cases` is never read as END or CASE.
    if (isWordChar(ch) && !isWordChar(sql[i - 1] ?? '')) {
      let j = i
      while (j < sql.length && isWordChar(sql[j])) j++
      const word = sql.slice(i, j).toUpperCase()
      if (word === 'CASE') depth++
      else if (word === 'BEGIN' && /^\s*CREATE\s+(?:TEMP\s+|TEMPORARY\s+)?TRIGGER\b/i.test(current)) depth++
      else if (word === 'END' && depth > 0) depth--
      current += sql.slice(i, j)
      i = j - 1
      continue
    }

    if (ch === ';' && depth === 0) {
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

function isWordChar(ch: string): boolean {
  return /[A-Za-z0-9_$]/.test(ch)
}
