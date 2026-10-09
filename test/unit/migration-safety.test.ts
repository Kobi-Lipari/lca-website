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
//
// It reads hand-written SQL and what drizzle-kit writes (npm run
// db:generate): names bare, in backticks or in double quotes, an ON UPDATE
// clause before ON DELETE, and ALTER TABLE ... ADD with or without COLUMN.
// test/unit/fixtures/drizzle-sql/ holds real drizzle-kit output to prove it.
import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const DIR = join(__dirname, '../../migrations')
const FIXTURES = join(__dirname, 'fixtures/drizzle-sql')
const stripComments = (text: string) => text.replace(/--[^\n]*/g, '')

export interface Source { file: string; text: string }

/** The migrations in the order they are applied, comments removed. */
export function migrationSources(): Source[] {
  return readdirSync(DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((file) => ({ file, text: stripComments(readFileSync(join(DIR, file), 'utf8')) }))
}

/** One drizzle-kit fixture, comments removed. */
export function fixture(file: string): Source {
  return { file, text: stripComments(readFileSync(join(FIXTURES, file), 'utf8')) }
}

// A table name: bare, `backticked`, "double quoted" or [bracketed].
const NAME = '(?:`([^`]+)`|"([^"]+)"|\\[([^\\]]+)\\]|(\\w+))'
const nameOf = (m: RegExpMatchArray, first: number) => m[first] ?? m[first + 1] ?? m[first + 2] ?? m[first + 3]
const ACTION = '(?:CASCADE|SET NULL|SET DEFAULT|RESTRICT|NO ACTION)'
// REFERENCES parent(cols) [ON UPDATE action] ON DELETE CASCADE|SET NULL
const REFERENCE = `REFERENCES\\s+${NAME}\\s*\\([^)]*\\)(?:\\s*ON UPDATE\\s+${ACTION})?\\s*ON DELETE (CASCADE|SET NULL)`

/** The table written in any of the quoting styles, for the restore checks. */
const named = (table: string) => {
  const t = table.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return `(?:\`${t}\`|"${t}"|\\[${t}\\]|\\b${t}\\b)`
}

interface Link { child: string; parent: string; action: 'CASCADE' | 'SET NULL'; since: number }

/** Every foreign key with a delete action, across the given files in order. */
export function links(sources: Source[] = migrationSources()): Link[] {
  const out: Link[] = []
  sources.forEach(({ text }, since) => {
    for (const m of text.matchAll(new RegExp(`CREATE TABLE(?: IF NOT EXISTS)?\\s+${NAME}\\s*\\(([\\s\\S]*?)\\n\\);`, 'gi'))) {
      const child = nameOf(m, 1)
      for (const fk of m[5].matchAll(new RegExp(REFERENCE, 'gi'))) {
        out.push({ child, parent: nameOf(fk, 1), action: fk[5].toUpperCase() as Link['action'], since })
      }
    }
    for (const m of text.matchAll(new RegExp(`ALTER TABLE\\s+${NAME}\\s+ADD(?:\\s+COLUMN)?\\s[^;]*?${REFERENCE}`, 'gi'))) {
      out.push({ child: nameOf(m, 1), parent: nameOf(m, 5), action: m[9].toUpperCase() as Link['action'], since })
    }
  })
  return out
}

/** Migrations that drop a parent table without restoring its children. */
export function unsafeMigrations(sources: Source[] = migrationSources()): Array<{ file: string; parent: string; lost: string[] }> {
  const all = links(sources)
  const found: Array<{ file: string; parent: string; lost: string[] }> = []
  sources.forEach(({ file, text }, index) => {
    for (const m of text.matchAll(new RegExp(`DROP TABLE(?: IF EXISTS)?\\s+${NAME}`, 'gi'))) {
      const parent = nameOf(m, 1)
      // Only tables that existed by then can lose rows.
      const children = all.filter((l) => l.parent === parent && l.child !== parent && l.since < index)
      const lost = [...new Set(children
        .filter((l) => {
          const restored = l.action === 'CASCADE'
            ? new RegExp(`INSERT INTO\\s+${named(l.child)}`, 'i').test(text)
            : new RegExp(`UPDATE\\s+${named(l.child)}`, 'i').test(text)
          // Dropping the child table itself in the same file is a rebuild of it, not a loss.
          const childDropped = new RegExp(`DROP TABLE(?: IF EXISTS)?\\s+${named(l.child)}`, 'i').test(text)
          return !restored && !childDropped
        })
        .map((l) => l.child))]
      if (lost.length) found.push({ file, parent, lost })
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

  it('reports exactly what it reported before it learned drizzle-kit quoting', () => {
    const lost = ['tournament_directors', 'tournament_reminders', 'tournament_attendee_reminders', 'support_tickets']
    expect(unsafeMigrations()).toEqual([
      { file: '0019_widen_checks.sql', parent: 'members', lost },
      { file: '0033_lca_auditor_role.sql', parent: 'members', lost: [...lost, 'board_seat_assignments'] },
      { file: '0040_lca_observer_role.sql', parent: 'members', lost: [...lost, 'board_seat_assignments'] },
    ])
    expect(links()).toHaveLength(17)
  })

  it('lists the sections and schedules tables of 0052 as cascade children', () => {
    const file = migrationSources().findIndex((s) => s.file === '0052_sections_schedules.sql')
    expect(file).toBeGreaterThan(-1)
    const added = links().filter((l) => l.since === file).map(({ child, parent, action }) => ({ child, parent, action }))
    expect(added).toEqual(expect.arrayContaining([
      { child: 'tournament_sections', parent: 'tournaments', action: 'CASCADE' },
      { child: 'tournament_schedules', parent: 'tournaments', action: 'CASCADE' },
      { child: 'tournament_schedule_rounds', parent: 'tournament_schedules', action: 'CASCADE' },
    ]))
    expect(added).toHaveLength(3)
    // registrations.section_id and schedule_id have no delete action, so they add no link.
    expect(links().filter((l) => l.child === 'registrations')).toEqual([])
  })

  it('would flag a later rebuild of tournaments for the new children too', () => {
    const rebuild = { file: '0099_bad_rebuild.sql', text: 'DROP TABLE tournaments;' }
    const flagged = unsafeMigrations([...migrationSources(), rebuild]).filter((u) => u.file === rebuild.file)
    expect(flagged[0].lost).toEqual(expect.arrayContaining(['tournament_sections', 'tournament_schedules']))
  })
})

describe('drizzle-kit output (test/unit/fixtures/drizzle-sql)', () => {
  const createTable = fixture('create-table-fk.sql')
  const alterAdd = fixture('alter-add-fk.sql')
  const dropParent = fixture('drop-quoted-parent.sql')

  it('the fixtures are drizzle-kit style: backticks, ON UPDATE before ON DELETE, ADD without COLUMN', () => {
    expect(createTable.text).toMatch(/CREATE TABLE `tournament_notes`/)
    expect(createTable.text).toMatch(/REFERENCES `tournaments`\(`id`\) ON UPDATE no action ON DELETE cascade/)
    expect(alterAdd.text).toMatch(/ALTER TABLE `clubs` ADD `featured_tournament_id`/)
    expect(alterAdd.text).not.toMatch(/ADD COLUMN/i)
    expect(dropParent.text).toMatch(/DROP TABLE `tournaments`;/)
  })

  it('reads a quoted cascade with ON UPDATE no action ON DELETE cascade in CREATE TABLE', () => {
    expect(links([createTable])).toEqual([{ child: 'tournament_notes', parent: 'tournaments', action: 'CASCADE', since: 0 }])
  })

  it('reads ALTER TABLE `x` ADD `col` ... REFERENCES ... ON DELETE cascade without COLUMN', () => {
    expect(links([alterAdd])).toEqual([{ child: 'clubs', parent: 'tournaments', action: 'CASCADE', since: 0 }])
  })

  it('reads ON UPDATE before ON DELETE in ALTER TABLE too', () => {
    const text = 'ALTER TABLE "clubs" ADD COLUMN "x" text REFERENCES "tournaments"("id") ON UPDATE cascade ON DELETE set null;'
    expect(links([{ file: 'x.sql', text }])).toEqual([{ child: 'clubs', parent: 'tournaments', action: 'SET NULL', since: 0 }])
  })

  it('flags a DROP of a quoted parent after a drizzle-kit table cascades from it', () => {
    expect(unsafeMigrations([createTable, dropParent])).toEqual([
      { file: 'drop-quoted-parent.sql', parent: 'tournaments', lost: ['tournament_notes'] },
    ])
    expect(unsafeMigrations([alterAdd, dropParent])).toEqual([
      { file: 'drop-quoted-parent.sql', parent: 'tournaments', lost: ['clubs'] },
    ])
  })

  it('flags the drizzle-kit rebuild of tournaments against the real migrations', () => {
    const found = unsafeMigrations([...migrationSources(), dropParent]).filter((u) => u.file === 'drop-quoted-parent.sql')
    expect(found).toHaveLength(1)
    expect(found[0].parent).toBe('tournaments')
    expect(found[0].lost).toEqual(expect.arrayContaining([
      'tournament_directors', 'tournament_reminders', 'tournament_attendee_reminders', 'tournament_games', 'state_champions',
    ]))
  })

  it('accepts a quoted restore: rows put back with INSERT INTO `child` or UPDATE "child"', () => {
    const restoreCascade = { file: 'r.sql', text: `${dropParent.text}\nINSERT INTO \`tournament_notes\` SELECT * FROM keep_notes;` }
    expect(unsafeMigrations([createTable, restoreCascade])).toEqual([])
    const setNull = { file: 's.sql', text: 'CREATE TABLE "notes" (\n  "t" text REFERENCES "tournaments"("id") ON UPDATE no action ON DELETE set null\n);' }
    const restoreSetNull = { file: 'u.sql', text: `${dropParent.text}\nUPDATE "notes" SET t = (SELECT t FROM keep_notes WHERE keep_notes.rowid = notes.rowid);` }
    expect(unsafeMigrations([setNull, dropParent])).toEqual([{ file: 'drop-quoted-parent.sql', parent: 'tournaments', lost: ['notes'] }])
    expect(unsafeMigrations([setNull, restoreSetNull])).toEqual([])
  })

  it('treats dropping the quoted child in the same file as a rebuild of it, not a loss', () => {
    const both = { file: 'b.sql', text: `${dropParent.text}\nDROP TABLE \`tournament_notes\`;` }
    expect(unsafeMigrations([createTable, both])).toEqual([])
  })
})

// ---- More quoting styles and rebuild patterns, on small made-up sources ----

const src = (file: string, text: string): Source => ({ file, text })

const PARENT = src('0001.sql', 'CREATE TABLE parents (id TEXT PRIMARY KEY);')
const child = (quote: (n: string) => string, action = 'CASCADE') => src(
  '0002.sql',
  `CREATE TABLE ${quote('kids')} (\n  id TEXT PRIMARY KEY,\n  parent_id TEXT REFERENCES ${quote('parents')}(id) ON DELETE ${action}\n);`,
)
const bare = (n: string) => n
const tick = (n: string) => `\`${n}\``
const dq = (n: string) => `"${n}"`

describe('a drop of the parent is flagged whichever way the names are quoted', () => {
  for (const [label, q] of [['bare', bare], ['backtick', tick], ['double quote', dq]] as const) {
    it(`CREATE TABLE ${label} then DROP TABLE ${label}`, () => {
      const drop = src('0003.sql', `DROP TABLE ${q('parents')};`)
      expect(unsafeMigrations([PARENT, child(q), drop])).toEqual([{ file: '0003.sql', parent: 'parents', lost: ['kids'] }])
    })

    it(`${label} SET NULL needs an UPDATE to be restored`, () => {
      const drop = src('0003.sql', `DROP TABLE ${q('parents')};`)
      const restored = src('0004.sql', `DROP TABLE ${q('parents')}; UPDATE ${q('kids')} SET parent_id = 'x';`)
      expect(unsafeMigrations([PARENT, child(q, 'SET NULL'), drop])).toHaveLength(1)
      expect(unsafeMigrations([PARENT, child(q, 'SET NULL'), restored])).toEqual([])
    })
  }

  it('DROP TABLE IF EXISTS and lower-case SQL', () => {
    const lower = src('0002.sql', 'create table kids (id text primary key, parent_id text references parents(id) on delete cascade\n);')
    const drop = src('0003.sql', 'drop table if exists parents;')
    expect(unsafeMigrations([PARENT, lower, drop])).toEqual([{ file: '0003.sql', parent: 'parents', lost: ['kids'] }])
  })

  it('a [bracketed] name', () => {
    const k = src('0002.sql', 'CREATE TABLE [kids] (\n  parent_id TEXT REFERENCES [parents]([id]) ON UPDATE CASCADE ON DELETE CASCADE\n);')
    expect(links([PARENT, k]).map((l) => [l.child, l.parent, l.action])).toEqual([['kids', 'parents', 'CASCADE']])
    expect(unsafeMigrations([PARENT, k, src('0003.sql', 'DROP TABLE [parents];')])).toHaveLength(1)
  })
})

describe('the rebuild patterns', () => {
  const k = child(tick)

  it('accepts a restore with INSERT INTO in any quoting', () => {
    for (const q of [bare, tick, dq]) {
      const rebuild = src('0003.sql', `DROP TABLE ${q('parents')}; INSERT INTO ${q('kids')} SELECT * FROM saved_kids;`)
      expect(unsafeMigrations([PARENT, k, rebuild]), q('kids')).toEqual([])
    }
  })

  it('does not accept a restore of a different table whose name starts the same way', () => {
    const rebuild = src('0003.sql', 'DROP TABLE parents; INSERT INTO kids_archive SELECT * FROM saved_kids;')
    expect(unsafeMigrations([PARENT, k, rebuild])).toEqual([{ file: '0003.sql', parent: 'parents', lost: ['kids'] }])
  })

  it('does not flag a drop of a table nothing cascades from', () => {
    expect(unsafeMigrations([PARENT, k, src('0003.sql', 'DROP TABLE kids;')])).toEqual([])
  })

  it('does not flag a drop of a table that was created in the same or a later file', () => {
    expect(unsafeMigrations([src('0001.sql', 'CREATE TABLE parents (id TEXT);'), src('0002.sql', 'DROP TABLE parents;'), k])).toEqual([])
  })

  it('does not flag NO ACTION or RESTRICT references', () => {
    const plain = src('0002.sql', 'CREATE TABLE kids (\n  parent_id TEXT REFERENCES parents(id) ON DELETE NO ACTION\n);')
    expect(links([PARENT, plain])).toEqual([])
    expect(unsafeMigrations([PARENT, plain, src('0003.sql', 'DROP TABLE parents;')])).toEqual([])
  })

  it('flags a new migration that rebuilds members the 0040 way', () => {
    const rebuild = { file: '0052_bad_rebuild.sql', text: 'CREATE TABLE members_new (id TEXT);\nDROP TABLE members;\nALTER TABLE members_new RENAME TO members;' }
    const flagged = unsafeMigrations([...migrationSources(), rebuild]).filter((u) => u.file === rebuild.file)
    expect(flagged).toHaveLength(1)
    expect(flagged[0].parent).toBe('members')
    expect(flagged[0].lost).toEqual(expect.arrayContaining(['tournament_directors', 'board_seat_assignments']))
  })
})
