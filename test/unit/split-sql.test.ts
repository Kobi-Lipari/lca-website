// test/unit/split-sql.test.ts
//
// The SQL splitter the test databases use (test/shared/splitSql.ts). It
// moved out of test/integration/setup.ts so the node:sqlite helper and the
// local introspection script can share it, and it now tracks BEGIN, CASE and
// END so a trigger whose body holds CASE ... END; stays one statement.
//
// Every integration test runs the migrations through it, so the existing
// migrations must split exactly as before: the same number of statements per
// file (written out below) and the same text as the old splitter, which is
// kept here, unchanged, as the reference.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { splitSql } from '../shared/splitSql'
import { MIGRATIONS_DIR, migrationFiles } from './helpers/sqlite'

/** The splitter as it was in test/integration/setup.ts before step 6. */
function legacySplitSql(sql: string): string[] {
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
    if (ch === '-' && sql[i + 1] === '-') {
      while (i < sql.length && sql[i] !== '\n') i++
      current += '\n'
      continue
    }
    if (ch === ';') {
      if (/^\s*CREATE\s+TRIGGER\b/i.test(current) && !/\bEND\s*$/i.test(current.trim())) {
        current += ch
        continue
      }
      statements.push(current.trim())
      current = ''
      continue
    }
    current += ch
  }
  if (current.trim()) statements.push(current.trim())
  return statements.filter((s) => s.length > 0 && !/^PRAGMA\b/i.test(s))
}

// Statements per migration under the old splitter, counted before the change.
const COUNTS: Record<string, number> = {
  '0001': 14, '0002': 6, '0003': 31, '0004': 2, '0005': 17, '0006': 1, '0007': 5, '0008': 1, '0009': 1,
  '0010': 1, '0011': 3, '0012': 1, '0013': 34, '0014': 6, '0015': 1, '0016': 2, '0017': 1, '0018': 1,
  '0019': 20, '0020': 1, '0021': 4, '0022_site_announcement': 2, '0022_tournament_reminders_registration_notified': 1,
  '0023': 2, '0024': 3, '0025': 12, '0026': 4, '0027': 4, '0028': 5, '0029': 4, '0030': 4, '0031': 3,
  '0032': 1, '0033': 8, '0034': 3, '0035': 1, '0036': 2, '0037': 3, '0038': 6, '0039': 3, '0040': 9,
  '0041': 3, '0042': 9, '0043': 4, '0044': 2, '0045': 1, '0046': 32, '0047': 2, '0048': 2, '0049': 3,
  '0050': 13, '0051': 2,
}

const keyOf = (file: string) => {
  const prefix = file.slice(0, 4)
  return prefix === '0022' ? file.replace(/\.sql$/, '') : prefix
}
const read = (file: string) => readFileSync(join(MIGRATIONS_DIR, file), 'utf8')

const CASE_TRIGGER = `
-- a trigger whose body holds CASE ... END;
CREATE TRIGGER members_role_label
AFTER UPDATE OF role ON members
BEGIN
  UPDATE members SET full_name = CASE
    WHEN NEW.role = 'lca_admin' THEN NEW.full_name || ' (admin; staff)'
    ELSE NEW.full_name
  END;
  SELECT CASE WHEN NEW.role = 'bad' THEN RAISE(ABORT, 'no; never') END;
END;
INSERT INTO members (id, role, full_name) VALUES ('m1', 'member', 'Ann');
`

describe('the existing migrations split exactly as before', () => {
  // The 52 files that existed when the splitter changed (step 6). Later
  // files are checked by count below.
  const files = migrationFiles().filter((f) => f < '0052')

  it('covers all 52 migration files, the count table included', () => {
    expect(files).toHaveLength(52)
    expect(files.map(keyOf).sort()).toEqual(Object.keys(COUNTS).sort())
  })

  it.each(files)('%s keeps its statement count', (file) => {
    expect(splitSql(read(file))).toHaveLength(COUNTS[keyOf(file)])
  })

  it.each(files)('%s gives the same statements as the old splitter', (file) => {
    expect(splitSql(read(file))).toEqual(legacySplitSql(read(file)))
  })
})

describe('migrations written after the splitter changed', () => {
  it('splits 0052 into its 11 statements and 0053 into 6, each trigger whole', () => {
    expect(splitSql(read('0052_sections_schedules.sql'))).toHaveLength(11)
    const backfill = splitSql(read('0053_sections_schedules_backfill.sql'))
    expect(backfill).toHaveLength(6)
    const triggers = backfill.filter((st) => /^CREATE TRIGGER\b/i.test(st))
    expect(triggers).toHaveLength(4)
    for (const t of triggers) expect(t).toMatch(/\bEND$/)
  })
})

