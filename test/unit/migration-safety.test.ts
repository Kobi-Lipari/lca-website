// test/unit/migration-safety.test.ts
//
// Rebuilding a table in SQLite means DROP TABLE and create it again. With
// foreign keys on (D1 always has them on), DROP TABLE first deletes every
// row, and that fires ON DELETE CASCADE / SET NULL in the tables pointing
// at it. `PRAGMA defer_foreign_keys` only delays the *checks*; it does not
// stop those actions. That is how migration 0040 (the observer role) wiped
// the board seat assignments and tournament director assignments.
//
// This test fails any migration that drops a table other tables cascade
// from, unless the same migration puts those rows back (see
// migrations/README.md for the pattern).
import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const DIR = join(__dirname, '../../migrations')
const files = readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort()
const sql = (f: string) => readFileSync(join(DIR, f), 'utf8').replace(/--[^\n]*/g, '')

interface Link { child: string; parent: string; action: 'CASCADE' | 'SET NULL'; since: number }

/** Every foreign key with a delete action, across all migrations. */
function links(): Link[] {
  const out: Link[] = []
  files.forEach((f, since) => {
    const text = sql(f)
    for (const m of text.matchAll(/CREATE TABLE(?: IF NOT EXISTS)?\s+(\w+)\s*\(([\s\S]*?)\n\);/gi)) {
      for (const fk of m[2].matchAll(/REFERENCES\s+(\w+)\s*\([^)]*\)\s*ON DELETE (CASCADE|SET NULL)/gi)) {
        out.push({ child: m[1], parent: fk[1], action: fk[2].toUpperCase() as Link['action'], since })
      }
    }
    for (const m of text.matchAll(/ALTER TABLE\s+(\w+)\s+ADD COLUMN[^;]*?REFERENCES\s+(\w+)\s*\([^)]*\)\s*ON DELETE (CASCADE|SET NULL)/gi)) {
      out.push({ child: m[1], parent: m[2], action: m[3].toUpperCase() as Link['action'], since })
    }
  })
  return out
}

/** Migrations that drop a parent table without restoring its children. */
export function unsafeMigrations(): Array<{ file: string; parent: string; lost: string[] }> {
  const all = links()
  const found: Array<{ file: string; parent: string; lost: string[] }> = []
  files.forEach((f, index) => {
    const text = sql(f)
    for (const m of text.matchAll(/DROP TABLE(?: IF EXISTS)?\s+(\w+)/gi)) {
      const parent = m[1]
      // Only tables that existed by then can lose rows.
      const children = all.filter((l) => l.parent === parent && l.child !== parent && l.since < index)
      const lost = [...new Set(children
        .filter((l) => {
          const restored = l.action === 'CASCADE'
            ? new RegExp(`INSERT INTO\\s+${l.child}\\b`, 'i').test(text)
            : new RegExp(`UPDATE\\s+${l.child}\\b`, 'i').test(text)
          // Dropping the child table itself in the same file is a rebuild of it, not a loss.
          const childDropped = new RegExp(`DROP TABLE(?: IF EXISTS)?\\s+${l.child}\\b`, 'i').test(text)
          return !restored && !childDropped
        })
        .map((l) => l.child))]
      if (lost.length) found.push({ file: f, parent, lost })
    }
  })
  return found
}

// Already applied before this check existed, so they can't be edited (D1
// records them as done). 0047 rebuilds what could be rebuilt.
const GRANDFATHERED = ['0019_widen_checks.sql', '0033_lca_auditor_role.sql', '0040_lca_observer_role.sql']

describe('migrations never silently delete rows through cascades', () => {
  it('catches the migrations that did (so the check works)', () => {
    const flagged = unsafeMigrations().map((u) => u.file)
    expect(flagged).toContain('0040_lca_observer_role.sql')
  })

  it('has no new migration that drops a parent table without restoring its children', () => {
    const offenders = unsafeMigrations().filter((u) => !GRANDFATHERED.includes(u.file))
    expect(offenders).toEqual([])
  })
})
