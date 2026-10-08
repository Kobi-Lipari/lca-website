// test/unit/split-sql-edges.test.ts
//
// More of the splitter in test/shared/splitSql.ts, beyond split-sql.test.ts:
// the edges of trigger and CASE depth tracking, line endings, and properties
// of the real migrations (the two members role triggers stay whole; splitting
// is stable when statements are joined and split again, and when the files
// are put end to end).
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { splitSql } from '../shared/splitSql'
import { MIGRATIONS_DIR, migrationFiles } from './helpers/sqlite'

const read = (file: string) => readFileSync(join(MIGRATIONS_DIR, file), 'utf8')

describe('depth tracking edges', () => {
  it('keeps a CASE trigger whole with Windows line endings', () => {
    const sql = [
      'CREATE TRIGGER t AFTER UPDATE ON members BEGIN',
      "  SELECT CASE WHEN NEW.role = 'x' THEN RAISE(ABORT, 'bad') END;",
      'END;',
      'SELECT 1;',
    ].join('\r\n')
    const parts = splitSql(sql)
    expect(parts).toHaveLength(2)
    expect(parts[0]).toMatch(/^CREATE TRIGGER t[\s\S]*END;\s*END$/)
  })

  it('reads a CASE inside the WHEN clause before BEGIN', () => {
    const sql = `CREATE TRIGGER t BEFORE UPDATE ON members
      WHEN (CASE WHEN NEW.role = 'a' THEN 1 ELSE 0 END) = 1
      BEGIN SELECT RAISE(ABORT, 'no'); END;
      SELECT 2;`
    const parts = splitSql(sql)
    expect(parts).toHaveLength(2)
    expect(parts[0]).toMatch(/RAISE\(ABORT, 'no'\); END$/)
    expect(parts[1]).toBe('SELECT 2')
  })

  it('reads lower-case keywords', () => {
    const sql = "create trigger t after insert on x begin select case when 1 then 2 end; select 3; end; select 4;"
    expect(splitSql(sql)).toEqual([
      'create trigger t after insert on x begin select case when 1 then 2 end; select 3; end',
      'select 4',
    ])
  })

  it('is not fooled by END, BEGIN or CASE inside comments or strings in a trigger body', () => {
    const sql = `CREATE TRIGGER t AFTER INSERT ON x BEGIN
      -- END; of the story, BEGIN again, CASE closed
      INSERT INTO log(msg) VALUES ('--not a comment; END; BEGIN');
      INSERT INTO log(msg) VALUES ('a ''quoted'' END;');
    END;
    SELECT 5;`
    const parts = splitSql(sql)
    expect(parts).toHaveLength(2)
    expect(parts[0]).toContain("'--not a comment; END; BEGIN'")
    expect(parts[0]).toContain("'a ''quoted'' END;'")
    expect(parts[1]).toBe('SELECT 5')
  })

  it('does not carry trigger depth into the next statement', () => {
    const parts = splitSql('CREATE TRIGGER t AFTER INSERT ON x BEGIN SELECT 1; END; BEGIN TRANSACTION; SELECT 2; COMMIT;')
    expect(parts).toEqual(['CREATE TRIGGER t AFTER INSERT ON x BEGIN SELECT 1; END', 'BEGIN TRANSACTION', 'SELECT 2', 'COMMIT'])
  })

  it('does not read a trigger name or column that merely contains a keyword', () => {
    const sql = 'CREATE TRIGGER end_case_begin AFTER INSERT ON x BEGIN UPDATE x SET begin_at = 1, end_at = 2; END; SELECT 1;'
    expect(splitSql(sql)).toHaveLength(2)
  })

  it('does not go below depth 0 on a stray END', () => {
    expect(splitSql('SELECT 1 AS "end"; SELECT 2;')).toEqual(['SELECT 1 AS "end"', 'SELECT 2'])
    expect(splitSql('SELECT END; SELECT 2;')).toEqual(['SELECT END', 'SELECT 2'])
  })

  it('keeps a trigger with no final semicolon as one statement', () => {
    const parts = splitSql('SELECT 1;\nCREATE TRIGGER t AFTER INSERT ON x BEGIN SELECT 2; END')
    expect(parts).toEqual(['SELECT 1', 'CREATE TRIGGER t AFTER INSERT ON x BEGIN SELECT 2; END'])
  })

  it('splits two triggers in a row', () => {
    const sql = `CREATE TRIGGER a AFTER INSERT ON x BEGIN SELECT CASE WHEN 1 THEN 1 END; END;
                 CREATE TRIGGER b AFTER DELETE ON x BEGIN SELECT CASE WHEN 1 THEN 1 END; END;`
    const parts = splitSql(sql)
    expect(parts).toHaveLength(2)
    expect(parts.map((p) => p.slice(0, 16))).toEqual(['CREATE TRIGGER a', 'CREATE TRIGGER b'])
  })
})

describe('the real migrations', () => {
  const files = migrationFiles()

  it('keeps each members role trigger and each 0053 sections trigger as one statement that SQLite accepts', () => {
    const triggers = files.flatMap((f) => splitSql(read(f)).filter((s) => /^CREATE\s+TRIGGER\b/i.test(s)).map((s) => ({ f, s })))
    expect(triggers.map((t) => t.s.match(/TRIGGER\s+(?:IF NOT EXISTS\s+)?(\w+)/i)?.[1]).sort())
      .toEqual([
        'members_role_insert', 'members_role_insert', 'members_role_update', 'members_role_update',
        'registrations_fill_section_insert', 'registrations_fill_section_update',
        'tournaments_sections_sync_insert', 'tournaments_sections_sync_update',
      ])
    for (const { s } of triggers) expect(s).toMatch(/\bEND$/i)
  })

  it('gives the same statements when they are joined with semicolons and split again', () => {
    for (const f of files) {
      const once = splitSql(read(f))
      expect(splitSql(once.map((s) => `${s};`).join('\n')), f).toEqual(once)
    }
  })

  it('gives the same statements for the files put end to end as for each file alone', () => {
    const alone = files.flatMap((f) => splitSql(read(f)))
    const together = splitSql(files.map((f) => `${read(f).trimEnd()}\n`).join('\n'))
    expect(together).toEqual(alone)
  })

  it('runs every statement on SQLite', () => {
    const db = new DatabaseSync(':memory:')
    db.exec('PRAGMA foreign_keys = ON')
    for (const f of files) for (const s of splitSql(read(f))) db.exec(s)
    expect((db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'trigger'").get() as { n: number }).n).toBe(6)
    db.close()
  })
})