describe('triggers and blocks', () => {
  it('keeps a trigger whose body holds CASE ... END; as one statement', () => {
    const parts = splitSql(CASE_TRIGGER)
    expect(parts).toHaveLength(2)
    expect(parts[0]).toMatch(/^CREATE TRIGGER members_role_label/)
    expect(parts[0]).toMatch(/END;\s*SELECT CASE[\s\S]*END;\s*END$/)
    expect(parts[1]).toMatch(/^INSERT INTO members/)
  })

  it('is the case the old splitter got wrong', () => {
    expect(legacySplitSql(CASE_TRIGGER).length).toBeGreaterThan(2)
  })

  it('produces statements SQLite runs, and the trigger works', () => {
    const db = new DatabaseSync(':memory:')
    db.exec('CREATE TABLE members (id TEXT PRIMARY KEY, role TEXT, full_name TEXT)')
    for (const stmt of splitSql(CASE_TRIGGER)) db.exec(stmt)
    db.exec(`UPDATE members SET role = 'lca_admin' WHERE id = 'm1'`)
    expect(db.prepare(`SELECT full_name FROM members WHERE id = 'm1'`).get()).toEqual({ full_name: 'Ann (admin; staff)' })
    expect(() => db.exec(`UPDATE members SET role = 'bad' WHERE id = 'm1'`)).toThrow(/no; never/)
    db.close()
  })

  it('handles nested CASE inside a trigger and the trigger kinds SQLite allows', () => {
    const sql = `CREATE TEMP TRIGGER t1 BEFORE INSERT ON x BEGIN
      SELECT CASE WHEN NEW.a = 1 THEN CASE WHEN NEW.b = 2 THEN 'x' END ELSE 'y' END;
      SELECT 1;
    END;
    CREATE TRIGGER IF NOT EXISTS t2 AFTER DELETE ON x BEGIN DELETE FROM y; END;
    SELECT 2;`
    const parts = splitSql(sql)
    expect(parts).toHaveLength(3)
    expect(parts[0]).toMatch(/SELECT 1;\s*END$/)
    expect(parts[1]).toBe('CREATE TRIGGER IF NOT EXISTS t2 AFTER DELETE ON x BEGIN DELETE FROM y; END')
  })

  it('reads CASE outside a trigger without holding the statement open', () => {
    const sql = "INSERT INTO a SELECT CASE WHEN role = 'admin' THEN 'lca_admin' ELSE role END FROM b; SELECT 1;"
    expect(splitSql(sql)).toEqual(["INSERT INTO a SELECT CASE WHEN role = 'admin' THEN 'lca_admin' ELSE role END FROM b", 'SELECT 1'])
  })

  it('does not treat BEGIN outside a trigger as a block', () => {
    expect(splitSql('BEGIN TRANSACTION; SELECT 1; COMMIT;')).toEqual(['BEGIN TRANSACTION', 'SELECT 1', 'COMMIT'])
  })

  it('only reads whole words: end_date, cases and legend are not END or CASE', () => {
    const sql = `CREATE TRIGGER t AFTER INSERT ON e BEGIN UPDATE e SET end_date = NEW.cases, legend = 1; END; SELECT 3;`
    const parts = splitSql(sql)
    expect(parts).toHaveLength(2)
    expect(parts[1]).toBe('SELECT 3')
  })
})

describe('strings, identifiers and comments', () => {
  it("keeps semicolons and keywords inside 'strings' (with '' escapes)", () => {
    expect(splitSql("INSERT INTO t VALUES ('a; it''s CASE; END;'); SELECT 1;")).toEqual([
      "INSERT INTO t VALUES ('a; it''s CASE; END;')",
      'SELECT 1',
    ])
  })

  it('keeps semicolons and keywords inside "double quoted" and `backtick` identifiers', () => {
    expect(splitSql('CREATE TABLE `odd;case` ("end;" text); SELECT "a""b;";')).toEqual([
      'CREATE TABLE `odd;case` ("end;" text)',
      'SELECT "a""b;"',
    ])
  })

  it("strips -- comments, drizzle-kit's statement breakpoints included", () => {
    const sql = "CREATE TABLE `a` (`x` text);--> statement-breakpoint\n-- note; with CASE\nCREATE INDEX `i` ON `a` (`x`);"
    expect(splitSql(sql)).toEqual(['CREATE TABLE `a` (`x` text)', 'CREATE INDEX `i` ON `a` (`x`)'])
  })

  it('drops PRAGMA statements and keeps a last statement with no semicolon', () => {
    expect(splitSql('PRAGMA foreign_keys=OFF;\nSELECT 1;\nPRAGMA foreign_keys = ON;\nSELECT 2')).toEqual(['SELECT 1', 'SELECT 2'])
  })
})
